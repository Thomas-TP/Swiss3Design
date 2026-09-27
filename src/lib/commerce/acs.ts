import type Stripe from "stripe";
import type { getDb } from "@/db";
import { deliveryDays, shippingFor } from "@/lib/shipping";
import { type SellableSku, loadSellableSkus, skuIndex } from "./catalog";
import {
  type PaidAgentOrder,
  isOrderLocale,
  localeFromNpa,
  recordPaidAgentOrder,
  toShippingAddress,
} from "./agent-orders";
import { availabilityOf, SHIPPING_SERVICE, type ShippingRule } from "./feed";
import { pushCatalogChange } from "./stripe-catalog";

type Db = Awaited<ReturnType<typeof getDb>>;

// Stripe Agentic Commerce Suite (ACS) : Stripe expose notre catalogue aux
// agents IA partenaires (ChatGPT & co.), mène le checkout et encaisse. De
// notre côté : (1) des « hooks » appelés pendant le checkout — validation de
// la commande avant paiement, frais de port, prix/stock en temps réel — et
// (2) la création de la commande à réception de `checkout.session.completed`
// pour une session que nous n'avons pas créée.
// https://docs.stripe.com/agentic-commerce/for-sellers (+ /manage)

// Champs en préversion (SKU du flux, agent) absents des types du SDK GA.
export const ACS_API_VERSION = "2026-08-26.preview";

type PreviewPrice = Stripe.Price & { external_reference?: string | null };
type PreviewPaymentIntent = Stripe.PaymentIntent & {
  agent_details?: { name?: string | null } | null;
};

export function externalReference(
  price: Stripe.Price | null | undefined,
): string | null {
  const ref = (price as PreviewPrice | null | undefined)?.external_reference;
  return typeof ref === "string" && ref.trim() ? ref.trim() : null;
}

function agentName(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  const fromIntent =
    pi && typeof pi === "object"
      ? (pi as PreviewPaymentIntent).agent_details?.name
      : null;
  const name = fromIntent ?? session.metadata?.agent ?? null;
  return name ? String(name).slice(0, 80) : null;
}

// Session ACS → commande (fonction pure, testée). `null` : ce n'est pas une
// vente par agent (aucune ligne ne porte de SKU de notre flux), par exemple
// un lien de paiement créé à la main dans le dashboard.
export function agenticOrderDraft(
  session: Stripe.Checkout.Session,
  skus: Map<string, SellableSku>,
): PaidAgentOrder | null {
  const items = session.line_items?.data ?? [];
  const refs = items.map((item) => externalReference(item.price));
  if (!items.length || refs.every((ref) => !ref)) return null;
  if (session.currency !== "chf")
    throw new Error(`agentic_currency_unsupported:${session.currency}`);

  const notes: string[] = [];
  const lines = items.map((item, index) => {
    const ref = refs[index] ?? "";
    const sku = ref ? (skus.get(ref) ?? null) : null;
    if (!sku)
      notes.push(
        `Article inconnu du catalogue (SKU « ${ref || "absent"} », « ${item.description ?? ""} ») : vérifier la commande dans Stripe.`,
      );
    const quantity = item.quantity ?? 1;
    const unitCents =
      item.price?.unit_amount ?? Math.round(item.amount_subtotal / quantity);
    return {
      sku,
      skuId: ref,
      name: sku?.lineName ?? item.description ?? "Article",
      colorName: sku?.colorName ?? null,
      colorHex: sku?.colorHex ?? null,
      unitCents,
      quantity,
    };
  });

  const linesTotal = lines.reduce((s, l) => s + l.unitCents * l.quantity, 0);
  const shippingCents =
    session.total_details?.amount_shipping ??
    session.shipping_cost?.amount_total ??
    0;
  const tax = session.total_details?.amount_tax ?? 0;
  const totalCents = session.amount_total ?? 0;
  // La contrainte orders_amounts_valid impose total = sous-total + port −
  // remise : le sous-total se déduit de ce que Stripe a réellement encaissé.
  let discountCents = session.total_details?.amount_discount ?? 0;
  let subtotalCents = totalCents - shippingCents + discountCents;
  if (subtotalCents < 0 || discountCents > subtotalCents) {
    subtotalCents = Math.max(0, totalCents - shippingCents);
    discountCents = 0;
  }
  if (subtotalCents !== linesTotal || tax > 0)
    notes.push(
      `Montants Stripe à vérifier : articles ${linesTotal / 100} CHF, encaissé ${totalCents / 100} CHF (port ${shippingCents / 100}, remise ${discountCents / 100}, taxe ${tax / 100}).`,
    );

  const shipping = session.collected_information?.shipping_details;
  const address = toShippingAddress(
    shipping?.name ?? session.customer_details?.name,
    shipping?.address ?? session.customer_details?.address,
  );
  if (address.country !== "CH")
    notes.push(
      `Adresse de livraison hors de Suisse (${address.country || "pays inconnu"}) : ne pas expédier, rembourser le client.`,
    );
  let email = (
    session.customer_details?.email ??
    session.customer_email ??
    ""
  ).toLowerCase();
  if (!email) {
    notes.push("E-mail de l'acheteur absent : le retrouver dans Stripe.");
    email = "contact@swiss3design.ch";
  }
  const paymentIntent = session.payment_intent;
  return {
    channel: "stripe_acs",
    agentName: agentName(session),
    email,
    locale: isOrderLocale(session.locale)
      ? session.locale
      : localeFromNpa(address.npa),
    address,
    lines,
    subtotalCents,
    shippingCents,
    discountCents,
    totalCents,
    paymentIntentId:
      typeof paymentIntent === "string"
        ? paymentIntent
        : (paymentIntent?.id ?? null),
    checkoutSessionId: session.id,
    notes,
  };
}

// Webhook : session payée sans commande liée → vente par agent ? On relit la
// session avec ses lignes (SKU) et le paiement, puis on crée la commande.
export async function fulfillAgenticCheckout(
  db: Db,
  stripe: Stripe,
  sessionId: string,
): Promise<boolean> {
  const session = await stripe.checkout.sessions.retrieve(
    sessionId,
    {
      expand: ["line_items.data.price.product", "payment_intent.latest_charge"],
    },
    { apiVersion: ACS_API_VERSION },
  );
  if (session.payment_status !== "paid") return false;
  const draft = agenticOrderDraft(
    session,
    skuIndex(await loadSellableSkus(db)),
  );
  if (!draft) return false;
  const { created } = await recordPaidAgentOrder(db, draft);
  // Stock vendu : l'agent doit le voir sans attendre le prochain cron.
  if (created) await pushCatalogChange(db, "stock");
  return true;
}

// ── Hooks de checkout (appelés par Stripe, réponse attendue en < 4 s) ────────

interface HookLine {
  sku_id: string;
  unit_amount: number;
  amount_discount?: number;
  quantity: number;
}

interface HookAddress {
  country?: string | null;
}

export interface FinalizeCheckoutData {
  currency: string;
  amount_total?: number;
  line_item_details?: HookLine[];
  shipping_details?: { address?: HookAddress | null } | null;
  total_details?: {
    amount_discount?: number;
    amount_shipping?: number;
    amount_tax?: number;
  } | null;
}

export type Decision = { approved: true } | { approved: false; reason: string };

// Validation avant paiement : on n'accepte que ce que la boutique peut
// réellement honorer, au prix du site (sinon Stripe annule le paiement).
export function decideFinalize(
  data: FinalizeCheckoutData,
  skus: Map<string, SellableSku>,
  rule: ShippingRule,
): Decision {
  if (data.currency?.toLowerCase() !== "chf")
    return { approved: false, reason: "Prices are in CHF only." };
  const country = data.shipping_details?.address?.country?.toUpperCase();
  if (country !== "CH")
    return {
      approved: false,
      reason: country
        ? "Swiss3Design ships to Switzerland only."
        : "A Swiss shipping address is required.",
    };
  const lines = data.line_item_details ?? [];
  if (!lines.length) return { approved: false, reason: "Empty cart." };
  const demand = new Map<string, { sku: SellableSku; quantity: number }>();
  let subtotal = 0;
  for (const line of lines) {
    const sku = skus.get(line.sku_id);
    if (!sku)
      return {
        approved: false,
        reason: `Product ${line.sku_id} is no longer available.`,
      };
    if (!Number.isInteger(line.quantity) || line.quantity < 1)
      return { approved: false, reason: "Invalid quantity." };
    if (line.unit_amount !== sku.priceCents)
      return {
        approved: false,
        reason: `The price of ${sku.title} has changed.`,
      };
    if ((line.amount_discount ?? 0) > 0)
      return { approved: false, reason: "Unknown discount." };
    subtotal += line.unit_amount * line.quantity;
    const bucket = demand.get(sku.stockKey);
    demand.set(sku.stockKey, {
      sku,
      quantity: (bucket?.quantity ?? 0) + line.quantity,
    });
  }
  for (const { sku, quantity } of demand.values())
    if (sku.stock != null && sku.stock < quantity)
      return { approved: false, reason: `${sku.title} is out of stock.` };
  const shipping = data.total_details?.amount_shipping;
  const expectedShipping = shippingFor(subtotal, {
    shippingCents: rule.shippingCents,
    freeOverCents: rule.freeOverCents,
  });
  if (shipping != null && shipping !== expectedShipping)
    return { approved: false, reason: "Shipping cost mismatch." };
  if ((data.total_details?.amount_discount ?? 0) > 0)
    return { approved: false, reason: "Unknown discount." };
  if (
    data.amount_total != null &&
    data.amount_total !== subtotal + (shipping ?? expectedShipping)
  )
    return { approved: false, reason: "Order total mismatch." };
  return { approved: true };
}

export interface CustomizeCheckoutData {
  currency: string;
  line_item_details?: HookLine[];
}

// Frais de port calculés comme au checkout web (tarif unique Poste suisse,
// offert dès le seuil) : Stripe affiche exactement ce que le site facturerait.
export function customizeShipping(
  data: CustomizeCheckoutData,
  skus: Map<string, SellableSku>,
  rule: ShippingRule,
) {
  const lines = data.line_item_details ?? [];
  const subtotal = lines.reduce(
    (sum, line) => sum + line.unit_amount * line.quantity,
    0,
  );
  const slowest = lines.reduce(
    (days, line) => {
      const sku = skus.get(line.sku_id);
      if (!sku) return days;
      const d = deliveryDays(sku);
      return { min: Math.max(days.min, d.min), max: Math.max(days.max, d.max) };
    },
    { min: 2, max: 6 },
  );
  return {
    shipping_options: [
      {
        shipping_rate_data: {
          display_name: SHIPPING_SERVICE,
          fixed_amount: {
            amount: shippingFor(subtotal, {
              shippingCents: rule.shippingCents,
              freeOverCents: rule.freeOverCents,
            }),
            currency: "chf",
          },
          tax_behavior: "inclusive",
          delivery_estimate: {
            minimum: { unit: "business_day", value: slowest.min },
            maximum: { unit: "business_day", value: slowest.max },
          },
        },
      },
    ],
  };
}

// Prix et disponibilité en temps réel d'un SKU (appelé avant le paiement et
// quand le stock est bas) — prioritaire sur les données du flux.
export function priceAvailability(
  skuId: string,
  merchantId: string,
  skus: Map<string, SellableSku>,
) {
  const sku = skus.get(skuId);
  if (!sku) return { sku_id: skuId, merchant_id: merchantId, deleted: true };
  const status = availabilityOf(sku);
  return {
    sku_id: skuId,
    merchant_id: merchantId,
    availability: {
      status,
      ...(sku.stock != null ? { quantity: Math.max(0, sku.stock) } : {}),
    },
    ...(status === "out_of_stock"
      ? {}
      : { price: { unit_amount: sku.priceCents, currency: "chf" } }),
    as_of: Math.floor(Date.now() / 1000),
  };
}

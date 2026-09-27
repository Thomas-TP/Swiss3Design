import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import type { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { uncached } from "@/db/fresh";
import { markOrderPaid } from "@/lib/orders";
import { makeOrderNumber } from "@/lib/order-number";
import { deliveryDays, shippingFor } from "@/lib/shipping";
import { recordStatusTransition } from "@/lib/status-history";
import { releaseOrderStock, reserveStock } from "@/lib/stock";
import { colorKey, type SellableSku } from "./catalog";
import {
  isUniqueViolation,
  type AgentChannel,
  type OrderLocale,
} from "./agent-orders";
import type { ShippingRule } from "./feed";

type Db = Awaited<ReturnType<typeof getDb>>;
type Order = typeof orders.$inferSelect;

// Cœur commun des achats par agents sur NOS API (MPP, ACP, UCP) : résolution
// des articles, devis (port et délai du site), adresse suisse, commande en
// attente avec stock réservé, puis paiement par Shared Payment Token Stripe.
// Contrairement à Stripe Agentic Commerce (déjà payé en arrivant), l'argent
// n'est pris qu'après la réservation : rien n'est encaissé sans stock.

// Version d'API des Shared Payment Tokens (préversion, cf. mppx).
export const SPT_API_VERSION = "2026-07-29.preview";
const RESERVATION_MS = 30 * 60 * 1000;
const MAX_QUANTITY = 99;

export type CheckoutErrorCode =
  | "invalid"
  | "missing"
  | "not_found"
  | "out_of_stock"
  | "region_restricted"
  | "quantity_exceeded"
  | "conflict"
  | "payment_declined"
  | "requires_action";

export class CheckoutError extends Error {
  constructor(
    readonly code: CheckoutErrorCode,
    message: string,
    readonly param?: string,
  ) {
    super(message);
  }
}

export interface LineRequest {
  sku?: string;
  slug?: string;
  variant?: string;
  color?: string;
  quantity?: number;
}

const same = (a: string | null | undefined, b: string) =>
  !!a && a.toLowerCase() === b.trim().toLowerCase();

// Une ligne demandée par un agent : par SKU du flux Stripe, ou par slug +
// variante + couleur (même logique que les liens panier du site).
export function resolveLine(
  request: LineRequest,
  skus: SellableSku[],
  index: Map<string, SellableSku>,
  param = "items",
): SellableSku {
  if (request.sku) {
    const sku = index.get(request.sku.trim());
    if (!sku)
      throw new CheckoutError(
        "not_found",
        `Unknown or unavailable product: ${request.sku}`,
        param,
      );
    return sku;
  }
  if (!request.slug)
    throw new CheckoutError(
      "missing",
      "Each item needs a sku or a slug",
      param,
    );
  let pool = skus.filter((s) => s.slug === request.slug!.trim());
  if (!pool.length)
    throw new CheckoutError(
      "not_found",
      `Unknown or unavailable product: ${request.slug}`,
      param,
    );
  const variants = [...new Set(pool.map((s) => s.variantName).filter(Boolean))];
  if (variants.length) {
    const wanted = request.variant;
    if (!wanted)
      throw new CheckoutError(
        "missing",
        `${pool[0].productName} requires a variant: ${variants.join(", ")}`,
        param,
      );
    pool = pool.filter(
      (s) =>
        same(s.variantName, wanted) ||
        s.variantId === wanted ||
        same(s.sku.split("--")[0], wanted),
    );
  }
  const colors = [...new Set(pool.map((s) => s.colorName).filter(Boolean))];
  if (colors.length) {
    const wanted = request.color;
    if (!wanted)
      throw new CheckoutError(
        "missing",
        `${pool[0]?.productName ?? request.slug} requires a colour: ${colors.join(", ")}`,
        param,
      );
    pool = pool.filter(
      (s) =>
        same(s.colorName, wanted) ||
        (s.colorName && colorKey(s.colorName) === colorKey(wanted)),
    );
  }
  if (pool.length !== 1)
    throw new CheckoutError(
      "invalid",
      `Unknown variant or colour for ${request.slug}`,
      param,
    );
  return pool[0];
}

export interface QuoteLine {
  sku: SellableSku;
  quantity: number;
  unitCents: number;
  totalCents: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  delivery: { min: number; max: number };
}

// Devis au prix du site : port forfaitaire offert dès le seuil, délai de la
// pièce la plus lente, stock vérifié par seau (couleurs d'une même fiche).
export function buildQuote(
  lines: { sku: SellableSku; quantity: number }[],
  rule: ShippingRule,
): Quote {
  if (!lines.length) throw new CheckoutError("missing", "Empty cart", "items");
  const demand = new Map<string, { sku: SellableSku; quantity: number }>();
  const quoted = lines.map(({ sku, quantity }, index) => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY)
      throw new CheckoutError(
        "quantity_exceeded",
        `Quantity must be between 1 and ${MAX_QUANTITY}`,
        `items[${index}].quantity`,
      );
    const bucket = demand.get(sku.stockKey);
    demand.set(sku.stockKey, {
      sku,
      quantity: (bucket?.quantity ?? 0) + quantity,
    });
    return {
      sku,
      quantity,
      unitCents: sku.priceCents,
      totalCents: sku.priceCents * quantity,
    };
  });
  for (const { sku, quantity } of demand.values())
    if (sku.stock != null && sku.stock < quantity)
      throw new CheckoutError(
        "out_of_stock",
        sku.stock <= 0
          ? `${sku.title} is out of stock`
          : `Only ${sku.stock} left for ${sku.title}`,
        "items",
      );
  const subtotalCents = quoted.reduce((sum, l) => sum + l.totalCents, 0);
  const shippingCents = shippingFor(subtotalCents, {
    shippingCents: rule.shippingCents,
    freeOverCents: rule.freeOverCents,
  });
  const delivery = quoted.reduce(
    (days, line) => {
      const d = deliveryDays(line.sku);
      return { min: Math.max(days.min, d.min), max: Math.max(days.max, d.max) };
    },
    { min: 0, max: 0 },
  );
  return {
    lines: quoted,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    delivery,
  };
}

export interface SwissAddress {
  name: string;
  street: string;
  npa: string;
  city: string;
  canton: string;
  country: "CH";
}

export interface AddressInput {
  name?: string | null;
  street?: string | null;
  line2?: string | null;
  npa?: string | null;
  city?: string | null;
  canton?: string | null;
  country?: string | null;
}

// Livraison en Suisse uniquement (NPA à 4 chiffres), comme le checkout web.
export function swissAddress(
  input: AddressInput,
  param = "address",
): SwissAddress {
  const country = (input.country ?? "CH").trim().toUpperCase();
  if (country !== "CH")
    throw new CheckoutError(
      "region_restricted",
      "Swiss3Design ships to Switzerland only",
      `${param}.country`,
    );
  const clean = (value: string | null | undefined, max: number) =>
    (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const name = clean(input.name, 120);
  const street = [clean(input.street, 200), clean(input.line2, 100)]
    .filter(Boolean)
    .join(", ")
    .slice(0, 200);
  const npa = clean(input.npa, 10);
  const city = clean(input.city, 120);
  if (name.length < 2)
    throw new CheckoutError(
      "missing",
      "Recipient name is required",
      `${param}.name`,
    );
  if (street.length < 3)
    throw new CheckoutError(
      "missing",
      "Street address is required",
      `${param}.street`,
    );
  if (!/^\d{4}$/.test(npa))
    throw new CheckoutError(
      "invalid",
      "A Swiss postal code has 4 digits",
      `${param}.postal_code`,
    );
  if (city.length < 2)
    throw new CheckoutError("missing", "City is required", `${param}.city`);
  const canton = clean(input.canton, 2).toUpperCase();
  return {
    name,
    street,
    npa,
    city,
    canton: /^[A-Z]{2}$/.test(canton) ? canton : "",
    country: "CH",
  };
}

export function normalizeEmail(value: string | null | undefined): string {
  const email = (value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new CheckoutError(
      "invalid",
      "A valid email address is required",
      "email",
    );
  return email;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Empreinte d'une commande (articles, quantités, adresse, e-mail, total) :
// lie un paiement ou une clé d'idempotence à CETTE commande précise.
export async function orderFingerprint(input: {
  quote: Quote;
  address: SwissAddress;
  email: string;
}): Promise<string> {
  const canonical = JSON.stringify({
    items: input.quote.lines.map((l) => [l.sku.sku, l.quantity, l.unitCents]),
    total: input.quote.totalCents,
    address: input.address,
    email: input.email,
  });
  return (await sha256Hex(canonical)).slice(0, 32);
}

// Commande en attente, stock réservé 30 min — idempotente sur `attemptKey`
// (un agent qui rejoue la même requête retrouve la même commande).
export async function createPendingAgentOrder(
  db: Db,
  input: {
    quote: Quote;
    address: SwissAddress;
    email: string;
    locale: OrderLocale;
    channel: AgentChannel;
    agentName: string | null;
    attemptKey: string;
    customerId?: string | null;
  },
): Promise<Order> {
  const fingerprint = await orderFingerprint(input);
  const find = async () => {
    const [row] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.checkoutAttemptKey, input.attemptKey), uncached));
    return row ?? null;
  };
  const existing = await find();
  if (existing) {
    if (existing.checkoutFingerprint !== fingerprint)
      throw new CheckoutError(
        "conflict",
        "This payment was already used for a different order",
      );
    return existing;
  }
  try {
    return await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber: makeOrderNumber(),
          checkoutAttemptKey: input.attemptKey,
          checkoutFingerprint: fingerprint,
          stockReservedAt: new Date(),
          reservationExpiresAt: new Date(Date.now() + RESERVATION_MS),
          customerId: input.customerId ?? null,
          email: input.email,
          status: "pending",
          subtotalCents: input.quote.subtotalCents,
          shippingCents: input.quote.shippingCents,
          discountCents: 0,
          totalCents: input.quote.totalCents,
          shippingAddress: JSON.stringify(input.address),
          locale: input.locale,
          channel: input.channel,
          agentName: input.agentName,
        })
        .returning();
      await recordStatusTransition(tx, {
        entityType: "order",
        entityId: order.id,
        fromStatus: null,
        toStatus: "pending",
        source: "checkout",
      });
      await tx.insert(orderItems).values(
        input.quote.lines.map((l) => ({
          orderId: order.id,
          productId: l.sku.productId,
          variantId: l.sku.variantId,
          nameSnapshot: l.sku.lineName,
          colorName: l.sku.colorName,
          colorHex: l.sku.colorHex,
          priceCentsSnapshot: l.unitCents,
          quantity: l.quantity,
        })),
      );
      await reserveStock(
        tx,
        input.quote.lines.map((l) => ({
          productId: l.sku.productId,
          variantId: l.sku.variantId,
          quantity: l.quantity,
        })),
        order.id,
      );
      return order;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const again = await find();
      if (again && again.checkoutFingerprint === fingerprint) return again;
    }
    if (error instanceof Error && error.message === "insufficient_stock")
      throw new CheckoutError("out_of_stock", "An item just sold out", "items");
    throw error;
  }
}

export type SptPayment =
  | { status: "paid" | "processing"; paymentIntentId: string }
  | {
      status: "failed";
      code: "payment_declined" | "requires_action" | "unavailable";
      message: string;
    }
  // Issue inconnue (réseau, 5xx) : la commande reste réservée, à rejouer.
  | { status: "unknown"; message: string };

// Classe une erreur levée par la création du PaymentIntent. Seules ces
// erreurs Stripe garantissent qu'aucun débit n'a eu lieu ; tout le reste
// (réseau coupé, 5xx, limite de débit, idempotence…) laisse l'issue ouverte.
export function sptFailure(
  error: unknown,
): Exclude<SptPayment, { status: "paid" | "processing" }> {
  const failure = error as { type?: string; message?: string } | null;
  switch (failure?.type) {
    case "StripeCardError":
      // Message Stripe prévu pour l'acheteur (« Your card was declined. »).
      return {
        status: "failed",
        code: "payment_declined",
        message: failure.message || "The card was declined",
      };
    case "StripeInvalidRequestError":
      return {
        status: "failed",
        code: "payment_declined",
        message:
          "The Shared Payment Token was refused (expired, already used, or not valid for this seller or amount)",
      };
    case "StripeAuthenticationError":
    case "StripePermissionError":
      // Problème de configuration de notre côté : jamais détaillé à l'agent.
      return {
        status: "failed",
        code: "unavailable",
        message: "Payments are temporarily unavailable",
      };
    default:
      return {
        status: "unknown",
        message:
          "The payment outcome is not known yet; retry the same request in a few seconds",
      };
  }
}

// Paiement par Shared Payment Token (émis pour notre profil Stripe par le
// portefeuille de l'agent, ex. Link). Succès → markOrderPaid (e-mails, statut)
// ; échec → réservation libérée. Idempotent côté Stripe (clé fournie), et le
// webhook payment_intent.succeeded (metadata.orderId) rattrape un Worker
// interrompu entre le paiement et l'enregistrement.
export async function payOrderWithSpt(
  db: Db,
  stripe: Stripe,
  order: Order,
  spt: string,
  idempotencyKey: string,
): Promise<SptPayment> {
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create(
      {
        amount: order.totalCents,
        currency: "chf",
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        description: `Swiss3Design ${order.orderNumber}`,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          channel: order.channel,
          machine_payment: "true",
        },
        // Champ en préversion, absent des types du SDK.
        shared_payment_granted_token: spt,
      } as Stripe.PaymentIntentCreateParams,
      { apiVersion: SPT_API_VERSION, idempotencyKey },
    );
  } catch (error) {
    const outcome = sptFailure(error);
    if (outcome.status === "unknown") {
      // Stripe a peut-être débité : pas de libération ici. L'agent rejoue la
      // même requête (même clé d'idempotence → même issue chez Stripe), sinon
      // la maintenance tranche en retrouvant le PaymentIntent par
      // metadata.orderId.
      console.error("[spt] issue du paiement inconnue", order.id, error);
      return outcome;
    }
    if (outcome.code === "unavailable")
      console.error("[spt] configuration Stripe", error);
    // Refus certain : rien n'a été débité, la réservation est libérée (et le
    // PaymentIntent refusé, s'il existe, annulé).
    const refused = (error as { payment_intent?: { id?: string } })
      .payment_intent?.id;
    if (refused)
      await stripe.paymentIntents.cancel(refused).catch(() => undefined);
    await db.transaction((tx) => releaseOrderStock(tx, order.id));
    return outcome;
  }
  if (intent.status === "succeeded") {
    await markOrderPaid(db, order.id, {
      id: intent.id,
      amount: intent.amount_received || intent.amount,
      currency: intent.currency,
    });
    return { status: "paid", paymentIntentId: intent.id };
  }
  if (intent.status === "processing") {
    // Le webhook finalisera la commande dès que Stripe confirme.
    await db
      .update(orders)
      .set({ stripePaymentIntentId: intent.id })
      .where(eq(orders.id, order.id));
    return { status: "processing", paymentIntentId: intent.id };
  }
  await stripe.paymentIntents.cancel(intent.id).catch(() => undefined);
  await db.transaction((tx) => releaseOrderStock(tx, order.id));
  return {
    status: "failed",
    code:
      intent.status === "requires_action"
        ? "requires_action"
        : "payment_declined",
    message:
      intent.status === "requires_action"
        ? "The card requires an interactive authentication this flow cannot perform"
        : "The payment was declined",
  };
}

// Commande déjà payée (réponse rejouée) : l'état fait foi, pas un nouveau paiement.
export async function orderState(db: Db, orderId: string) {
  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), uncached));
  return row ?? null;
}

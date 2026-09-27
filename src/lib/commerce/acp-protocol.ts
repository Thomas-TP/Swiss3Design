import { z } from "zod";
import { SITE_URL } from "@/lib/seo";
import type { AddressInput, LineRequest } from "./checkout-core";
import {
  SHIPPING_OPTION_ID,
  STRIPE_ACCOUNT_ID,
  type Evaluation,
  type SessionBuyer,
  type SessionRow,
  type SessionState,
} from "./agent-checkout";
import { SHIPPING_SERVICE } from "./feed";
import { feedImageUrl } from "./catalog";

// Agentic Commerce Protocol (https://agenticcommerce.dev), version
// 2026-04-17 : API REST de checkout (create/update/get/complete/cancel) et
// document de découverte /.well-known/acp.json. Paiement : handler
// `dev.acp.tokenized.card` chez Stripe — l'agent obtient un Shared Payment
// Token pour notre compte/profil et le transmet à la finalisation.

export const ACP_VERSION = "2026-04-17";
export const ACP_SUPPORTED_VERSIONS = [ACP_VERSION];
const HANDLER_ID = "stripe_spt";

export function acpDiscovery(apiBaseUrl: string) {
  return {
    protocol: {
      name: "acp",
      version: ACP_VERSION,
      supported_versions: ACP_SUPPORTED_VERSIONS,
      documentation_url: `${SITE_URL}/agents.md`,
    },
    api_base_url: apiBaseUrl,
    transports: ["rest"],
    capabilities: {
      services: ["checkout"],
      supported_currencies: ["chf"],
      supported_locales: ["fr-CH", "de-CH", "it-CH", "en"],
    },
  };
}

export function acpHandler(networkId: string, live: boolean) {
  return {
    id: HANDLER_ID,
    name: "dev.acp.tokenized.card",
    display_name: "Card (Stripe)",
    version: "2026-01-22",
    spec: "https://acp.dev/handlers/tokenized.card",
    requires_delegate_payment: true,
    requires_pci_compliance: false,
    psp: "stripe",
    config_schema:
      "https://acp.dev/schemas/handlers/tokenized.card/config.json",
    instrument_schemas: [
      "https://acp.dev/schemas/handlers/tokenized.card/instrument.json",
    ],
    config: {
      merchant_id: STRIPE_ACCOUNT_ID,
      // Profil réseau Stripe auquel l'agent destine le jeton (SPT).
      network_business_profile: networkId,
      psp: "stripe",
      accepted_brands: ["visa", "mastercard", "amex"],
      accepted_funding_types: ["credit", "debit", "prepaid"],
      supports_3ds: false,
      environment: live ? "production" : "test",
    },
    display_order: 0,
  };
}

// ── Requêtes ─────────────────────────────────────────────────────────────────

const address = z
  .object({
    name: z.string().max(120).optional(),
    line_one: z.string().max(200).optional(),
    line_two: z.string().max(100).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(40).optional(),
    country: z.string().max(2).optional(),
    postal_code: z.string().max(12).optional(),
  })
  .passthrough();

const buyer = z
  .object({
    first_name: z.string().max(80).optional(),
    last_name: z.string().max(80).optional(),
    full_name: z.string().max(160).optional(),
    email: z.string().max(254).optional(),
    phone_number: z.string().max(40).optional(),
  })
  .passthrough();

const item = z
  .object({
    id: z.string().min(1).max(120),
    quantity: z.number().int().min(1).max(99).optional(),
  })
  .passthrough();

const fulfillmentDetails = z
  .object({
    name: z.string().max(120).optional(),
    phone_number: z.string().max(40).optional(),
    email: z.string().max(254).optional(),
    address: address.optional(),
  })
  .passthrough();

export const acpCreate = z
  .object({
    line_items: z.array(item).min(1).max(20),
    currency: z.string().max(3),
    buyer: buyer.optional(),
    fulfillment_details: fulfillmentDetails.optional(),
    locale: z.string().max(20).optional(),
  })
  .passthrough();

export const acpUpdate = z
  .object({
    line_items: z.array(item).min(1).max(20).optional(),
    buyer: buyer.optional(),
    fulfillment_details: fulfillmentDetails.optional(),
    selected_fulfillment_options: z.array(z.any()).optional(),
  })
  .passthrough();

export const acpComplete = z
  .object({
    buyer: buyer.optional(),
    payment_data: z
      .object({
        handler_id: z.string().max(80).optional(),
        instrument: z
          .object({
            credential: z
              .object({
                type: z.string().optional(),
                token: z.string().optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough()
          .optional(),
        // Forme historique : { token, provider: "stripe" }.
        token: z.string().optional(),
        provider: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

// Identifiant d'article ACP = SKU de notre flux, ou slug d'un produit sans
// variante ni couleur.
export function acpLineRequests(items: z.infer<typeof item>[]): LineRequest[] {
  return items.map((i) => ({ sku: i.id, quantity: i.quantity ?? 1 }));
}

export function acpBuyer(
  current: SessionBuyer,
  input?: z.infer<typeof buyer>,
  contactEmail?: string,
): SessionBuyer {
  return {
    email: input?.email ?? contactEmail ?? current.email,
    firstName: input?.first_name ?? current.firstName,
    lastName: input?.last_name ?? current.lastName,
    fullName: input?.full_name ?? current.fullName,
    phone: input?.phone_number ?? current.phone,
  };
}

export function acpAddress(
  details?: z.infer<typeof fulfillmentDetails>,
): AddressInput | null {
  const a = details?.address;
  if (!a) return null;
  return {
    name: a.name ?? details?.name,
    street: a.line_one,
    line2: a.line_two,
    npa: a.postal_code,
    city: a.city,
    canton: a.state,
    country: a.country,
  };
}

export function acpToken(body: z.infer<typeof acpComplete>): string | null {
  const token =
    body.payment_data.instrument?.credential?.token ?? body.payment_data.token;
  return typeof token === "string" && /^spt_[A-Za-z0-9_]+$/.test(token)
    ? token
    : null;
}

// ── Réponses ─────────────────────────────────────────────────────────────────

export function acpError(
  type: "invalid_request" | "processing_error" | "service_unavailable",
  code: string,
  message: string,
  param?: string,
) {
  return {
    type,
    code,
    message,
    ...(param ? { param } : {}),
    ...(code === "unsupported_version"
      ? { supported_versions: ACP_SUPPORTED_VERSIONS }
      : {}),
  };
}

const total = (type: string, displayText: string, amount: number) => ({
  type,
  display_text: displayText,
  amount,
});

const deliveryTime = (days: number) =>
  new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();

export const ACP_LINKS = [
  { type: "terms_of_use", url: `${SITE_URL}/legal/terms` },
  { type: "privacy_policy", url: `${SITE_URL}/legal/privacy` },
  { type: "return_policy", url: `${SITE_URL}/legal/shipping` },
  { type: "shipping_policy", url: `${SITE_URL}/legal/shipping` },
  { type: "contact_us", url: `${SITE_URL}/fr/contact` },
];

export function acpSessionView(
  session: SessionRow,
  state: SessionState,
  ev: Evaluation,
  opts: {
    networkId: string;
    live: boolean;
    expired?: boolean;
    order?: { id: string; orderNumber: string; locale: string } | null;
  },
) {
  const quote = ev.quote;
  const lineItems = ev.lines.map(({ item, sku }) => {
    const unit = sku?.priceCents ?? 0;
    const amount = unit * item.quantity;
    return {
      id: item.lineId,
      item: { id: item.sku, name: sku?.title, unit_amount: unit },
      quantity: item.quantity,
      name: sku?.title ?? item.sku,
      ...(sku
        ? {
            description: sku.description.slice(0, 500),
            images: sku.imageUrls
              .filter((u) => !/\.svg(\?|$)/i.test(u))
              .slice(0, 3)
              .map(feedImageUrl),
            product_id: sku.productId,
            sku: sku.sku,
            ...(sku.variantId ? { variant_id: sku.variantId } : {}),
            availability_status:
              sku.stock != null && sku.stock <= 0 ? "out_of_stock" : "in_stock",
            ...(sku.stock != null
              ? { available_quantity: Math.max(0, sku.stock) }
              : {}),
            max_quantity_per_order: 99,
            ...(sku.colorName
              ? { variant_options: [{ name: "Couleur", value: sku.colorName }] }
              : {}),
          }
        : {}),
      unit_amount: unit,
      totals: [
        total("items_base_amount", "Articles", amount),
        total("subtotal", "Sous-total", amount),
        total("total", "Total", amount),
      ],
    };
  });
  const shippingCents = quote?.shippingCents ?? 0;
  const status =
    session.status === "completed"
      ? "completed"
      : session.status === "canceled"
        ? "canceled"
        : opts.expired
          ? "expired"
          : ev.ready
            ? "ready_for_payment"
            : "not_ready_for_payment";
  const email = state.buyer.email;
  return {
    id: session.id,
    protocol: { version: ACP_VERSION },
    capabilities: {
      payment: { handlers: [acpHandler(opts.networkId, opts.live)] },
      interventions: { supported: [], required: [], enforcement: "optional" },
    },
    ...(email || state.buyer.firstName || state.buyer.fullName
      ? {
          buyer: {
            ...(state.buyer.firstName
              ? { first_name: state.buyer.firstName }
              : {}),
            ...(state.buyer.lastName
              ? { last_name: state.buyer.lastName }
              : {}),
            ...(state.buyer.fullName
              ? { full_name: state.buyer.fullName }
              : {}),
            email: email ?? "",
            ...(state.buyer.phone ? { phone_number: state.buyer.phone } : {}),
          },
        }
      : {}),
    status,
    currency: "chf",
    locale: state.locale === "en" ? "en" : `${state.locale}-CH`,
    line_items: lineItems,
    ...(state.address
      ? {
          fulfillment_details: {
            ...(ev.address?.name ? { name: ev.address.name } : {}),
            ...(email ? { email } : {}),
            address: {
              name: ev.address?.name ?? state.address.name ?? "",
              line_one: ev.address?.street ?? state.address.street ?? "",
              city: ev.address?.city ?? state.address.city ?? "",
              state: ev.address?.canton ?? state.address.canton ?? "",
              country: "CH",
              postal_code: ev.address?.npa ?? state.address.npa ?? "",
            },
          },
        }
      : {}),
    fulfillment_options: [
      {
        type: "shipping",
        id: SHIPPING_OPTION_ID,
        title: SHIPPING_SERVICE,
        description:
          shippingCents === 0
            ? "Livraison offerte en Suisse"
            : "Envoi en Suisse par la Poste",
        carrier: "Swiss Post",
        ...(quote
          ? {
              earliest_delivery_time: deliveryTime(quote.delivery.min),
              latest_delivery_time: deliveryTime(quote.delivery.max),
            }
          : {}),
        totals: [total("total", SHIPPING_SERVICE, shippingCents)],
      },
    ],
    // Une seule option (tarif unique Poste suisse) : toujours sélectionnée.
    selected_fulfillment_options: [
      {
        type: "shipping",
        option_id: SHIPPING_OPTION_ID,
        item_ids: lineItems.map((l) => l.id),
      },
    ],
    totals: [
      total("items_base_amount", "Articles", quote?.subtotalCents ?? 0),
      total("subtotal", "Sous-total", quote?.subtotalCents ?? 0),
      total("fulfillment", "Livraison", shippingCents),
      total("tax", "TVA (non assujetti)", 0),
      total("total", "Total", quote?.totalCents ?? 0),
    ],
    messages: ev.issues.map((issue) => ({
      type: "error",
      code: issue.code,
      severity: issue.code === "missing" ? "medium" : "high",
      resolution:
        issue.code === "missing" || issue.code === "invalid"
          ? "requires_buyer_input"
          : "requires_buyer_review",
      param: issue.path,
      content_type: "plain",
      content: issue.message,
    })),
    links: ACP_LINKS,
    created_at: session.createdAt.toISOString(),
    updated_at: session.updatedAt.toISOString(),
    expires_at: session.expiresAt.toISOString(),
    continue_url: `${SITE_URL}/${state.locale}/shop`,
    ...(opts.order
      ? {
          order: {
            id: opts.order.id,
            checkout_session_id: session.id,
            order_number: opts.order.orderNumber,
            permalink_url: `${SITE_URL}/${opts.order.locale}/track`,
            status: "confirmed",
            confirmation: {
              confirmation_number: opts.order.orderNumber,
              confirmation_email_sent: true,
            },
          },
        }
      : {}),
  };
}

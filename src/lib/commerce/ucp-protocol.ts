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

// Universal Commerce Protocol (https://ucp.dev), version 2026-08-25 : profil
// marchand /.well-known/ucp, service dev.ucp.shopping (liaison REST) avec le
// checkout et l'extension fulfillment. Paiement : handler maison
// `ch.swiss3design.stripe_spt` (spec publiée sur le site) — le handler Stripe
// officiel `com.stripe.payments` est en préversion privée.

export const UCP_VERSION = "2026-08-25";
export const UCP_HANDLER_KEY = "ch.swiss3design.stripe_spt";
export const UCP_HANDLER_VERSION = "2026-09-27";
const HANDLER_ID = "stripe_spt";
const ucpUrl = (path: string) => `https://ucp.dev/${UCP_VERSION}${path}`;

export const UCP_HANDLER_SPEC_PATH = "/agents/ucp-stripe-spt.md";
export const UCP_HANDLER_SCHEMA_PATH = "/agents/ucp-stripe-spt.schema.json";

function handler(origin: string, networkId: string, live: boolean) {
  return {
    id: HANDLER_ID,
    version: UCP_HANDLER_VERSION,
    spec: `${origin}${UCP_HANDLER_SPEC_PATH}`,
    schema: `${origin}${UCP_HANDLER_SCHEMA_PATH}`,
    available_instruments: [{ type: "card" }],
    config: {
      psp: "stripe",
      merchant_id: STRIPE_ACCOUNT_ID,
      network_id: networkId,
      environment: live ? "production" : "sandbox",
      credential_type: "stripe_shared_payment_token",
    },
  };
}

export function ucpProfile(opts: {
  origin: string;
  networkId: string;
  live: boolean;
  keys: Record<string, unknown>[];
}) {
  const checkout = {
    version: UCP_VERSION,
    spec: ucpUrl("/specification/shopping/checkout"),
    schema: ucpUrl("/schemas/shopping/checkout.json"),
  };
  return {
    ucp: {
      version: UCP_VERSION,
      services: {
        "dev.ucp.shopping": [
          {
            version: UCP_VERSION,
            spec: ucpUrl("/specification/overview/"),
            transport: "rest",
            endpoint: `${opts.origin}/api/ucp`,
            schema: ucpUrl("/services/shopping/rest.openapi.json"),
          },
        ],
      },
      capabilities: {
        "dev.ucp.shopping.checkout": [checkout],
        "dev.ucp.shopping.fulfillment": [
          {
            version: UCP_VERSION,
            spec: ucpUrl("/specification/shopping/extensions/fulfillment"),
            schema: ucpUrl("/schemas/shopping/fulfillment.json"),
            extends: "dev.ucp.shopping.checkout",
          },
        ],
      },
      payment_handlers: {
        [UCP_HANDLER_KEY]: [handler(opts.origin, opts.networkId, opts.live)],
      },
    },
    // Clé publique Ed25519 du site (la même que Web Bot Auth, kid = empreinte
    // RFC 7638) : signatures HTTP des réponses et webhooks UCP.
    keys: opts.keys,
  };
}

// ── Requêtes ─────────────────────────────────────────────────────────────────

const lineItem = z
  .object({
    id: z.string().max(120).optional(),
    item: z.object({ id: z.string().min(1).max(120) }).passthrough(),
    quantity: z.number().int().min(1).max(99).optional(),
  })
  .passthrough();

const buyer = z
  .object({
    first_name: z.string().max(80).optional(),
    last_name: z.string().max(80).optional(),
    email: z.string().max(254).optional(),
    phone_number: z.string().max(40).optional(),
  })
  .passthrough();

const destination = z
  .object({
    street_address: z.string().max(200).optional(),
    extended_address: z.string().max(100).optional(),
    address_locality: z.string().max(120).optional(),
    address_region: z.string().max(40).optional(),
    postal_code: z.string().max(12).optional(),
    address_country: z.string().max(2).optional(),
    first_name: z.string().max(80).optional(),
    last_name: z.string().max(80).optional(),
  })
  .passthrough();

const fulfillment = z
  .object({
    methods: z
      .array(
        z
          .object({
            type: z.string().optional(),
            destinations: z.array(destination).optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const ucpCreate = z
  .object({
    line_items: z.array(lineItem).min(1).max(20),
    buyer: buyer.optional(),
    fulfillment: fulfillment.optional(),
  })
  .passthrough();

export const ucpUpdate = z
  .object({
    line_items: z.array(lineItem).min(1).max(20).optional(),
    buyer: buyer.optional(),
    fulfillment: fulfillment.optional(),
  })
  .passthrough();

export const ucpComplete = z
  .object({
    payment: z
      .object({
        instruments: z
          .array(
            z
              .object({
                handler_id: z.string().max(80).optional(),
                selected: z.boolean().optional(),
                credential: z
                  .object({
                    type: z.string().optional(),
                    token: z.string().optional(),
                  })
                  .passthrough()
                  .optional(),
              })
              .passthrough(),
          )
          .min(1),
      })
      .passthrough(),
  })
  .passthrough();

export const ucpLineRequests = (
  items: z.infer<typeof lineItem>[],
): LineRequest[] =>
  items.map((i) => ({ sku: i.item.id, quantity: i.quantity ?? 1 }));

export function ucpBuyer(
  current: SessionBuyer,
  input?: z.infer<typeof buyer>,
): SessionBuyer {
  return {
    ...current,
    email: input?.email ?? current.email,
    firstName: input?.first_name ?? current.firstName,
    lastName: input?.last_name ?? current.lastName,
    phone: input?.phone_number ?? current.phone,
  };
}

export function ucpAddress(
  input?: z.infer<typeof fulfillment>,
): AddressInput | null {
  const method =
    input?.methods?.find((m) => !m.type || m.type === "shipping") ?? null;
  const dest = method?.destinations?.[0];
  if (!dest) return null;
  const name = [dest.first_name, dest.last_name].filter(Boolean).join(" ");
  return {
    name: name || undefined,
    street: dest.street_address,
    line2: dest.extended_address,
    npa: dest.postal_code,
    city: dest.address_locality,
    canton: dest.address_region,
    country: dest.address_country,
  };
}

export function ucpToken(body: z.infer<typeof ucpComplete>): string | null {
  const instrument =
    body.payment.instruments.find((i) => i.selected) ??
    body.payment.instruments[0];
  const token = instrument?.credential?.token;
  return typeof token === "string" && /^spt_[A-Za-z0-9_]+$/.test(token)
    ? token
    : null;
}

// ── Réponses ─────────────────────────────────────────────────────────────────

export const UCP_LINKS = [
  { type: "terms_of_service", url: `${SITE_URL}/legal/terms` },
  { type: "privacy_policy", url: `${SITE_URL}/legal/privacy` },
  { type: "refund_policy", url: `${SITE_URL}/legal/shipping` },
  { type: "shipping_policy", url: `${SITE_URL}/legal/shipping` },
];

const severityOf = (code: string) =>
  code === "missing" || code === "invalid" || code === "region_restricted"
    ? "requires_buyer_input"
    : "recoverable";

export function ucpError(code: string, content: string, path?: string) {
  return {
    ucp: { version: UCP_VERSION, status: "error" },
    messages: [
      {
        type: "error",
        code,
        content,
        severity: "unrecoverable",
        ...(path ? { path } : {}),
      },
    ],
    continue_url: `${SITE_URL}/fr/shop`,
  };
}

export function ucpCheckoutView(
  session: SessionRow,
  state: SessionState,
  ev: Evaluation,
  opts: {
    origin: string;
    networkId: string;
    live: boolean;
    expired?: boolean;
    order?: { id: string; orderNumber: string; locale: string } | null;
    extraMessages?: Record<string, unknown>[];
  },
) {
  const quote = ev.quote;
  const shippingCents = quote?.shippingCents ?? 0;
  const lineItems = ev.lines.map(({ item, sku }) => {
    const unit = sku?.priceCents ?? 0;
    const image = sku?.imageUrls.find((u) => !/\.svg(\?|$)/i.test(u));
    return {
      id: item.lineId,
      item: {
        id: item.sku,
        title: sku?.title ?? item.sku,
        price: unit,
        ...(image ? { image_url: feedImageUrl(image) } : {}),
      },
      quantity: item.quantity,
      totals: [
        { type: "subtotal", amount: unit * item.quantity },
        { type: "total", amount: unit * item.quantity },
      ],
    };
  });
  const status =
    session.status === "completed"
      ? "completed"
      : session.status === "canceled" || opts.expired
        ? "canceled"
        : ev.ready
          ? "ready_for_complete"
          : "incomplete";
  const address = ev.address;
  return {
    ucp: {
      version: UCP_VERSION,
      capabilities: {
        "dev.ucp.shopping.checkout": [{ version: UCP_VERSION }],
        "dev.ucp.shopping.fulfillment": [{ version: UCP_VERSION }],
      },
      payment_handlers: {
        [UCP_HANDLER_KEY]: [handler(opts.origin, opts.networkId, opts.live)],
      },
    },
    id: session.id,
    status,
    messages: [
      ...ev.issues.map((issue) => ({
        type: "error",
        code: issue.code,
        path: issue.path,
        content: issue.message,
        severity: severityOf(issue.code),
      })),
      ...(opts.extraMessages ?? []),
    ],
    currency: "CHF",
    line_items: lineItems,
    ...(state.buyer.email || state.buyer.firstName
      ? {
          buyer: {
            ...(state.buyer.email ? { email: state.buyer.email } : {}),
            ...(state.buyer.firstName
              ? { first_name: state.buyer.firstName }
              : {}),
            ...(state.buyer.lastName
              ? { last_name: state.buyer.lastName }
              : {}),
            ...(state.buyer.phone ? { phone_number: state.buyer.phone } : {}),
          },
        }
      : {}),
    totals: [
      {
        type: "subtotal",
        display_text: "Sous-total",
        amount: quote?.subtotalCents ?? 0,
      },
      { type: "fulfillment", display_text: "Livraison", amount: shippingCents },
      { type: "tax", display_text: "TVA (non assujetti)", amount: 0 },
      { type: "total", display_text: "Total", amount: quote?.totalCents ?? 0 },
    ],
    links: UCP_LINKS,
    fulfillment: {
      methods: [
        {
          id: "shipping_1",
          type: "shipping",
          line_item_ids: lineItems.map((l) => l.id),
          ...(address ? { selected_destination_id: "dest_1" } : {}),
          destinations: address
            ? [
                {
                  type: "shipping_address",
                  id: "dest_1",
                  street_address: address.street,
                  address_locality: address.city,
                  ...(address.canton ? { address_region: address.canton } : {}),
                  postal_code: address.npa,
                  address_country: "CH",
                },
              ]
            : [],
          groups: [
            {
              id: "package_1",
              line_item_ids: lineItems.map((l) => l.id),
              // Tarif unique Poste suisse : toujours sélectionné.
              selected_option_id: SHIPPING_OPTION_ID,
              options: [
                {
                  id: SHIPPING_OPTION_ID,
                  title: SHIPPING_SERVICE,
                  description: quote
                    ? `Livraison en Suisse en ${quote.delivery.min} à ${quote.delivery.max} jours`
                    : "Livraison en Suisse",
                  totals: [{ type: "total", amount: shippingCents }],
                },
              ],
            },
          ],
        },
      ],
    },
    payment: { instruments: [] },
    expires_at: session.expiresAt.toISOString(),
    continue_url: `${SITE_URL}/${state.locale}/shop`,
    ...(opts.order
      ? {
          order: {
            id: opts.order.id,
            label: opts.order.orderNumber,
            permalink_url: `${SITE_URL}/${opts.order.locale}/track`,
          },
        }
      : {}),
  };
}

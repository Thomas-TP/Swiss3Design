import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { PUBLIC_CORS } from "@/lib/agent/config";
import { price } from "@/lib/agent/catalog";
import { loadSellableSkus, skuIndex } from "@/lib/commerce/catalog";
import {
  buildQuote,
  CheckoutError,
  createPendingAgentOrder,
  normalizeEmail,
  orderFingerprint,
  payOrderWithSpt,
  resolveLine,
  sha256Hex,
  swissAddress,
  type Quote,
} from "@/lib/commerce/checkout-core";
import {
  challengeSecret,
  createChallenge,
  parseCredential,
  problem,
  receiptHeader,
  serializeChallenge,
  verifyChallenge,
  type ProblemType,
} from "@/lib/commerce/mpp";
import { pushCatalogChange } from "@/lib/commerce/stripe-catalog";
import { rateLimit } from "@/lib/rate-limit";
import { SITE_URL } from "@/lib/seo";
import { getShippingSettings } from "@/lib/shipping-settings";
import { getStripe } from "@/lib/stripe";

// Achat direct par un agent IA, payé en MPP (Machine Payments Protocol) avec
// un Shared Payment Token Stripe (ex. portefeuille d'agent Link) :
// 1. POST sans paiement → 402 + devis + défi `WWW-Authenticate: Payment` ;
// 2. même POST avec `Authorization: Payment …` → stock réservé, paiement,
//    commande créée, reçu `Payment-Receipt`.
// Le défi est lié au contenu de la commande (externalId) : une preuve de
// paiement ne vaut que pour CES articles, CETTE adresse et CE montant.

const CHALLENGE_TTL_MS = 15 * 60 * 1000;

const CORS = {
  ...PUBLIC_CORS,
  "Access-Control-Expose-Headers": "WWW-Authenticate, Payment-Receipt",
};

const body = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().min(1).max(120).optional(),
        slug: z.string().min(1).max(120).optional(),
        variant: z.string().max(120).optional(),
        color: z.string().max(60).optional(),
        quantity: z.number().int().min(1).max(99).optional(),
      }),
    )
    .min(1)
    .max(20),
  email: z.string().max(254),
  shipping_address: z.object({
    name: z.string().max(120),
    line1: z.string().max(200),
    line2: z.string().max(100).optional(),
    postal_code: z.string().max(10),
    city: z.string().max(120),
    canton: z.string().max(10).optional(),
    country: z.string().max(2).optional(),
  }),
  language: z.enum(["fr", "de", "it", "en"]).optional(),
});

const json = (
  data: unknown,
  status: number,
  headers: Record<string, string> = {},
  type = "application/json",
) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": `${type}; charset=utf-8`,
      "Cache-Control": "no-store",
      ...CORS,
      ...headers,
    },
  });

const STATUS: Record<CheckoutError["code"], number> = {
  invalid: 400,
  missing: 400,
  not_found: 404,
  out_of_stock: 409,
  region_restricted: 422,
  quantity_exceeded: 400,
  conflict: 409,
  payment_declined: 402,
  requires_action: 402,
};

function quoteView(quote: Quote) {
  return {
    items: quote.lines.map((l) => ({
      sku: l.sku.sku,
      name: l.sku.title,
      quantity: l.quantity,
      unit_price: price(l.unitCents),
      total: price(l.totalCents),
    })),
    subtotal: price(quote.subtotalCents),
    shipping: price(quote.shippingCents),
    total: price(quote.totalCents),
    delivery_days: quote.delivery,
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  return json(
    {
      description:
        "Buy Swiss3Design products with a Machine Payments Protocol (MPP) payment: POST the order below without payment to get a 402 challenge (method=stripe, card via a Stripe Shared Payment Token, e.g. from the Link agent wallet), then retry the same POST with the Authorization: Payment credential.",
      method: "POST",
      example: {
        items: [{ slug: "vase-spirale", color: "Noir", quantity: 1 }],
        email: "buyer@example.ch",
        shipping_address: {
          name: "Jeanne Exemple",
          line1: "Rue du Lac 1",
          postal_code: "1260",
          city: "Nyon",
          country: "CH",
        },
        language: "fr",
      },
      documentation: `${SITE_URL}/agents.md`,
      terms: `${SITE_URL}/legal/terms`,
    },
    200,
  );
}

export async function POST(request: Request) {
  if (!(await rateLimit(request, "purchases", { limit: 30, windowS: 600 })))
    return json(
      problem("bad-request", "Too many requests", 429),
      429,
      {},
      "application/problem+json",
    );
  const { env } = await getCloudflareContext({ async: true });
  const networkId = env.STRIPE_PROFILE_ID;
  if (!networkId) return json({ error: "purchases_unavailable" }, 503);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return json(
      problem(
        "bad-request",
        parsed.error.issues
          .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
          .join("; "),
        400,
      ),
      400,
      {},
      "application/problem+json",
    );
  const input = parsed.data;
  const db = await getDb();
  const [skus, rule] = await Promise.all([
    loadSellableSkus(db),
    getShippingSettings(),
  ]);
  const index = skuIndex(skus);
  let quote: Quote;
  let email: string;
  let address: ReturnType<typeof swissAddress>;
  try {
    quote = buildQuote(
      input.items.map((item, i) => ({
        sku: resolveLine(item, skus, index, `items[${i}]`),
        quantity: item.quantity ?? 1,
      })),
      rule,
    );
    email = normalizeEmail(input.email);
    address = swissAddress(
      {
        name: input.shipping_address.name,
        street: input.shipping_address.line1,
        line2: input.shipping_address.line2,
        npa: input.shipping_address.postal_code,
        city: input.shipping_address.city,
        canton: input.shipping_address.canton,
        country: input.shipping_address.country,
      },
      "shipping_address",
    );
  } catch (error) {
    if (error instanceof CheckoutError)
      return json(
        {
          error: {
            code: error.code,
            message: error.message,
            param: error.param,
          },
        },
        STATUS[error.code],
      );
    throw error;
  }

  const realm = new URL(env.BETTER_AUTH_URL).host;
  const secret = await challengeSecret(env.STRIPE_SECRET_KEY);
  const externalId = await orderFingerprint({ quote, address, email });
  const description = `Swiss3Design — ${quote.lines.reduce((n, l) => n + l.quantity, 0)} item(s), shipping to Switzerland`;
  const challengeResponse = async (type: ProblemType, detail: string) => {
    const challenge = await createChallenge(secret, {
      realm,
      method: "stripe",
      intent: "charge",
      request: {
        amount: String(quote.totalCents),
        currency: "chf",
        description,
        externalId,
        methodDetails: { networkId, paymentMethodTypes: ["card"] },
      },
      description,
      expires: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    });
    return json(
      { ...problem(type, detail, 402, challenge.id), quote: quoteView(quote) },
      402,
      { "WWW-Authenticate": serializeChallenge(challenge) },
      "application/problem+json",
    );
  };

  const credential = parseCredential(request.headers.get("Authorization"));
  if (!credential) {
    if (request.headers.get("Authorization")?.match(/^Payment\s/i))
      return challengeResponse(
        "malformed-credential",
        "Unreadable Payment credential.",
      );
    return challengeResponse(
      "payment-required",
      `Payment of CHF ${(quote.totalCents / 100).toFixed(2)} required to place this order.`,
    );
  }
  const validity = await verifyChallenge(secret, credential.challenge, realm);
  if (validity === "expired")
    return challengeResponse(
      "payment-expired",
      "This payment challenge has expired.",
    );
  if (validity === "invalid")
    return challengeResponse(
      "invalid-challenge",
      "Unknown or altered payment challenge.",
    );
  const bound = credential.challenge.request;
  if (
    bound.externalId !== externalId ||
    bound.amount !== String(quote.totalCents) ||
    bound.currency !== "chf"
  )
    return challengeResponse(
      "invalid-challenge",
      "The order or its price changed since the challenge was issued.",
    );
  const spt = credential.payload.spt;
  if (typeof spt !== "string" || !/^spt_[A-Za-z0-9_]+$/.test(spt))
    return challengeResponse(
      "malformed-credential",
      "The credential carries no Shared Payment Token.",
    );

  // Une tentative par jeton : un jeton refusé ne bloque pas le suivant, un
  // même jeton rejoué retrouve la même commande (et le même PaymentIntent).
  const attemptKey = `mpp:${credential.challenge.id}:${(await sha256Hex(spt)).slice(0, 16)}`;
  let order;
  try {
    order = await createPendingAgentOrder(db, {
      quote,
      address,
      email,
      locale: input.language ?? "fr",
      channel: "mpp",
      agentName: (request.headers.get("User-Agent") ?? "").slice(0, 80) || null,
      attemptKey,
    });
  } catch (error) {
    if (error instanceof CheckoutError)
      return json(
        {
          error: {
            code: error.code,
            message: error.message,
            param: error.param,
          },
        },
        STATUS[error.code],
      );
    throw error;
  }

  const view = (status: string) => ({
    order: {
      order_number: order.orderNumber,
      status,
      email: order.email,
      ...quoteView(quote),
      tracking: `${SITE_URL}/${order.locale}/track`,
    },
  });
  if (order.status === "paid" && order.stripePaymentIntentId)
    return json(view("paid"), 200, {
      "Payment-Receipt": receiptHeader(order.stripePaymentIntentId, externalId),
      "Cache-Control": "private, no-store",
    });
  if (order.status !== "pending")
    return challengeResponse(
      "verification-failed",
      "This payment already failed. Issue a new Shared Payment Token and retry.",
    );

  const stripe = getStripe(env.STRIPE_SECRET_KEY);
  const payment = await payOrderWithSpt(db, stripe, order, spt, attemptKey);
  if (payment.status === "failed")
    return challengeResponse(
      payment.code === "requires_action"
        ? "payment-action-required"
        : "verification-failed",
      payment.message,
    );
  await pushCatalogChange(db, "stock");
  if (payment.status === "processing") return json(view("processing"), 202);
  return json(view("paid"), 201, {
    "Payment-Receipt": receiptHeader(payment.paymentIntentId, externalId),
    "Cache-Control": "private, no-store",
  });
}

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { getStripe, createCheckoutSession } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/stripe-customer";
import { getServerSession } from "@/lib/session";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Crée une Checkout Session pour payer un devis chiffré. Réservé au client
// propriétaire du devis (compte connecté).
const bodySchema = z.object({
  quoteId: z.string().min(1),
  locale: z.enum(["fr", "de", "it", "en"]).catch("fr"),
});

export async function POST(request: Request) {
  if (!(await rateLimit(request, "quote-checkout", { limit: 20, windowS: 600 }))) {
    return tooManyRequests();
  }

  const authSession = await getServerSession();
  if (!authSession) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const db = await getDb();
  const [quote] = await db
    .select()
    .from(quoteRequests)
    .where(eq(quoteRequests.id, parsed.data.quoteId))
    .limit(1);
  if (!quote) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Le devis doit appartenir au client connecté
  const owns =
    quote.customerId === authSession.user.id ||
    quote.email.toLowerCase() === authSession.user.email.toLowerCase();
  if (!owns) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  // Seuls les devis chiffrés, non expirés et non encore payés sont payables
  const expired =
    !!quote.validUntil && quote.validUntil.getTime() < Date.now();
  if (
    expired ||
    (quote.status !== "quoted" && quote.status !== "accepted") ||
    !quote.quotedPriceCents ||
    quote.quotedPriceCents <= 0
  ) {
    return Response.json({ error: "not_payable" }, { status: 409 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const stripe = getStripe(env.STRIPE_SECRET_KEY);

  // Toujours un client connecté ici (garde plus haut) : rattache le paiement
  // à son identité Stripe, comme le checkout panier (Link 1-clic).
  const stripeCustomerId = await getOrCreateStripeCustomer(stripe, db, {
    id: authSession.user.id,
    email: authSession.user.email,
    name: authSession.user.name,
    stripeCustomerId: authSession.user.stripeCustomerId ?? null,
  });

  const session = await createCheckoutSession(
    stripe,
    {
      ui_mode: "elements",
      mode: "payment",
      locale: parsed.data.locale,
      line_items: [
        {
          price_data: {
            currency: "chf",
            product_data: { name: `Devis ${quote.id.slice(0, 8)}` },
            unit_amount: quote.quotedPriceCents,
          },
          quantity: 1,
        },
      ],
      return_url: `${env.BETTER_AUTH_URL}/${parsed.data.locale}/account/quotes/${quote.id}/pay?session_id={CHECKOUT_SESSION_ID}`,
      customer: stripeCustomerId,
      payment_intent_data: {
        receipt_email: quote.email,
        metadata: { quoteId: quote.id },
      },
      metadata: { quoteId: quote.id },
    },
    env.STRIPE_PAYMENT_METHOD_CONFIGURATION,
  );

  return Response.json({
    clientSecret: session.client_secret,
    totalCents: quote.quotedPriceCents,
  });
}

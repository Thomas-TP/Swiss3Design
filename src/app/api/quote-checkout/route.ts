import { z } from "zod";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { getServerSession } from "@/lib/session";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Crée un PaymentIntent pour payer un devis chiffré. Réservé au client
// propriétaire du devis (compte connecté).
const bodySchema = z.object({ quoteId: z.string().min(1) });

export async function POST(request: Request) {
  if (!(await rateLimit(request, "quote-checkout", { limit: 20, windowS: 600 }))) {
    return tooManyRequests();
  }

  const session = await getServerSession();
  if (!session) {
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
    quote.customerId === session.user.id ||
    quote.email.toLowerCase() === session.user.email.toLowerCase();
  if (!owns) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  // Seuls les devis chiffrés et non encore payés sont payables
  if (
    (quote.status !== "quoted" && quote.status !== "accepted") ||
    !quote.quotedPriceCents ||
    quote.quotedPriceCents <= 0
  ) {
    return Response.json({ error: "not_payable" }, { status: 409 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const stripe = getStripe(env.STRIPE_SECRET_KEY);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: quote.quotedPriceCents,
    currency: "chf",
    automatic_payment_methods: { enabled: true },
    receipt_email: quote.email,
    metadata: { quoteId: quote.id },
  });

  return Response.json({
    clientSecret: paymentIntent.client_secret,
    totalCents: quote.quotedPriceCents,
  });
}

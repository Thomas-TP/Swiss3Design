import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getStripe } from "./stripe";
import type { quoteRequests } from "@/db/schema";
// Appelé sous verrou de ligne, partagé avec la création du checkout.
// Une session déjà complétée doit être rapprochée avant toute modification.
export async function expireQuoteSession(
  quote: typeof quoteRequests.$inferSelect,
) {
  if (!quote.checkoutSessionId) return;
  const { env } = await getCloudflareContext({ async: true });
  const stripe = getStripe(env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.retrieve(
    quote.checkoutSessionId,
  );
  if (session.status === "complete")
    throw new Error("quote_payment_in_progress");
  if (session.status === "open")
    await stripe.checkout.sessions.expire(session.id);
}

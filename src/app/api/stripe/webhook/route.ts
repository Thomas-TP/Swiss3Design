import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { markOrderPaid, markQuotePaid } from "@/lib/orders";
import { getStripe, stripeCryptoProvider } from "@/lib/stripe";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const signature = request.headers.get("stripe-signature");
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Missing signature", { status: 400 });
  }

  const stripe = getStripe(env.STRIPE_SECRET_KEY);
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      stripeCryptoProvider,
    );
  } catch (err) {
    console.error(
      "[stripe webhook] signature invalide",
      err instanceof Error ? err.message : err,
    );
    return new Response("Invalid signature", { status: 400 });
  }

  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed"
  ) {
    const paymentIntent = event.data.object;
    const orderId = paymentIntent.metadata?.orderId;
    const quoteId = paymentIntent.metadata?.quoteId;
    const succeeded = event.type === "payment_intent.succeeded";
    try {
      if (orderId) {
        const db = await getDb();
        if (succeeded) {
          await markOrderPaid(db, orderId);
        } else {
          await db
            .update(orders)
            .set({ status: "cancelled" })
            .where(eq(orders.id, orderId));
        }
      }
      // Paiement d'un devis chiffré
      if (quoteId && succeeded) {
        const db = await getDb();
        await markQuotePaid(db, quoteId);
      }
    } catch (err) {
      // Échec de finalisation (D1, etc.) après encaissement : on journalise
      // avec contexte (capté par l'Observability Cloudflare) et on renvoie 500
      // → Stripe réessaiera la livraison du webhook. La finalisation étant
      // idempotente, le rejeu reprend là où il s'est arrêté sans double effet.
      console.error("[stripe webhook] échec de finalisation", {
        eventType: event.type,
        eventId: event.id,
        orderId,
        quoteId,
        error: err instanceof Error ? err.message : String(err),
      });
      return new Response("Webhook handler error", { status: 500 });
    }
  }

  return Response.json({ received: true });
}

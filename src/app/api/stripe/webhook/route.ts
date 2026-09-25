import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { orders, paymentEvents } from "@/db/schema";
import { markOrderPaid, markQuotePaid } from "@/lib/orders";
import { settleSession } from "@/lib/checkout-session";
import { releaseOrderStock } from "@/lib/stock";
import { getStripe, stripeCryptoProvider } from "@/lib/stripe";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const signature = request.headers.get("stripe-signature");
  if (!signature || !env.STRIPE_WEBHOOK_SECRET)
    return new Response("Missing signature", { status: 400 });
  const stripe = getStripe(env.STRIPE_SECRET_KEY);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      stripeCryptoProvider,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  const db = await getDb();
  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const proof = {
        id: pi.id,
        amount: pi.amount_received,
        currency: pi.currency,
        offerVersion: pi.metadata.offerVersion
          ? Number(pi.metadata.offerVersion)
          : undefined,
      };
      if (pi.metadata.orderId)
        await markOrderPaid(db, pi.metadata.orderId, proof);
      if (pi.metadata.quoteId)
        await markQuotePaid(db, pi.metadata.quoteId, proof);
    } else if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await settleSession(db, event.data.object);
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      if (session.metadata?.orderId)
        await db.transaction((tx) =>
          releaseOrderStock(tx, session.metadata!.orderId),
        );
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const pi =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (pi)
        await db
          .update(orders)
          .set({
            refundedCents: sql`greatest(${orders.refundedCents}, ${charge.amount_refunded})`,
          })
          .where(eq(orders.stripePaymentIntentId, pi));
    }
    // Un échec de tentative n'annule pas une commande : Stripe autorise un
    // nouvel essai sur le même paiement et livre les événements sans ordre garanti.
    await db
      .insert(paymentEvents)
      .values({
        id: event.id,
        type: event.type,
        objectId:
          "id" in event.data.object ? String(event.data.object.id) : event.id,
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error("[stripe webhook] rapprochement requis", {
      eventId: event.id,
      type: event.type,
      error: error instanceof Error ? error.message : "unknown",
    });
    return new Response("Webhook handler error", { status: 500 });
  }
  return Response.json({ received: true });
}

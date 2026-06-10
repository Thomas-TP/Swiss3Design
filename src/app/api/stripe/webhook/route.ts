import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
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
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed"
  ) {
    const paymentIntent = event.data.object;
    const orderId = paymentIntent.metadata?.orderId;
    if (orderId) {
      const db = await getDb();
      await db
        .update(orders)
        .set({
          status: event.type === "payment_intent.succeeded" ? "paid" : "cancelled",
        })
        .where(eq(orders.id, orderId));
    }
  }

  return Response.json({ received: true });
}

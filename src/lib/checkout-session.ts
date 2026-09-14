import { and, eq, isNull, lt } from "drizzle-orm";
import type Stripe from "stripe";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { getDb } from "@/db";
import { orders, user } from "@/db/schema";
import { createCheckoutSession, getStripe } from "./stripe";
import { markOrderPaid, markQuotePaid } from "./orders";
import { releaseOrderStock } from "./stock";
import { getOrCreateStripeCustomer } from "./stripe-customer";
type Db = Awaited<ReturnType<typeof getDb>>;
type Order = typeof orders.$inferSelect;
export async function settleSession(db: Db, session: Stripe.Checkout.Session) {
  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  )
    return false;
  const id =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  const proof = {
    id: id ?? session.id,
    amount: session.amount_total ?? -1,
    currency: session.currency ?? "",
    offerVersion: session.metadata?.offerVersion
      ? Number(session.metadata.offerVersion)
      : undefined,
  };
  if (session.metadata?.orderId)
    return markOrderPaid(db, session.metadata.orderId, proof);
  if (session.metadata?.quoteId)
    return markQuotePaid(db, session.metadata.quoteId, proof);
  return false;
}
export async function getOrderCheckout(db: Db, order: Order) {
  const { env } = await getCloudflareContext({ async: true });
  const stripe = getStripe(env.STRIPE_SECRET_KEY);
  if (order.checkoutSessionId)
    return stripe.checkout.sessions.retrieve(order.checkoutSessionId);
  let customerId = order.stripeCustomerId;
  if (!customerId && order.customerId) {
    const [customer] = await db
      .select()
      .from(user)
      .where(eq(user.id, order.customerId));
    if (customer) {
      customerId = await getOrCreateStripeCustomer(stripe, db, customer);
      await db
        .update(orders)
        .set({ stripeCustomerId: customerId })
        .where(eq(orders.id, order.id));
    }
  }
  const address = JSON.parse(order.shippingAddress) as {
    name: string;
    street: string;
    npa: string;
    city: string;
  };
  const session = await createCheckoutSession(
    stripe,
    {
      ui_mode: "elements",
      mode: "payment",
      locale: order.locale,
      expires_at: Math.floor(
        (
          order.reservationExpiresAt ??
          new Date(order.createdAt.getTime() + 3600000)
        ).getTime() / 1000,
      ),
      line_items: [
        {
          price_data: {
            currency: "chf",
            product_data: { name: "Swiss3Design " + order.orderNumber },
            unit_amount: order.totalCents,
          },
          quantity: 1,
        },
      ],
      return_url:
        env.BETTER_AUTH_URL +
        "/" +
        order.locale +
        "/checkout/success?session_id={CHECKOUT_SESSION_ID}",
      ...(customerId
        ? { customer: customerId }
        : { customer_email: order.email }),
      payment_intent_data: {
        receipt_email: order.email,
        shipping: {
          name: address.name,
          address: {
            line1: address.street,
            postal_code: address.npa,
            city: address.city,
            country: "CH",
          },
        },
        metadata: { orderId: order.id, orderNumber: order.orderNumber },
      },
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    },
    env.STRIPE_PAYMENT_METHOD_CONFIGURATION,
    "order:" + order.id,
  );
  await db
    .update(orders)
    .set({ checkoutSessionId: session.id })
    .where(eq(orders.id, order.id));
  return session;
}
export async function resumeOrderCheckout(db: Db, order: Order) {
  if (order.status !== "pending")
    return Response.json({ error: "checkout_closed" }, { status: 409 });
  try {
    const session = await getOrderCheckout(db, order);
    if (session.status !== "open") {
      if (session.status === "expired")
        await db.transaction((tx) => releaseOrderStock(tx, order.id));
      else await settleSession(db, session);
      return Response.json({ error: "checkout_closed" }, { status: 409 });
    }
    return Response.json({
      clientSecret: session.client_secret,
      subtotalCents: order.subtotalCents,
      totalCents: order.totalCents,
      shippingCents: order.shippingCents,
      discountCents: order.discountCents,
    });
  } catch {
    // L'appel Stripe peut avoir réussi malgré une coupure réseau : garder la
    // réservation et la clé de reprise jusqu'à rapprochement, jamais libérer à l'aveugle.
    console.error("[checkout] session à reprendre", { orderId: order.id });
    return Response.json({ error: "checkout_unavailable" }, { status: 503 });
  }
}
export async function reconcilePendingOrders(db: Db) {
  const { env } = await getCloudflareContext({ async: true });
  const stripe = getStripe(env.STRIPE_SECRET_KEY);
  const pending = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        isNull(orders.paidAt),
        lt(orders.reservationExpiresAt, new Date()),
      ),
    )
    .limit(30);
  for (const order of pending) {
    try {
      let sessionId = order.checkoutSessionId;
      if (!sessionId) {
        // Attendre l'expiration ferme avant de conclure à l'absence de session.
        // Parcours borné ; si la fenêtre contient trop de sessions, conserver le stock.
        if (Date.now() < order.reservationExpiresAt!.getTime() + 300000)
          continue;
        let cursor: string | undefined;
        let exhausted = false;
        for (let page = 0; page < 5; page++) {
          const sessions = await stripe.checkout.sessions.list({
            created: {
              gte: Math.floor(order.createdAt.getTime() / 1000) - 5,
              lte: Math.ceil(order.reservationExpiresAt!.getTime() / 1000),
            },
            limit: 100,
            ...(cursor ? { starting_after: cursor } : {}),
          });
          const found = sessions.data.find(
            (s) => s.metadata?.orderId === order.id,
          );
          if (found) {
            sessionId = found.id;
            break;
          }
          if (!sessions.has_more) {
            exhausted = true;
            break;
          }
          cursor = sessions.data.at(-1)?.id;
        }
        if (!sessionId) {
          if (exhausted)
            await db.transaction((tx) => releaseOrderStock(tx, order.id));
          else
            console.error("[checkout] réservation à rapprocher manuellement", {
              orderId: order.id,
            });
          continue;
        }
        await db
          .update(orders)
          .set({ checkoutSessionId: sessionId })
          .where(eq(orders.id, order.id));
      }
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === "expired")
        await db.transaction((tx) => releaseOrderStock(tx, order.id));
      else if (session.status === "complete") await settleSession(db, session);
    } catch {
      console.error("[checkout] rapprochement différé", { orderId: order.id });
    }
  }
}

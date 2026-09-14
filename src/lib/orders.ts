import { eq, and, isNull } from "drizzle-orm";
import type { getDb } from "@/db";
import { orders, orderItems, quoteRequests, abandonedCarts } from "@/db/schema";
import { getAdminEmails } from "./email";
import { incrementDiscountUse } from "./discounts";
import {
  orderConfirmationEmail,
  adminNewOrderEmail,
  adminQuotePaidEmail,
} from "./email-templates";
import { queueEmail, drainEmailOutbox } from "./outbox";
import { reserveStock } from "./stock";
import { recordStatusTransition } from "./status-history";
import { isOrderPaid, verifyPayment, type PaymentProof } from "./payment-state";
type Db = Awaited<ReturnType<typeof getDb>>;

// Un seul commit pour le paiement, le stock et les messages à envoyer.
// Le statut d'expédition ne peut jamais réarmer le traitement du paiement.
export async function markOrderPaid(
  db: Db,
  orderId: string,
  proof: PaymentProof,
) {
  const admins = await getAdminEmails();
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");
    if (!order) throw new Error("order_not_found");
    verifyPayment(proof, order.totalCents, order.stripePaymentIntentId);
    if (isOrderPaid(order.status, order.paidAt)) return;
    if (order.status !== "pending" || order.stockReleasedAt)
      throw new Error("payment_requires_reconciliation");
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    if (!items.length) throw new Error("empty_order");
    if (!order.stockReservedAt) {
      // Compatibilité des sessions ouvertes avant cette migration.
      await reserveStock(tx, items, orderId);
      if (order.discountCode)
        await incrementDiscountUse(tx, order.discountCode);
    }
    await tx
      .update(orders)
      .set({
        status: "paid",
        paidAt: new Date(),
        stripePaymentIntentId: proof.id,
      })
      .where(and(eq(orders.id, orderId), isNull(orders.paidAt)));
    await recordStatusTransition(tx, {
      entityType: "order",
      entityId: orderId,
      fromStatus: order.status,
      toStatus: "paid",
      source: "payment",
    });
    await tx
      .delete(abandonedCarts)
      .where(eq(abandonedCarts.email, order.email.toLowerCase()));
    await queueEmail(
      tx,
      "order-confirmation:" + orderId,
      orderConfirmationEmail(order, items),
    );
    if (admins.length)
      await queueEmail(
        tx,
        "order-admin:" + orderId,
        adminNewOrderEmail(order, items, admins, []),
      );
  });
  // Un échec de transport laisse l'e-mail disponible pour le cron, sans annuler la vente.
  try {
    await drainEmailOutbox(db);
  } catch {
    console.error("[outbox] reprise par maintenance");
  }
  return true;
}

export async function markQuotePaid(
  db: Db,
  quoteId: string,
  proof: PaymentProof,
) {
  const admins = await getAdminEmails();
  await db.transaction(async (tx) => {
    const [quote] = await tx
      .select()
      .from(quoteRequests)
      .where(eq(quoteRequests.id, quoteId))
      .for("update");
    if (!quote) throw new Error("quote_not_found");
    verifyPayment(
      proof,
      quote.paidPriceCents ?? quote.quotedPriceCents ?? -1,
      quote.stripePaymentIntentId,
    );
    if (
      quote.paidAt ||
      ["paid", "in_production", "done"].includes(quote.status)
    )
      return;
    if (
      !["quoted", "accepted"].includes(quote.status) ||
      (proof.offerVersion ?? 1) !== quote.offerVersion
    )
      throw new Error("quote_payment_requires_reconciliation");
    await tx
      .update(quoteRequests)
      .set({
        status: "paid",
        paidAt: new Date(),
        paidPriceCents: proof.amount,
        stripePaymentIntentId: proof.id,
      })
      .where(eq(quoteRequests.id, quoteId));
    await recordStatusTransition(tx, {
      entityType: "quote",
      entityId: quoteId,
      fromStatus: quote.status,
      toStatus: "paid",
      source: "payment",
    });
    if (admins.length)
      await queueEmail(
        tx,
        "quote-paid:" + quoteId,
        adminQuotePaidEmail(quote, admins),
      );
  });
  try {
    await drainEmailOutbox(db);
  } catch {
    console.error("[outbox] reprise par maintenance");
  }
  return true;
}

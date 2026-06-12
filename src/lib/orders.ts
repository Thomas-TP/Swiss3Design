import { and, eq, ne } from "drizzle-orm";
import type { getDb } from "@/db";
import { orders, orderItems, products, inventoryLog } from "@/db/schema";
import { sendEmail } from "./email";
import { orderConfirmationEmail } from "./email-templates";

type Db = Awaited<ReturnType<typeof getDb>>;

// Passe la commande en "payée", décrémente le stock et envoie l'e-mail de
// confirmation — idempotent : appelé par le webhook Stripe ET par la page
// de confirmation (filet), le premier arrivé fait le travail.
export async function markOrderPaid(db: Db, orderId: string) {
  // UPDATE conditionnel : si le webhook et la page de succès arrivent en même
  // temps, un seul des deux passe — pas de double décrément de stock.
  const claimed = await db
    .update(orders)
    .set({ status: "paid" })
    .where(and(eq(orders.id, orderId), ne(orders.status, "paid")))
    .returning({ id: orders.id });
  if (claimed.length === 0) return;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const item of items) {
    if (!item.productId) continue;
    const [product] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);
    if (product?.stock == null) continue;

    await db
      .update(products)
      .set({ stock: Math.max(0, product.stock - item.quantity) })
      .where(eq(products.id, item.productId));
    await db.insert(inventoryLog).values({
      variantId: item.productId,
      delta: -item.quantity,
      reason: "order",
    });
  }

  // L'échec d'envoi d'e-mail ne doit jamais faire échouer le paiement
  try {
    await sendEmail(orderConfirmationEmail(order, items));
  } catch (e) {
    console.error("[email confirmation commande]", e);
  }
}

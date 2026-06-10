import { eq } from "drizzle-orm";
import type { getDb } from "@/db";
import { orders, orderItems, products, inventoryLog } from "@/db/schema";

type Db = Awaited<ReturnType<typeof getDb>>;

// Passe la commande en "payée" et décrémente le stock — idempotent :
// appelé par le webhook Stripe ET par la page de confirmation (filet),
// le premier arrivé fait le travail, le second ne fait rien.
export async function markOrderPaid(db: Db, orderId: string) {
  const [order] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order || order.status === "paid") return;

  await db.update(orders).set({ status: "paid" }).where(eq(orders.id, orderId));

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
}

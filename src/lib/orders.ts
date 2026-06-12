import { and, eq, ne } from "drizzle-orm";
import type { getDb } from "@/db";
import { orders, orderItems, products, inventoryLog } from "@/db/schema";
import { sendEmail, getAdminEmails } from "./email";
import { orderConfirmationEmail, adminNewOrderEmail } from "./email-templates";

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

  // Stock bas constaté pendant le décrément — signalé dans la notif admin
  const lowStock: { name: string; stock: number }[] = [];
  for (const item of items) {
    if (!item.productId) continue;
    const [product] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);
    if (product?.stock == null) continue;

    const newStock = Math.max(0, product.stock - item.quantity);
    await db
      .update(products)
      .set({ stock: newStock })
      .where(eq(products.id, item.productId));
    await db.insert(inventoryLog).values({
      variantId: item.productId,
      delta: -item.quantity,
      reason: "order",
    });
    if (newStock <= 2) {
      lowStock.push({ name: item.nameSnapshot, stock: newStock });
    }
  }

  // L'échec d'envoi d'e-mail ne doit jamais faire échouer le paiement
  try {
    await sendEmail(orderConfirmationEmail(order, items));
  } catch (e) {
    console.error("[email confirmation commande]", e);
  }

  // Notification interne : nouvelle commande à préparer
  try {
    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      await sendEmail(adminNewOrderEmail(order, items, adminEmails, lowStock));
    }
  } catch (e) {
    console.error("[email notif admin commande]", e);
  }
}

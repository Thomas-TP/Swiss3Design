import { and, eq, ne, gte, isNotNull, sql } from "drizzle-orm";
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

  // Stock bas (ou survente) constaté pendant le décrément — signalé à l'admin
  const lowStock: { name: string; stock: number }[] = [];
  for (const item of items) {
    if (!item.productId) continue;

    // Décrément atomique : ne s'applique que si le stock suffit encore. Empêche
    // la survente lorsque deux paiements pour le dernier exemplaire arrivent
    // en parallèle (la condition stock >= quantité est évaluée par SQLite).
    const decremented = await db
      .update(products)
      .set({ stock: sql`${products.stock} - ${item.quantity}` })
      .where(
        and(
          eq(products.id, item.productId),
          isNotNull(products.stock),
          gte(products.stock, item.quantity),
        ),
      )
      .returning({ stock: products.stock });

    if (decremented.length > 0) {
      // stock non-null garanti par le filtre isNotNull ci-dessus
      const newStock = decremented[0].stock ?? 0;
      await db.insert(inventoryLog).values({
        variantId: item.productId,
        delta: -item.quantity,
        reason: "order",
      });
      if (newStock <= 2) {
        lowStock.push({ name: item.nameSnapshot, stock: newStock });
      }
      continue;
    }

    // Pas de décrément : soit le produit n'est pas suivi (stock null → rien à
    // faire), soit le stock était insuffisant (survente concurrente). Le
    // paiement étant déjà encaissé, on tombe le stock à 0 et on alerte l'admin.
    const [current] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);
    if (current?.stock != null) {
      await db.insert(inventoryLog).values({
        variantId: item.productId,
        delta: -current.stock,
        reason: "order",
      });
      await db
        .update(products)
        .set({ stock: 0 })
        .where(eq(products.id, item.productId));
      lowStock.push({ name: item.nameSnapshot, stock: 0 });
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

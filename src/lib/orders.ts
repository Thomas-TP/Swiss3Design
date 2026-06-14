import { and, eq, ne, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import {
  orders,
  orderItems,
  products,
  productVariants,
  inventoryLog,
  quoteRequests,
} from "@/db/schema";
import { sendEmail, getAdminEmails } from "./email";
import { incrementDiscountUse } from "./discounts";
import {
  orderConfirmationEmail,
  adminNewOrderEmail,
  adminQuotePaidEmail,
} from "./email-templates";

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

  // Comptabilise l'utilisation du code promo (paiement confirmé)
  if (order.discountCode) {
    try {
      await incrementDiscountUse(db, order.discountCode);
    } catch (e) {
      console.error("[usage code promo]", e);
    }
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  // Stock bas (ou survente) constaté pendant le décrément — signalé à l'admin
  const lowStock: { name: string; stock: number }[] = [];
  for (const item of items) {
    // Décrément atomique (stock >= quantité évalué par SQLite) : empêche la
    // survente concurrente. On cible la variante si la ligne en a une, sinon
    // le produit. Si le décrément échoue alors qu'un stock est suivi, le
    // paiement étant déjà encaissé on tombe à 0 et on alerte l'admin.
    if (item.variantId) {
      const dec = await db
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} - ${item.quantity}` })
        .where(
          and(
            eq(productVariants.id, item.variantId),
            isNotNull(productVariants.stock),
            gte(productVariants.stock, item.quantity),
          ),
        )
        .returning({ stock: productVariants.stock });
      if (dec.length > 0) {
        const newStock = dec[0].stock ?? 0;
        await db.insert(inventoryLog).values({
          variantId: item.variantId,
          delta: -item.quantity,
          reason: "order",
        });
        if (newStock <= 2) {
          lowStock.push({ name: item.nameSnapshot, stock: newStock });
        }
        continue;
      }
      const [cur] = await db
        .select({ stock: productVariants.stock })
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .limit(1);
      if (cur?.stock != null) {
        await db.insert(inventoryLog).values({
          variantId: item.variantId,
          delta: -cur.stock,
          reason: "order",
        });
        await db
          .update(productVariants)
          .set({ stock: 0 })
          .where(eq(productVariants.id, item.variantId));
        lowStock.push({ name: item.nameSnapshot, stock: 0 });
      }
      continue;
    }

    if (!item.productId) continue;
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

// Passe un devis chiffré en "payé" (idempotent) et notifie l'admin. Appelé par
// le webhook Stripe ET par la page de retour (filet) — le premier arrivé agit.
export async function markQuotePaid(db: Db, quoteId: string) {
  const claimed = await db
    .update(quoteRequests)
    .set({ status: "paid" })
    .where(
      and(
        eq(quoteRequests.id, quoteId),
        inArray(quoteRequests.status, ["quoted", "accepted"]),
      ),
    )
    .returning({ id: quoteRequests.id });
  if (claimed.length === 0) return;

  const [quote] = await db
    .select()
    .from(quoteRequests)
    .where(eq(quoteRequests.id, quoteId))
    .limit(1);
  if (!quote) return;

  try {
    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      await sendEmail(adminQuotePaidEmail(quote, adminEmails));
    }
  } catch (e) {
    console.error("[email devis payé]", e);
  }
}

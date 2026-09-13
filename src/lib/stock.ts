import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import {
  products,
  productVariants,
  inventoryLog,
  discountCodes,
  orders,
  orderItems,
} from "@/db/schema";
import type { Transaction } from "./outbox";
import { aggregateStock } from "./payment-state";
export async function reserveStock(
  tx: Transaction,
  lines: {
    productId: string | null;
    variantId?: string | null;
    quantity: number;
  }[],
  orderId: string,
) {
  for (const line of aggregateStock(lines)) {
    const table = line.variantId ? productVariants : products;
    const id = line.variantId ?? line.productId!;
    const [current] = await tx
      .select({ stock: table.stock })
      .from(table)
      .where(eq(table.id, id))
      .for("update");
    if (!current) throw new Error("unknown_product");
    if (current.stock == null) continue;
    const [reserved] = await tx
      .update(table)
      .set({ stock: sql`${table.stock}-${line.quantity}` })
      .where(and(eq(table.id, id), gte(table.stock, line.quantity)))
      .returning({ stock: table.stock });
    if (!reserved) throw new Error("insufficient_stock");
    await tx.insert(inventoryLog).values({
      variantId: id,
      delta: -line.quantity,
      reason: "reservation:" + orderId,
    });
  }
}
export async function releaseOrderStock(tx: Transaction, orderId: string) {
  const [order] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .for("update");
  if (
    !order ||
    order.status !== "pending" ||
    order.paidAt ||
    order.stockReleasedAt
  )
    return;
  if (order.stockReservedAt) {
    // Les mouvements enregistrés définissent exactement ce qui a été réservé,
    // y compris si le suivi de stock du produit a changé depuis.
    const entries = await tx
      .select()
      .from(inventoryLog)
      .where(eq(inventoryLog.reason, "reservation:" + orderId));
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    for (const entry of entries) {
      const table = items.some((i) => i.variantId === entry.variantId)
        ? productVariants
        : products;
      await tx
        .update(table)
        .set({ stock: sql`${table.stock}-${entry.delta}` })
        .where(and(eq(table.id, entry.variantId), isNotNull(table.stock)));
      await tx.insert(inventoryLog).values({
        variantId: entry.variantId,
        delta: -entry.delta,
        reason: "release:" + orderId,
      });
    }
    if (order.discountCode)
      await tx
        .update(discountCodes)
        .set({ usedCount: sql`greatest(0,${discountCodes.usedCount}-1)` })
        .where(eq(discountCodes.code, order.discountCode));
  }
  await tx
    .update(orders)
    .set({ status: "cancelled", stockReleasedAt: new Date() })
    .where(eq(orders.id, orderId));
}

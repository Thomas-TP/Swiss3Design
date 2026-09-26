import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { price } from "./catalog";

// Suivi de commande sans compte : numéro de commande ET e-mail exact, comme la
// page /track (preuve de possession ; le rate-limit par IP reste à l'appelant).
// Réponse identique si la commande n'existe pas ou si l'e-mail ne concorde
// pas : aucun oracle sur l'existence d'une commande.

export async function findOrderForTracking(orderNumber: string, email: string) {
  const db = await getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.orderNumber, orderNumber.trim().toUpperCase()),
        eq(orders.email, email.trim().toLowerCase()),
      ),
    )
    .limit(1);
  if (!order) return null;
  const items = await db
    .select({
      id: orderItems.id,
      nameSnapshot: orderItems.nameSnapshot,
      colorName: orderItems.colorName,
      colorHex: orderItems.colorHex,
      priceCentsSnapshot: orderItems.priceCentsSnapshot,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(asc(orderItems.id));
  return { order, items };
}

const postTrackingUrl = (trackingNumber: string) =>
  `https://service.post.ch/ekp-web/ui/entry/search/${encodeURIComponent(trackingNumber)}`;

// Vue « agent » : sans adresse postale. L'assistant agit pour le client, mais
// l'adresse n'a pas à transiter par une plateforme d'IA tierce pour suivre un
// colis.
export async function trackOrderForAgent(orderNumber: string, email: string) {
  const found = await findOrderForTracking(orderNumber, email);
  if (!found) return null;
  const { order, items } = found;
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    items: items.map((i) => ({
      name: i.nameSnapshot,
      color: i.colorName,
      quantity: i.quantity,
      unitPrice: price(i.priceCentsSnapshot),
    })),
    subtotal: price(order.subtotalCents),
    shipping: price(order.shippingCents),
    discount: price(order.discountCents),
    total: price(order.totalCents),
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingNumber
      ? postTrackingUrl(order.trackingNumber)
      : null,
  };
}

import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Suivi de commande sans compte : on retrouve une commande par son numéro ET
// l'e-mail utilisé. La combinaison (numéro aléatoire + e-mail exact) sert de
// preuve de possession ; le rate-limiting par IP empêche l'énumération.

const bodySchema = z.object({
  orderNumber: z.string().min(3).max(40),
  email: z.email(),
});

export async function POST(request: Request) {
  if (!(await rateLimit(request, "track-order", { limit: 30, windowS: 600 }))) {
    return tooManyRequests();
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const orderNumber = parsed.data.orderNumber.trim().toUpperCase();
  const email = parsed.data.email.trim().toLowerCase();

  const db = await getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), eq(orders.email, email)))
    .limit(1);

  // Réponse unique si introuvable OU e-mail non concordant : aucun oracle qui
  // révélerait l'existence d'une commande pour une adresse donnée.
  if (!order) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

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

  let address = { name: "", street: "", npa: "", city: "", canton: "" };
  try {
    address = { ...address, ...JSON.parse(order.shippingAddress) };
  } catch {
    // adresse illisible — section masquée côté client
  }

  // DTO public : ni note interne admin, ni identifiants Stripe, ni customerId.
  return Response.json({
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    discountCents: order.discountCents,
    discountCode: order.discountCode,
    totalCents: order.totalCents,
    trackingNumber: order.trackingNumber,
    address,
    items,
  });
}

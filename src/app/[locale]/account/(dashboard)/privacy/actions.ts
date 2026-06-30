"use server";

import { eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, quoteRequests, customerAddresses } from "@/db/schema";
import { getServerSession } from "@/lib/session";

// Export de mes données (droit d'accès nLPD/RGPD) : agrège les données
// personnelles détenues par Swiss3Design en un objet JSON téléchargeable
// côté client. N'inclut pas de champs internes (rôle, hash de mot de
// passe…) — uniquement ce qui concerne directement le client.
export async function exportMyData(): Promise<
  { data: object } | { error: string }
> {
  const session = await getServerSession();
  if (!session) return { error: "unauthorized" };
  const { user } = session;

  const db = await getDb();
  const [myOrders, myQuotes, myAddresses] = await Promise.all([
    db
      .select({
        orderNumber: orders.orderNumber,
        status: orders.status,
        totalCents: orders.totalCents,
        shippingAddress: orders.shippingAddress,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(or(eq(orders.customerId, user.id), eq(orders.email, user.email))),
    db
      .select({
        description: quoteRequests.description,
        status: quoteRequests.status,
        quotedPriceCents: quoteRequests.quotedPriceCents,
        createdAt: quoteRequests.createdAt,
      })
      .from(quoteRequests)
      .where(
        or(
          eq(quoteRequests.customerId, user.id),
          eq(quoteRequests.email, user.email),
        ),
      ),
    db
      .select({
        label: customerAddresses.label,
        name: customerAddresses.name,
        street: customerAddresses.street,
        npa: customerAddresses.npa,
        city: customerAddresses.city,
        canton: customerAddresses.canton,
        isDefault: customerAddresses.isDefault,
      })
      .from(customerAddresses)
      .where(eq(customerAddresses.userId, user.id)),
  ]);

  return {
    data: {
      exportedAt: new Date().toISOString(),
      account: {
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      orders: myOrders,
      quotes: myQuotes,
      addresses: myAddresses,
    },
  };
}

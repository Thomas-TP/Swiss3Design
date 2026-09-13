"use server";

import { eq, or, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  orders,
  quoteRequests,
  customerAddresses,
  passkey,
  orderItems,
  quoteMessages,
  reviews,
  notificationPreferences,
} from "@/db/schema";
import { getServerSession } from "@/lib/session";

// Export de mes données (droit d'accès nLPD/RGPD) : agrège les données
// personnelles détenues par Swiss3Design en un objet JSON téléchargeable
// côté client. N'inclut pas de champs internes (rôle, hash de mot de
// passe…) — uniquement ce qui concerne directement le client.
export async function exportMyData(): Promise<
  { data: object } | { error: string }
> {
  const session = await getServerSession();
  if (!session || !session.user.emailVerified) return { error: "unauthorized" };
  if (Date.now() - new Date(session.session.createdAt).getTime() > 30 * 60000)
    return { error: "reauth_required" };
  const { user } = session;

  const db = await getDb();
  const [myOrders, myQuotes, myAddresses, myPasskeys] = await Promise.all([
    db
      .select({
        id: orders.id,
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
        id: quoteRequests.id,
        description: quoteRequests.description,
        material: quoteRequests.material,
        colors: quoteRequests.colors,
        dimensions: quoteRequests.dimensions,
        adminMessage: quoteRequests.adminMessage,
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
    // Métadonnées uniquement — jamais la clé publique ni l'identifiant de
    // credential, qui n'ont pas de valeur pour l'utilisateur et ne doivent
    // pas quitter le serveur.
    db
      .select({
        name: passkey.name,
        deviceType: passkey.deviceType,
        createdAt: passkey.createdAt,
      })
      .from(passkey)
      .where(eq(passkey.userId, user.id)),
  ]);

  const [items, messages, myReviews, preferences] = await Promise.all([
    myOrders.length
      ? db
          .select()
          .from(orderItems)
          .where(
            inArray(
              orderItems.orderId,
              myOrders.map((o) => o.id),
            ),
          )
      : [],
    myQuotes.length
      ? db
          .select({
            quoteId: quoteMessages.quoteId,
            sender: quoteMessages.sender,
            body: quoteMessages.body,
            priceCents: quoteMessages.priceCents,
            fileName: quoteMessages.fileName,
            createdAt: quoteMessages.createdAt,
          })
          .from(quoteMessages)
          .where(
            inArray(
              quoteMessages.quoteId,
              myQuotes.map((q) => q.id),
            ),
          )
      : [],
    db.select().from(reviews).where(eq(reviews.customerId, user.id)),
    db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, user.id)),
  ]);
  return {
    data: {
      exportedAt: new Date().toISOString(),
      account: {
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
      },
      orders: myOrders,
      orderItems: items,
      quoteMessages: messages,
      reviews: myReviews,
      notificationPreferences: preferences,
      quotes: myQuotes,
      addresses: myAddresses,
      passkeys: myPasskeys,
    },
  };
}

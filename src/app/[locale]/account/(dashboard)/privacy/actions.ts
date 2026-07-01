"use server";

import { eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, quoteRequests, customerAddresses, passkey } from "@/db/schema";
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
  const [myOrders, myQuotes, myAddresses, myPasskeys] = await Promise.all([
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
      quotes: myQuotes,
      addresses: myAddresses,
      passkeys: myPasskeys,
    },
  };
}

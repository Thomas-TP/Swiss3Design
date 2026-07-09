import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import type { getDb } from "@/db";
import { user as userTable } from "@/db/schema";

// Identité Stripe du client, créée paresseusement au premier checkout
// connecté (jamais à l'inscription — beaucoup de comptes n'achètent jamais).
// Permet à Stripe Link de proposer en 1 clic les cartes déjà enregistrées
// par ce client sur d'autres achats Swiss3Design, sans coffre-fort maison
// (pas de stockage de moyen de paiement côté serveur — voir docs/codemap.md).
export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  db: Awaited<ReturnType<typeof getDb>>,
  user: {
    id: string;
    email: string;
    name: string;
    stripeCustomerId: string | null;
  },
): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });

  await db
    .update(userTable)
    .set({ stripeCustomerId: customer.id })
    .where(eq(userTable.id, user.id));

  return customer.id;
}

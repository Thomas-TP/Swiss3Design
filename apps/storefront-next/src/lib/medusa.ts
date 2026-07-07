import Medusa from "@medusajs/js-sdk";
import { readToken } from "./auth-client";

export const medusa = new Medusa({
  baseUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
});

const BETTER_AUTH_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000";

// Échange la session Better Auth active contre un jeton pont court-lived
// (`/api/medusa-bridge-token`, app Next.js racine) puis l'échange à son tour
// contre une session Medusa via l'Auth Module Provider custom
// `better-auth-bridge` (apps/medusa/apps/backend/src/modules/better-auth-bridge).
// Miroir de apps/storefront/src/lib/medusa.ts (storefront SolidStart) —
// même pont, adapté au client Better Auth React.
export async function loginToMedusa(email: string) {
  const token = readToken();
  if (!token) {
    throw new Error("Aucune session Better Auth active");
  }
  const response = await fetch(`${BETTER_AUTH_URL}/api/medusa-bridge-token`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("Impossible d'obtenir le jeton pont Medusa");
  }
  const { token: bridgeToken } = (await response.json()) as { token: string };
  const result = await medusa.auth.login("customer", "better-auth-bridge", { token: bridgeToken });
  if (typeof result !== "string") {
    throw new Error("Réponse d'authentification Medusa inattendue (MFA/redirection non gérée ici)");
  }

  // Le provider better-auth-bridge (comme emailpass) ne fait que résoudre/créer
  // l'AuthIdentity — la toute première authentification n'a pas encore de
  // Customer Medusa lié (app_metadata.customer_id absent), d'où le 401. On
  // crée le profil client à la volée, ce qui termine le lien ; le jeton initial
  // ne reflète pas encore ce lien (actor_id figé à l'émission), d'où le refresh
  // explicite avant de réessayer.
  try {
    await medusa.store.customer.retrieve();
  } catch {
    await medusa.store.customer.create({ email });
    await medusa.auth.refresh();
  }
}

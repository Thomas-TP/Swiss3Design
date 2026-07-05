import Medusa from "@medusajs/js-sdk";
import { authClient } from "./auth-client";

export const medusa = new Medusa({
  baseUrl: import.meta.env.VITE_MEDUSA_BACKEND_URL ?? "http://localhost:9000",
  publishableKey: import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY,
});

// Échange la session Better Auth active contre un jeton pont court-lived
// (`/api/medusa-bridge-token`, app Next.js) puis l'échange à son tour contre
// une session Medusa via l'Auth Module Provider custom `better-auth-bridge`
// (apps/medusa/apps/backend/src/modules/better-auth-bridge). Le SDK Medusa
// stocke ensuite lui-même le jeton client résultant.
export async function loginToMedusa() {
  const response = await authClient.$fetch("/api/medusa-bridge-token", {
    method: "GET",
  });
  if (response.error || !response.data) {
    throw new Error("Impossible d'obtenir le jeton pont Medusa");
  }
  const { token } = response.data as { token: string };
  const result = await medusa.auth.login("customer", "better-auth-bridge", { token });
  if (typeof result !== "string") {
    throw new Error("Réponse d'authentification Medusa inattendue (MFA/redirection non gérée ici)");
  }
}

import { getAuth } from "@/lib/auth";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Endpoints d'authentification sensibles (mot de passe, envoi d'e-mails),
// limités par IP : le rate limiting intégré de better-auth compte en mémoire,
// ce qui ne tient pas sur Workers (chaque isolate a la sienne).
// get-session et les autres lectures ne sont pas limités.
const LIMITED_PREFIXES = [
  "/api/auth/sign-in",
  "/api/auth/sign-up",
  "/api/auth/forget-password",
  "/api/auth/reset-password",
  "/api/auth/send-verification-email",
  "/api/auth/change-password",
  // Vérification 2FA : sans limite, le code TOTP à 6 chiffres (1 M de
  // combinaisons) et les codes de secours seraient forçables par bruteforce.
  "/api/auth/two-factor",
];

// Requêtes du serveur OAuth des agents (oauth-provider) et du profil auth.md :
// seules à déclarer les ressources protégées, jusqu'à ce que l'isolate les ait
// vues insérées une fois (voir getAuth). Drapeau d'isolate, pas d'état métier.
const OAUTH_PREFIXES = ["/api/auth/oauth2/", "/api/auth/agent/"];
let oauthResourcesSeeded = false;

async function handler(request: Request) {
  const { pathname } = new URL(request.url);
  if (request.method === "POST") {
    if (LIMITED_PREFIXES.some((p) => pathname.startsWith(p))) {
      const allowed = await rateLimit(request, "auth", {
        limit: 15,
        windowS: 600,
      });
      if (!allowed) return tooManyRequests();
    }
  }

  const seedOAuthResources =
    !oauthResourcesSeeded && OAUTH_PREFIXES.some((p) => pathname.startsWith(p));
  const auth = await getAuth({ seedOAuthResources });
  const response = await auth.handler(request);
  if (seedOAuthResources && response.status < 500) oauthResourcesSeeded = true;
  return response;
}

export { handler as GET, handler as POST };

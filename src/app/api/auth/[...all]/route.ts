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

async function handler(request: Request) {
  if (request.method === "POST") {
    const { pathname } = new URL(request.url);
    if (LIMITED_PREFIXES.some((p) => pathname.startsWith(p))) {
      const allowed = await rateLimit(request, "auth", {
        limit: 15,
        windowS: 600,
      });
      if (!allowed) return tooManyRequests();
    }
  }

  const auth = await getAuth();
  return auth.handler(request);
}

export { handler as GET, handler as POST };

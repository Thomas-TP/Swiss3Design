import { getAuth } from "@/lib/auth";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { corsHeadersFor } from "@/lib/medusa-bridge";

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
  const response = await auth.handler(request);

  // Cross-origin uniquement pour le storefront SolidStart (voir
  // src/lib/medusa-bridge.ts) — même origine (l'app actuelle) : ces en-têtes
  // sont ignorés par le navigateur, aucun changement de comportement.
  const origin = request.headers.get("origin");
  if (origin) {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeadersFor(origin))) {
      headers.set(key, value as string);
    }
    return new Response(response.body, { status: response.status, headers });
  }
  return response;
}

function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeadersFor(request.headers.get("origin")),
  });
}

export { handler as GET, handler as POST, OPTIONS };

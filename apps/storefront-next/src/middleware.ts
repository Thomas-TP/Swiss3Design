import { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next 16 a renommé « middleware » en « proxy », mais proxy.ts impose le
// runtime Node.js, que l'adaptateur OpenNext Cloudflare ne supporte pas
// encore. On conserve donc la convention middleware.ts (Edge runtime) —
// même contrainte que l'app racine, voir AGENTS.md.
const intlMiddleware = createMiddleware(routing);

// En-têtes de sécurité de base (Cloudflare ne les ajoute pas par défaut) —
// identiques à l'app racine.
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// Origines des backends cross-origine (Medusa + serveur d'auth) — inlinées au
// build par Next (préfixe NEXT_PUBLIC_), nécessaires en plus des origines de
// l'app racine (Stripe, Google Fonts, geo.admin.ch) car ce storefront ne fait
// pas que se parler à lui-même contrairement à l'app racine.
const MEDUSA_ORIGIN = new URL(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000").origin;
const BETTER_AUTH_ORIGIN = new URL(process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000").origin;

// Content-Security-Policy : même politique que l'app racine (nonce par
// requête en prod, assouplie en dev pour HMR/eval), étendue aux origines
// cross-origine propres à ce storefront (Medusa Store API, serveur d'auth
// pour toutes les routes cross-origine de src/lib/auth-client.ts et les
// routes /api/* de l'app racine consommées depuis ici).
function buildCsp({ nonce, isProd, origin }: { nonce: string | null; isProd: boolean; origin: string }): string {
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' https://js.stripe.com https://static.cloudflareinsights.com`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://static.cloudflareinsights.com`;
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${MEDUSA_ORIGIN} ${BETTER_AUTH_ORIGIN} https://*.stripe.com https://m.stripe.network https://fonts.googleapis.com https://api3.geo.admin.ch https://cloudflareinsights.com${isProd ? "" : " ws: wss:"}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://m.stripe.network",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    `report-uri ${origin}/api/csp-report`,
    "report-to csp",
    "upgrade-insecure-requests",
  ].join("; ");
}

export default function middleware(request: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";
  const origin = new URL(request.url).origin;
  // Nonce unique et imprévisible par requête (Web Crypto, dispo en Edge).
  const nonce = isProd ? crypto.randomUUID().replace(/-/g, "") : null;
  const csp = buildCsp({ nonce, isProd, origin });

  // Pour que Next applique le nonce à ses scripts (runtime, hydratation RSC),
  // celui-ci doit lui parvenir via les en-têtes de requête. next-intl recopie
  // request.headers dans ses réponses NextResponse.next/rewrite. On ne
  // reconstruit que les requêtes GET (sans corps) pour ne pas perturber
  // d'éventuelles requêtes POST.
  let req = request;
  if (nonce && request.method === "GET") {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    req = new NextRequest(request.url, { headers });
  }

  const response = intlMiddleware(req);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Reporting-Endpoints", `csp="${origin}/api/csp-report"`);

  if (process.env.APP_ENV === "preview") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  // next-intl pose le cookie de langue NEXT_LOCALE sans drapeau de sécurité.
  // On le re-pose durci (Secure en prod, HttpOnly, SameSite=Lax).
  const localeCookie = response.cookies.get("NEXT_LOCALE");
  if (localeCookie) {
    response.cookies.set("NEXT_LOCALE", localeCookie.value, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};

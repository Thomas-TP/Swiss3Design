import { NextResponse, NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next 16 a renommé « middleware » en « proxy », mais proxy.ts impose le
// runtime Node.js, que l'adaptateur OpenNext Cloudflare ne supporte pas encore
// (« Node.js middleware is not currently supported »). On conserve donc la
// convention middleware.ts, qui reste compilée en Edge runtime — seul format
// déployable sur Cloudflare Workers.
const intlMiddleware = createMiddleware(routing);

// En-têtes de sécurité de base (Cloudflare ne les ajoute pas par défaut)
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// Content-Security-Policy : limite les origines sans casser les services
// réellement utilisés —
//  • Stripe (script + iframes 3DS + appels réseau)
//  • Google Fonts (CSS lu par Stripe Elements pour la police Geist des iframes)
//  • autocomplétion d'adresse geo.admin.ch (connect)
//  • Cloudflare Web Analytics (beacon, sans cookie) — à activer dans le dashboard
//  • avatars Google et images produits (img https:)
//
// En production, les scripts inline injectés par Next sont autorisés via un
// nonce par requête (cf. middleware ci-dessous) plutôt que par 'unsafe-inline'
// — recommandation OWASP, supprime le vecteur XSS d'exécution de scripts inline.
// En dev, Next/HMR ont besoin d'inline + eval sans nonce : on assouplit pour ne
// pas casser `npm run dev`, la politique stricte ne vaut qu'en production.
function buildCsp({
  nonce,
  isProd,
  origin,
}: {
  nonce: string | null;
  isProd: boolean;
  origin: string;
}): string {
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
    `connect-src 'self' https://*.stripe.com https://m.stripe.network https://fonts.googleapis.com https://api3.geo.admin.ch https://cloudflareinsights.com${isProd ? "" : " ws: wss:"}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://m.stripe.network",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    `report-uri ${origin}/api/csp-report`,
    "report-to csp",
    "upgrade-insecure-requests",
  ].join("; ");
}

export default function middleware(request: NextRequest) {
  // www.swiss3design.ch → swiss3design.ch (canonique)
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const url = new URL(request.url);
    url.host = host.slice(4);
    return NextResponse.redirect(url, 301);
  }

  const isProd = process.env.NODE_ENV === "production";
  const origin = new URL(request.url).origin;
  // Nonce unique et imprévisible par requête (Web Crypto, dispo en Edge).
  const nonce = isProd ? crypto.randomUUID().replace(/-/g, "") : null;
  const csp = buildCsp({ nonce, isProd, origin });

  // Pour que Next applique le nonce à ses scripts (runtime, hydratation RSC),
  // celui-ci doit lui parvenir via les en-têtes de requête. next-intl recopie
  // request.headers dans ses réponses NextResponse.next/rewrite, donc Next les
  // reçoit en aval. On ne reconstruit que les requêtes GET (sans corps) afin de
  // ne pas perturber les POST des server actions (formulaire de devis, etc.).
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

  // Environnement de preview (wrangler.jsonc → env.preview.vars.APP_ENV) :
  // désindexation complète, indépendante de robots.txt qui ne couvre que la
  // prod. Le Worker preview tourne sur sa propre URL *.workers.dev — jamais
  // de contenu dupliqué indexable.
  if (process.env.APP_ENV === "preview") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  // next-intl pose le cookie de langue NEXT_LOCALE sans drapeau de sécurité.
  // On le re-pose durci (Secure en prod, HttpOnly, SameSite=Lax). Ce cookie ne
  // contient qu'un code de langue : la synchro côté client de next-intl n'est
  // qu'une optimisation, le proxy le repose à chaque navigation côté serveur,
  // donc HttpOnly ne casse pas le changement de langue.
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

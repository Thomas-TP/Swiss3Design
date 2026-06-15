import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next 16 : le middleware s'appelle désormais « proxy » (même fonctionnement).
const intlMiddleware = createMiddleware(routing);

// En-têtes de sécurité de base (Cloudflare ne les ajoute pas par défaut)
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// Content-Security-Policy : limite les origines sans casser les services
// réellement utilisés —
//  • Stripe (script + iframes 3DS + appels réseau)
//  • autocomplétion d'adresse geo.admin.ch (connect)
//  • Cloudflare Web Analytics (beacon, sans cookie) — à activer dans le dashboard
//  • avatars Google et images produits (img https:)
// Next 16 injecte des scripts inline sans nonce → 'unsafe-inline' nécessaire.
// En dev, Next a besoin d'eval (HMR) et de websockets : on assouplit pour ne
// pas casser `npm run dev`, la politique stricte ne vaut qu'en production.
function buildCsp(): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' https://*.stripe.com https://m.stripe.network https://api3.geo.admin.ch https://cloudflareinsights.com${dev ? " ws: wss:" : ""}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://m.stripe.network",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export default function proxy(request: NextRequest) {
  // www.swiss3design.ch → swiss3design.ch (canonique)
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const url = new URL(request.url);
    url.host = host.slice(4);
    return NextResponse.redirect(url, 301);
  }
  const response = intlMiddleware(request);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  response.headers.set("Content-Security-Policy", buildCsp());
  return response;
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};

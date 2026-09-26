import { NextResponse, NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import {
  ANALYTICS_RELAY_PATH,
  POSTHOG_ASSET_HOST,
  POSTHOG_INGEST_HOST,
} from "./lib/analytics-config";

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
//  • PostHog : la mesure passe par le relais first-party ('self') ; les hôtes
//    *.posthog.com ne servent qu'au toolbar (heatmaps affichées sur le site
//    réel, ouvert depuis l'application PostHog)
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
    ? `script-src 'self' 'nonce-${nonce}' https://js.stripe.com https://static.cloudflareinsights.com https://*.posthog.com`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://static.cloudflareinsights.com https://*.posthog.com`;
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.posthog.com",
    "font-src 'self' https://fonts.gstatic.com https://*.posthog.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' https://*.stripe.com https://m.stripe.network https://fonts.googleapis.com https://api3.geo.admin.ch https://cloudflareinsights.com https://*.posthog.com${isProd ? "" : " ws: wss:"}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://m.stripe.network",
    "worker-src 'self' blob: data:",
    "manifest-src 'self'",
    `report-uri ${origin}/api/csp-report`,
    "report-to csp",
    "upgrade-insecure-requests",
  ].join("; ");
}

// Fichiers racine générés par l'app : hors préfixe de langue, mais ils doivent
// passer ici pour la redirection http→https / www→apex. Sans elle,
// http://…/robots.txt répondait 200 et déclarait http://…/sitemap.xml : Ahrefs
// voyait deux sitemaps (« Page in multiple sitemaps ») et des URL http.
const ROOT_FILES = new Set(["/robots.txt", "/sitemap.xml", "/llms.txt"]);

function withSecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS))
    response.headers.set(key, value);
  return response;
}

// Relais PostHog, traité ici plutôt que par une route Next : la requête ne
// traverse pas le serveur Next (quelques millisecondes de CPU au lieu d'un
// rendu complet, à chaque lot d'événements) et on choisit précisément les
// en-têtes transmis. Une réécriture next.config ferait suivre TOUS les
// en-têtes, dont le cookie de session better-auth, jusque chez PostHog.
const RELAY_REQUEST_HEADERS = [
  "content-type",
  "user-agent",
  "accept",
  "accept-language",
];
const RELAY_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "last-modified",
];

async function relayToPostHog(request: NextRequest, url: URL) {
  if (!["GET", "HEAD", "POST"].includes(request.method))
    return new Response(null, { status: 405 });
  const path = url.pathname.slice(ANALYTICS_RELAY_PATH.length) || "/";
  // Hôte cible fixe : un chemin forgé ne peut pas viser un autre domaine.
  const target = new URL(
    `${path}${url.search}`,
    path.startsWith("/static/") ? POSTHOG_ASSET_HOST : POSTHOG_INGEST_HOST,
  );
  const headers = new Headers();
  for (const name of RELAY_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Géolocalisation (pays, ville) : PostHog lit l'IP du visiteur ici, puis
  // l'écarte (réglage « Discard client IP data » du projet).
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "POST" ? await request.arrayBuffer() : null,
      redirect: "manual",
    });
    const out = new Headers({ "X-Content-Type-Options": "nosniff" });
    for (const name of RELAY_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) out.set(name, value);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: out,
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}

export default function middleware(request: NextRequest) {
  const original = new URL(request.url);
  if (
    ["swiss3design.ch", "www.swiss3design.ch"].includes(original.hostname) &&
    original.protocol === "http:"
  ) {
    original.protocol = "https:";
    original.hostname = "swiss3design.ch";
    return NextResponse.redirect(original, 308);
  }
  if (
    original.pathname === ANALYTICS_RELAY_PATH ||
    original.pathname.startsWith(`${ANALYTICS_RELAY_PATH}/`)
  ) {
    return relayToPostHog(request, original);
  }
  // Les routes API ne sont jamais redirigées (webhooks, callbacks OAuth : un
  // 301 sur un POST les casserait).
  if (original.pathname.startsWith("/api/")) {
    return withSecurityHeaders(NextResponse.next());
  }
  // www.swiss3design.ch → swiss3design.ch (canonique). La redirection porte
  // elle aussi HSTS : sans lui, le sous-domaine www était signalé « ne
  // supporte pas HSTS » (Semrush), le preload exigeant l'en-tête partout.
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const url = new URL(request.url);
    url.host = host.slice(4);
    return withSecurityHeaders(NextResponse.redirect(url, 301));
  }
  if (ROOT_FILES.has(original.pathname)) {
    return withSecurityHeaders(NextResponse.next());
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

  const response = withSecurityHeaders(intlMiddleware(req));
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
  // Tout sauf les assets (chemins avec un point)… à l'exception des fichiers
  // racine générés (ROOT_FILES), qui ont besoin des redirections canoniques,
  // et du relais PostHog, dont les scripts (…/static/recorder.js) ont un point.
  matcher: [
    "/((?!_next|_vercel|.*\\..*).*)",
    "/robots.txt",
    "/sitemap.xml",
    "/llms.txt",
    "/api/relay/:path*",
  ],
};

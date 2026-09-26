// Mesure d'audience : PostHog, région UE (Francfort), en mode sans cookie.
// Trois règles :
//  1. posthog-js n'est importé QUE par instrumentation-client.ts, en idle.
//     Ce module-ci n'en dépend pas (types seulement) : pages serveur et
//     composants client peuvent l'importer sans que posthog-js entre dans
//     le bundle du Worker (rendu serveur des composants client compris).
//  2. Les événements émis avant ce chargement attendent dans une file bornée.
//  3. Rien de personnel ne part : URL réduites à une liste blanche de
//     paramètres, adresses e-mail masquées, espace admin jamais mesuré.
import type {
  CaptureResult,
  PostHog,
  PostHogConfig,
  Properties,
} from "posthog-js";
import type { CartItem } from "./cart-data";
import {
  ANALYTICS_HOSTNAME,
  ANALYTICS_RELAY_PATH,
  POSTHOG_UI_HOST,
} from "./analytics-config";

// Clé de projet PostHog : publique par nature (elle part dans chaque
// navigateur), comme la clé publiable Stripe — d'où .env.production.
export const POSTHOG_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_TOKEN;
const OPT_OUT_KEY = "s3d-analytics-optout";
const INTERNAL_KEY = "s3d-internal";
const MAX_QUEUE = 50;

// Paramètres d'URL conservés : campagnes (utm, identifiants de clic) et
// recherche/filtres du catalogue. Tout le reste disparaît avant l'envoi :
// session_id Stripe de la confirmation, email pré-rempli de l'inscription,
// order du suivi de commande, jetons de réinitialisation…
const KEPT_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "ttclid",
  "li_fat_id",
  "twclid",
  "ref",
  "q",
  "sort",
  "category",
  "material",
  "color",
  "multicolor",
]);

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const HREF_IN_CHAIN = /((?:attr__)?href=")([^"]*)(")/g;
const URL_KEY = /(?:url|referrer|href)$/i;
const ADMIN_PATH = /^\/(?:fr|de|it|en)\/admin(?:\/|$)/;
const ABSOLUTE_URL = /^[a-z][\w+.-]*:/i;

export function sanitizeUrl(value: string): string {
  if (!value.includes("?")) return value;
  try {
    const url = new URL(value, "https://relative.invalid");
    // Copie des clés : supprimer pendant l'itération du live iterator en
    // sauterait certaines.
    for (const key of Array.from(url.searchParams.keys()))
      if (!KEPT_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
    return ABSOLUTE_URL.test(value)
      ? url.toString()
      : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value.slice(0, value.indexOf("?"));
  }
}

// Parcourt propriétés, $set et $elements (liens cliqués capturés par
// l'autocapture : le lien « Créer un compte » de la confirmation porte
// l'e-mail du client dans son href).
function clean(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    let out = URL_KEY.test(key) ? sanitizeUrl(value) : value;
    if (key === "$elements_chain")
      out = out.replace(
        HREF_IN_CHAIN,
        (_, open: string, href: string, close: string) =>
          `${open}${sanitizeUrl(href)}${close}`,
      );
    return out.replace(EMAIL, "[email]");
  }
  if (Array.isArray(value)) return value.map((item) => clean(key, item));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, clean(k, v)]),
    );
  return value;
}

export function sanitizeEvent(
  event: CaptureResult | null,
): CaptureResult | null {
  if (!event) return null;
  const pathname = event.properties?.$pathname;
  if (typeof pathname === "string" && ADMIN_PATH.test(pathname)) return null;
  // Enregistrements de session (phase 2, avec consentement) : champs déjà
  // masqués par le SDK, et trop volumineux pour un parcours complet.
  if (event.event === "$snapshot") return event;
  return {
    ...event,
    properties: clean("properties", event.properties) as Properties,
    ...(event.$set && { $set: clean("$set", event.$set) as Properties }),
    ...(event.$set_once && {
      $set_once: clean("$set_once", event.$set_once) as Properties,
    }),
  };
}

// ── Chargement et file d'attente ─────────────────────────────────────────────

let client: PostHog | null = null;
// null = mesure désactivée (dev, preview, refus, admin) : on n'empile plus.
let queue: ((posthog: PostHog) => void)[] | null = [];
// Chargeur fourni par instrumentation-client.ts (seul à importer posthog-js).
let loader: (() => void) | null = null;

function flag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function analyticsAllowed(): boolean {
  return (
    Boolean(POSTHOG_TOKEN) &&
    window.location.hostname === ANALYTICS_HOSTNAME &&
    !flag(OPT_OUT_KEY) &&
    !flag(INTERNAL_KEY)
  );
}

// Pays, canton et ville posés sur <html> par le layout (géolocalisation
// Cloudflare). En mode sans cookie, PostHog retire l'IP avant son propre
// enrichissement GeoIP : sans ces propriétés, aucun pays ni région dans les
// rapports. $geoip_disable empêche PostHog de les écraser par la suite.
function geoProperties(): Properties {
  const data = document.documentElement.dataset;
  const country = data.geoCountry;
  // XX = pays inconnu, T1 = réseau Tor.
  if (!country || country === "XX" || country === "T1")
    return { $geoip_disable: true };
  let countryName: string | undefined;
  try {
    countryName = new Intl.DisplayNames(["en"], { type: "region" }).of(country);
  } catch {
    /* Le code pays suffit. */
  }
  return Object.fromEntries(
    Object.entries({
      $geoip_disable: true,
      $geoip_country_code: country,
      $geoip_country_name: countryName,
      $geoip_continent_code: data.geoContinent,
      $geoip_subdivision_1_code: data.geoRegionCode,
      $geoip_subdivision_1_name: data.geoRegion,
      $geoip_city_name: data.geoCity,
      $geoip_time_zone: data.geoTz,
    }).filter(([, value]) => value),
  );
}

export function posthogConfig(): Partial<PostHogConfig> {
  const geo = geoProperties();
  return {
    api_host: ANALYTICS_RELAY_PATH,
    ui_host: POSTHOG_UI_HOST,
    // Figé volontairement : les millésimes suivants activent la capture des
    // corps de requêtes réseau dans les enregistrements.
    defaults: "2026-05-30",
    // Aucun cookie ni stockage local : visiteurs comptés par une empreinte
    // anonyme calculée chez PostHog (réglage « Cookieless server hash mode »
    // activé dans le projet, sinon les événements sont ignorés).
    cookieless_mode: "always",
    person_profiles: "identified_only",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: true,
    capture_dead_clicks: true,
    capture_heatmaps: true,
    capture_performance: { web_vitals: true, network_timing: false },
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    // Réservés à la phase 2 (bandeau de consentement) : enregistrements,
    // sondages et flags exigent un stockage dans le navigateur.
    disable_session_recording: true,
    disable_surveys: true,
    disable_web_experiments: true,
    // Sans flags, pas de configuration distante : tout est explicite ici.
    advanced_disable_flags: true,
    before_send: [
      (event) =>
        event && { ...event, properties: { ...geo, ...event.properties } },
      sanitizeEvent,
    ],
  };
}

// Appelé par instrumentation-client.ts : enregistre le chargeur, et coupe la
// file tout de suite si la mesure est exclue sur ce navigateur.
export function registerAnalyticsLoader(load: () => void) {
  loader = load;
  if (!analyticsAllowed()) queue = null;
}

// Appelé une fois posthog.init() fait : vide la file d'attente.
export function attachPostHog(posthog: PostHog) {
  client = posthog;
  const pending = queue ?? [];
  queue = [];
  for (const run of pending) run(posthog);
}

function withPostHog(run: (posthog: PostHog) => void) {
  if (client) run(client);
  else if (queue && queue.length < MAX_QUEUE) queue.push(run);
}

export function track(event: string, properties?: Properties) {
  withPostHog((posthog) => {
    posthog.capture(event, properties);
  });
}

export function trackException(error: unknown, properties?: Properties) {
  withPostHog((posthog) => {
    posthog.captureException(error, properties);
  });
}

// ── Refus (politique de confidentialité) et exclusion de l'équipe ───────────

const OPT_OUT_EVENT = "s3d-analytics-optout";

export function isAnalyticsOptedOut(): boolean {
  return flag(OPT_OUT_KEY);
}

// Pour useSyncExternalStore : le choix peut changer ici ou dans un autre
// onglet (événement storage).
export function subscribeAnalyticsOptOut(onChange: () => void) {
  window.addEventListener(OPT_OUT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(OPT_OUT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setAnalyticsOptOut(optOut: boolean) {
  try {
    if (optOut) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* Stockage bloqué : le choix vaut pour la page en cours. */
  }
  window.dispatchEvent(new Event(OPT_OUT_EVENT));
  if (optOut) {
    client?.opt_out_capturing();
    queue = null;
  } else if (client) {
    client.opt_in_capturing();
  } else {
    queue = [];
    loader?.();
  }
}

// Posé à chaque passage dans l'admin : les visites de l'équipe ne faussent
// plus les statistiques de la boutique, sur ce navigateur.
export function markInternalVisitor() {
  try {
    localStorage.setItem(INTERNAL_KEY, "1");
  } catch {
    /* Stockage bloqué : l'admin reste de toute façon exclu (sanitizeEvent). */
  }
  client?.opt_out_capturing();
  queue = null;
}

// ── Propriétés e-commerce (spécification PostHog) ────────────────────────────

// Montants en francs (décimaux), devise explicite : c'est ce que lit
// l'analyse des revenus de PostHog.
export const chf = (cents: number) => Math.round(cents) / 100;

type ProductLike = Pick<
  CartItem,
  "productId" | "slug" | "name" | "priceCents"
> &
  Partial<
    Pick<CartItem, "variantName" | "colorName" | "saleType" | "quantity">
  >;

export function productProperties(item: ProductLike): Properties {
  return {
    product_id: item.productId,
    sku: item.slug,
    name: item.name,
    price: chf(item.priceCents),
    quantity: item.quantity ?? 1,
    currency: "CHF",
    variant:
      [item.variantName, item.colorName].filter(Boolean).join(" / ") ||
      undefined,
    sale_type: item.saleType,
  };
}

export function cartProperties(items: CartItem[]): Properties {
  const cents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  return {
    products: items.map(productProperties),
    value: chf(cents),
    currency: "CHF",
    quantity: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

import { routing, type Locale } from "@/i18n/routing";

// URL canonique — à mettre à jour avec le domaine définitif de ce storefront
// une fois la bascule Phase 6 décidée (pour l'instant, seul swiss3design.ch
// existe réellement en production).
export const SITE_URL = "https://swiss3design.ch";

export function alternatesFor(locale: Locale, path = "") {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = `/${l}${path}`;
  languages["x-default"] = `/${routing.defaultLocale}${path}`;
  return { canonical: `/${locale}${path}`, languages };
}

// Données structurées de l'entreprise (rich results Google) - miroir de
// src/lib/seo.ts côté app Next.js racine.
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: "Swiss3Design",
    url: SITE_URL,
    logo: `${SITE_URL}/brand/logo.png`,
    image: `${SITE_URL}/brand/social/og-image.png`,
    email: "contact@swiss3design.ch",
    areaServed: { "@type": "Country", name: "Switzerland" },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Gland",
      addressRegion: "VD",
      addressCountry: "CH",
    },
    currenciesAccepted: "CHF",
  };
}

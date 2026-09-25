import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "de", "it", "en"],
  // Repli français (boutique romande) ; la langue du navigateur est détectée
  // automatiquement par le proxy next-intl (en-tête Accept-Language).
  defaultLocale: "fr",
  // Pas d'en-tête HTTP `Link` hreflang : les alternates sont posés dans le
  // <head> par chaque page (lib/seo.ts → alternatesFor). Les deux sources
  // cumulées produisaient des doublons et un x-default vers « /contact » (sans
  // préfixe, redirection 307) — 3 erreurs Ahrefs sur toutes les pages.
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];

import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "de", "it", "en"],
  // Repli français (boutique romande) ; la langue du navigateur est détectée
  // automatiquement par le proxy next-intl (en-tête Accept-Language).
  defaultLocale: "fr",
});

export type Locale = (typeof routing.locales)[number];

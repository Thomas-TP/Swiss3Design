import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "./routing";

// import() statique de apps/storefront-next/messages/*.json — une COPIE
// générée par scripts/sync-messages.mjs (avant chaque dev/build/preview/
// deploy) à partir de messages/*.json à la racine du monorepo, seule
// source de vérité éditée à la main (partagée avec l'app Next.js racine).
// Deux contraintes empêchent un import direct vers la racine du monorepo :
// Turbopack refuse de résoudre tout fichier hors de turbopack.root (scopé à
// cette app pour la vitesse de dev, cf. next.config.ts — "Module not
// found" silencieux) et, une fois déployé, Cloudflare Workers n'a pas de
// filesystem réel à l'exécution (un fs.readFile marchait en dev/`next
// start` mais y échouerait). Un import() statique est résolu au build par
// le bundler (Turbopack en dev, webpack pour le build OpenNext, cf.
// AGENTS.md règle d'or 3) et le JSON est embarqué dans le bundle — aucun
// accès disque requis à l'exécution, donc compatible Workers.
const MESSAGE_LOADERS: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  fr: () => import("../../messages/fr.json"),
  de: () => import("../../messages/de.json"),
  it: () => import("../../messages/it.json"),
  en: () => import("../../messages/en.json"),
};

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const { default: messages } = await MESSAGE_LOADERS[locale]();

  return { locale, messages };
});

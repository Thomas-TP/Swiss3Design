import { readFile } from "node:fs/promises";
import path from "node:path";
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// Lecture fs directe (pas un import() dynamique) : messages/*.json vit hors
// de la racine Turbopack de cette app (turbopack.root la scope à
// apps/storefront-next pour la vitesse de dev, cf. next.config.ts) - un
// import() relatif vers l'extérieur de cette racine échoue silencieusement
// sous Turbopack (404 générique, aucune erreur serveur visible). fs échappe
// entièrement à la résolution de modules.
const MESSAGES_DIR = path.resolve(process.cwd(), "../../messages");

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const raw = await readFile(path.join(MESSAGES_DIR, `${locale}.json`), "utf-8");

  return {
    locale,
    // Source de vérité unique avec l'app Next.js racine : réutilisé tel
    // quel, aucune duplication de traduction.
    messages: JSON.parse(raw),
  };
});

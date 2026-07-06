import fr from "../../../../messages/fr.json";
import de from "../../../../messages/de.json";
import it from "../../../../messages/it.json";
import en from "../../../../messages/en.json";

// Réutilise messages/*.json tel quel (source de vérité partagée avec l'app
// Next.js) — voir docs/plan Phase 5. Le format (interpolation {clé} et
// pluriels ICU) est résolu par src/i18n/format.ts, pas par le résolveur par
// défaut de @solid-primitives/i18n (syntaxe {{ clé }} différente).
export const LOCALES = ["fr", "de", "it", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

export const messages = { fr, de, it, en } satisfies Record<Locale, unknown>;
export type Messages = typeof messages.fr;

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

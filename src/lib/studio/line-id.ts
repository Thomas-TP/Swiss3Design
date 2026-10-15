// Identité d'une ligne du Studio (panier, commande) : l'empreinte de ce qui
// s'imprime. Léger (FNV-1a, aucun import de géométrie) : lu par le panier du
// navigateur comme par le serveur. Pas une empreinte de sécurité : le serveur
// ne s'y fie pas, il revalide la configuration et refait le prix.
import { canonicalJson, fnv1a64 } from "./kernel/hash";
import type { StudioConfig, StudioTexts } from "./types";

export type LineLocale = "fr" | "de" | "it" | "en";

/**
 * La langue n'entre dans l'empreinte que si elle change ce qui s'imprime :
 * l'étiquette de la Montagne (altitude en « 2 566 » ou « 2’566 ») quand elle
 * porte un texte. Même règle que `studioHash` (stl.ts).
 */
export function printLocale(
  config: StudioConfig,
  texts: StudioTexts,
  locale: LineLocale,
): LineLocale | null {
  return config.object === "montagne" && config.label && texts.peak
    ? locale
    : null;
}

/** 16 caractères hexadécimaux : configuration + textes saisis (nettoyés) + langue utile. */
export function studioLineId(
  config: StudioConfig,
  texts: StudioTexts,
  locale: LineLocale,
): string {
  return fnv1a64(
    canonicalJson({
      config,
      texts,
      locale: printLocale(config, texts, locale),
    }),
  );
}

// Champs de texte des objets du Studio (brief « Strates », §6.2 : longueurs ;
// §6.6 : les textes sont bornés en longueur, rendus en géométrie, relus par un
// humain). Un texte n'est JAMAIS une configuration : il ne passe ni par le
// fragment d'URL ni par un événement d'analytics (types.ts, `StudioTexts`).
import type { StudioObjectId, StudioTexts } from "../types";
import { codePoints, normalizeText } from "./layout";

/** Longueurs maximales saisissables (points de code), tableaux du §6.2. */
export const TEXT_LIMITS = {
  name: 24,
  role: 30,
  line1: 30,
  line2: 30,
  peak: 12,
  text: 14,
} as const satisfies Record<keyof StudioTexts, number>;

export type TextField = keyof typeof TEXT_LIMITS;

/** Plafond dur du maillage : un texte plus long est tronqué avant tout calcul (le garde-fou signale le dépassement). */
export const TEXT_HARD_MAX = 64;

/** Champs de texte de chaque objet, dans l'ordre d'affichage. */
export const OBJECT_TEXT_FIELDS: Record<StudioObjectId, readonly TextField[]> =
  {
    lavaux: [],
    cartouche: ["name", "role", "line1", "line2"],
    relief: ["peak"],
    borne: ["text"],
  };

/**
 * Textes d'exemple (français) : ceux qui s'impriment tant que le visiteur n'a
 * rien saisi, et qui servent aux posters, aux statistiques du défaut et aux
 * tests. Les mêmes, traduits, sont dans `studioCore.examples.*` (un test
 * vérifie que le français ne dérive pas).
 */
export const DEFAULT_TEXTS: Readonly<Record<StudioObjectId, StudioTexts>> = {
  lavaux: {},
  cartouche: {
    name: "Léa Dubois",
    role: "Architecte",
    line1: "lea@exemple.ch",
    line2: "+41 21 000 00 00",
  },
  relief: { peak: "Léa" },
  borne: { text: "Léa" },
};

/**
 * Un champ prêt à être mesuré : normalisé (NFC), espaces de bord retirés,
 * espaces multiples fusionnés, tronqué au plafond dur. Un champ absent ou vide
 * donne une chaîne vide (la ligne n'est pas tracée).
 */
export function cleanText(value: string | undefined): string {
  if (!value) return "";
  const collapsed = normalizeText(value)
    .replace(/[ \t]+/g, " ")
    .trim();
  const chars = codePoints(collapsed);
  return chars.length > TEXT_HARD_MAX
    ? chars.slice(0, TEXT_HARD_MAX).join("")
    : collapsed;
}

/** Textes de l'objet seulement, nettoyés ; les champs des autres objets sont ignorés. */
export function sanitizeTexts(
  object: StudioObjectId,
  texts: StudioTexts | undefined,
): StudioTexts {
  const out: StudioTexts = {};
  for (const field of OBJECT_TEXT_FIELDS[object]) {
    const value = cleanText(texts?.[field]);
    if (value) out[field] = value;
  }
  return out;
}

/** Vrai si le champ dépasse sa longueur saisissable. */
export function overLimit(field: TextField, value: string): boolean {
  return codePoints(value).length > TEXT_LIMITS[field];
}

// Règles sur les textes d'un objet avant de l'envoyer à l'atelier ou de l'acheter :
// quels champs comptent, lequel manque, lesquels s'impriment. Pur TypeScript,
// partagé par l'interface (components/studio/objects.ts les ré-exporte), le
// panier et le serveur de paiement (purchase.ts) : l'écran et le serveur
// appliquent EXACTEMENT les mêmes règles.
import type { StudioConfig, StudioObjectId, StudioTexts } from "../types";
import { OBJECT_TEXT_FIELDS, cleanText, type TextField } from "./fields";

/** Champs de texte de l'objet, et seulement ceux dont la configuration a besoin. */
export function textFieldsFor(config: StudioConfig): readonly TextField[] {
  const fields = OBJECT_TEXT_FIELDS[config.object];
  // L'étiquette de la montagne n'existe que si elle est activée.
  if (config.object === "montagne" && !config.label) return [];
  return fields;
}

export function hasTextFields(config: StudioConfig): boolean {
  return textFieldsFor(config).length > 0;
}

/**
 * Premier champ à remplir avant l'envoi, ou null. Un porte-nom sans texte est
 * « imprimable » pour les garde-fous (rien à mesurer) : l'atelier recevrait une
 * plaque vide. La carte exige un nom ; la montagne un texte d'étiquette seulement
 * si l'étiquette est activée.
 */
export function missingText(
  config: StudioConfig,
  texts: StudioTexts,
): TextField | null {
  switch (config.object) {
    case "cartouche":
      return cleanText(texts.name) ? null : "name";
    case "borne":
      return cleanText(texts.text) ? null : "text";
    case "montagne":
      return config.label && !cleanText(texts.peak) ? "peak" : null;
    default:
      return null;
  }
}

/** Textes à imprimer, nettoyés, dans l'ordre d'affichage des champs (champs vides omis). */
export function printedTexts(
  config: StudioConfig,
  texts: StudioTexts,
): { field: TextField; value: string }[] {
  const out: { field: TextField; value: string }[] = [];
  for (const field of textFieldsFor(config)) {
    const value = cleanText(texts[field]);
    if (value) out.push({ field, value });
  }
  return out;
}

/** Copie des textes limitée aux champs de l'objet (un autre objet n'emporte pas le nom saisi ailleurs). */
export function textsForObject(
  object: StudioObjectId,
  texts: StudioTexts,
): StudioTexts {
  const out: StudioTexts = {};
  for (const field of OBJECT_TEXT_FIELDS[object]) {
    if (texts[field] !== undefined) out[field] = texts[field];
  }
  return out;
}

/**
 * Textes à ACHETER : ceux que le visiteur a saisis, nettoyés (NFC, espaces,
 * plafond dur) et limités aux champs dont la configuration a besoin (pas de
 * nom de sommet si l'étiquette de la Montagne est désactivée). Jamais les
 * textes d'exemple. Idempotent : c'est la forme stockée dans le panier, envoyée
 * au serveur, recalculée par lui et gardée dans la commande.
 */
export function purchaseTexts(
  config: StudioConfig,
  texts: StudioTexts | undefined,
): StudioTexts {
  const out: StudioTexts = {};
  for (const field of textFieldsFor(config)) {
    const value = cleanText(texts?.[field]);
    if (value) out[field] = value;
  }
  return out;
}

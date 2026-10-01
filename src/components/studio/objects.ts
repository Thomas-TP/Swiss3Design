// Ce que l'interface sait des quatre objets du Studio, sans React ni three :
// vues disponibles, champs de texte, exigences avant l'envoi, choix de la
// vue 2D exacte. Testé (objects.test.ts) : l'interface ne fait qu'appeler.
import { MAX_BANDS } from "@/lib/studio/ranges";
import {
  OBJECT_TEXT_FIELDS,
  cleanText,
  type TextField,
} from "@/lib/studio/text/fields";
import {
  STUDIO_OBJECT_IDS,
  type StudioConfig,
  type StudioObjectId,
  type StudioTexts,
} from "@/lib/studio/types";

export { OBJECT_TEXT_FIELDS, STUDIO_OBJECT_IDS };

/** Les vues de la scène : 3/4 (orbite), Plan, Élévation (2D exacte) et Couches. */
export type StudioViewMode = "orbit" | "plan" | "elevation" | "layers";

/**
 * Vues proposées : l'Élévation (silhouette latérale) n'a de sens que pour le
 * vase ; les objets plats n'ont que leur Plan comme dessin 2D exact.
 */
export function viewsFor(object: StudioObjectId): StudioViewMode[] {
  return object === "lavaux"
    ? ["orbit", "plan", "elevation", "layers"]
    : ["orbit", "plan", "layers"];
}

/** Vue 2D exacte de l'objet (la seule disponible sans WebGL) : élévation du vase, plan des objets plats. */
export function flatViewOf(object: StudioObjectId): "elevation" | "plan" {
  return object === "lavaux" ? "elevation" : "plan";
}

/** Vue de départ : le 3/4 avec WebGL, sinon le dessin 2D exact. */
export function defaultView(
  object: StudioObjectId,
  has3d: boolean,
): StudioViewMode {
  return has3d ? "orbit" : flatViewOf(object);
}

/** Les bandes de couleur se règlent sur une barre altimétrique (vase et sous-verre). */
export function hasBandBar(object: StudioObjectId): boolean {
  return object === "lavaux" || object === "relief";
}

export function minBands(object: StudioObjectId): number {
  return object === "relief" ? 2 : 1;
}

export { MAX_BANDS };

/** Champs de texte de l'objet, et seulement ceux dont la configuration a besoin. */
export function textFieldsFor(config: StudioConfig): readonly TextField[] {
  const fields = OBJECT_TEXT_FIELDS[config.object];
  // L'étiquette du sous-verre n'existe que si elle est activée.
  if (config.object === "relief" && !config.label) return [];
  return fields;
}

export function hasTextFields(config: StudioConfig): boolean {
  return textFieldsFor(config).length > 0;
}

/**
 * Premier champ à remplir avant l'envoi, ou null. Un porte-nom sans texte est
 * « imprimable » pour les garde-fous (rien à mesurer) : l'atelier recevrait une
 * plaque vide. La carte exige un nom ; le sous-verre un texte d'étiquette seulement
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
    case "relief":
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

// Textes du Studio : ceux que le visiteur a saisis, et ceux qu'on affiche
// (brief « Strates », §4.5, §4.10, §6.8). Fonctions pures et testées
// (texts.test.ts).
//
// Tant que le visiteur n'a rien saisi pour un objet, l'aperçu montre le texte
// d'exemple (traduit : « Léa Dubois », « Architecte »…) pour que l'objet ait
// l'air fini ; dès qu'il touche un champ, l'aperçu ne montre plus que ce qu'il a
// écrit (un champ resté vide n'imprime rien). L'EXEMPLE N'EST JAMAIS ENVOYÉ :
// l'export, la demande de devis et l'empreinte du fichier ne lisent que les
// textes saisis (`texts`), jamais les textes affichés (`displayTexts`).
import { OBJECT_TEXT_FIELDS, cleanText } from "@/lib/studio/text/fields";
import type { StudioObjectId, StudioTexts } from "@/lib/studio/types";
import type { Translate } from "./summary";

/** Textes d'exemple de la langue du visiteur (studioCore.examples.*), pour les champs de l'objet. */
export function exampleTexts(
  object: StudioObjectId,
  core: Translate,
): StudioTexts {
  const out: StudioTexts = {};
  for (const field of OBJECT_TEXT_FIELDS[object])
    out[field] = core(`examples.${field}`);
  return out;
}

/** Vrai dès que le visiteur a touché un champ de l'objet (même pour le vider). */
export function isEdited(object: StudioObjectId, texts: StudioTexts): boolean {
  return OBJECT_TEXT_FIELDS[object].some((field) => texts[field] !== undefined);
}

/** Textes à AFFICHER : ceux du visiteur s'il en a saisi, sinon les exemples. */
export function displayTexts(
  object: StudioObjectId,
  texts: StudioTexts,
  examples: StudioTexts,
): StudioTexts {
  if (OBJECT_TEXT_FIELDS[object].length === 0) return {};
  return isEdited(object, texts) ? texts : examples;
}

/** Vrai si au moins un champ de l'objet contient un caractère saisi. */
export function hasTypedText(
  object: StudioObjectId,
  texts: StudioTexts,
): boolean {
  return OBJECT_TEXT_FIELDS[object].some((field) => cleanText(texts[field]));
}

// Ce que l'interface sait des quatre objets du Studio, sans React ni three :
// vues disponibles, champs de texte, exigences avant l'envoi, choix de la
// vue 2D exacte. Testé (objects.test.ts) : l'interface ne fait qu'appeler.
import { MAX_BANDS } from "@/lib/studio/ranges";
import { OBJECT_TEXT_FIELDS } from "@/lib/studio/text/fields";
import { STUDIO_OBJECT_IDS, type StudioObjectId } from "@/lib/studio/types";

export { OBJECT_TEXT_FIELDS, STUDIO_OBJECT_IDS };

/** Les vues de la scène : 3D (orbite), Plan, Élévation (2D exacte) et Couches. */
export type StudioViewMode = "orbit" | "plan" | "elevation" | "layers";

/**
 * Vues proposées : l'Élévation (silhouette latérale) a un sens pour le vase et
 * la montagne ; les objets plats n'ont que leur Plan comme dessin 2D exact.
 */
export function viewsFor(object: StudioObjectId): StudioViewMode[] {
  return hasElevation(object)
    ? ["orbit", "plan", "elevation", "layers"]
    : ["orbit", "plan", "layers"];
}

/** Le vase et la montagne ont une silhouette latérale exacte (Élévation). */
function hasElevation(object: StudioObjectId): boolean {
  return object === "lavaux" || object === "montagne";
}

/** Vue 2D exacte de l'objet (la seule disponible sans WebGL) : élévation du vase et de la montagne, plan des objets plats. */
export function flatViewOf(object: StudioObjectId): "elevation" | "plan" {
  return hasElevation(object) ? "elevation" : "plan";
}

/** Vue de départ : la 3D avec WebGL, sinon le dessin 2D exact. */
export function defaultView(
  object: StudioObjectId,
  has3d: boolean,
): StudioViewMode {
  return has3d ? "orbit" : flatViewOf(object);
}

/** Les bandes de couleur se règlent sur une barre altimétrique (vase et montagne). */
export function hasBandBar(object: StudioObjectId): boolean {
  return object === "lavaux" || object === "montagne";
}

export function minBands(object: StudioObjectId): number {
  return object === "montagne" ? 2 : 1;
}

export { MAX_BANDS };

// Règles sur les textes (partagées avec le panier et le serveur de paiement).
export {
  textFieldsFor,
  hasTextFields,
  missingText,
  printedTexts,
  textsForObject,
  purchaseTexts,
} from "@/lib/studio/text/rules";

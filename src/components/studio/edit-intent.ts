// « Modifier dans le Studio » depuis le panier : l'intention de MODIFIER une ligne
// (et non d'en ajouter une autre) passe par sessionStorage, jamais par l'URL.
// L'URL ne porte que la configuration (fragment #c=…, sans texte) ; les textes
// partent par `writeStudioTexts` (texts-store.ts) ; ceci ne garde que
// l'identité de la ligne et sa quantité, pour que « Mettre à jour le panier »
// REMPLACE la ligne. L'intention expire au bout de deux heures et ne vaut que
// pour l'objet concerné.
import { isStudioObjectId, type StudioObjectId } from "@/lib/studio/types";

export const EDIT_INTENT_KEY = "s3d-studio-edit-v1";
export const EDIT_INTENT_TTL_MS = 2 * 3600 * 1000;

export interface EditIntent {
  /** Identité de la ligne du panier à remplacer. */
  id: string;
  object: StudioObjectId;
  quantity: number;
  /** Instant de l'intention (ms). */
  at: number;
}

export function writeEditIntent(intent: Omit<EditIntent, "at">): void {
  try {
    sessionStorage.setItem(
      EDIT_INTENT_KEY,
      JSON.stringify({ ...intent, at: Date.now() }),
    );
  } catch {
    // Stockage bloqué : la modification devient un ajout, sans gravité.
  }
}

/** L'intention en cours pour cet objet, ou null (absente, expirée, d'un autre objet). */
export function readEditIntent(
  object: StudioObjectId,
  now: number = Date.now(),
): EditIntent | null {
  try {
    const raw = sessionStorage.getItem(EDIT_INTENT_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;
    const {
      id,
      object: target,
      quantity,
      at,
    } = data as Record<string, unknown>;
    if (
      typeof id !== "string" ||
      !isStudioObjectId(target) ||
      target !== object ||
      !Number.isInteger(quantity) ||
      typeof at !== "number" ||
      now - at > EDIT_INTENT_TTL_MS
    )
      return null;
    return { id, object, quantity: quantity as number, at };
  } catch {
    return null;
  }
}

export function clearEditIntent(): void {
  try {
    sessionStorage.removeItem(EDIT_INTENT_KEY);
  } catch {
    // Rien à faire : l'intention expire seule.
  }
}

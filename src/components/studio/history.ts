// Historique du Studio (brief « Strates », §6.7 : « Annuler / Rétablir, pile de
// 50 états, un état par geste terminé »). Réducteur pur, testé (history.test.ts).
//
// Un geste (glissé d'un curseur, frappe dans un champ) met à jour l'état présent
// à chaque événement SANS empiler : le premier événement retient l'état d'avant
// (`base`), `commit` (relâchement du curseur, sortie du champ, clic sur une
// puce) l'empile une seule fois. Annuler pendant un geste commence par le
// terminer.
import { canonicalJson } from "@/lib/studio/kernel/hash";
import type { StudioConfig, StudioTexts } from "@/lib/studio/types";

export const HISTORY_LIMIT = 50;

export interface StudioDoc {
  config: StudioConfig;
  texts: StudioTexts;
}

export interface StudioHistory {
  present: StudioDoc;
  past: StudioDoc[];
  future: StudioDoc[];
  /** État d'avant le geste en cours ; null hors geste. */
  base: StudioDoc | null;
}

export type HistoryAction =
  /** Met à jour l'état (partiellement) ; `commit` termine le geste dans la foulée. */
  | { type: "set"; patch: Partial<StudioDoc>; commit: boolean }
  /** Termine le geste en cours (relâchement, sortie de champ). */
  | { type: "commit" }
  | { type: "undo" }
  | { type: "redo" }
  /** Remplace tout (chargement d'un lien, d'un préréglage de départ) et vide l'historique. */
  | { type: "load"; doc: StudioDoc };

export function createHistory(doc: StudioDoc): StudioHistory {
  return { present: doc, past: [], future: [], base: null };
}

function sameDoc(a: StudioDoc, b: StudioDoc): boolean {
  if (a === b) return true;
  return (
    canonicalJson(a.config) === canonicalJson(b.config) &&
    canonicalJson(a.texts) === canonicalJson(b.texts)
  );
}

function finish(history: StudioHistory): StudioHistory {
  const { base } = history;
  if (!base) return history;
  if (sameDoc(base, history.present)) return { ...history, base: null };
  return {
    present: history.present,
    past: [...history.past, base].slice(-HISTORY_LIMIT),
    future: [],
    base: null,
  };
}

export function historyReducer(
  history: StudioHistory,
  action: HistoryAction,
): StudioHistory {
  switch (action.type) {
    case "set": {
      const present: StudioDoc = { ...history.present, ...action.patch };
      const next: StudioHistory = {
        ...history,
        present,
        base: history.base ?? history.present,
      };
      return action.commit ? finish(next) : next;
    }
    case "commit":
      return finish(history);
    case "undo": {
      const settled = finish(history);
      const previous = settled.past.at(-1);
      if (!previous) return settled;
      return {
        present: previous,
        past: settled.past.slice(0, -1),
        future: [settled.present, ...settled.future],
        base: null,
      };
    }
    case "redo": {
      const settled = finish(history);
      const [next, ...rest] = settled.future;
      if (!next) return settled;
      return {
        present: next,
        past: [...settled.past, settled.present].slice(-HISTORY_LIMIT),
        future: rest,
        base: null,
      };
    }
    case "load":
      return createHistory(action.doc);
  }
}

export const canUndo = (h: StudioHistory) =>
  h.past.length > 0 || (h.base !== null && !sameDoc(h.base, h.present));
export const canRedo = (h: StudioHistory) => h.future.length > 0;

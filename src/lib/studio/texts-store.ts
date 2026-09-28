// Textes saisis dans le Studio (brief « Strates », §4.5, §4.10, §6.8) :
// sessionStorage["s3d-studio-texts-v1"] = { [objet]: StudioTexts }. Écrits par
// l'accueil (chapitre 02) et par le Studio, relus par le Studio : le nom tapé
// sur l'accueil suit le visiteur jusqu'au configurateur. JAMAIS dans l'URL ni
// un événement ; ils ne quittent le navigateur que dans la Server Action de
// devis (finalité déclarée). sessionStorage plutôt que localStorage : ils
// disparaissent avec l'onglet. Tout accès est en try/catch.
import {
  isStudioObjectId,
  type StudioObjectId,
  type StudioTexts,
} from "./types";

export const STUDIO_TEXTS_KEY = "s3d-studio-texts-v1";

const TEXT_KEYS = ["name", "role", "line1", "line2", "peak", "text"] as const;
// Borne défensive, bien au-dessus des limites des champs (24, 30, 12, 14
// caractères, §6.2) : les générateurs et guards.ts valident les vraies.
const MAX_TEXT = 120;

type TextsByObject = Partial<Record<StudioObjectId, StudioTexts>>;

/**
 * Ne garde que les clés connues, en chaînes bornées ; renvoie undefined si
 * rien ne reste. Partagé avec « Mes créations ».
 */
export function sanitizeStudioTexts(value: unknown): StudioTexts | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const texts: StudioTexts = {};
  let any = false;
  for (const key of TEXT_KEYS) {
    const text = source[key];
    if (typeof text !== "string") continue;
    texts[key] = text.slice(0, MAX_TEXT);
    any = true;
  }
  return any ? texts : undefined;
}

function readAll(): TextsByObject {
  try {
    const raw = sessionStorage.getItem(STUDIO_TEXTS_KEY);
    if (!raw) return {};
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const all: TextsByObject = {};
    for (const [object, texts] of Object.entries(data)) {
      if (!isStudioObjectId(object)) continue;
      const clean = sanitizeStudioTexts(texts);
      if (clean) all[object] = clean;
    }
    return all;
  } catch {
    return {};
  }
}

function writeAll(all: TextsByObject) {
  try {
    if (Object.keys(all).length === 0)
      sessionStorage.removeItem(STUDIO_TEXTS_KEY);
    else sessionStorage.setItem(STUDIO_TEXTS_KEY, JSON.stringify(all));
  } catch {
    // Stockage plein ou bloqué : les textes restent en mémoire dans la page.
  }
}

/** Textes de l'objet ({} si aucun) : l'appelant complète avec les exemples. */
export function readStudioTexts(object: StudioObjectId): StudioTexts {
  if (typeof window === "undefined") return {};
  return { ...readAll()[object] };
}

/** Remplace les textes de l'objet (aucune clé : l'entrée disparaît). */
export function writeStudioTexts(
  object: StudioObjectId,
  texts: StudioTexts,
): void {
  if (typeof window === "undefined" || !isStudioObjectId(object)) return;
  const all = readAll();
  const clean = sanitizeStudioTexts(texts);
  if (clean) all[object] = clean;
  else delete all[object];
  writeAll(all);
}

/** Efface les textes d'un objet, ou de tous (après un envoi réussi, par exemple). */
export function clearStudioTexts(object?: StudioObjectId): void {
  if (typeof window === "undefined") return;
  if (object === undefined) {
    writeAll({});
    return;
  }
  const all = readAll();
  if (!(object in all)) return;
  delete all[object];
  writeAll(all);
}

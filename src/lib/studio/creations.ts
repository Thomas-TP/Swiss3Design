// « Mes créations » (brief « Strates », §4.5, §6.8, §7.17) : les
// configurations gardées par « Garder » dans le Studio, relues par l'onglet
// du même nom des Favoris. localStorage["s3d-creations-v1"], 12 au plus
// (les plus anciennes sortent d'abord), vignette ≤ 60 Ko sinon omise.
//
// Stockage local à ce navigateur, jamais envoyé : il peut contenir les textes
// du visiteur (son nom sur une Cartouche), c'est pourquoi rien d'ici ne part
// dans une URL ni un événement. Tout accès est en try/catch (navigation
// privée, stockage plein ou bloqué) : sans stockage, la liste est vide et
// saveCreation renvoie null.
import {
  isStudioObjectId,
  type StudioObjectId,
  type StudioTexts,
} from "./types";
import { sanitizeStudioTexts } from "./texts-store";

export interface Creation {
  id: string;
  object: StudioObjectId;
  /** Fragment de configuration (#c=v1.…), sans aucun texte personnel. */
  fragment: string;
  texts?: StudioTexts;
  /** Vignette en data: URL (image), ≤ 60 Ko. */
  thumbnail?: string;
  label: string;
  savedAt: number;
}

export const CREATIONS_KEY = "s3d-creations-v1";
export const MAX_CREATIONS = 12;
export const MAX_THUMBNAIL_BYTES = 60 * 1024;
// Émis sur window après chaque écriture de cet onglet ; l'événement `storage`
// couvre les autres onglets.
const CHANGE_EVENT = "s3d-creations-change";
// Bornes défensives : le fragment tient en 600 caractères (§6.8), le libellé
// est un nom d'objet et quelques cotes.
const MAX_FRAGMENT = 2048;
const MAX_LABEL = 200;
const THUMBNAIL = /^data:image\/(?:webp|png|jpeg|svg\+xml)[;,]/;

const EMPTY: Creation[] = [];
// Dernière lecture : même chaîne stockée ⇒ même tableau. listCreations peut
// ainsi servir de snapshot à useSyncExternalStore sans boucler.
let cache: { raw: string | null; list: Creation[] } | null = null;

function parseCreation(value: unknown): Creation | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  if (
    typeof c.id !== "string" ||
    !c.id ||
    !isStudioObjectId(c.object) ||
    typeof c.fragment !== "string" ||
    c.fragment.length > MAX_FRAGMENT ||
    typeof c.label !== "string" ||
    typeof c.savedAt !== "number" ||
    !Number.isFinite(c.savedAt)
  )
    return null;
  const creation: Creation = {
    id: c.id,
    object: c.object,
    fragment: c.fragment,
    label: c.label.slice(0, MAX_LABEL),
    savedAt: c.savedAt,
  };
  const texts = sanitizeStudioTexts(c.texts);
  if (texts) creation.texts = texts;
  if (typeof c.thumbnail === "string" && validThumbnail(c.thumbnail))
    creation.thumbnail = c.thumbnail;
  return creation;
}

function validThumbnail(thumbnail: string): boolean {
  return (
    THUMBNAIL.test(thumbnail) && byteLength(thumbnail) <= MAX_THUMBNAIL_BYTES
  );
}

// Taille réelle en stockage (UTF-8) ; une data: URL base64 est de l'ASCII.
function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(CREATIONS_KEY);
  } catch {
    return null;
  }
}

function parseList(raw: string | null): Creation[] {
  if (!raw) return EMPTY;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return EMPTY;
    const seen = new Set<string>();
    const list: Creation[] = [];
    for (const item of data) {
      const creation = parseCreation(item);
      if (!creation || seen.has(creation.id)) continue;
      seen.add(creation.id);
      list.push(creation);
    }
    return list.slice(-MAX_CREATIONS);
  } catch {
    return EMPTY;
  }
}

/** Créations gardées, de la plus ancienne à la plus récente. */
export function listCreations(): Creation[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = readRaw();
  if (cache?.raw !== raw) cache = { raw, list: parseList(raw) };
  return cache.list;
}

function write(list: Creation[]): boolean {
  try {
    localStorage.setItem(CREATIONS_KEY, JSON.stringify(list));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

function newId(): string {
  try {
    if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // Contexte non sécurisé : repli ci-dessous.
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Garde une création (la plus ancienne sort au-delà de 12). Stockage plein :
 * on retire les vignettes, des plus anciennes aux plus récentes, avant de
 * renoncer. Renvoie la création enregistrée, ou null si rien n'a pu l'être.
 */
export function saveCreation(
  input: Omit<Creation, "id" | "savedAt">,
): Creation | null {
  if (typeof window === "undefined") return null;
  const creation = parseCreation({
    ...input,
    id: newId(),
    savedAt: Date.now(),
  });
  if (!creation) return null;

  const list = [...listCreations(), creation].slice(-MAX_CREATIONS);
  if (write(list)) return creation;
  for (let i = 0; i < list.length; i++) {
    if (!list[i].thumbnail) continue;
    const lighter = { ...list[i] };
    delete lighter.thumbnail;
    list[i] = lighter;
    if (write(list)) return list.at(-1) ?? null;
  }
  return null;
}

export function removeCreation(id: string): void {
  if (typeof window === "undefined") return;
  const list = listCreations();
  const next = list.filter((c) => c.id !== id);
  if (next.length !== list.length) write(next);
}

/** Abonnement (useSyncExternalStore) : cet onglet et les autres. */
export function subscribeCreations(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CREATIONS_KEY) cb();
  };
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

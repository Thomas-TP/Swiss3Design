// Mémoire des envois du Studio (brief « Strates », §6.8) :
// sessionStorage["s3d-studio-upload-v1"] = { [hash]: { key, name, bytes,
// triangles, at } }. Une configuration inchangée n'est jamais renvoyée : le
// fichier déjà déposé (clé R2 `quotes/…`) est réutilisé 24 h, la durée du cookie
// propriétaire de l'upload (s3d-upload-owner). Cela protège aussi le quota
// (10 envois par heure) : « Réessayer » après une erreur de la Server Action ne
// refait ni l'export ni l'envoi.
//
// Tout accès est en try/catch (navigation privée, stockage plein ou bloqué) :
// sans stockage, le cache est simplement vide. Lu comme une donnée non fiable.
import { canonicalJson, fnv1a64 } from "@/lib/studio/kernel/hash";
import { sanitizeTexts } from "@/lib/studio/text/fields";
import type { StudioConfig, StudioTexts } from "@/lib/studio/types";

export const UPLOAD_CACHE_KEY = "s3d-studio-upload-v1";
export const UPLOAD_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 12;

export interface CachedUpload {
  /** Clé R2 privée (`quotes/<uuid>-<nom>`), à passer telle quelle à la Server Action. */
  key: string;
  name: string;
  bytes: number;
  triangles: number;
  /** Date de l'envoi (ms). */
  at: number;
}

/**
 * Empreinte d'un envoi : FNV-1a 64 du JSON canonique de la configuration et des
 * textes (nettoyés, limités aux champs de l'objet). La langue n'entre que pour
 * l'étiquette du sous-verre, qui change avec elle (« POINTE » / « PIZ »…).
 */
export function uploadHash(
  config: StudioConfig,
  texts: StudioTexts,
  locale: string,
): string {
  const clean = sanitizeTexts(config.object, texts);
  const labelled = config.object === "relief" && config.label && clean.peak;
  return fnv1a64(
    canonicalJson({
      config,
      texts: clean,
      ...(labelled ? { locale } : {}),
    }),
  );
}

function isEntry(value: unknown, now: number): value is CachedUpload {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.key === "string" &&
    e.key.startsWith("quotes/") &&
    e.key.length <= 300 &&
    typeof e.name === "string" &&
    e.name.length > 0 &&
    e.name.length <= 200 &&
    typeof e.bytes === "number" &&
    Number.isFinite(e.bytes) &&
    typeof e.triangles === "number" &&
    Number.isFinite(e.triangles) &&
    typeof e.at === "number" &&
    Number.isFinite(e.at) &&
    now - e.at <= UPLOAD_CACHE_TTL_MS &&
    e.at <= now + 5 * 60 * 1000
  );
}

function readAll(now: number): Record<string, CachedUpload> {
  try {
    const raw = sessionStorage.getItem(UPLOAD_CACHE_KEY);
    if (!raw) return {};
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const out: Record<string, CachedUpload> = {};
    for (const [hash, entry] of Object.entries(data)) {
      if (/^[0-9a-f]{16}$/.test(hash) && isEntry(entry, now)) out[hash] = entry;
    }
    return out;
  } catch {
    return {};
  }
}

/** Envoi déjà fait pour cette empreinte (et encore valable), ou null. */
export function readCachedUpload(
  hash: string,
  now: number = Date.now(),
): CachedUpload | null {
  if (typeof window === "undefined") return null;
  return readAll(now)[hash] ?? null;
}

export function writeCachedUpload(
  hash: string,
  entry: CachedUpload,
  now: number = Date.now(),
): void {
  if (typeof window === "undefined") return;
  const all = readAll(now);
  all[hash] = entry;
  const kept = Object.entries(all)
    .sort(([, a], [, b]) => a.at - b.at)
    .slice(-MAX_ENTRIES);
  try {
    sessionStorage.setItem(
      UPLOAD_CACHE_KEY,
      JSON.stringify(Object.fromEntries(kept)),
    );
  } catch {
    // Stockage plein ou bloqué : le prochain envoi refera le fichier.
  }
}

export function clearCachedUploads(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(UPLOAD_CACHE_KEY);
  } catch {
    // Rien à effacer.
  }
}

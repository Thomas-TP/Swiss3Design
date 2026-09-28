// Passage Studio → /custom (brief « Strates », §4.5, §6.9 étape 7, §7.10) :
// « Ouvrir dans le formulaire complet » écrit la configuration dans
// sessionStorage["s3d-quote-handoff-v1"], /custom#studio la relit pour
// afficher la carte « Configuration Studio jointe » et préremplir le
// formulaire. Même onglet seulement, jamais dans l'URL.
//
// Le contenu est relu comme une donnée non fiable (une autre version du site
// a pu l'écrire, ou une extension) : tout est validé, borné aux limites de la
// Server Action submitQuoteRequest (description ≤ 4000, colors et dimensions
// ≤ 200), la pièce jointe doit être une clé `quotes/…` (l'action vérifie en
// plus qu'elle appartient au cookie du visiteur), le lien doit rester sur ce
// site. Expire après 24 h, la durée du cookie propriétaire de l'upload
// (s3d-upload-owner) : au-delà, la pièce jointe ne serait plus acceptée.
import { isStudioObjectId, type StudioObjectId } from "./studio/types";

export interface QuoteHandoff {
  v: 1;
  source: "studio";
  object: StudioObjectId;
  /** Lien de configuration SANS texte personnel (fragment #c= seulement). */
  link: string;
  prefill: {
    description: string;
    material: "PLA";
    colors: string;
    dimensions: string;
  };
  attachment?: { key: string; name: string; bytes: number; triangles: number };
  /** Vignette en data: URL (image). */
  thumbnail?: string;
  createdAt: number;
}

export const QUOTE_HANDOFF_KEY = "s3d-quote-handoff-v1";
export const QUOTE_HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;

// Limites du schéma zod de submitQuoteRequest (src/app/[locale]/(site)/custom/actions.ts).
const MAX_DESCRIPTION = 4000;
const MAX_COLORS = 200;
const MAX_DIMENSIONS = 200;
const MAX_LINK = 2048;
const MAX_FILE_KEY = 300;
const MAX_FILE_NAME = 200;
// Une vignette 512² WebP pèse 30 à 60 Ko ; 256 Ko laisse de la marge sans
// remplir le sessionStorage (≈ 5 Mo).
const MAX_THUMBNAIL = 256 * 1024;
const THUMBNAIL = /^data:image\/(?:webp|png|jpeg|svg\+xml)[;,]/;
// Horloge du même appareil : un createdAt dans le futur est un faux.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const isString = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;

/** Chemin de ce site (/fr/studio/…) ou URL http(s) de la même origine. */
function safeLink(link: unknown): link is string {
  if (!isString(link, MAX_LINK) || !link) return false;
  if (link.startsWith("/")) return !/^\/[/\\]/.test(link);
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return typeof location === "undefined" || url.origin === location.origin;
  } catch {
    return false;
  }
}

function parseAttachment(value: unknown): QuoteHandoff["attachment"] | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  if (
    !isString(a.key, MAX_FILE_KEY) ||
    !a.key.startsWith("quotes/") ||
    !isString(a.name, MAX_FILE_NAME) ||
    !a.name ||
    typeof a.bytes !== "number" ||
    !Number.isFinite(a.bytes) ||
    a.bytes < 0 ||
    typeof a.triangles !== "number" ||
    !Number.isInteger(a.triangles) ||
    a.triangles < 0
  )
    return null;
  return { key: a.key, name: a.name, bytes: a.bytes, triangles: a.triangles };
}

/** Valide une valeur inconnue ; null si elle n'est pas un QuoteHandoff utilisable. */
export function parseQuoteHandoff(
  value: unknown,
  now = Date.now(),
): QuoteHandoff | null {
  if (!value || typeof value !== "object") return null;
  const h = value as Record<string, unknown>;
  const prefill = h.prefill as Record<string, unknown> | null | undefined;
  if (
    h.v !== 1 ||
    h.source !== "studio" ||
    !isStudioObjectId(h.object) ||
    !safeLink(h.link) ||
    !prefill ||
    typeof prefill !== "object" ||
    !isString(prefill.description, MAX_DESCRIPTION) ||
    prefill.material !== "PLA" ||
    !isString(prefill.colors, MAX_COLORS) ||
    !isString(prefill.dimensions, MAX_DIMENSIONS) ||
    typeof h.createdAt !== "number" ||
    !Number.isFinite(h.createdAt) ||
    h.createdAt > now + CLOCK_SKEW_MS ||
    now - h.createdAt > QUOTE_HANDOFF_TTL_MS
  )
    return null;

  const handoff: QuoteHandoff = {
    v: 1,
    source: "studio",
    object: h.object,
    link: h.link,
    prefill: {
      description: prefill.description,
      material: "PLA",
      colors: prefill.colors,
      dimensions: prefill.dimensions,
    },
    createdAt: h.createdAt,
  };
  if (h.attachment !== undefined) {
    const attachment = parseAttachment(h.attachment);
    if (!attachment) return null; // pièce jointe annoncée mais douteuse : tout refuser
    handoff.attachment = attachment;
  }
  // Vignette hors format ou trop lourde : simplement omise, elle n'est qu'un aperçu.
  if (
    typeof h.thumbnail === "string" &&
    h.thumbnail.length <= MAX_THUMBNAIL &&
    THUMBNAIL.test(h.thumbnail)
  )
    handoff.thumbnail = h.thumbnail;
  return handoff;
}

/** Écrit le passage ; false si la valeur est invalide ou si le stockage refuse. */
export function writeQuoteHandoff(h: QuoteHandoff): boolean {
  if (typeof window === "undefined") return false;
  const clean = parseQuoteHandoff(h);
  if (!clean) return false;
  try {
    sessionStorage.setItem(QUOTE_HANDOFF_KEY, JSON.stringify(clean));
    return true;
  } catch {
    // Stockage plein : on retente sans la vignette, qui n'est qu'un aperçu.
    if (!clean.thumbnail) return false;
    const { v, source, object, link, prefill, attachment, createdAt } = clean;
    try {
      sessionStorage.setItem(
        QUOTE_HANDOFF_KEY,
        JSON.stringify({
          v,
          source,
          object,
          link,
          prefill,
          attachment,
          createdAt,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}

/** Passage en cours, ou null (absent, invalide ou expiré : il est alors effacé). */
export function readQuoteHandoff(): QuoteHandoff | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(QUOTE_HANDOFF_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let handoff: QuoteHandoff | null = null;
  try {
    handoff = parseQuoteHandoff(JSON.parse(raw));
  } catch {
    handoff = null;
  }
  if (!handoff) clearQuoteHandoff();
  return handoff;
}

export function clearQuoteHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(QUOTE_HANDOFF_KEY);
  } catch {
    // Stockage bloqué : rien n'avait pu être écrit.
  }
}

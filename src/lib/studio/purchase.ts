// Achat d'un objet du Studio, côté SERVEUR (api/checkout) : schéma de la ligne
// envoyée par le navigateur, validation stricte, recalcul du prix, instantané
// gardé dans la commande. Le navigateur n'est jamais cru : ni la configuration
// (schéma strict, plages, forme canonique), ni les textes (nettoyés, imprimables,
// obligatoires quand l'objet en exige), ni le prix (refait ici, au centime).
//
// Pur TypeScript, sans I/O : testé sans base (purchase.test.ts). Les textes
// saisis peuvent être des données personnelles : ils ne sortent d'ici que vers
// `order_items.studio` (jamais Stripe, analytics, logs ni empreinte de reprise :
// `studioDigest` n'en laisse qu'un condensé).
import { z } from "zod";
import { canonicalJson } from "./kernel/hash";
import { studioLineId, type LineLocale } from "./line-id";
import { PRINT } from "./print-params";
import {
  PRICE_LOCALE,
  PRICE_VERSION,
  STUDIO_QTY_MAX,
  studioLineCents,
  studioUnitCents,
} from "./price";
import { clampConfig } from "./ranges";
import { parseConfig } from "./schemas";
import { computeStats } from "./stats";
import { studioHash } from "./stl";
import type { StudioOrderLine } from "./order-line";
import { missingText, purchaseTexts } from "./text/rules";

export { readStudioOrderLine, type StudioOrderLine } from "./order-line";
import type {
  StudioConfig,
  StudioObjectId,
  StudioStats,
  StudioTexts,
} from "./types";
import { STUDIO_OBJECT_IDS } from "./types";

const LOCALES = ["fr", "de", "it", "en"] as const;
const TEXT_FIELDS = ["name", "role", "line1", "line2", "peak", "text"] as const;

/** Plafond brut d'un champ reçu (le garde-fou « texte trop long » tranche ensuite). */
const RAW_TEXT_MAX = 128;

/** Ligne du Studio dans le corps de `POST /api/checkout`. */
export const studioLineInputSchema = z.strictObject({
  kind: z.literal("studio"),
  /** Identité côté navigateur : simplement renvoyée dans les erreurs, jamais crue. */
  id: z.string().min(1).max(64).optional(),
  object: z.enum(STUDIO_OBJECT_IDS as [StudioObjectId, ...StudioObjectId[]]),
  /** Forme libre ici : `parseConfig` (schéma strict de l'objet) la vérifie ensuite. */
  config: z.record(z.string(), z.unknown()),
  texts: z
    .partialRecord(z.enum(TEXT_FIELDS), z.string().max(RAW_TEXT_MAX))
    .default({}),
  locale: z.enum(LOCALES),
  quantity: z.number().int().min(1).max(STUDIO_QTY_MAX),
  /** Prix unitaire affiché au client : sert seulement à détecter un écart (409), jamais à facturer. */
  expectedUnitCents: z.number().int().min(0).max(10_000_000).optional(),
});

export type StudioLineInput = z.infer<typeof studioLineInputSchema>;

export interface ValidatedStudioLine {
  /** Identité de ligne recalculée (`studioLineId`). */
  id: string;
  /** Identité envoyée par le navigateur, renvoyée dans les erreurs. */
  clientId: string | null;
  object: StudioObjectId;
  config: StudioConfig;
  texts: StudioTexts;
  locale: LineLocale;
  quantity: number;
  unitCents: number;
  lineCents: number;
  stats: StudioStats;
  hash: string;
  expectedUnitCents: number | null;
  snapshot: StudioOrderLine;
}

export type StudioLineError =
  | "invalid_config"
  | "not_canonical"
  | "text_missing"
  | "unprintable";

export type StudioLineResult =
  | { ok: true; line: ValidatedStudioLine }
  | {
      ok: false;
      error: StudioLineError;
      clientId: string | null;
      /** Codes des anomalies bloquantes (`text-char`, `text-fit`…) ou champ manquant ; jamais de texte saisi. */
      issues: string[];
    };

/**
 * Valide une ligne du Studio reçue au paiement et recalcule son prix.
 * 1. forme et plages : `parseConfig` (schéma strict de l'objet) ;
 * 2. forme canonique : `clampConfig(c)` doit rendre `c` (l'interface ne produit
 *    que des configurations bornées : ce qui est gardé est ce que le client a vu) ;
 * 3. textes saisis, nettoyés, limités aux champs de l'objet ; obligatoires ;
 * 4. garde-fous d'imprimabilité (`printable.status === "error"` refuse) ;
 * 5. prix : `studioUnitCents` sur les chiffres d'une pièce, en langue canonique.
 */
export function validateStudioLine(input: StudioLineInput): StudioLineResult {
  const clientId = input.id ?? null;
  const parsed = parseConfig(input.object, input.config);
  if (!parsed.ok)
    return { ok: false, error: "invalid_config", clientId, issues: [] };
  const config = parsed.config;
  if (canonicalJson(clampConfig(config)) !== canonicalJson(config))
    return { ok: false, error: "not_canonical", clientId, issues: [] };

  const texts = purchaseTexts(config, input.texts);
  const missing = missingText(config, texts);
  if (missing)
    return { ok: false, error: "text_missing", clientId, issues: [missing] };

  const stats = computeStats(config, texts, PRINT, PRICE_LOCALE);
  if (stats.printable.status === "error") {
    return {
      ok: false,
      error: "unprintable",
      clientId,
      issues: stats.printable.issues.map((issue) => issue.code),
    };
  }

  const figures = { grams: stats.grams, changes: stats.changes };
  const unitCents = studioUnitCents(config.object, figures, input.quantity);
  const lineCents = studioLineCents(config.object, figures, input.quantity);
  const locale = input.locale;
  const snapshot: StudioOrderLine = {
    v: 1,
    object: config.object,
    config,
    texts,
    locale,
    stats: {
      heightMm: stats.heightMm,
      widthMm: stats.widthMm,
      depthMm: stats.depthMm,
      layers: stats.layers,
      volumeCm3: stats.volumeCm3,
      grams: stats.grams,
      minutes: stats.minutes,
      changes: stats.changes,
      printable: stats.printable.status === "warn" ? "warn" : "ok",
    },
    price: {
      v: PRICE_VERSION,
      unitCents,
      grams: stats.grams,
      changes: stats.changes,
    },
    hash: studioHash(config, texts, locale),
  };
  return {
    ok: true,
    line: {
      id: studioLineId(config, texts, locale),
      clientId,
      object: config.object,
      config,
      texts,
      locale,
      quantity: input.quantity,
      unitCents,
      lineCents,
      stats,
      hash: snapshot.hash,
      expectedUnitCents: input.expectedUnitCents ?? null,
      snapshot,
    },
  };
}

/**
 * Condensé SHA-256 d'une ligne (configuration, textes, langue utile, quantité)
 * pour l'empreinte de reprise d'un paiement : `orders.checkoutFingerprint` est
 * une colonne en clair, les textes saisis n'y entrent que par ce condensé.
 */
export async function studioDigest(line: StudioLineInput): Promise<string> {
  const bytes = new TextEncoder().encode(
    canonicalJson({
      object: line.object,
      config: line.config,
      texts: line.texts,
      locale: line.locale,
      quantity: line.quantity,
    }),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

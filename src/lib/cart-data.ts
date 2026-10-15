import { requestedColorRef } from "@/lib/filament/shop";
import { STUDIO_MAX_LINES, STUDIO_QTY_MAX } from "@/lib/studio/price";
import {
  isStudioObjectId,
  type StudioConfig,
  type StudioObjectId,
  type StudioTexts,
} from "@/lib/studio/types";

export interface CartItem {
  productId: string;
  // Variante choisie (taille/finition). null = produit sans variante.
  variantId?: string | null;
  variantName?: string | null;
  // Couleur choisie : une référence du stock (`filament_refs.id`, les mêmes que
  // « Sur mesure »). `colorRef` en est l'identité ; `colorName` et `colorHex` ne
  // servent qu'à l'affichage (le serveur relit tout). Un ancien panier n'a que le
  // NOM de l'ancienne palette : `parseCart` le rattache à une référence. null =
  // produit sans couleur.
  colorRef?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  /**
   * Poids d'UNE pièce (g), repris de la fiche à l'ajout : le panier en tire le
   * filament à réserver (tout article qui a un poids) pour signaler une couleur
   * épuisée. Indicatif : le serveur relit le poids en base. Absent d'un ancien
   * panier : pas d'avertissement dans le panier, le paiement revérifie.
   */
  weightGrams?: number | null;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  saleType: "stock" | "on_demand";
  quantity: number;
}

/**
 * Une ligne du Studio dans le panier du navigateur (`s3d-cart-v1`, même tableau
 * JSON que les produits). Elle porte l'objet, sa configuration, les textes SAISIS
 * et la quantité : le serveur refait tout (validation, prix) au paiement.
 *
 * DONNÉES PERSONNELLES : `texts` peut contenir un nom, une fonction, une adresse
 * e-mail, un numéro de téléphone. Ces lignes ne partent JAMAIS vers les relances
 * de panier (`parseCart` les écarte), ni dans l'URL, ni dans une mesure
 * d'audience ; elles expirent du stockage local au bout de 30 jours.
 */
export interface StudioCartItem {
  kind: "studio";
  /** Identité de la ligne : empreinte de la configuration et des textes (`studioLineId`). */
  id: string;
  /** Version du modèle de ligne (configuration v1 + barème 1). */
  v: 1;
  object: StudioObjectId;
  config: StudioConfig;
  /** Textes saisis, nettoyés (`purgeTexts`) : jamais les textes d'exemple. */
  texts: StudioTexts;
  /** Langue de l'étiquette de la Montagne (sans effet ailleurs). */
  locale: "fr" | "de" | "it" | "en";
  /** 1 à 20. */
  quantity: number;
  /** Grammes d'UNE pièce (langue canonique) : de quoi recalculer le prix sans moteur. */
  grams: number;
  /** Changements de couleur de la pièce. */
  changes: number;
  /** Prix unitaire D'AFFICHAGE à `quantity` (centimes) : jamais cru par le serveur. */
  priceCents: number;
  /** Instant de l'ajout (ms) : le stockage local oublie la ligne au bout de 30 jours. */
  addedAt: number;
}

export type CartLine = CartItem | StudioCartItem;

export const isStudioLine = (line: CartLine): line is StudioCartItem =>
  "kind" in line && line.kind === "studio";

/** Plafonds du panier : lignes en tout, lignes du Studio, durée de garde d'une ligne du Studio. */
export const CART_MAX_LINES = 50;
export const STUDIO_CART_MAX_LINES = STUDIO_MAX_LINES;
export const STUDIO_CART_TTL_MS = 30 * 24 * 3600 * 1000;

// Une ligne de panier est identifiée par le triplet produit + variante + couleur
type LineRef = {
  productId: string;
  variantId?: string | null;
  colorRef?: string | null;
  colorName?: string | null;
};

/**
 * Clé de la couleur d'une ligne : sa référence du stock, à défaut la référence
 * d'un ancien nom de l'ancienne palette (« Blanc »…), à défaut le nom brut. Deux
 * lignes de la même couleur ont la même clé, qu'elles viennent d'un panier d'avant
 * ou d'après ; les actions du panier (`setQuantity`, `remove`) la prennent telle quelle.
 */
export const lineColorKey = (line: {
  colorRef?: string | null;
  colorName?: string | null;
}): string | null =>
  requestedColorRef({ colorRef: line.colorRef, color: line.colorName }) ??
  line.colorName ??
  null;

export const sameLine = (a: LineRef, b: LineRef) =>
  a.productId === b.productId &&
  (a.variantId ?? null) === (b.variantId ?? null) &&
  lineColorKey(a) === lineColorKey(b);

/** Une ligne du Studio est identifiée par l'empreinte de sa configuration et de ses textes. */
export const sameStudioLine = (a: { id: string }, b: { id: string }) =>
  a.id === b.id;

/**
 * Lignes PRODUIT d'un panier sérialisé. Contrat inchangé depuis avant le Studio :
 * c'est ce que lisent les relances de panier et la reprise par lien, côté
 * serveur comme côté navigateur ; une ligne du Studio n'y passe jamais (aucun
 * texte personnel dans ces chemins).
 */
export function parseCart(raw: string): CartItem[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (i): i is CartItem =>
          i &&
          typeof i === "object" &&
          i.kind !== "studio" &&
          typeof i.productId === "string" &&
          typeof i.name === "string" &&
          typeof i.slug === "string" &&
          Number.isSafeInteger(i.priceCents) &&
          i.priceCents >= 0 &&
          Number.isInteger(i.quantity) &&
          i.quantity > 0 &&
          (i.saleType === "stock" || i.saleType === "on_demand") &&
          [
            i.variantId,
            i.variantName,
            i.colorRef,
            i.colorName,
            i.colorHex,
            i.imageUrl,
          ].every((v) => v == null || typeof v === "string") &&
          (i.weightGrams == null ||
            (typeof i.weightGrams === "number" &&
              Number.isFinite(i.weightGrams) &&
              i.weightGrams > 0 &&
              i.weightGrams <= 100_000)),
      )
      .slice(0, CART_MAX_LINES)
      .map((i) => {
        // Un ancien panier (avant les couleurs du stock) n'a que le NOM de la
        // couleur : « Blanc », « Noir » et « Bleu » sont rattachés à leur
        // référence, tout autre nom reste un nom (le serveur le retrouve parmi les
        // couleurs de l'article, sinon la couleur est à rechoisir sur la fiche).
        const colorRef =
          requestedColorRef({ colorRef: i.colorRef, color: i.colorName }) ??
          null;
        return {
          ...i,
          ...(colorRef ? { colorRef } : {}),
          quantity: Math.min(i.quantity, 99),
        };
      });
  } catch {
    return [];
  }
}

const LOCALES = ["fr", "de", "it", "en"] as const;
const TEXT_KEYS = ["name", "role", "line1", "line2", "peak", "text"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Lecture défensive d'une ligne du Studio du stockage local. Forme seulement :
 * la validation complète (schéma strict, plages, textes imprimables, prix) est
 * celle du serveur au paiement. Une ligne illisible ou expirée est écartée.
 */
export function parseStudioLine(
  value: unknown,
  now: number = Date.now(),
): StudioCartItem | null {
  if (!isPlainObject(value) || value.kind !== "studio") return null;
  const {
    id,
    v,
    object,
    config,
    texts,
    locale,
    quantity,
    grams,
    changes,
    priceCents,
    addedAt,
  } = value;
  if (typeof id !== "string" || id.length < 1 || id.length > 64) return null;
  if (v !== 1 || !isStudioObjectId(object)) return null;
  if (!isPlainObject(config) || config.object !== object) return null;
  if (!isPlainObject(texts)) return null;
  if (!(LOCALES as readonly unknown[]).includes(locale)) return null;
  if (
    !Number.isInteger(quantity) ||
    (quantity as number) < 1 ||
    (quantity as number) > STUDIO_QTY_MAX
  )
    return null;
  if (typeof grams !== "number" || !Number.isFinite(grams) || grams < 0)
    return null;
  if (!Number.isInteger(changes) || (changes as number) < 0) return null;
  if (!Number.isSafeInteger(priceCents) || (priceCents as number) < 0)
    return null;
  if (typeof addedAt !== "number" || !Number.isFinite(addedAt)) return null;
  if (now - addedAt > STUDIO_CART_TTL_MS) return null;
  const cleanTexts: StudioTexts = {};
  for (const key of TEXT_KEYS) {
    const text = texts[key];
    if (typeof text === "string" && text.length <= 128) cleanTexts[key] = text;
  }
  return {
    kind: "studio",
    id,
    v: 1,
    object,
    config: config as unknown as StudioConfig,
    texts: cleanTexts,
    locale: locale as StudioCartItem["locale"],
    quantity: quantity as number,
    grams,
    changes: changes as number,
    priceCents: priceCents as number,
    addedAt,
  };
}

/**
 * Toutes les lignes d'un panier sérialisé, dans l'ordre : les produits comme
 * `parseCart` (un ancien panier se relit à l'identique) et les lignes du Studio
 * valides et non expirées (dix au plus), 50 lignes en tout.
 */
export function parseCartLines(
  raw: string,
  now: number = Date.now(),
): CartLine[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const out: CartLine[] = [];
    let studio = 0;
    for (const entry of data) {
      if (out.length >= CART_MAX_LINES) break;
      if (isPlainObject(entry) && entry.kind === "studio") {
        const line = parseStudioLine(entry, now);
        if (!line || studio >= STUDIO_CART_MAX_LINES) continue;
        if (out.some((l) => isStudioLine(l) && l.id === line.id)) continue;
        studio++;
        out.push(line);
        continue;
      }
      const [product] = parseCart(JSON.stringify([entry]));
      if (product) out.push(product);
    }
    return out;
  } catch {
    return [];
  }
}

// Couleurs et filament de la BOUTIQUE (pur, sans base ni React : le panier du
// navigateur et le serveur le partagent). Décision du propriétaire du 15.10.2026 :
// les articles de la boutique proposent les MÊMES couleurs que « Sur mesure » (les
// références du stock actives avec `custom_ok`), moins les exclusions de l'article ;
// les articles imprimés à la demande réservent leur filament comme le Studio.
import { isShort, type Capacity } from "./capacity";
import { CUSTOM_MATERIAL } from "./constants";

/** Matière de tous les articles : le stock est 100 % PLA (le serveur l'impose à l'enregistrement). */
export const SHOP_MATERIAL = CUSTOM_MATERIAL;

/**
 * Perte d'impression d'une pièce de la boutique (purge, chutes, jupe) : on réserve
 * le poids de la fiche + 10 %. En pour cent entier : le calcul reste exact (jamais
 * `330.00000000000006` pour 100 g × 3 × 1,10).
 */
export const SHOP_WASTE_PERCENT = 10;
export const SHOP_WASTE_FACTOR = 1 + SHOP_WASTE_PERCENT / 100;

/**
 * Besoin de filament d'une ligne : ceil(poids × quantité × 1,10), en grammes.
 * `null` sans poids connu (fiche sans `weight_grams`) : la couleur n'est alors
 * pas suivie, la vente passe.
 */
export function shopNeedGrams(
  weightGrams: number | null | undefined,
  quantity: number,
): number | null {
  if (
    typeof weightGrams !== "number" ||
    !Number.isFinite(weightGrams) ||
    weightGrams <= 0
  )
    return null;
  const pieces = Math.max(1, Math.trunc(quantity) || 1);
  return Math.ceil(
    (Math.ceil(weightGrams) * pieces * (100 + SHOP_WASTE_PERCENT)) / 100,
  );
}

/** Cette ligne réserve-t-elle du filament ? Seulement un article imprimé à la demande, avec un poids. */
export function shopLineTracksFilament(
  saleType: "stock" | "on_demand",
  weightGrams: number | null | undefined,
): boolean {
  return (
    shopNeedGrams(saleType === "on_demand" ? weightGrams : null, 1) !== null
  );
}

/**
 * Grammes d'UNE pièce à réserver pour une ligne (`order_item_filaments.grams_per_piece`) :
 * le poids de la fiche arrondi au gramme supérieur, seulement pour un article
 * imprimé à la demande avec un poids ; null sinon (rien n'est écrit). La ligne
 * réserve ensuite `grams_per_piece × quantité + perte`, dérivé à la lecture.
 */
export function shopReservationGrams(
  saleType: "stock" | "on_demand",
  weightGrams: number | null | undefined,
): number | null {
  return shopLineTracksFilament(saleType, weightGrams)
    ? Math.ceil(weightGrams as number)
    : null;
}

/**
 * Anciens paniers (localStorage) et anciens clients : une ligne qui n'a qu'un NOM
 * de couleur de l'ancienne palette de la boutique est rattachée à une référence du
 * stock par cette table en dur. Tout autre nom : la couleur est retirée et le
 * client en choisit une sur la fiche. Les clés sont normalisées (`colorNameKey`).
 */
export const LEGACY_COLOR_REFS: Readonly<Record<string, string>> = {
  blanc: "ref-bambu-matte-ivory-white",
  noir: "ref-bambu-matte-charcoal",
  bleu: "ref-bambu-matte-marine-blue",
};

/** Casse, accents et espaces ignorés : « Blanc », « blanc », « BLANC  » se valent. */
export function colorNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Référence du stock correspondant à un ancien nom de couleur, ou null. */
export function legacyColorRef(name: string | null | undefined): string | null {
  if (!name) return null;
  return LEGACY_COLOR_REFS[colorNameKey(name)] ?? null;
}

/**
 * Référence demandée par une ligne : son `colorRef`, à défaut l'ancien nom de
 * couleur converti. `null` : aucune couleur demandée (ou nom hérité inconnu).
 */
export function requestedColorRef(line: {
  colorRef?: string | null;
  color?: string | null;
}): string | null {
  if (line.colorRef) return line.colorRef;
  return legacyColorRef(line.color);
}

/** Une couleur proposée par la boutique : une référence du stock, prête à afficher. */
export interface ShopColor {
  /** Id de la référence (`filament_refs.id`) : l'identité de la couleur d'une ligne. */
  id: string;
  /** Nom affiché, dans la langue : palette du Studio si la référence en a un, sinon nom officiel. */
  name: string;
  officialName: string;
  brand: string;
  range: string;
  /** Id de la palette du Studio (`blanc-neve`…), ou null. */
  studioId: string | null;
  /** Première teinte (viewer 3D, pastilles unies). */
  hex: string;
  /** 1 à 3 teintes (tricolore co-extrudé). */
  hexes: string[];
  /** Teinte approximative : la bobine fait foi. */
  approximate: boolean;
}

/**
 * La couleur demandée (par un agent, un lien de panier, un ancien client) parmi
 * celles d'un article : par id de référence, par nom affiché, par nom officiel, ou
 * par ancien nom de la palette de la boutique (« Blanc »…).
 */
export function findColorOption<
  T extends { id: string; name: string; officialName?: string },
>(options: readonly T[], requested: string | null | undefined): T | undefined {
  const wanted = requested?.trim();
  if (!wanted) return undefined;
  const key = colorNameKey(wanted);
  const legacy = legacyColorRef(wanted);
  return (
    options.find((option) => option.id === wanted) ??
    options.find(
      (option) =>
        colorNameKey(option.name) === key ||
        (option.officialName !== undefined &&
          colorNameKey(option.officialName) === key),
    ) ??
    (legacy ? options.find((option) => option.id === legacy) : undefined)
  );
}

/** Les couleurs proposées par un article : les références du stock, moins ses exclusions. */
export function allowedColors<T extends { id: string }>(
  refs: readonly T[],
  excluded: ReadonlySet<string> | undefined,
): T[] {
  if (!excluded || excluded.size === 0) return [...refs];
  return refs.filter((ref) => !excluded.has(ref.id));
}

/**
 * Ordre d'affichage : d'abord les couleurs de la palette du Studio, dans l'ordre
 * de cette palette (la blanche d'abord : c'est la couleur par défaut d'une
 * carte), puis les autres par marque et nom.
 */
export function sortShopColors<
  T extends {
    studioId: string | null;
    brand: string;
    officialName: string;
  },
>(refs: readonly T[], studioOrder: readonly string[]): T[] {
  // Les références hors palette partagent le rang « après la palette ».
  const rank = (ref: T) => {
    const index = ref.studioId ? studioOrder.indexOf(ref.studioId) : -1;
    return index < 0 ? studioOrder.length : index;
  };
  return [...refs].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.brand.localeCompare(b.brand) ||
      a.officialName.localeCompare(b.officialName),
  );
}

// ── Besoins combinés par référence (Studio + boutique) ───────────────────────

export interface NeedRef {
  id: string;
  /** Id de la palette du Studio (`blanc-neve`…), ou null. */
  studioId: string | null;
}

export interface CombinedNeeds {
  /** Grammes par id de palette du Studio (lignes du Studio : pièce × quantité). */
  studio: Readonly<Record<string, number>>;
  /** Grammes par id de référence (lignes de la boutique imprimées à la demande). */
  shop: Readonly<Record<string, number>>;
}

export interface RefNeed {
  refId: string;
  studioId: string | null;
  needGrams: number;
}

/**
 * Besoin TOTAL de chaque référence : ses lignes du Studio (par id de palette)
 * plus ses lignes de la boutique (par id de référence). Une même bobine sert les
 * deux : on les additionne avant de comparer au disponible. Pur, testé.
 */
export function combineNeedsByRef(
  refs: readonly NeedRef[],
  needs: CombinedNeeds,
): RefNeed[] {
  const out: RefNeed[] = [];
  for (const ref of refs) {
    const needGrams =
      (ref.studioId ? (needs.studio[ref.studioId] ?? 0) : 0) +
      (needs.shop[ref.id] ?? 0);
    if (needGrams > 0)
      out.push({ refId: ref.id, studioId: ref.studioId, needGrams });
  }
  return out;
}

export interface RefShortfall extends RefNeed {
  availableGrams: number;
}

/** Les références dont le disponible ne couvre pas le besoin (marge de fin de bobine comprise). */
export function findShortfalls(
  needs: readonly RefNeed[],
  availableByRef: ReadonlyMap<string, number>,
  covers: (availableGrams: number, needGrams: number) => boolean,
): RefShortfall[] {
  const short: RefShortfall[] = [];
  for (const need of needs) {
    const availableGrams = availableByRef.get(need.refId) ?? 0;
    if (!covers(availableGrams, need.needGrams))
      short.push({ ...need, availableGrams });
  }
  return short;
}

// ── Besoins des lignes de la boutique (panier du navigateur et paiement) ─────

export interface ShopNeedLine {
  /** Référence de la couleur choisie, ou null (ligne sans couleur : rien à réserver). */
  colorRef: string | null;
  saleType: "stock" | "on_demand";
  weightGrams: number | null | undefined;
  quantity: number;
}

/**
 * Grammes à réserver par référence pour des lignes de la boutique : seulement les
 * articles imprimés à la demande, avec un poids et une couleur ; chaque ligne est
 * arrondie au gramme supérieur AVANT d'être additionnée (comme la requête de
 * réservation, qui additionne des lignes arrondies). Pur : le panier et le
 * paiement partagent ce calcul.
 */
export function shopNeedsByRef(
  lines: readonly ShopNeedLine[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of lines) {
    if (!line.colorRef) continue;
    const grams = shopNeedGrams(
      line.saleType === "on_demand" ? line.weightGrams : null,
      line.quantity,
    );
    if (grams === null) continue;
    out[line.colorRef] = (out[line.colorRef] ?? 0) + grams;
  }
  return out;
}

/**
 * Ce que le navigateur sait du stock : la capacité publique (arrondie, plafonnée)
 * par id de palette du Studio et par id de référence, et le lien référence →
 * palette du Studio pour additionner les deux familles de lignes.
 */
export interface ClientStock {
  studio: Capacity;
  refs: Capacity;
  /** Id de référence → id de palette du Studio (seulement les références qui en ont un). */
  studioOfRef: Readonly<Record<string, string>>;
}

/**
 * Références dont la capacité ne couvre pas le besoin TOTAL (lignes du Studio par
 * id de palette + lignes de la boutique par id de référence). Même règle que le
 * paiement, avec la capacité arrondie du public : une référence plafonnée ou
 * inconnue n'est jamais épuisée ici, le paiement revérifie côté serveur.
 */
export function shortRefIds(
  stock: ClientStock | null,
  studioNeeds: readonly Readonly<Record<string, number | undefined>>[],
  shopNeeds: Readonly<Record<string, number>>,
): Set<string> {
  const out = new Set<string>();
  if (!stock) return out;
  const studioTotals = new Map<string, number>();
  for (const grams of studioNeeds)
    for (const [id, g] of Object.entries(grams))
      studioTotals.set(id, (studioTotals.get(id) ?? 0) + (g ?? 0));
  const totals = new Map<string, number>();
  for (const [refId, studioId] of Object.entries(stock.studioOfRef)) {
    const grams = studioTotals.get(studioId) ?? 0;
    if (grams > 0) totals.set(refId, grams);
  }
  for (const [refId, g] of Object.entries(shopNeeds))
    totals.set(refId, (totals.get(refId) ?? 0) + g);
  for (const [refId, total] of totals)
    if (isShort(stock.refs, refId, total)) out.add(refId);
  return out;
}

/** Ids de palette du Studio des références épuisées (les lignes du Studio se repèrent par là). */
export function studioIdsOfRefs(
  stock: ClientStock | null,
  refIds: ReadonlySet<string>,
): Set<string> {
  const out = new Set<string>();
  if (!stock) return out;
  for (const refId of refIds) {
    const studioId = stock.studioOfRef[refId];
    if (studioId) out.add(studioId);
  }
  return out;
}

// Liste « À acheter » et panier Bambu Lab Europe optimisé (calcul PUR, testé dans
// shopping.test.ts). Le magasin remise le panier entier, bobines et recharges
// mélangées : −10 % à 2 unités, −20 % à 4, −30 % à 6, −40 % à 10 ; port offert
// en Suisse dès 119 €, sinon 20 €. Les prix sont en centimes d'EUR (le seuil de
// port est en euros) ; les coûts réels de l'atelier, eux, sont en centimes CHF.
import { BAMBU_SHOP } from "./constants";

export type Format = "spool" | "refill";

export interface ShopConfig {
  tiers: readonly { minUnits: number; percent: number }[];
  freeShippingEurCents: number;
  shippingEurCents: number;
  maxExtraRatio: number;
}

export interface BuyRefInput {
  refId: string;
  label: string;
  studio: boolean;
  customOk: boolean;
  /** Disponible : restant − réservé, commandes en route exclues. */
  available: number;
  /** Grammes déjà commandés, pas encore reçus. */
  orderedGrams: number;
  /** Bobines neuves non ouvertes en stock. */
  sealed: number;
  /** Bobines commandées, pas encore reçues. */
  ordered: number;
  reorderBelowGrams: number;
  minSpareSpools: number;
  priceSpoolEurCents: number | null;
  priceRefillEurCents: number | null;
  urlSpool: string | null;
  urlRefill: string | null;
  /** Consommation récente (g/jour), pour la couverture en jours. */
  gramsPerDay?: number;
}

export interface Suggestion {
  refId: string;
  qty: number;
  reason: "below" | "spare" | "below+spare";
  /** Jours de couverture au rythme récent, null sans consommation connue. */
  coverDays: number | null;
}

/**
 * Une couleur est à acheter si ce qu'il y aura (disponible + commandé) passe
 * sous son seuil, ou si les bobines neuves (en stock + commandées) manquent à
 * sa réserve. La quantité comble la réserve, au moins une bobine sous le seuil.
 */
export function suggestPurchases(rows: readonly BuyRefInput[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const row of rows) {
    const incoming = row.available + row.orderedGrams;
    const below = incoming < row.reorderBelowGrams;
    const spareGap = row.minSpareSpools - (row.sealed + row.ordered);
    const lacksSpare = spareGap > 0;
    if (!below && !lacksSpare) continue;
    out.push({
      refId: row.refId,
      qty: Math.max(lacksSpare ? spareGap : 0, below ? 1 : 0),
      reason: below && lacksSpare ? "below+spare" : below ? "below" : "spare",
      coverDays:
        row.gramsPerDay && row.gramsPerDay > 0
          ? Math.max(0, Math.round(incoming / row.gramsPerDay))
          : null,
    });
  }
  return out.sort(byUrgency(rows));
}

function byUrgency(rows: readonly BuyRefInput[]) {
  const by = new Map(rows.map((r) => [r.refId, r]));
  return (a: Suggestion, b: Suggestion) => {
    const ca = a.coverDays ?? Number.POSITIVE_INFINITY;
    const cb = b.coverDays ?? Number.POSITIVE_INFINITY;
    if (ca !== cb) return ca - cb;
    return (
      (by.get(a.refId)?.available ?? 0) - (by.get(b.refId)?.available ?? 0)
    );
  };
}

export interface BasketLine {
  refId: string;
  format: Format;
  qty: number;
  unitEurCents: number;
  url: string | null;
  /** Ajoutée pour atteindre un palier de remise. */
  extra: boolean;
  /** Recharge sans support vide libre pour la monter. */
  needsHolder: boolean;
}

export interface BasketTotals {
  units: number;
  tierPercent: number;
  listEurCents: number;
  discountEurCents: number;
  shippingEurCents: number;
  totalEurCents: number;
  /** Reste à ajouter pour le port offert (0 si atteint). */
  freeShippingGapEurCents: number;
}

export function tierPercent(units: number, shop: ShopConfig = BAMBU_SHOP) {
  let percent = 0;
  for (const tier of shop.tiers)
    if (units >= tier.minUnits) percent = tier.percent;
  return percent;
}

export function priceBasket(
  lines: readonly BasketLine[],
  shop: ShopConfig = BAMBU_SHOP,
): BasketTotals {
  const units = lines.reduce((s, l) => s + l.qty, 0);
  const listEurCents = lines.reduce((s, l) => s + l.qty * l.unitEurCents, 0);
  const percent = tierPercent(units, shop);
  const discountEurCents = Math.round((listEurCents * percent) / 100);
  const net = listEurCents - discountEurCents;
  const shippingEurCents =
    units === 0 || net >= shop.freeShippingEurCents ? 0 : shop.shippingEurCents;
  return {
    units,
    tierPercent: percent,
    listEurCents,
    discountEurCents,
    shippingEurCents,
    totalEurCents: net + shippingEurCents,
    freeShippingGapEurCents:
      units === 0 ? 0 : Math.max(0, shop.freeShippingEurCents - net),
  };
}

export interface BasketOption {
  /** Nombre d'unités ajoutées au besoin réel pour atteindre le palier. */
  extras: number;
  lines: BasketLine[];
  totals: BasketTotals;
  /** Surcoût total (port compris) par rapport au panier sans extras. */
  marginalEurCents: number;
  /** Surcoût par extra, en centimes d'EUR ; null sans extras. */
  marginalPerExtraEurCents: number | null;
  recommended: boolean;
}

export interface BasketPlan {
  options: BasketOption[];
  recommended: BasketOption | null;
}

/**
 * Panier optimisé. `needs` : ce qu'il faut acheter ; `extras` : couleurs à
 * ajouter en priorité pour atteindre un palier (déjà classées par urgence) ;
 * `freeHolders` : supports plastique vides disponibles pour monter des
 * recharges. Une recharge n'est choisie que s'il reste un support libre ;
 * sinon une bobine avec support (si la couleur existe dans ce format).
 */
export function planBasket(
  refs: readonly BuyRefInput[],
  needs: readonly Suggestion[],
  extras: readonly Suggestion[],
  freeHolders: number,
  shop: ShopConfig = BAMBU_SHOP,
): BasketPlan {
  const byRef = new Map(refs.map((r) => [r.refId, r]));

  function build(extraCount: number): BasketLine[] {
    let holders = Math.max(0, freeHolders);
    const lines = new Map<string, BasketLine>();
    const add = (refId: string, qty: number, extra: boolean) => {
      const ref = byRef.get(refId);
      if (!ref) return;
      const hasRefill = ref.priceRefillEurCents !== null;
      const hasSpool = ref.priceSpoolEurCents !== null;
      for (let i = 0; i < qty; i++) {
        let format: Format;
        let needsHolder = false;
        if (hasRefill && holders > 0) {
          format = "refill";
          holders--;
        } else if (hasSpool) {
          format = "spool";
        } else {
          format = "refill";
          needsHolder = true;
        }
        const unit =
          format === "spool" ? ref.priceSpoolEurCents : ref.priceRefillEurCents;
        if (unit === null) continue;
        const key = `${refId}:${format}:${extra}`;
        const line = lines.get(key);
        if (line) line.qty += 1;
        else
          lines.set(key, {
            refId,
            format,
            qty: 1,
            unitEurCents: unit,
            url: format === "spool" ? ref.urlSpool : ref.urlRefill,
            extra,
            needsHolder,
          });
      }
    };
    for (const need of needs) add(need.refId, need.qty, false);
    let remaining = extraCount;
    for (const extra of extras) {
      if (remaining <= 0) break;
      const take = Math.min(extra.qty, remaining);
      add(extra.refId, take, true);
      remaining -= take;
    }
    return [...lines.values()];
  }

  const baseLines = build(0);
  const baseTotals = priceBasket(baseLines, shop);
  const available = extras.reduce((s, e) => s + e.qty, 0);
  const options: BasketOption[] = [
    {
      extras: 0,
      lines: baseLines,
      totals: baseTotals,
      marginalEurCents: 0,
      marginalPerExtraEurCents: null,
      recommended: false,
    },
  ];
  if (baseTotals.units === 0) return { options, recommended: null };

  for (const tier of shop.tiers) {
    const extraCount = tier.minUnits - baseTotals.units;
    if (extraCount <= 0 || extraCount > available) continue;
    const lines = build(extraCount);
    const totals = priceBasket(lines, shop);
    if (totals.units < tier.minUnits) continue;
    const marginal = totals.totalEurCents - baseTotals.totalEurCents;
    options.push({
      extras: extraCount,
      lines,
      totals,
      marginalEurCents: marginal,
      marginalPerExtraEurCents: Math.round(marginal / extraCount),
      recommended: false,
    });
  }

  // Recommandé : le plus gros panier dont chaque extra coûte au plus
  // `maxExtraRatio` de son prix catalogue (sinon, le besoin réel seul).
  let recommended: BasketOption = options[0];
  for (const option of options.slice(1)) {
    const extraLines = option.lines.filter((l) => l.extra);
    const extraList = extraLines.reduce(
      (s, l) => s + l.qty * l.unitEurCents,
      0,
    );
    if (extraList === 0) continue;
    const ratio = option.marginalEurCents / extraList;
    if (ratio <= shop.maxExtraRatio && option.extras > recommended.extras)
      recommended = option;
  }
  recommended.recommended = true;
  return { options, recommended };
}

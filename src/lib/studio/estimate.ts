// Estimation de prix (brief « Strates », §6.5 et annexe B) :
//
//   prix = max(plancher, préparation + g × CHF/g + h × CHF/h + changements × CHF/changement) × marge
//
// fourchette ± rangePct (15 % avant calibration), bornes arrondies à 0,50 CHF,
// CENTIMES ENTIERS (règle d'or 5), jamais sous le plancher. `null` tant que
// `PRICING.validated` vaut false : aucun CHF avant validation des coefficients.
// Libellé obligatoire à côté du prix : « Estimation · prix ferme confirmé par
// l'atelier sous 48 h » (texte du namespace `studio`).
import { PRICING, type PricingParams } from "./pricing-params";
import type { StudioStats } from "./types";

export interface PriceRange {
  lowCents: number;
  highCents: number;
}

/** Arrondi à un multiple de `step` (centimes), entier. */
function roundTo(cents: number, step: number): number {
  return Math.round(cents / step) * step;
}

/** Prix central en centimes (non arrondi), avant fourchette. */
export function basePriceCents(
  stats: Pick<StudioStats, "grams" | "minutes" | "changes">,
  params: PricingParams = PRICING,
): number {
  const raw =
    params.setupCents +
    stats.grams * params.centsPerGram +
    (stats.minutes / 60) * params.centsPerHour +
    stats.changes * params.centsPerChange;
  return Math.max(params.floorCents, raw) * params.margin;
}

/**
 * Fourchette de prix, ou `null` si les coefficients ne sont pas validés.
 * `rangePct` permet la calibration (±8 %) sans toucher aux paramètres.
 */
export function estimate(
  stats: Pick<StudioStats, "grams" | "minutes" | "changes">,
  params: PricingParams = PRICING,
  rangePct: number = params.rangePct,
): PriceRange | null {
  if (!params.validated) return null;
  const price = basePriceCents(stats, params);
  const spread = rangePct / 100;
  const floor = roundTo(params.floorCents, params.roundToCents);
  const low = Math.max(floor, roundTo(price * (1 - spread), params.roundToCents));
  const high = Math.max(low, roundTo(price * (1 + spread), params.roundToCents));
  return { lowCents: Math.round(low), highCents: Math.round(high) };
}

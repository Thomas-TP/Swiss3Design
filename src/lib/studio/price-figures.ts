// Les chiffres qui servent au prix, et le prix d'une configuration : le pont
// entre `computeStats` (géométrie) et `price.ts` (argent, léger). Identique côté
// navigateur (affichage en direct) et côté serveur (recalcul au paiement) :
// ces deux côtés appellent exactement ce module.
//
// INVARIANTS (price-font.test.ts) :
//  - le prix ne dépend pas de la police de glyphes complète (public/studio/
//    glyphs/…json), que le serveur ne charge jamais : `computeStats` ne lit que
//    la table de métriques `glyph-metrics.ts` ;
//  - le prix ne dépend pas de la langue : calcul en `PRICE_LOCALE`.
import { PRINT } from "./print-params";
import {
  PRICE_LOCALE,
  studioLineCents,
  studioUnitCents,
  type PriceFigures,
} from "./price";
import { computeStats } from "./stats";
import type { StudioConfig, StudioStats, StudioTexts } from "./types";

type StatsLocale = Parameters<typeof computeStats>[3];

/**
 * Statistiques à prendre pour le prix. On réutilise celles que l'appelant a déjà
 * calculées (`stats`, dans la langue `locale`) quand la langue ne peut pas les
 * changer (tout sauf la Montagne) ou quand c'est déjà la langue canonique ;
 * sinon on les recalcule en `PRICE_LOCALE` (moins d'une milliseconde).
 */
export function priceStats(
  config: StudioConfig,
  texts: StudioTexts,
  locale?: StatsLocale,
  stats?: StudioStats,
): StudioStats {
  const independent = config.object !== "montagne" || locale === PRICE_LOCALE;
  if (stats && independent) return stats;
  return computeStats(config, texts, PRINT, PRICE_LOCALE);
}

export function figuresOf(stats: StudioStats): PriceFigures {
  return { grams: stats.grams, changes: stats.changes };
}

export interface StudioPrice {
  unitCents: number;
  totalCents: number;
  /** Chiffres d'une pièce, en langue canonique. */
  stats: StudioStats;
}

/**
 * Prix ferme d'une configuration (textes déjà nettoyés) pour `quantity`
 * pièces, avec les statistiques déjà calculées si elles servent.
 */
export function studioPrice(
  config: StudioConfig,
  texts: StudioTexts,
  quantity: number,
  options: { locale?: StatsLocale; stats?: StudioStats } = {},
): StudioPrice {
  const stats = priceStats(config, texts, options.locale, options.stats);
  const figures = figuresOf(stats);
  return {
    unitCents: studioUnitCents(config.object, figures, quantity),
    totalCents: studioLineCents(config.object, figures, quantity),
    stats,
  };
}

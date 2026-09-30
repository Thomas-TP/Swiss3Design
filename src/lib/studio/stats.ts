// Statistiques analytiques d'une configuration (brief « Strates », §6.5 et
// annexe B). Pur TypeScript, identique en SSR et côté client : « tout chiffre
// est calculé par la même fonction pure ». Aucune dépendance à three.
//
//   couches  = ceil(h / 0,2)
//   masse    = V(cm³) × 1,24 g/cm³ (PLA) + changements × purge
//   durée    = V(mm³) / 8 mm³/s + couches × 1,5 s + changements × 110 s + 6 min
//   changements = frontières de bande où le filament change
//
// Les objets plats (Cartouche, Relief, Borne) sont livrés par WP-02 : leurs
// aires exactes s'ajoutent ici sans changer le contrat de `StudioStats`.
import { estimate } from "./estimate";
import { checkLavauxWith } from "./guards";
import { analyzeLavaux } from "./objects/lavaux-analysis";
import { LAYER_HEIGHT } from "./objects/lavaux-model";
import { PRICING, type PricingParams } from "./pricing-params";
import type {
  Band,
  LavauxConfig,
  StudioConfig,
  StudioStats,
  StudioTexts,
} from "./types";

/** Nombre de couches d'une hauteur : ceil(h / 0,2), à l'erreur de virgule flottante près. */
export function layerCount(heightMm: number): number {
  return Math.ceil(heightMm / LAYER_HEIGHT - 1e-6);
}

/** Couche d'une frontière de bande : la frontière z tombe à la couche round(z / 0,2) + 1 (annexe B). */
export function boundaryLayer(zMm: number): number {
  return Math.round(zMm / LAYER_HEIGHT) + 1;
}

/** Nombre de changements de filament : frontières entre deux bandes de filaments différents. */
export function countChanges(bands: readonly Band[]): number {
  let changes = 0;
  for (let k = 1; k < bands.length; k++) {
    if (bands[k].filament !== bands[k - 1].filament) changes++;
  }
  return changes;
}

/** Masse (g), durée (min) et purge d'un volume, avec les coefficients de l'atelier. */
export function printFigures(
  volumeMm3: number,
  layers: number,
  changes: number,
  params: PricingParams = PRICING,
) {
  const purgeGrams = changes * params.purgeGrams;
  const grams = (volumeMm3 / 1000) * params.densityGcm3 + purgeGrams;
  const seconds =
    volumeMm3 / params.flowMm3PerS +
    layers * params.layerOverheadS +
    changes * params.changeSeconds;
  const minutes = seconds / 60 + params.setupMinutes;
  return { grams, minutes, purgeGrams };
}

function lavauxStats(config: LavauxConfig, params: PricingParams): StudioStats {
  const analysis = analyzeLavaux(config);
  const layers = layerCount(config.h);
  const changes = countChanges(config.bands);
  const { grams, minutes, purgeGrams } = printFigures(
    analysis.volumeMm3,
    layers,
    changes,
    params,
  );
  const stats: StudioStats = {
    heightMm: config.h,
    // « d = diamètre de l'enveloppe, motif compris » : la largeur affichée est d.
    widthMm: config.d,
    depthMm: config.d,
    layers,
    volumeCm3: Math.round(analysis.volumeMm3) / 1000,
    grams: Math.round(grams * 10) / 10,
    minutes: Math.round(minutes),
    changes,
    purgeGrams: Math.round(purgeGrams * 10) / 10,
    printable: checkLavauxWith(config, analysis),
  };
  stats.estimate = estimate(stats, params);
  return stats;
}

/**
 * Statistiques d'une configuration. `texts` n'influe que sur les objets à
 * texte (WP-02). `params` permet de tester un barème validé sans toucher à
 * PRICING (aucun CHF tant que `PRICING.validated` vaut false).
 */
export function computeStats(
  config: StudioConfig,
  texts?: StudioTexts,
  params: PricingParams = PRICING,
): StudioStats {
  void texts;
  if (config.object === "lavaux") return lavauxStats(config, params);
  throw new Error(`computeStats : « ${config.object} » est livré par WP-02`);
}

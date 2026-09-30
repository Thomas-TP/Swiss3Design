// Statistiques analytiques d'une configuration (brief « Strates », §6.5 et
// annexe B). Pur TypeScript, identique en SSR et côté client : « tout chiffre
// est calculé par la même fonction pure ». Aucune dépendance à three.
//
//   couches  = ceil(h / 0,2)
//   masse    = V(cm³) × 1,24 g/cm³ (PLA) + changements × purge
//   durée    = V(mm³) / 8 mm³/s + couches × 1,5 s + changements × 110 s + 6 min
//   changements = frontières de bande où le filament change
//
// Objets plats (WP-02) : aires EXACTES des polygones (plaque, disque, cadre,
// contours des strates) et, pour le texte, la table de métriques des glyphes
// (aire et chasse de chaque caractère) : pas de contour de glyphe, donc le même
// chiffre en SSR et côté client. Le Relief et la Borne, pleins et de plus de
// 3 mm, s'impriment en coque de 0,8 mm + remplissage à 15 % (§6.5) ; la
// Cartouche, mince, est pleine.
import { estimate } from "./estimate";
import {
  borneStrokeFix,
  checkFlatWith,
  checkLavauxWith,
  checkReliefWith,
} from "./guards";
import { layoutBorne } from "./objects/borne-model";
import { layoutCartouche } from "./objects/cartouche-model";
import {
  analyzeFlat,
  flatBands,
  flatHeight,
  type FlatModel,
} from "./objects/flat-model";
import { analyzeLavaux } from "./objects/lavaux-analysis";
import { LAYER_HEIGHT } from "./objects/lavaux-model";
import {
  analyzeRelief,
  layoutRelief,
  type Locale,
} from "./objects/relief-model";
import { PRICING, type PricingParams } from "./pricing-params";
import type {
  Band,
  LavauxConfig,
  Printability,
  ReliefConfig,
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

/** Épaisseur de la coque pleine (mm) et remplissage des objets épais (§6.5). */
export const SHELL_MM = 0.8;
export const INFILL = 0.15;

/**
 * Volume imprimé (mm³) d'un objet plein de plus de 3 mm : coque de 0,8 mm
 * pleine + remplissage à 15 % du reste (`V_coque = min(V, A × 0,8)`).
 */
export function solidPrintVolume(
  volumeMm3: number,
  surfaceMm2: number,
): number {
  const shell = Math.min(volumeMm3, surfaceMm2 * SHELL_MM);
  return shell + INFILL * (volumeMm3 - shell);
}

function finish(
  base: Omit<StudioStats, "grams" | "minutes" | "purgeGrams" | "estimate"> & {
    printVolumeMm3: number;
  },
  params: PricingParams,
): StudioStats {
  const { printVolumeMm3, ...rest } = base;
  const { grams, minutes, purgeGrams } = printFigures(
    printVolumeMm3,
    rest.layers,
    rest.changes,
    params,
  );
  const stats: StudioStats = {
    ...rest,
    grams: Math.round(grams * 10) / 10,
    minutes: Math.round(minutes),
    purgeGrams: Math.round(purgeGrams * 10) / 10,
  };
  stats.estimate = estimate(stats, params);
  return stats;
}

function flatStats(
  model: FlatModel,
  printable: Printability,
  solid: boolean,
  params: PricingParams,
): StudioStats {
  const analysis = analyzeFlat(model);
  const height = flatHeight(model);
  return finish(
    {
      heightMm: height,
      widthMm: Math.round(model.widthMm * 10) / 10,
      depthMm: Math.round(model.depthMm * 10) / 10,
      layers: layerCount(height),
      volumeCm3: Math.round(analysis.volumeMm3) / 1000,
      changes: countChanges(flatBands(model)),
      printable,
      printVolumeMm3: solid
        ? solidPrintVolume(analysis.volumeMm3, analysis.surfaceMm2)
        : analysis.volumeMm3,
    },
    params,
  );
}

function reliefStats(
  config: ReliefConfig,
  texts: StudioTexts | undefined,
  locale: Locale | undefined,
  params: PricingParams,
): StudioStats {
  const model = layoutRelief(config, texts, locale);
  const analysis = analyzeRelief(model);
  return finish(
    {
      heightMm: model.heightMm,
      widthMm: config.size,
      depthMm: config.size,
      layers: layerCount(model.heightMm),
      volumeCm3: Math.round(analysis.volumeMm3) / 1000,
      changes: countChanges(config.bands),
      printable: checkReliefWith(config, model),
      printVolumeMm3: solidPrintVolume(analysis.volumeMm3, analysis.surfaceMm2),
    },
    params,
  );
}

/**
 * Statistiques d'une configuration. `texts` n'influe que sur les objets à
 * texte (Cartouche, Relief, Borne) ; `locale` seulement sur l'étiquette du
 * sous-verre. `params` permet de tester un barème validé sans toucher à
 * PRICING (aucun CHF tant que `PRICING.validated` vaut false).
 */
export function computeStats(
  config: StudioConfig,
  texts?: StudioTexts,
  params: PricingParams = PRICING,
  locale?: Locale,
): StudioStats {
  switch (config.object) {
    case "lavaux":
      return lavauxStats(config, params);
    case "cartouche": {
      const model = layoutCartouche(config, texts);
      return flatStats(model, checkFlatWith(model), false, params);
    }
    case "borne": {
      const model = layoutBorne(config, texts);
      const printable = checkFlatWith(model, () => borneStrokeFix(config));
      return flatStats(model, printable, true, params);
    }
    case "relief":
      return reliefStats(config, texts, locale, params);
  }
}

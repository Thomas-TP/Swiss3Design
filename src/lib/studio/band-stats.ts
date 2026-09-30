// Statistiques par bande (brief « Strates », §6.4 et §7.5 chapitre 01) : les
// étiquettes de l'éclaté (« Bleu Léman · couches 1–210 · 0–42,0 mm · ≈ 21 g »)
// et la ligne de purge (« 2 changements · purge ≈ 1,6 g · + ≈ 4 min »).
// Les noms de filaments sont traduits par l'appelant (studioCore.filaments).
import {
  boundaryLayer,
  countChanges,
  layerCount,
  printFigures,
  solidPrintVolume,
} from "./stats";
import { layoutBorne } from "./objects/borne-model";
import { layoutCartouche } from "./objects/cartouche-model";
import {
  analyzeFlat,
  flatBands,
  flatHeight,
  type FlatModel,
} from "./objects/flat-model";
import { analyzeLavaux } from "./objects/lavaux-analysis";
import {
  analyzeRelief,
  layoutRelief,
  type Locale,
} from "./objects/relief-model";
import { PRICING, type PricingParams } from "./pricing-params";
import type {
  Band,
  FilamentId,
  LavauxConfig,
  StudioConfig,
  StudioTexts,
} from "./types";

export interface BandStat {
  index: number;
  filament: FilamentId;
  /** Bornes en mm depuis le plateau. */
  fromMm: number;
  toMm: number;
  /** Couches numérotées depuis 1 : « couches 211–540 ». */
  fromLayer: number;
  toLayer: number;
  layers: number;
  volumeCm3: number;
  /** Masse de la bande seule (sans purge), en grammes. */
  grams: number;
  /** Vrai si cette bande commence par un changement de filament. */
  startsWithChange: boolean;
}

export interface BandSummary {
  bands: BandStat[];
  changes: number;
  purgeGrams: number;
  /** Temps ajouté par les changements (minutes). */
  extraMinutes: number;
}

/**
 * Résumé par bande à partir des bandes, de la hauteur et du volume de chaque
 * bande (mm³). `printScale` ramène le volume plein au volume imprimé : 1 pour
 * un objet plein, `solidPrintVolume / volume` pour un objet épais (coque de
 * 0,8 mm + remplissage à 15 %, §6.5).
 */
function summarize(
  config: { bands: readonly Band[] },
  heightMm: number,
  volumesMm3: readonly number[],
  params: PricingParams,
  printScale = 1,
): BandSummary {
  const totalLayers = layerCount(heightMm);
  let from = 0;
  const bands: BandStat[] = config.bands.map((band, index) => {
    const fromMm = from;
    from = band.toMm;
    const fromLayer = index === 0 ? 1 : boundaryLayer(fromMm);
    const toLayer =
      index === config.bands.length - 1
        ? totalLayers
        : boundaryLayer(band.toMm) - 1;
    const volumeMm3 = (volumesMm3[index] ?? 0) * printScale;
    return {
      index,
      filament: band.filament,
      fromMm,
      toMm: band.toMm,
      fromLayer,
      toLayer,
      layers: toLayer - fromLayer + 1,
      volumeCm3: Math.round(volumeMm3) / 1000,
      grams: Math.round((volumeMm3 / 1000) * params.densityGcm3 * 10) / 10,
      startsWithChange:
        index > 0 && config.bands[index - 1].filament !== band.filament,
    };
  });
  const changes = countChanges(config.bands);
  const { purgeGrams } = printFigures(0, 0, changes, params);
  return {
    bands,
    changes,
    purgeGrams: Math.round(purgeGrams * 10) / 10,
    extraMinutes: Math.round((changes * params.changeSeconds) / 60),
  };
}

export function bandStats(
  config: LavauxConfig,
  params: PricingParams = PRICING,
): BandSummary {
  const analysis = analyzeLavaux(config);
  return summarize(config, config.h, analysis.bandVolumesMm3, params);
}

function flatBandStats(
  model: FlatModel,
  solid: boolean,
  params: PricingParams,
): BandSummary {
  const analysis = analyzeFlat(model);
  const scale = solid
    ? solidPrintVolume(analysis.volumeMm3, analysis.surfaceMm2) /
      analysis.volumeMm3
    : 1;
  return summarize(
    { bands: flatBands(model) },
    flatHeight(model),
    analysis.bandVolumesMm3,
    params,
    scale,
  );
}

/**
 * Résumé par bande d'une configuration quelconque (étiquettes de l'éclaté et
 * ligne de purge, §6.4) : le vase lit ses bandes, la Cartouche et le porte-nom
 * les déduisent de la plaque et du texte (relief : plaque puis encre ; gravure :
 * encre puis plaque), le sous-verre les cale sur les sommets de strates. La somme
 * des masses de bandes plus la purge est la masse de `computeStats`.
 */
export function bandStatsFor(
  config: StudioConfig,
  texts?: StudioTexts,
  params: PricingParams = PRICING,
  locale?: Locale,
): BandSummary {
  switch (config.object) {
    case "lavaux":
      return bandStats(config, params);
    case "cartouche":
      return flatBandStats(layoutCartouche(config, texts), false, params);
    case "borne":
      return flatBandStats(layoutBorne(config, texts), true, params);
    case "relief": {
      const model = layoutRelief(config, texts, locale);
      const analysis = analyzeRelief(model);
      const scale = solidPrintVolume(analysis.volumeMm3, analysis.surfaceMm2);
      return summarize(
        config,
        model.heightMm,
        analysis.bandVolumesMm3,
        params,
        scale / analysis.volumeMm3,
      );
    }
  }
}

// Statistiques par bande (brief « Strates », §6.4 et §7.5 chapitre 01) : les
// étiquettes de l'éclaté (« Bleu Léman · couches 1–210 · 0–42,0 mm · ≈ 21 g »)
// et la ligne de purge (« 2 changements · purge ≈ 1,6 g · + ≈ 4 min »).
// Les noms de filaments sont traduits par l'appelant (studioCore.filaments).
import { countChanges, boundaryLayer, layerCount, printFigures } from "./stats";
import { analyzeLavaux } from "./objects/lavaux-analysis";
import { PRICING, type PricingParams } from "./pricing-params";
import type { FilamentId, LavauxConfig } from "./types";

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

export function bandStats(
  config: LavauxConfig,
  params: PricingParams = PRICING,
): BandSummary {
  const analysis = analyzeLavaux(config);
  const totalLayers = layerCount(config.h);
  let from = 0;
  const bands: BandStat[] = config.bands.map((band, index) => {
    const fromMm = from;
    from = band.toMm;
    const fromLayer = index === 0 ? 1 : boundaryLayer(fromMm);
    const toLayer =
      index === config.bands.length - 1
        ? totalLayers
        : boundaryLayer(band.toMm) - 1;
    const volumeMm3 = analysis.bandVolumesMm3[index] ?? 0;
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

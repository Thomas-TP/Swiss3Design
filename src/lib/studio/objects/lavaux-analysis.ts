// Analyse analytique du vase « Lavaux » (brief « Strates », §6.5) : volume
// (total et par bande), pentes extrêmes des parois, rayon du pied. Une seule
// passe sur un plan d'anneaux grossier ; les statistiques, les bandes et les
// garde-fous lisent le même résultat. Identique en SSR et côté client.
//
// Volume : Lavaux = ∫∫ (r_o² − r_i²) / 2 dθ dz (paroi, de z = 1,6 mm à h) +
// le fond plein (disque complet de z = 0 à 1,6 mm). Intégration trapézoïdale
// en z sur des anneaux qui encadrent chaque retrait de gradin (largeur nulle
// à la corniche, donc exacte) et quadrature du point milieu en θ.
import {
  FLOOR_MM,
  allocateCounts,
  bandBoundaries,
  buildRingPlan,
  collectBreakpoints,
  createLavauxModel,
  innerRadius,
  uniformInterior,
  type LavauxModel,
  type RingPlan,
} from "./lavaux-model";
import type { Band, LavauxConfig } from "../types";
import { canonicalJson } from "../kernel/hash";

export interface LavauxAnalysis {
  /** Volume de matière (mm³). */
  volumeMm3: number;
  /** Volume par bande de couleur (mm³), dans l'ordre de `config.bands`. */
  bandVolumesMm3: number[];
  /** Plus forte pente vers l'extérieur de la paroi extérieure (dr/dz, sans unité) et sa hauteur. */
  maxOutwardSlope: number;
  maxOutwardSlopeZ: number;
  /** Plus forte pente vers l'intérieur (dr/dz < 0 en valeur absolue) : surplomb de la cavité. */
  maxInwardSlope: number;
  maxInwardSlopeZ: number;
  /** Rayon extérieur au pied, hors motif (mm). */
  footRadius: number;
  /** Rayon maximal de l'enveloppe, d / 2 (mm). */
  envelopeRadius: number;
}

/** Nombre de bandes maillées visé pour l'intégration (précision ≪ 1 %, ≈ 1 ms). */
const ANALYSIS_STRIPS = 120;

function analysisPlan(model: LavauxModel): RingPlan {
  const { height: h, config } = model;
  const steps = model.pattern.discontinuities(h);
  const marks = [FLOOR_MM, ...bandBoundaries(config.bands, h)];
  const bps = collectBreakpoints(0, h, marks, steps);
  const lengths: number[] = [];
  const minimum: number[] = [];
  for (let k = 0; k < bps.length - 1; k++) {
    const len = bps[k + 1].z - bps[k].z;
    lengths.push(len);
    // Rampes de gradin : nombre PAIR de sous-intervalles, donc un anneau au
    // milieu de la rampe, là où la pente est maximale (1,875 × gd / gs).
    minimum.push(steps.length > 0 && len >= 1 ? 4 : 1);
  }
  const counts = allocateCounts(
    lengths,
    Math.max(ANALYSIS_STRIPS, lengths.length),
    minimum,
  ).map((c, k) =>
    steps.length > 0 && lengths[k] >= 1 && c % 2 === 1 ? c + 1 : c,
  );
  const byStart = new Map<number, number>();
  bps.forEach((bp, k) => {
    if (k < counts.length) byStart.set(Math.round(bp.z * 1e6), counts[k]);
  });
  return buildRingPlan(
    bps,
    (a, b) => uniformInterior(a, b, byStart.get(Math.round(a * 1e6)) ?? 1),
    false,
  );
}

function bandIndex(bands: readonly Band[], z: number): number {
  for (let k = 0; k < bands.length - 1; k++)
    if (z <= bands[k].toMm + 1e-9) return k;
  return Math.max(bands.length - 1, 0);
}

function analyze(config: LavauxConfig): LavauxAnalysis {
  const model = createLavauxModel(config);
  const plan = analysisPlan(model);
  const { wall, pattern, profile } = model;
  const M = Math.max(1, pattern.thetaSamples);
  const dTheta = (2 * Math.PI) / M;
  const tmp = new Float64Array(3);
  const n = plan.count;

  // Par anneau : intégrales angulaires du disque plein et de la paroi.
  const full = new Float64Array(n);
  const shell = new Float64Array(n);
  let maxOut = -Infinity;
  let maxOutZ = 0;
  let maxIn = 0;
  let maxInZ = 0;
  for (let j = 0; j < n; j++) {
    const z = plan.z[j];
    let sFull = 0;
    let sShell = 0;
    for (let i = 0; i < M; i++) {
      model.outer((i + 0.5) * dTheta, z, plan.nudge[j], tmp);
      const r = tmp[0];
      const fz = tmp[1];
      const ri = innerRadius(wall, r, fz, tmp[2]);
      sFull += r * r;
      sShell += r * r - ri * ri;
      if (fz > maxOut) {
        maxOut = fz;
        maxOutZ = z;
      }
      if (-fz > maxIn) {
        maxIn = -fz;
        maxInZ = z;
      }
    }
    full[j] = 0.5 * sFull * dTheta;
    shell[j] = 0.5 * sShell * dTheta;
  }

  const bands =
    config.bands.length > 0
      ? config.bands
      : [{ filament: "blanc-neve" as const, toMm: model.height }];
  const bandVolumes = new Array<number>(bands.length).fill(0);
  let volume = 0;
  for (let j = 0; j < n - 1; j++) {
    const dz = plan.z[j + 1] - plan.z[j];
    if (dz <= 0) continue;
    const zMid = 0.5 * (plan.z[j] + plan.z[j + 1]);
    const inBase = zMid < FLOOR_MM;
    const a = inBase ? full[j] : shell[j];
    const b = inBase ? full[j + 1] : shell[j + 1];
    const v = 0.5 * (a + b) * dz;
    volume += v;
    bandVolumes[bandIndex(bands, zMid)] += v;
  }

  return {
    volumeMm3: volume,
    bandVolumesMm3: bandVolumes,
    maxOutwardSlope: Math.max(maxOut, 0),
    maxOutwardSlopeZ: maxOutZ,
    maxInwardSlope: maxIn,
    maxInwardSlopeZ: maxInZ,
    footRadius: profile.radius(0),
    envelopeRadius: config.d / 2,
  };
}

// Mémoïsation d'un élément : l'interface appelle stats, bandes et garde-fous
// pour la même configuration ; la clé canonique évite de refaire l'analyse.
let lastKey = "";
let lastResult: LavauxAnalysis | null = null;

export function analyzeLavaux(config: LavauxConfig): LavauxAnalysis {
  const key = canonicalJson(config);
  if (key === lastKey && lastResult) return lastResult;
  const result = analyze(config);
  lastKey = key;
  lastResult = result;
  return result;
}

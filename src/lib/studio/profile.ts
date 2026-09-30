// Profil du vase « Lavaux » (brief « Strates », §6.3.1).
//
//   t = z / h. Rayons relatifs aux points de contrôle t = 0, 0,2, 0,5, 0,8, 1 :
//     cylindre [0,94 ; 0,98 ; 1,00 ; 0,99 ; n]
//     galet    [0,66 ; 0,92 ; 1,00 ; 0,90 ; n]
//     amphore  [0,58 ; 0,90 ; 1,00 ; 0,78 ; n]
//     cône     [1,00 ; 0,93 ; 0,84 ; 0,76 ; n]
//     tulipe   [0,64 ; 0,74 ; 0,86 ; 0,97 ; max(n ; 0,9)]
//   Galbe b : pour les 4 premiers points, rᵢ' = clamp(1 + (rᵢ − 1) × 2b, 0,4 ; 1)
//   (b = 0,5 redonne la famille, b = 0 un cylindre). Interpolation cubique
//   monotone : jamais de dépassement, donc pas de bosse imprévue ni de surplomb
//   caché. Lèvre : + l × smootherstep((t − 0,92) / 0,08).
//   R(z) = (d/2 − A) × P(t) où A est l'amplitude maximale du motif, pour que
//   l'enveloppe (motif compris) fasse exactement d.
//
// Écart assumé au brief : P est normalisé par son maximum (`Pmax`), pas
// supposé égal à 1. Avec une lèvre sur un col de 1,0 (cylindre), P monte à
// 1,08 en haut et l'enveloppe dépasserait `d` de 8 % ; la normalisation garde
// « d = diamètre de l'enveloppe » vrai pour tous les profils (pour le héros,
// Pmax = 1 : identique à la formule du brief).
import type { LavauxConfig } from "./types";
import { monotoneCubic, smootherstep, smootherstepSlope } from "./kernel/monotone";

export const PROFILE_T = [0, 0.2, 0.5, 0.8, 1] as const;

type ProfileKind = LavauxConfig["profile"];

/** Rayons relatifs des quatre premiers points ; le cinquième (col) vient de `neck`. */
const PROFILE_POINTS: Record<ProfileKind, readonly [number, number, number, number]> = {
  cylindre: [0.94, 0.98, 1.0, 0.99],
  galet: [0.66, 0.92, 1.0, 0.9],
  amphore: [0.58, 0.9, 1.0, 0.78],
  cone: [1.0, 0.93, 0.84, 0.76],
  tulipe: [0.64, 0.74, 0.86, 0.97],
};

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

/** Début et largeur de la lèvre, en fraction de hauteur. */
export const LIP_START = 0.92;
export const LIP_SPAN = 0.08;

export interface LavauxProfile {
  /** Rayon de base R(z) en mm, hors motif. */
  radius(z: number): number;
  /** dR/dz. */
  slope(z: number): number;
  /** Rayon moyen sur la hauteur (sert à la grille des cellules de Voronoï). */
  readonly meanRadius: number;
  /** Rayon maximal de R (avant motif). */
  readonly maxRadius: number;
  readonly height: number;
}

type ProfileInput = Pick<
  LavauxConfig,
  "h" | "d" | "profile" | "belly" | "neck" | "lip"
>;

/**
 * Courbe relative P(t) (sans l'échelle) : points de contrôle galbés, cubique
 * monotone, lèvre. `amplitude` est l'amplitude A du motif (mm).
 */
export function createProfile(
  config: ProfileInput,
  amplitude: number,
): LavauxProfile {
  const { h, d, profile, belly, neck, lip } = config;
  const base = PROFILE_POINTS[profile];
  const top = profile === "tulipe" ? Math.max(neck, 0.9) : neck;
  const ys = [
    ...base.map((r) => clamp(1 + (r - 1) * 2 * belly, 0.4, 1)),
    top,
  ];
  const curve = monotoneCubic(PROFILE_T, ys);

  const rel = (t: number) =>
    curve.value(t) + lip * smootherstep((t - LIP_START) / LIP_SPAN);
  const relSlope = (t: number) =>
    curve.slope(t) +
    (lip * smootherstepSlope((t - LIP_START) / LIP_SPAN)) / LIP_SPAN;

  // Maximum de P (points de contrôle, extremum de chaque cubique, lèvre) : un
  // balayage fin suffit, la courbe est lisse et l'erreur reste < 1e-6.
  let pMax = 0;
  let sum = 0;
  const N = 400;
  for (let i = 0; i <= N; i++) {
    const p = rel(i / N);
    if (p > pMax) pMax = p;
    sum += p;
  }
  const meanRel = sum / (N + 1);
  const scale = (d / 2 - amplitude) / pMax;

  return {
    radius: (z) => scale * rel(clamp(z / h, 0, 1)),
    slope: (z) => (scale * relSlope(clamp(z / h, 0, 1))) / h,
    meanRadius: scale * meanRel,
    maxRadius: scale * pMax,
    height: h,
  };
}

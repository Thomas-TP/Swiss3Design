// Motifs du vase « Lavaux » (brief « Strates », §6.3.1) : δ(θ, z) ≥ 0, en mm
// vers l'EXTÉRIEUR de la paroi, avec ses dérivées analytiques (∂δ/∂z et
// ∂δ/∂θ) : les normales, l'épaisseur de paroi (décalage selon la pente
// locale) et le garde-fou de surplomb s'en servent sans différences finies.
//
//  - gradins : u = fract(z / gs), δ = gd × smootherstep(u) : montée douce
//    (pente max 1,875 × gd / gs, donc ≤ 0,94 tant que gd ≤ 0,5 gs), puis
//    RETRAIT NET vers l'intérieur au changement de palier : une corniche
//    horizontale imprimable. C'est la seule discontinuité du modèle
//    (`discontinuities`), représentée par des anneaux au même z.
//  - vagues : δ = wa × (0,5 + 0,5 sin(2π (z / wl + 0,12 sin(wk θ)))) : des
//    anneaux ondulés, pas une torsade.
//  - voronoï : germes sur une grille cylindrique à jitter (colonnes
//    C = max(3, round(√(vc × 2π R̄ / h))), lignes ⌈vc / C⌉, jitter 0,8, distance
//    périodique en θ), e = (F2 − F1) / 2, δ = va × smoothstep(0, W, e).
//  - nervures : φ = θ + rt × z / h, δ = ra × (0,5 + 0,5 cos(rn φ))^1,5.
//  - lisse : δ = 0.
//
// Écarts assumés au brief pour la règle des 45° (§6.6, « ∂r_o/∂z ≤ 1 ») :
//  1. Voronoï : e est la DEMI-différence F2 − F1 (elle vaut la distance à la
//     médiatrice pour des germes alignés, donc |∇e| ≤ 1 au lieu de 2) et la
//     largeur de rampe est W = max(2,4 ; 3 × va) mm au lieu de
//     max(1,5 ; 1,2 × va). Pente maximale du motif : 1,5 × va / W = 0,5.
//     Avec la formule littérale (e = F2 − F1, W = 1,2 va) la pente du motif
//     atteint 2,5 (68°) et le héros en voronoï serait « non imprimable ».
//     Le couplage « w ≥ 1,2 va » du brief reste vrai par construction.
//  2. Le reste (gradins, vagues, nervures) suit le brief à la lettre.
import { mulberry32 } from "./kernel/rng";
import { smootherstep, smootherstepSlope } from "./kernel/monotone";
import type { LavauxPattern } from "./types";

export const VORONOI_JITTER = 0.8;
export const VORONOI_RAMP_FACTOR = 3;
export const VORONOI_MIN_RAMP = 2.4;

export interface PatternContext {
  /** Hauteur du vase (mm). */
  h: number;
  /** Rayon moyen de la paroi (mm), pour dérouler θ en longueur d'arc. */
  meanRadius: number;
}

export interface PatternField {
  /** Amplitude maximale A du motif (mm) : l'enveloppe se calcule avec d/2 − A. */
  readonly amplitude: number;
  /** Vrai si δ ne dépend pas de θ (une seule colonne suffit pour intégrer). */
  readonly axisymmetric: boolean;
  /** Hauteurs des retraits nets (strictement entre 0 et h), croissantes. */
  discontinuities(h: number): number[];
  /**
   * Écrit [δ, ∂δ/∂z, ∂δ/∂θ] dans `out` au point (θ en radians, z en mm).
   * Aux retraits, l'appelant décale z de ± 1e-7 pour choisir le côté.
   */
  eval(theta: number, z: number, out: Float64Array): void;
  /** Nombre d'échantillons en θ conseillé pour intégrer ou mesurer une pente. */
  readonly thetaSamples: number;
}

const TWO_PI = Math.PI * 2;

function lisse(): PatternField {
  return {
    amplitude: 0,
    axisymmetric: true,
    thetaSamples: 1,
    discontinuities: () => [],
    eval(_t, _z, out) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
    },
  };
}

function gradins(step: number, depth: number): PatternField {
  return {
    amplitude: depth,
    axisymmetric: true,
    thetaSamples: 1,
    discontinuities(h) {
      const out: number[] = [];
      for (let k = 1; k * step < h - 1e-6; k++) out.push(k * step);
      return out;
    },
    eval(_t, z, out) {
      const k = Math.floor(z / step);
      const u = z / step - k;
      out[0] = depth * smootherstep(u);
      out[1] = (depth * smootherstepSlope(u)) / step;
      out[2] = 0;
    },
  };
}

function vagues(wavelength: number, amplitude: number, lobes: number): PatternField {
  const k = TWO_PI / wavelength;
  return {
    amplitude,
    axisymmetric: lobes === 0,
    thetaSamples: lobes === 0 ? 1 : 8 * lobes + 16,
    discontinuities: () => [],
    eval(theta, z, out) {
      const s = Math.sin(lobes * theta);
      const phi = TWO_PI * (z / wavelength + 0.12 * s);
      const sp = Math.sin(phi);
      const cp = Math.cos(phi);
      out[0] = amplitude * (0.5 + 0.5 * sp);
      out[1] = amplitude * 0.5 * cp * k;
      out[2] = amplitude * 0.5 * cp * TWO_PI * 0.12 * lobes * Math.cos(lobes * theta);
    },
  };
}

function nervures(count: number, depth: number, twistDeg: number, h: number): PatternField {
  const twist = (twistDeg * Math.PI) / 180;
  return {
    amplitude: depth,
    axisymmetric: false,
    thetaSamples: Math.max(32, 4 * count),
    discontinuities: () => [],
    eval(theta, z, out) {
      const phi = theta + (twist * z) / h;
      const c = Math.cos(count * phi);
      const b = Math.max(0.5 + 0.5 * c, 0);
      const sb = Math.sqrt(b);
      out[0] = depth * b * sb;
      const dphi = depth * 1.5 * sb * (-0.5 * count * Math.sin(count * phi));
      out[1] = (dphi * twist) / h;
      out[2] = dphi;
    },
  };
}

function voronoi(
  cells: number,
  relief: number,
  seed: number,
  ctx: PatternContext,
): PatternField {
  const { h, meanRadius } = ctx;
  const circ = TWO_PI * meanRadius;
  const cols = Math.max(3, Math.round(Math.sqrt((cells * circ) / h)));
  const rows = Math.ceil(cells / cols);
  const cu = circ / cols;
  const cz = h / rows;
  const ramp = Math.max(VORONOI_MIN_RAMP, VORONOI_RAMP_FACTOR * relief);

  // Germes : deux tirages mulberry32 par cellule, en ordre ligne par ligne.
  const rng = mulberry32(seed);
  const sx = new Float64Array(cols * rows);
  const sz = new Float64Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      sx[r * cols + c] = (c + 0.5 + (rng() - 0.5) * VORONOI_JITTER) * cu;
      sz[r * cols + c] = (r + 0.5 + (rng() - 0.5) * VORONOI_JITTER) * cz;
    }
  }

  return {
    amplitude: relief,
    axisymmetric: false,
    thetaSamples: 96,
    discontinuities: () => [],
    eval(theta, z, out) {
      const u = (((theta % TWO_PI) + TWO_PI) % TWO_PI) * meanRadius;
      const c0 = Math.min(Math.floor(u / cu), cols - 1);
      const r0 = Math.min(Math.max(Math.floor(z / cz), 0), rows - 1);
      let d1 = Infinity;
      let d2 = Infinity;
      let g1u = 0;
      let g1z = 0;
      let g2u = 0;
      let g2z = 0;
      for (let dr = -1; dr <= 1; dr++) {
        const r = r0 + dr;
        if (r < 0 || r >= rows) continue;
        for (let dc = -1; dc <= 1; dc++) {
          const cc = c0 + dc;
          const wrapped = ((cc % cols) + cols) % cols;
          const shift = circ * Math.floor(cc / cols);
          const index = r * cols + wrapped;
          const du = u - (sx[index] + shift);
          const dz = z - sz[index];
          const dist = Math.sqrt(du * du + dz * dz);
          if (dist < d1) {
            d2 = d1;
            g2u = g1u;
            g2z = g1z;
            d1 = dist;
            g1u = du;
            g1z = dz;
          } else if (dist < d2) {
            d2 = dist;
            g2u = du;
            g2z = dz;
          }
        }
      }
      if (!Number.isFinite(d2)) {
        // Un seul germe voisin (hauteur très réduite) : plateau.
        out[0] = relief;
        out[1] = 0;
        out[2] = 0;
        return;
      }
      const i1 = 1 / Math.max(d1, 1e-9);
      const i2 = 1 / Math.max(d2, 1e-9);
      const e = 0.5 * (d2 - d1);
      const t = e / ramp;
      if (t >= 1) {
        out[0] = relief;
        out[1] = 0;
        out[2] = 0;
        return;
      }
      // ∇d = (p − germe) / d ; ∇e = (∇d2 − ∇d1) / 2.
      const eu = 0.5 * (g2u * i2 - g1u * i1);
      const ez = 0.5 * (g2z * i2 - g1z * i1);
      const tc = Math.max(t, 0);
      out[0] = relief * tc * tc * (3 - 2 * tc);
      const dde = (relief * 6 * tc * (1 - tc)) / ramp;
      out[1] = dde * ez;
      out[2] = dde * eu * meanRadius;
    },
  };
}

export function createPattern(
  pattern: LavauxPattern,
  ctx: PatternContext,
): PatternField {
  switch (pattern.kind) {
    case "lisse":
      return lisse();
    case "gradins":
      return gradins(pattern.step, pattern.depth);
    case "vagues":
      return vagues(pattern.wavelength, pattern.amplitude, pattern.lobes);
    case "voronoi":
      return voronoi(pattern.cells, pattern.relief, pattern.seed, ctx);
    case "nervures":
      return nervures(pattern.count, pattern.depth, pattern.twistDeg, ctx.h);
  }
}

/** Amplitude maximale A d'un motif, sans construire le champ. */
export function patternAmplitude(pattern: LavauxPattern): number {
  switch (pattern.kind) {
    case "lisse":
      return 0;
    case "gradins":
      return pattern.depth;
    case "vagues":
      return pattern.amplitude;
    case "voronoi":
      return pattern.relief;
    case "nervures":
      return pattern.depth;
  }
}

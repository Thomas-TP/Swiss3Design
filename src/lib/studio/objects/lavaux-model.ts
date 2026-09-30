// Modèle analytique du vase « Lavaux » (brief « Strates », §6.3.1) : la surface
// extérieure r_o(θ, z) = R(z) + δ(θ, z) avec ses pentes, le décalage de paroi
// et le PLAN D'ANNEAUX (hauteurs où l'on échantillonne). Partagé par le
// générateur de maillage, les statistiques et les garde-fous : un seul
// endroit définit la forme, donc un seul endroit à tester.
//
// Convention : mm, Z vers le haut, θ en radians depuis +X vers +Y.
import { createPattern, patternAmplitude, type PatternField } from "../patterns";
import { createProfile, type LavauxProfile } from "../profile";
import type { Band, LavauxConfig } from "../types";

/** Hauteur de couche (mm) : frontières de bande et comptes de couches en dépendent. */
export const LAYER_HEIGHT = 0.2;
/** Fond plein (8 couches) : disque extérieur à z = 0, plancher intérieur à z = 1,6. */
export const FLOOR_MM = 1.6;
/** Décalage de z (mm) pour choisir le côté d'un retrait net (corniche). */
export const NUDGE = 1e-7;
/** Rayon intérieur minimal (mm) : évite une cavité de section nulle. */
export const MIN_INNER_RADIUS = 0.4;
/** cos α ≥ 0,5 (brief) : le décalage radial de la paroi ne dépasse pas 2 × w. */
const MAX_WALL_FACTOR = 2;

export interface LavauxModel {
  readonly config: LavauxConfig;
  readonly profile: LavauxProfile;
  readonly pattern: PatternField;
  readonly height: number;
  readonly wall: number;
  /**
   * Surface extérieure en (θ, z) : écrit [r_o, ∂r_o/∂z, ∂r_o/∂θ] dans `out`.
   * `nudge` = −1 / +1 évalue juste au-dessous / au-dessus d'un retrait net.
   */
  outer(theta: number, z: number, nudge: number, out: Float64Array): void;
}

export function createLavauxModel(config: LavauxConfig): LavauxModel {
  const profile = createProfile(config, patternAmplitude(config.pattern));
  const pattern = createPattern(config.pattern, {
    h: config.h,
    meanRadius: profile.meanRadius,
  });
  const tmp = new Float64Array(3);
  return {
    config,
    profile,
    pattern,
    height: config.h,
    wall: config.wall,
    outer(theta, z, nudge, out) {
      const zz = z + nudge * NUDGE;
      pattern.eval(theta, zz, tmp);
      out[0] = profile.radius(zz) + tmp[0];
      out[1] = profile.slope(zz) + tmp[1];
      out[2] = tmp[2];
    },
  };
}

/** Décalage radial de la paroi : w / cos α, avec α l'inclinaison de la normale sur l'horizontale. */
export function wallOffset(
  wall: number,
  r: number,
  fz: number,
  ft: number,
): number {
  const g = ft / Math.max(r, 1e-6);
  return wall * Math.min(MAX_WALL_FACTOR, Math.sqrt(1 + fz * fz + g * g));
}

/** Rayon intérieur pour un rayon extérieur et des pentes donnés. */
export function innerRadius(
  wall: number,
  r: number,
  fz: number,
  ft: number,
): number {
  return Math.max(r - wallOffset(wall, r, fz, ft), MIN_INNER_RADIUS);
}

// ── Bandes de couleur ────────────────────────────────────────────────────────

/** Indice de la bande qui contient z (une frontière appartient à la bande inférieure). */
export function bandIndexAt(bands: readonly Band[], z: number): number {
  for (let k = 0; k < bands.length - 1; k++) {
    if (z <= bands[k].toMm + 1e-9) return k;
  }
  return Math.max(bands.length - 1, 0);
}

/** Frontières intérieures des bandes (toMm des bandes sauf la dernière), dans ]0, h[. */
export function bandBoundaries(bands: readonly Band[], h: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < bands.length - 1; k++) {
    const z = bands[k].toMm;
    if (z > 1e-6 && z < h - 1e-6) out.push(z);
  }
  return out;
}

// ── Plan d'anneaux ───────────────────────────────────────────────────────────

/** Point de rupture de l'axe Z : frontière de bande, plancher, ou retrait net. */
export interface Breakpoint {
  z: number;
  /** Retrait net (corniche) : deux côtés distincts. */
  step: boolean;
}

/**
 * Plan d'anneaux d'une coque entre deux hauteurs : instances d'anneaux
 * ordonnées par z. `strip[j] = 1` si la bande entre les anneaux j et j + 1
 * doit être maillée (0 : anneaux confondus, bande nulle). `ledge[j] = 1` pour
 * les anneaux de corniche, dont les normales sont verticales.
 */
export interface RingPlan {
  z: Float64Array;
  nudge: Int8Array;
  ledge: Uint8Array;
  strip: Uint8Array;
  count: number;
  /** Nombre de bandes maillées (= triangles / (2 × S × surfaces)). */
  strips: number;
}

const EPS_Z = 1e-9;

/** Points de rupture triés et fusionnés (un retrait l'emporte sur une simple marque). */
export function collectBreakpoints(
  z0: number,
  z1: number,
  marks: readonly number[],
  steps: readonly number[],
): Breakpoint[] {
  const all: Breakpoint[] = [
    { z: z0, step: false },
    { z: z1, step: false },
  ];
  for (const z of marks) if (z > z0 + EPS_Z && z < z1 - EPS_Z) all.push({ z, step: false });
  for (const z of steps) if (z > z0 + EPS_Z && z < z1 - EPS_Z) all.push({ z, step: true });
  all.sort((a, b) => a.z - b.z || Number(b.step) - Number(a.step));
  const out: Breakpoint[] = [];
  for (const bp of all) {
    const last = out[out.length - 1];
    if (last && Math.abs(bp.z - last.z) <= EPS_Z) {
      last.step = last.step || bp.step;
    } else {
      out.push({ ...bp });
    }
  }
  return out;
}

/**
 * Construit le plan d'anneaux d'une suite de points de rupture. `interior`
 * donne, pour chaque intervalle lisse [a, b], les hauteurs intermédiaires
 * (strictement entre a et b). Aux retraits nets, le plan contient l'anneau
 * « juste dessous », deux anneaux de corniche (normales verticales) puis
 * l'anneau « juste dessus » ; sans `ledgeRings`, seulement les deux anneaux
 * « dessous » et « dessus » (intégration sans maillage).
 */
export function buildRingPlan(
  bps: readonly Breakpoint[],
  interior: (a: number, b: number) => readonly number[],
  ledgeRings: boolean,
): RingPlan {
  const zs: number[] = [];
  const nudges: number[] = [];
  const ledges: number[] = [];
  const strips: number[] = [];
  const push = (z: number, nudge: number, ledge: number, stripAfterPrev: number) => {
    if (zs.length > 0) strips.push(stripAfterPrev);
    zs.push(z);
    nudges.push(nudge);
    ledges.push(ledge);
  };

  const last = bps.length - 1;
  for (let k = 0; k < last; k++) {
    const a = bps[k];
    const b = bps[k + 1];
    // Début d'intervalle : anneau partagé avec l'intervalle précédent, sauf
    // après un retrait (ou en tout premier), où l'on repart « au-dessus ».
    if (k === 0) push(a.z, 1, 0, 0);
    else if (a.step) {
      if (ledgeRings) {
        push(a.z, -1, 1, 0); // corniche, côté bas
        push(a.z, 1, 1, 1); // corniche, côté haut : la bande de corniche
        push(a.z, 1, 0, 0); // anneau « dessus » : bande nulle
      } else {
        push(a.z, 1, 0, 1); // A (dessous, déjà posé) → B (dessus) : largeur nulle
      }
    }
    for (const z of interior(a.z, b.z)) push(z, 0, 0, 1);
    // Fin d'intervalle : « dessous » avant un retrait ou au sommet.
    const isTop = k === last - 1;
    if (b.step || isTop) push(b.z, -1, 0, 1);
    else push(b.z, 0, 0, 1);
  }
  const n = zs.length;
  const stripArr = new Uint8Array(Math.max(n - 1, 0));
  let drawn = 0;
  for (let j = 0; j < n - 1; j++) {
    stripArr[j] = strips[j];
    drawn += strips[j];
  }
  return {
    z: Float64Array.from(zs),
    nudge: Int8Array.from(nudges),
    ledge: Uint8Array.from(ledges),
    strip: stripArr,
    count: n,
    strips: drawn,
  };
}

/** Sous-intervalles uniformes de [a, b] : `n − 1` hauteurs intermédiaires. */
export function uniformInterior(a: number, b: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i < n; i++) out.push(a + ((b - a) * i) / n);
  return out;
}

/**
 * Répartit `total` sous-intervalles entre des intervalles proportionnellement
 * à leur longueur, avec un minimum par intervalle (plus grand reste, donc
 * déterministe et somme exacte).
 */
export function allocateCounts(
  lengths: readonly number[],
  total: number,
  minimum: readonly number[],
): number[] {
  const counts = minimum.slice();
  let used = counts.reduce((s, c) => s + c, 0);
  if (used >= total) return counts;
  const sumLen = lengths.reduce((s, l) => s + l, 0) || 1;
  const spare = total - used;
  const want = lengths.map((l) => (l / sumLen) * spare);
  const extra = want.map((w) => Math.floor(w));
  let rest = spare - extra.reduce((s, e) => s + e, 0);
  const order = want
    .map((w, i) => ({ i, frac: w - Math.floor(w) }))
    .sort((p, q) => q.frac - p.frac || p.i - q.i);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) extra[order[k].i]++;
  for (let i = 0; i < counts.length; i++) counts[i] += extra[i];
  used = counts.reduce((s, c) => s + c, 0);
  return counts;
}

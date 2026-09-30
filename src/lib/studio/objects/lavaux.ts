// Générateur de maillage du vase « Lavaux » (brief « Strates », §6.3.1).
//
// Surfaces : extérieure r_o = R(z) + δ(θ, z) ; intérieure r_i = r_o − w / cos α
// (décalage radial selon la pente locale, cos α ≥ 0,5), de z = 1,6 mm à h ;
// lèvre plate (couronne horizontale) à z = h ; fond plein de 1,6 mm (8
// couches) : disque extérieur à z = 0 et plancher intérieur à z = 1,6. Couture
// en θ = 0 partagée (indices modulo S) : aucune arête ouverte.
//
// Trois niveaux de détail :
//  - drag    : 64 × 80, anneaux réguliers, pas de corniches (interaction) ;
//  - display : C2 160 segments × ~180 bandes (≈ 115 k triangles), C1 96 × ~100
//              (≈ 38 k), anneaux répartis par longueur, corniche exacte ;
//  - export  : anneaux ADAPTATIFS (erreur de corde ≤ 0,05 mm), deux anneaux
//              au même z à chaque retrait de gradin (la corniche), un anneau
//              à chaque frontière de bande ; plafond de 200 k triangles.
//
// Écarts assumés au brief, tous au service de la cible « 1 à 3 Mo » (§6.9) et
// de « export ≤ 400 ms » (§6.11), que le pas de base de 0,8 mm et les 180
// segments de 360° rendaient inatteignables pour le héros (≈ 8,6 Mo) :
//  - pas maximal 4 mm au lieu d'un pas de base de 0,8 mm : les zones lisses
//    n'ont pas besoin de 190 anneaux, la tolérance de 0,05 mm reste celle du
//    brief et pilote le raffinement (les rampes de gradins dominent le compte) ;
//  - motifs de révolution (gradins, lisse, vagues sans lobes) : le nombre de
//    segments vient de la MÊME tolérance de 0,05 mm en θ (flèche de la corde
//    ≤ 0,05 mm au rayon maximal), avec un plancher de 96 ;
//  - motifs non axisymétriques : segments du brief (vagues 240, voronoï 360,
//    nervures max(180, 10 × rn)).
//
// Normales : celles de la surface paramétrique (analytiques). L'attribut `side`
// vaut 0 sur la paroi extérieure, 1 sur le reste. Les sommets d'une arête vive
// (corniche, lèvre, fond, bouchons) sont dupliqués avec leurs propres normales.
import { MeshBuilder } from "../kernel/mesh";
import type { Band, LavauxConfig, MeshData } from "../types";
import {
  FLOOR_MM,
  allocateCounts,
  bandBoundaries,
  bandIndexAt,
  buildRingPlan,
  collectBreakpoints,
  createLavauxModel,
  innerRadius,
  uniformInterior,
  type LavauxModel,
  type RingPlan,
} from "./lavaux-model";

export type LavauxLod = "drag" | "display" | "export";

export interface LavauxBuildOptions {
  lod: LavauxLod;
  /** `display` : 2 = C2 (160 × 180), 1 = C1 (96 × 100). Défaut 2. */
  tier?: 1 | 2;
  /**
   * Une coque fermée PAR BANDE (anneaux dupliqués aux frontières + bouchons en
   * couronne) : sert à l'éclaté d'affichage. Jamais dans l'export.
   */
  separateBands?: boolean;
}

export const EXPORT_LIMITS = {
  /** Erreur de corde maximale (mm), en z et en θ. */
  chordTolerance: 0.05,
  /** Pas maximal entre deux anneaux (mm). */
  maxStep: 4,
  /** Pas minimal (mm) : en dessous, l'échantillonnage n'apporte rien à 0,4 mm de buse. */
  minStep: 0.1,
  /** Plafond de triangles d'un export. */
  maxTriangles: 200_000,
  minSegments: 96,
} as const;

const DISPLAY = {
  2: { segments: 160, strips: 180, triangles: 120_000 },
  1: { segments: 96, strips: 100, triangles: 40_000 },
} as const;

const DRAG = { segments: 64, strips: 80 } as const;

const TWO_PI = Math.PI * 2;

function defaultBands(config: LavauxConfig): readonly Band[] {
  return config.bands.length > 0
    ? config.bands
    : [{ filament: "blanc-neve", toMm: config.h }];
}

// ── Plans d'anneaux par niveau de détail ─────────────────────────────────────

interface Layout {
  segments: number;
  /** Plan d'anneaux d'une plage [z0, z1] de la coque. */
  planFor(z0: number, z1: number): RingPlan;
  /** Attribue toutes les bandes à 0 (drag : un seul groupe). */
  singleBand: boolean;
}

const key = (z: number) => Math.round(z * 1e6);

function uniformLayout(
  model: LavauxModel,
  marks: readonly number[],
  steps: readonly number[],
  segments: number,
  stripBudget: number,
  minGradin: number,
  tierTriangles: number,
  ledgeRings: boolean,
  singleBand: boolean,
): Layout {
  const h = model.height;
  const bps = collectBreakpoints(0, h, marks, steps);
  const lengths: number[] = [];
  const minimum: number[] = [];
  for (let k = 0; k < bps.length - 1; k++) {
    const len = bps[k + 1].z - bps[k].z;
    lengths.push(len);
    minimum.push(steps.length > 0 && len >= 1 ? minGradin : 1);
  }
  const ledges = ledgeRings ? steps.length : 0;
  const counts = allocateCounts(
    lengths,
    Math.max(stripBudget - ledges, lengths.length),
    minimum,
  );
  const total = counts.reduce((s, c) => s + c, 0) + ledges;
  // Trop de retraits pour le budget : moins de segments plutôt que plus de triangles.
  let S = segments;
  if (total * S * 4 > tierTriangles * 1.05) {
    S = Math.max(
      64,
      Math.floor((S * (tierTriangles / (total * S * 4))) / 8) * 8,
    );
  }
  const byStart = new Map<number, number>();
  for (let k = 0; k < counts.length; k++) byStart.set(key(bps[k].z), counts[k]);
  return {
    segments: S,
    singleBand,
    planFor(z0, z1) {
      const sub = collectBreakpoints(z0, z1, marks, steps);
      return buildRingPlan(
        sub,
        (a, b) => uniformInterior(a, b, byStart.get(key(a)) ?? 1),
        ledgeRings,
      );
    },
  };
}

/** Segments d'un solide de révolution : flèche de la corde ≤ tolérance au rayon maximal. */
function revolutionSegments(model: LavauxModel, tolerance: number): number {
  const rMax = model.profile.maxRadius + model.pattern.amplitude;
  const sag = Math.ceil(Math.PI / Math.acos(Math.max(1 - tolerance / rMax, 0)));
  return Math.max(EXPORT_LIMITS.minSegments, Math.ceil(sag / 4) * 4);
}

function exportSegments(model: LavauxModel, tolerance: number): number {
  const p = model.config.pattern;
  const revolution = revolutionSegments(model, tolerance);
  if (model.pattern.axisymmetric) return revolution;
  switch (p.kind) {
    case "vagues":
      return 240;
    case "voronoi":
      return 360;
    case "nervures":
      return Math.max(180, 10 * p.count);
    default:
      return revolution;
  }
}

/** Hauteurs intermédiaires adaptatives de [a, b] (erreur de corde ≤ tolérance). */
function adaptiveInterior(
  model: LavauxModel,
  a: number,
  b: number,
  nudgeA: number,
  nudgeB: number,
  tolerance: number,
): number[] {
  const { maxStep, minStep } = EXPORT_LIMITS;
  const K = model.pattern.axisymmetric ? 1 : 16;
  const tmp = new Float64Array(3);
  const sample = (z: number, nudge: number) => {
    const v = new Float64Array(K);
    for (let k = 0; k < K; k++) {
      model.outer(((k + 0.37) * TWO_PI) / K, z, nudge, tmp);
      v[k] = tmp[0];
    }
    return v;
  };
  const out: number[] = [];
  // Test en trois points (1/4, 1/2, 3/4) : une rampe de gradin, symétrique
  // par rapport à son milieu, passerait un test au seul milieu.
  const refine = (
    za: number,
    zb: number,
    va: Float64Array,
    vb: Float64Array,
  ) => {
    const len = zb - za;
    if (len < 2 * minStep) return;
    const q1 = sample(za + len * 0.25, 0);
    const q2 = sample(za + len * 0.5, 0);
    const q3 = sample(za + len * 0.75, 0);
    let err = 0;
    for (let k = 0; k < K; k++) {
      err = Math.max(
        err,
        Math.abs(q1[k] - (0.75 * va[k] + 0.25 * vb[k])),
        Math.abs(q2[k] - 0.5 * (va[k] + vb[k])),
        Math.abs(q3[k] - (0.25 * va[k] + 0.75 * vb[k])),
      );
    }
    if (err > tolerance || len > maxStep) {
      const zm = za + len / 2;
      refine(za, zm, va, q2);
      out.push(zm);
      refine(zm, zb, q2, vb);
    }
  };
  const n0 = Math.max(1, Math.ceil((b - a) / maxStep));
  const points = [a, ...uniformInterior(a, b, n0), b];
  const values = points.map((z, i) =>
    sample(z, i === 0 ? nudgeA : i === points.length - 1 ? nudgeB : 0),
  );
  const result: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    if (i > 0) result.push(points[i]);
    out.length = 0;
    refine(points[i], points[i + 1], values[i], values[i + 1]);
    result.push(...out);
  }
  return result;
}

function exportLayout(
  model: LavauxModel,
  marks: readonly number[],
  steps: readonly number[],
): Layout {
  const h = model.height;
  let tolerance: number = EXPORT_LIMITS.chordTolerance;
  let S = exportSegments(model, tolerance);
  for (let attempt = 0; ; attempt++) {
    const layout = makeExportLayout(model, marks, steps, S, tolerance);
    const plan = layout.planFor(0, h);
    const tri = estimateTriangles(plan, S);
    if (tri <= EXPORT_LIMITS.maxTriangles || attempt >= 6) return layout;
    // Trop de triangles : d'abord moins de segments (jusqu'au plancher de
    // révolution), puis une tolérance plus large.
    const floor = revolutionSegments(model, EXPORT_LIMITS.chordTolerance);
    if (S > floor)
      S = Math.max(
        floor,
        Math.floor((S * EXPORT_LIMITS.maxTriangles) / tri / 4) * 4,
      );
    else if (attempt < 3) tolerance *= 1.6;
    else S = Math.max(64, S - 16);
  }
}

function makeExportLayout(
  model: LavauxModel,
  marks: readonly number[],
  steps: readonly number[],
  S: number,
  tolerance: number,
): Layout {
  return {
    segments: S,
    singleBand: false,
    planFor(z0, z1) {
      const sub = collectBreakpoints(z0, z1, marks, steps);
      const last = sub.length - 1;
      const starts = new Map<number, number>();
      sub.forEach((bp, i) => starts.set(key(bp.z), i));
      return buildRingPlan(
        sub,
        (a, b) => {
          const i = starts.get(key(a)) ?? 0;
          const nudgeA = i === 0 || sub[i].step ? 1 : 0;
          const j = starts.get(key(b)) ?? last;
          const nudgeB = j === last || sub[j].step ? -1 : 0;
          return adaptiveInterior(model, a, b, nudgeA, nudgeB, tolerance);
        },
        true,
      );
    },
  };
}

/** Triangles d'une coque : deux surfaces, deux triangles par quadrilatère, plus fond et lèvre. */
function estimateTriangles(plan: RingPlan, S: number): number {
  let inner = 0;
  for (let j = 0; j < plan.count - 1; j++) {
    if (plan.strip[j] && plan.z[j] >= FLOOR_MM - 1e-9) inner++;
  }
  return (plan.strips + inner) * 2 * S + 6 * S;
}

/** Met en cache les plans par plage : le calcul adaptatif de l'export n'est fait qu'une fois. */
function memoized(layout: Layout): Layout {
  const cache = new Map<string, RingPlan>();
  return {
    segments: layout.segments,
    singleBand: layout.singleBand,
    planFor(z0, z1) {
      const k = `${z0}|${z1}`;
      let plan = cache.get(k);
      if (!plan) {
        plan = layout.planFor(z0, z1);
        cache.set(k, plan);
      }
      return plan;
    },
  };
}

function layoutFor(model: LavauxModel, options: LavauxBuildOptions): Layout {
  const h = model.height;
  const bands = defaultBands(model.config);
  const { lod } = options;
  if (lod === "drag") {
    return memoized(
      uniformLayout(
        model,
        [FLOOR_MM],
        [],
        DRAG.segments,
        DRAG.strips,
        1,
        Infinity,
        false,
        true,
      ),
    );
  }
  const marks = [FLOOR_MM, ...bandBoundaries(bands, h)];
  const steps = model.pattern.discontinuities(h);
  if (lod === "display") {
    const t = DISPLAY[options.tier ?? 2];
    return memoized(
      uniformLayout(
        model,
        marks,
        steps,
        t.segments,
        t.strips,
        3,
        t.triangles,
        true,
        false,
      ),
    );
  }
  return memoized(exportLayout(model, marks, steps));
}

// ── Émission ─────────────────────────────────────────────────────────────────

function emitSolid(
  b: MeshBuilder,
  model: LavauxModel,
  S: number,
  plan: RingPlan,
  z0: number,
  z1: number,
  bandOf: (z: number) => number,
): void {
  const wall = model.wall;
  const nR = plan.count;
  const theta = new Float64Array(S);
  const cosT = new Float64Array(S);
  const sinT = new Float64Array(S);
  for (let i = 0; i < S; i++) {
    theta[i] = (i * TWO_PI) / S;
    cosT[i] = Math.cos(theta[i]);
    sinT[i] = Math.sin(theta[i]);
  }
  const rO = new Float64Array(S);
  const fZ = new Float64Array(S);
  const fT = new Float64Array(S);
  const tmp = new Float64Array(3);
  const sample = (z: number, nudge: number) => {
    for (let i = 0; i < S; i++) {
      model.outer(theta[i], z, nudge, tmp);
      rO[i] = tmp[0];
      fZ[i] = tmp[1];
      fT[i] = tmp[2];
    }
  };

  const hasInner = z1 > FLOOR_MM + 1e-9;
  const innerStart0 = Math.max(z0, FLOOR_MM);
  let ji0 = nR;
  if (hasInner) {
    for (let j = 0; j < nR; j++) {
      if (plan.z[j] >= innerStart0 - 1e-9) {
        ji0 = j;
        break;
      }
    }
  }

  const vo = new Int32Array(nR);
  const vi = new Int32Array(nR).fill(-1);

  for (let j = 0; j < nR; j++) {
    const z = plan.z[j];
    sample(z, plan.nudge[j]);
    const flat = plan.ledge[j] === 1;
    vo[j] = b.vertexCount;
    for (let i = 0; i < S; i++) {
      const r = rO[i];
      let nx = 0;
      let ny = 0;
      let nz = 1;
      if (!flat) {
        const g = fT[i] / r;
        nx = cosT[i] + g * sinT[i];
        ny = sinT[i] - g * cosT[i];
        nz = -fZ[i];
        const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx *= inv;
        ny *= inv;
        nz *= inv;
      }
      b.addVertex(r * cosT[i], r * sinT[i], z, nx, ny, nz, 0);
    }
    if (j >= ji0) {
      vi[j] = b.vertexCount;
      for (let i = 0; i < S; i++) {
        const r = innerRadius(wall, rO[i], fZ[i], fT[i]);
        let nx = 0;
        let ny = 0;
        let nz = -1;
        if (!flat) {
          const ro = rO[i];
          const g = fT[i] / ro;
          nx = -(cosT[i] + g * sinT[i]);
          ny = -(sinT[i] - g * cosT[i]);
          nz = fZ[i];
          const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
          nx *= inv;
          ny *= inv;
          nz *= inv;
        }
        b.addVertex(r * cosT[i], r * sinT[i], z, nx, ny, nz, 1);
      }
    }
  }

  // Parois : bandes entre anneaux consécutifs (les anneaux confondus sont sautés).
  for (let j = 0; j < nR - 1; j++) {
    if (!plan.strip[j]) continue;
    const band = bandOf(0.5 * (plan.z[j] + plan.z[j + 1]));
    const o0 = vo[j];
    const o1 = vo[j + 1];
    for (let i = 0; i < S; i++) {
      const n = i + 1 === S ? 0 : i + 1;
      b.addQuad(o0 + i, o0 + n, o1 + n, o1 + i, band);
    }
    if (j >= ji0) {
      const i0 = vi[j];
      const i1 = vi[j + 1];
      for (let i = 0; i < S; i++) {
        const n = i + 1 === S ? 0 : i + 1;
        b.addQuad(i0 + i, i1 + i, i1 + n, i0 + n, band);
      }
    }
  }

  // Couronne (ou lèvre) du dessus : entre l'extérieur et l'intérieur à z1.
  const annulus = (j: number, up: boolean, band: number) => {
    sample(plan.z[j], plan.nudge[j]);
    const z = plan.z[j];
    const outer = b.vertexCount;
    for (let i = 0; i < S; i++) {
      b.addVertex(rO[i] * cosT[i], rO[i] * sinT[i], z, 0, 0, up ? 1 : -1, 1);
    }
    const inner = b.vertexCount;
    for (let i = 0; i < S; i++) {
      const r = innerRadius(wall, rO[i], fZ[i], fT[i]);
      b.addVertex(r * cosT[i], r * sinT[i], z, 0, 0, up ? 1 : -1, 1);
    }
    for (let i = 0; i < S; i++) {
      const n = i + 1 === S ? 0 : i + 1;
      if (up) {
        b.addTriangle(inner + i, outer + i, outer + n, band);
        b.addTriangle(inner + i, outer + n, inner + n, band);
      } else {
        b.addTriangle(inner + i, outer + n, outer + i, band);
        b.addTriangle(inner + i, inner + n, outer + n, band);
      }
    }
  };
  if (hasInner) annulus(nR - 1, true, bandOf(z1));
  else {
    // Coque sans cavité (plage sous le plancher) : simple disque du dessus.
    sample(plan.z[nR - 1], plan.nudge[nR - 1]);
    disc(b, S, cosT, sinT, rO, plan.z[nR - 1], true, bandOf(z1), 1);
  }

  if (z0 <= 1e-9) {
    // Fond : disque extérieur à z = 0 (normale vers le bas)…
    sample(0, 1);
    disc(b, S, cosT, sinT, rO, 0, false, bandOf(0), 1);
    // …et plancher intérieur à z = 1,6 (normale vers le haut).
    if (hasInner && ji0 < nR) {
      sample(plan.z[ji0], plan.nudge[ji0]);
      const floorR = new Float64Array(S);
      for (let i = 0; i < S; i++)
        floorR[i] = innerRadius(wall, rO[i], fZ[i], fT[i]);
      disc(b, S, cosT, sinT, floorR, plan.z[ji0], true, bandOf(plan.z[ji0]), 1);
    }
  } else {
    annulus(0, false, bandOf(z0 + 1e-6));
  }
}

function disc(
  b: MeshBuilder,
  S: number,
  cosT: Float64Array,
  sinT: Float64Array,
  radius: Float64Array,
  z: number,
  up: boolean,
  band: number,
  side: number,
): void {
  const nz = up ? 1 : -1;
  const center = b.addVertex(0, 0, z, 0, 0, nz, side);
  const ring = b.vertexCount;
  for (let i = 0; i < S; i++) {
    b.addVertex(radius[i] * cosT[i], radius[i] * sinT[i], z, 0, 0, nz, side);
  }
  for (let i = 0; i < S; i++) {
    const n = i + 1 === S ? 0 : i + 1;
    if (up) b.addTriangle(center, ring + i, ring + n, band);
    else b.addTriangle(center, ring + n, ring + i, band);
  }
}

/** Maillage du vase : voir l'en-tête pour les niveaux de détail. */
export function buildLavaux(
  config: LavauxConfig,
  options: LavauxBuildOptions,
): MeshData {
  const model = createLavauxModel(config);
  const layout = layoutFor(model, options);
  const S = layout.segments;
  const h = config.h;
  const bands = defaultBands(config);
  const full = layout.planFor(0, h);
  const separate =
    options.separateBands && bands.length > 1 && !layout.singleBand;
  // Capacité exacte à une marge près : pas de recopie des tableaux en route.
  const factor = separate ? 1.15 : 1;
  const b = new MeshBuilder(
    Math.ceil((full.count * 2 + 8) * S * factor),
    Math.ceil(estimateTriangles(full, S) * factor) + 64,
  );

  if (separate) {
    let z0 = 0;
    bands.forEach((band, k) => {
      const z1 = k === bands.length - 1 ? h : Math.min(band.toMm, h);
      if (z1 - z0 > 1e-6) {
        emitSolid(b, model, S, layout.planFor(z0, z1), z0, z1, () => k);
      }
      z0 = z1;
    });
  } else {
    const bandOf = layout.singleBand
      ? () => 0
      : (z: number) => bandIndexAt(bands, z);
    emitSolid(b, model, S, full, 0, h, bandOf);
  }
  return b.build(true);
}

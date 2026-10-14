// Carte d'altitude de la « Montagne » (brief « Strates », §6.2 et §6.3.4, refonte
// du 10.10.2026 : le sous-verre « Relief » est remplacé par une vraie petite
// montagne à poser sur un bureau). Fonction pure (x, y) → altitude normalisée
// dans [0, 1] : la même pour le maillage lissé, les strates, le plan, l'élévation
// et les statistiques, donc identique en SSR, dans le Worker et sur le client.
//
// Construction (tout est déterministe, graine comprise, sans Math.random) :
//  1. une ENVELOPPE de sommets : chaque sommet est un cône à sommet arrondi
//     (profil tabulé, exposant fixé par la raideur) dont les flancs sont creusés
//     d'arêtes radiales (cos(nθ) élevé à une puissance : arêtes vives, couloirs
//     larges) ; les sommets se raccordent par un maximum lissé (les cols). Les
//     trois formes (« Pic », « Massif », « Arête ») ne diffèrent que par la
//     disposition de ces sommets ;
//  2. un DÉTAIL de roche : bruit simplex « ridged multifractal » (crêtes
//     (1 − |n|)², chaque octave pondérée par la précédente) sur un domaine
//     déformé par deux bruits lents, appliqué en facteur sur l'enveloppe (le pied
//     reste lisse, les hauts sont rocheux) ;
//  3. une CHUTE vers le pied (smoothstep) : la carte vaut exactement 0 hors du
//     disque d'emprise, donc la pièce garde un bord plat d'au moins 3 mm ;
//  4. un PLATEAU de sommet : tout ce qui dépasse le niveau `cap` est ramené à 1.
//     `cap` est choisi pour que le plus haut sommet garde une calotte plate d'au
//     moins 1,5 mm de diamètre (jamais une aiguille fragile) : la carte atteint
//     donc 1 exactement, et la hauteur choisie est celle du maillage.
//
// Seuls les polynômes, `sqrt` et une table sont dans la boucle chaude : pas de
// trigonométrie ni de `pow` par point (le même chiffre sur tous les moteurs).
import { createSimplex } from "../kernel/noise";
import { between, intBetween, mulberry32, type Rng } from "../kernel/rng";

export type MontagneForm = "pic" | "massif" | "arete";

/** Disque d'emprise de la montagne : centre et rayon (mm), repère du socle. */
export interface Footprint {
  cx: number;
  cy: number;
  radius: number;
}

/** Diamètre minimal (mm) de la calotte plate du sommet : 0,4 mm de buse × ≈ 4. */
export const CAP_DIAMETER_MM = 1.5;

/** Rayon d'arrondi du sommet des cônes, en fraction de leur rayon. */
const APEX_ROUNDING = 0.035;

export interface FieldParams {
  seed: number;
  form: MontagneForm;
  /** Raideur 0 (douce) à 1 (raide). */
  steep: number;
  footprint: Footprint;
}

interface Summit {
  x: number;
  y: number;
  /** Hauteur relative (le principal vaut 1). */
  h: number;
  /** Demi-axes d'emprise (mm) selon l'orientation `(cos, sin)`. */
  a: number;
  b: number;
  cos: number;
  sin: number;
  /** Arêtes radiales : nombre, phase (cos, sin), profondeur des couloirs. */
  ridges: number;
  phaseCos: number;
  phaseSin: number;
  amp: number;
}

export interface MountainField {
  /** Altitude normalisée en (x, y) mm : 0 hors emprise, 1 sur la calotte. */
  at(x: number, y: number): number;
  /** Position du sommet principal (mm) : repère des tests et des vues. */
  peak: { x: number; y: number };
  /** Niveau de la calotte (avant normalisation) : informatif, testé. */
  cap: number;
  footprint: Footprint;
  summits: readonly { x: number; y: number; h: number }[];
}

// ── Profil des cônes ─────────────────────────────────────────────────────────

const PROFILE_SIZE = 512;

/**
 * Table du profil radial g(u), u = ρ ∈ [0, 1] : cône à sommet arrondi
 * (hyperbole), élevé à l'exposant `k`. g(0) = 1, g(1) = 0 ; pente nulle au pied
 * pour k > 1 (flancs concaves, « corne »), arrondie en haut quel que soit k.
 */
function profileTable(k: number): Float64Array {
  const e = APEX_ROUNDING;
  const edge = Math.sqrt(1 + e * e) - e;
  const t = new Float64Array(PROFILE_SIZE + 2);
  for (let i = 0; i <= PROFILE_SIZE; i++) {
    const u = i / PROFILE_SIZE;
    const v = (Math.sqrt(u * u + e * e) - e) / edge;
    t[i] = Math.pow(Math.max(0, 1 - v), k);
  }
  t[PROFILE_SIZE + 1] = 0;
  return t;
}

// ── Utilitaires ──────────────────────────────────────────────────────────────

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Maximum lissé polynomial (Quilez) : le col entre deux sommets est arrondi sur `k`. */
const smoothMax = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
};

// ── Disposition des sommets selon la forme ───────────────────────────────────

function makeSummit(
  rng: Rng,
  fp: Footprint,
  ux: number,
  uy: number,
  h: number,
  a: number,
  b: number,
  angle: number,
  ridges: number,
  amp: number,
): Summit {
  const phase = between(rng, 0, Math.PI * 2);
  return {
    x: fp.cx + ux * fp.radius,
    y: fp.cy + uy * fp.radius,
    h,
    a: a * fp.radius,
    b: b * fp.radius,
    cos: Math.cos(angle),
    sin: Math.sin(angle),
    ridges,
    phaseCos: Math.cos(phase),
    phaseSin: Math.sin(phase),
    amp,
  };
}

function layoutSummits(
  form: MontagneForm,
  seed: number,
  fp: Footprint,
  steep: number,
): Summit[] {
  const rng = mulberry32(seed ^ 0x9e3779b1);
  const amp = 0.15 + 0.25 * steep;
  const out: Summit[] = [];
  if (form === "pic") {
    // Un pic dominant, légèrement dissymétrique, et deux épaules qui cassent
    // la symétrie (un gendarme sur l'arête, un replat sur le flanc).
    const angle = between(rng, 0, Math.PI);
    out.push(
      makeSummit(
        rng,
        fp,
        between(rng, -0.1, 0.1),
        between(rng, -0.1, 0.1),
        1,
        1,
        0.9,
        angle,
        rng() < 0.7 ? 4 : 5,
        amp + 0.12,
      ),
    );
    const a0 = between(rng, 0, Math.PI * 2);
    for (let k = 0; k < 2; k++) {
      const a = a0 + k * between(rng, 2.2, 3.6);
      const d = between(rng, 0.38, 0.58);
      out.push(
        makeSummit(
          rng,
          fp,
          Math.cos(a) * d,
          Math.sin(a) * d,
          between(rng, 0.26, 0.4),
          0.36,
          0.3,
          between(rng, 0, Math.PI),
          3,
          amp * 0.7,
        ),
      );
    }
    return out;
  }
  if (form === "massif") {
    // Un sommet principal décentré et deux ou trois sommets secondaires.
    const a0 = between(rng, 0, Math.PI * 2);
    out.push(
      makeSummit(
        rng,
        fp,
        Math.cos(a0 + Math.PI) * 0.12,
        Math.sin(a0 + Math.PI) * 0.12,
        1,
        0.62,
        0.56,
        between(rng, 0, Math.PI),
        intBetween(rng, 4, 5),
        amp,
      ),
    );
    const count = intBetween(rng, 2, 3);
    for (let k = 0; k < count; k++) {
      const a =
        a0 + (k + 0.5) * ((Math.PI * 2) / count) + between(rng, -0.4, 0.4);
      const d = between(rng, 0.4, 0.6);
      out.push(
        makeSummit(
          rng,
          fp,
          Math.cos(a) * d,
          Math.sin(a) * d,
          between(rng, 0.55, 0.86),
          between(rng, 0.38, 0.5),
          between(rng, 0.34, 0.44),
          between(rng, 0, Math.PI),
          intBetween(rng, 3, 5),
          amp * 0.9,
        ),
      );
    }
    return out;
  }
  // Arête : une chaîne de sommets allongés le long d'un axe ; un seul domine.
  const axis = between(rng, -0.5, 0.5);
  const ca = Math.cos(axis);
  const sa = Math.sin(axis);
  const count = intBetween(rng, 5, 6);
  const dominant = intBetween(rng, 1, count - 2);
  for (let k = 0; k < count; k++) {
    const t = -0.68 + (1.36 * k) / (count - 1) + between(rng, -0.05, 0.05);
    const side = between(rng, -0.06, 0.06);
    out.push(
      makeSummit(
        rng,
        fp,
        t * ca - side * sa,
        t * sa + side * ca,
        k === dominant ? 1 : between(rng, 0.55, 0.9),
        0.5,
        0.27,
        axis,
        2,
        amp * 0.8,
      ),
    );
  }
  return out;
}

// ── La carte ─────────────────────────────────────────────────────────────────

/** Détail de roche (octaves) et fréquence de base (cycles par rayon). */
const OCTAVES = 4;
const BASE_FREQ = 1.5;
const WARP_FREQ = 0.9;

/** Maille et côté (mailles) de la grille locale qui sert à mesurer la calotte. */
const CAP_CELL_MM = 0.12;
const CAP_GRID = 80;

/**
 * Niveau de la calotte : on part du sommet et on fait croître une région
 * connexe en ajoutant toujours sa plus haute voisine (inondation par priorité,
 * tas binaire, sur une grille locale de 0,12 mm) jusqu'à ce qu'elle couvre l'aire
 * d'un disque de CAP_DIAMETER_MM ; le niveau est la plus basse valeur ajoutée.
 * Tout ce qui dépasse ce niveau devient la calotte plate. Mesurer l'aire plutôt
 * qu'une pente garde la coupe minimale : une pointe très raide n'est pas
 * rabotée plus qu'il ne faut, et la calotte est d'un seul tenant.
 */
function capLevel(
  raw: (x: number, y: number) => number,
  px: number,
  py: number,
  peak: number,
): number {
  const N = CAP_GRID;
  const half = (N * CAP_CELL_MM) / 2;
  const values = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    const y = py - half + (j + 0.5) * CAP_CELL_MM;
    for (let i = 0; i < N; i++) {
      values[j * N + i] = raw(px - half + (i + 0.5) * CAP_CELL_MM, y);
    }
  }
  const target = Math.PI * (CAP_DIAMETER_MM / 2) ** 2;
  const cellArea = CAP_CELL_MM * CAP_CELL_MM;
  const seen = new Uint8Array(N * N);
  const heap: number[] = [];
  const push = (k: number) => {
    seen[k] = 1;
    heap.push(k);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (values[heap[p]] >= values[heap[c]]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && values[heap[l]] > values[heap[m]]) m = l;
        if (r < heap.length && values[heap[r]] > values[heap[m]]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };
  push((N >> 1) * N + (N >> 1));
  let area = 0;
  let level = peak;
  while (heap.length > 0 && area < target) {
    const k = pop();
    level = Math.min(level, values[k]);
    area += cellArea;
    const i = k % N;
    const j = (k - i) / N;
    if (i > 0 && !seen[k - 1]) push(k - 1);
    if (i < N - 1 && !seen[k + 1]) push(k + 1);
    if (j > 0 && !seen[k - N]) push(k - N);
    if (j < N - 1 && !seen[k + N]) push(k + N);
  }
  return Math.max(level, peak * 0.5);
}

const fieldCache = new Map<string, MountainField>();

function keyOf(p: FieldParams): string {
  const f = p.footprint;
  return [
    p.seed,
    p.form,
    p.steep,
    f.cx.toFixed(3),
    f.cy.toFixed(3),
    f.radius.toFixed(3),
  ].join("|");
}

/**
 * Carte d'altitude d'une montagne (mémoïsée : les statistiques, les vues et le
 * maillage en partagent la même, quelles que soient la hauteur, la hauteur du
 * socle, le style ou les couleurs, qui n'y changent rien).
 */
export function createMountainField(p: FieldParams): MountainField {
  const key = keyOf(p);
  const hit = fieldCache.get(key);
  if (hit) {
    fieldCache.delete(key);
    fieldCache.set(key, hit);
    return hit;
  }
  const field = buildField(p);
  fieldCache.set(key, field);
  if (fieldCache.size > 6) fieldCache.delete(fieldCache.keys().next().value!);
  return field;
}

function buildField({ seed, form, steep, footprint: fp }: FieldParams) {
  const simplex = createSimplex(seed);
  const summits = layoutSummits(form, seed, fp, steep);
  const table = profileTable(0.55 + 0.95 * steep);
  const R = fp.radius;
  const invR = 1 / R;
  const roughness = 0.2 + 0.32 * steep;
  const softness = 0.09 + 0.05 * (1 - steep);
  const f0 = BASE_FREQ * invR;
  const wf = WARP_FREQ * invR;
  const warpEnv = 0.045 * R;
  const warpRock = 0.14 * R;

  /** Valeur brute (avant plateau), ≥ 0, de l'ordre de 1 au sommet principal. */
  function raw(x: number, y: number): number {
    const dx0 = x - fp.cx;
    const dy0 = y - fp.cy;
    const rho2 = (dx0 * dx0 + dy0 * dy0) * invR * invR;
    if (rho2 >= 1) return 0;
    // Domaine déformé : les arêtes ondulent un peu, les crêtes de roche davantage.
    const nx = simplex.noise2(x * wf + 11.3, y * wf - 4.7);
    const ny = simplex.noise2(x * wf - 7.1, y * wf + 19.9);
    const ex0 = x + warpEnv * nx;
    const ey0 = y + warpEnv * ny;
    const wx = x + warpRock * nx;
    const wy = y + warpRock * ny;

    let env = 0;
    for (let i = 0; i < summits.length; i++) {
      const s = summits[i];
      const ex = ex0 - s.x;
      const ey = ey0 - s.y;
      const u = (ex * s.cos + ey * s.sin) / s.a;
      const v = (-ex * s.sin + ey * s.cos) / s.b;
      const rho = Math.sqrt(u * u + v * v);
      if (rho >= 1) continue;
      const pos = rho * PROFILE_SIZE;
      const idx = pos | 0;
      const frac = pos - idx;
      const g = table[idx] * (1 - frac) + table[idx + 1] * frac;
      // Arêtes radiales : (u + iv)^n, partie réelle tournée de la phase.
      const inv = 1 / (rho + 1e-6);
      const c = u * inv;
      const sn = v * inv;
      let re = 1;
      let im = 0;
      for (let k = 0; k < s.ridges; k++) {
        const nr = re * c - im * sn;
        im = re * sn + im * c;
        re = nr;
      }
      const m = 0.5 + 0.5 * (re * s.phaseCos - im * s.phaseSin);
      // Les couloirs se creusent avec la distance au sommet.
      const depth = s.amp * smoothstep(0.06, 0.55, rho);
      const ridge = 1 - depth * (1 - m * Math.sqrt(m));
      const value = s.h * g * ridge;
      env = i === 0 ? value : smoothMax(env, value, softness);
    }
    if (env <= 0) return 0;

    // Roche : crêtes multifractales, pondérées par la crête précédente.
    let sum = 0;
    let norm = 0;
    let amp = 1;
    let freq = f0;
    let weight = 1;
    for (let o = 0; o < OCTAVES; o++) {
      let n =
        1 - Math.abs(simplex.noise2(wx * freq + 3.1 * o, wy * freq - 1.7 * o));
      n *= n;
      n *= weight;
      weight = Math.min(Math.max(n * 1.6, 0), 1);
      sum += n * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    const detail = sum / norm; // ≈ [0, 1], moyenne ≈ 0,3
    const rock = 1 - roughness + roughness * 2.4 * detail;
    // Chute vers le pied : exactement 0 au bord de l'emprise.
    const fall = smoothstep(1, 0.78, Math.sqrt(rho2));
    return env * rock * fall;
  }

  // Sommet principal et niveau de calotte. Recherche grossière du maximum sur
  // une grille de 2 mm environ, affinée par montée de gradient ; le niveau de
  // la calotte (`capLevel`) est celui où la région connexe du sommet atteint
  // l'aire d'un disque de CAP_DIAMETER_MM.
  const coarse = Math.max(24, Math.min(64, Math.round((2 * R) / 2)));
  const cell = (2 * R) / coarse;
  let bestX = fp.cx;
  let bestY = fp.cy;
  let best = -1;
  for (let j = 0; j < coarse; j++) {
    const y = fp.cy - R + (j + 0.5) * cell;
    for (let i = 0; i < coarse; i++) {
      const x = fp.cx - R + (i + 0.5) * cell;
      const v = raw(x, y);
      if (v > best) {
        best = v;
        bestX = x;
        bestY = y;
      }
    }
  }
  // Montée par raffinement de pas décroissant (8 directions).
  let step = cell;
  for (let it = 0; it < 28 && step > 0.02; it++) {
    let moved = false;
    for (let d = 0; d < 8; d++) {
      const a = (d * Math.PI) / 4;
      const nx = bestX + Math.cos(a) * step;
      const ny = bestY + Math.sin(a) * step;
      const v = raw(nx, ny);
      if (v > best) {
        best = v;
        bestX = nx;
        bestY = ny;
        moved = true;
      }
    }
    if (!moved) step *= 0.6;
  }
  const cap = capLevel(raw, bestX, bestY, best);
  const inv = 1 / cap;

  return {
    at(x: number, y: number): number {
      const v = raw(x, y) * inv;
      return v >= 1 ? 1 : v;
    },
    peak: { x: bestX, y: bestY },
    cap,
    footprint: fp,
    summits: summits.map((s) => ({ x: s.x, y: s.y, h: s.h })),
  } satisfies MountainField;
}

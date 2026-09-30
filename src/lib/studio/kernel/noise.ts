// Bruits du Studio (brief « Strates », §6.3.2 : « simplex 2D/3D et FBM, portage
// MIT d'Ashima/Gustavson, variante périodique »).
//
// - createSimplex(seed) : bruit simplex 2D et 3D de Gustavson, table de
//   permutation mélangée par mulberry32 (mêmes valeurs partout pour une même
//   graine). Sortie dans [-1, 1]. Sert au relief du sous-verre (WP-02).
// - createPeriodicNoise2(seed) : bruit de gradient 2D dont le réseau est
//   replié sur des périodes entières. Le simplex n'est pas périodique sans
//   réseau tourné (psrdnoise) ; un bruit de gradient à réseau carré l'est
//   trivialement, et la variante périodique ne sert qu'aux posters de champ
//   de courbes (scripts/gen-field-posters.ts), où la qualité visuelle d'un
//   Perlin lissé par `fade` suffit.
// - fbm2 / fbm3 / periodicFbm2 : somme d'octaves normalisée dans [-1, 1].
import { mulberry32 } from "./rng";

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const F3 = 1 / 3;
const G3 = 1 / 6;

// 12 arêtes du cube pour la 3D, 8 directions pour la 2D (Gustavson).
const GRAD3 = new Int8Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0,
  -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);
const GRAD2 = new Int8Array([
  1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1,
]);

/** Table de permutation de 256 entrées, mélangée par graine, doublée. */
function permutation(seed: number): Uint8Array {
  const rng = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

export interface Simplex {
  noise2(x: number, y: number): number;
  noise3(x: number, y: number, z: number): number;
}

export function createSimplex(seed: number): Simplex {
  const perm = permutation(seed);

  function noise2(x: number, y: number): number {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = (perm[ii + perm[jj]] & 7) * 2;
      t0 *= t0;
      n += t0 * t0 * (GRAD2[g] * x0 + GRAD2[g + 1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = (perm[ii + i1 + perm[jj + j1]] & 7) * 2;
      t1 *= t1;
      n += t1 * t1 * (GRAD2[g] * x1 + GRAD2[g + 1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = (perm[ii + 1 + perm[jj + 1]] & 7) * 2;
      t2 *= t2;
      n += t2 * t2 * (GRAD2[g] * x2 + GRAD2[g + 1] * y2);
    }
    return 70 * n;
  }

  function noise3(x: number, y: number, z: number): number {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const z0 = z - (k - t);
    let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number;
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
      }
    } else if (y0 < z0) {
      i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
    } else if (x0 < z0) {
      i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
    } else {
      i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
    }
    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    let n = 0;
    const corner = (
      c: number,
      gx: number,
      gy: number,
      gz: number,
      hash: number,
    ) => {
      if (c > 0) {
        const g = (hash % 12) * 3;
        c *= c;
        n += c * c * (GRAD3[g] * gx + GRAD3[g + 1] * gy + GRAD3[g + 2] * gz);
      }
    };
    corner(
      0.6 - x0 * x0 - y0 * y0 - z0 * z0,
      x0,
      y0,
      z0,
      perm[ii + perm[jj + perm[kk]]],
    );
    corner(
      0.6 - x1 * x1 - y1 * y1 - z1 * z1,
      x1,
      y1,
      z1,
      perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]],
    );
    corner(
      0.6 - x2 * x2 - y2 * y2 - z2 * z2,
      x2,
      y2,
      z2,
      perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]],
    );
    corner(
      0.6 - x3 * x3 - y3 * y3 - z3 * z3,
      x3,
      y3,
      z3,
      perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]],
    );
    return 32 * n;
  }

  return { noise2, noise3 };
}

export interface FbmOptions {
  octaves?: number;
  /** Gain d'amplitude entre deux octaves (défaut 0,5). */
  persistence?: number;
  /** Facteur de fréquence entre deux octaves (défaut 2). */
  lacunarity?: number;
}

/** Somme d'octaves de bruit 2D, normalisée dans [-1, 1]. */
export function fbm2(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  { octaves = 5, persistence = 0.5, lacunarity = 2 }: FbmOptions = {},
): number {
  let sum = 0;
  let norm = 0;
  let amp = 1;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Somme d'octaves de bruit 3D, normalisée dans [-1, 1]. */
export function fbm3(
  noise: (x: number, y: number, z: number) => number,
  x: number,
  y: number,
  z: number,
  { octaves = 5, persistence = 0.5, lacunarity = 2 }: FbmOptions = {},
): number {
  let sum = 0;
  let norm = 0;
  let amp = 1;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return sum / norm;
}

// ── Bruit périodique ─────────────────────────────────────────────────────────

export interface PeriodicNoise2 {
  /**
   * Bruit de gradient 2D, périodique de `periodX` × `periodY` cellules du
   * réseau (entiers ≥ 1) : noise(x + periodX, y) === noise(x, y).
   * Sortie dans [-1, 1].
   */
  (x: number, y: number, periodX: number, periodY: number): number;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const mod = (n: number, m: number) => ((n % m) + m) % m;

export function createPeriodicNoise2(seed: number): PeriodicNoise2 {
  const perm = permutation(seed);
  // 16 directions unitaires : plus régulier que 8 gradients, pas de biais
  // visible sur les lignes de niveau.
  const gx = new Float64Array(16);
  const gy = new Float64Array(16);
  for (let i = 0; i < 16; i++) {
    gx[i] = Math.cos((i * Math.PI) / 8);
    gy[i] = Math.sin((i * Math.PI) / 8);
  }
  const hash = (ix: number, iy: number) => perm[(ix & 255) + perm[iy & 255]] & 15;

  return (x, y, periodX, periodY) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const x0 = mod(ix, periodX);
    const y0 = mod(iy, periodY);
    const x1 = mod(ix + 1, periodX);
    const y1 = mod(iy + 1, periodY);
    const h00 = hash(x0, y0);
    const h10 = hash(x1, y0);
    const h01 = hash(x0, y1);
    const h11 = hash(x1, y1);
    const n00 = gx[h00] * fx + gy[h00] * fy;
    const n10 = gx[h10] * (fx - 1) + gy[h10] * fy;
    const n01 = gx[h01] * fx + gy[h01] * (fy - 1);
    const n11 = gx[h11] * (fx - 1) + gy[h11] * (fy - 1);
    const u = fade(fx);
    const v = fade(fy);
    const a = n00 + u * (n10 - n00);
    const b = n01 + u * (n11 - n01);
    // Un bruit de gradient de vecteurs unitaires tient dans ±√2/2.
    return (a + v * (b - a)) * Math.SQRT2;
  };
}

/**
 * FBM périodique : à chaque octave la fréquence ET la période sont
 * multipliées par `lacunarity` (entier), donc la somme reste périodique de
 * `periodX` × `periodY` cellules de l'octave de base.
 */
export function periodicFbm2(
  noise: PeriodicNoise2,
  x: number,
  y: number,
  periodX: number,
  periodY: number,
  { octaves = 5, persistence = 0.5, lacunarity = 2 }: FbmOptions = {},
): number {
  let sum = 0;
  let norm = 0;
  let amp = 1;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum +=
      amp * noise(x * freq, y * freq, periodX * freq, periodY * freq);
    norm += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return sum / norm;
}

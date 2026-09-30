// Caméra et projection pures (brief « Strates », §5.3 et §5.7 : « Le cadrage
// est calculé par camera.ts (pur TS, partagé avec les posters) : même
// projection que le SVG, donc raccord exact »). Les matrices sont en colonnes,
// avec les conventions de three (Matrix4.lookAt, makePerspective) : le Stage
// n'a qu'à poser `toThreeWorld(eye)` et `fov` sur sa PerspectiveCamera, le
// poster SVG projette avec les mêmes formules.
//
// Repères : le générateur est en Z vers le haut (mm) ; three est en Y vers le
// haut. Le Stage fait tourner l'objet de −90° autour de X : (x, y, z) du
// modèle devient (x, z, −y) dans le monde three (`toThreeWorld`). Les angles de
// la caméra sont ceux du monde three : azimut depuis +Z vers +X, élévation
// au-dessus de l'horizon ; la lumière du nord-ouest (en haut à gauche) et une
// caméra à −28° d'azimut regardent la même face de l'objet.
//
// Le fov est VERTICAL et fixe : l'objet occupe la même fraction de la hauteur
// de la vue quel que soit le rapport largeur/hauteur, donc un poster 4:5 en
// `meet` (hauteur limitante) se superpose exactement à un canvas carré ou 4:5.
import { createLavauxModel } from "./objects/lavaux-model";
import { HERO_CONFIG } from "./presets";
import type { LavauxConfig } from "./types";

export type Vec3 = [number, number, number];
/** Matrice 4×4 en colonnes (comme three.Matrix4.elements). */
export type Mat4 = Float64Array;

const RAD = Math.PI / 180;

export function mat4Identity(): Mat4 {
  const m = new Float64Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

/** a × b (b appliquée d'abord), comme Matrix4.multiplyMatrices(a, b). */
export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float64Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/**
 * Matrice de vue : inverse de la matrice monde de la caméra, celle que
 * produit `Matrix4.lookAt(eye, target, up)` puis la translation en `eye`.
 */
export function mat4LookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  const m = new Float64Array(16);
  m[0] = x[0];
  m[4] = x[1];
  m[8] = x[2];
  m[12] = -dot(x, eye);
  m[1] = y[0];
  m[5] = y[1];
  m[9] = y[2];
  m[13] = -dot(y, eye);
  m[2] = z[0];
  m[6] = z[1];
  m[10] = z[2];
  m[14] = -dot(z, eye);
  m[15] = 1;
  return m;
}

/** Projection perspective (fov vertical en degrés), comme Matrix4.makePerspective. */
export function mat4Perspective(
  fovDeg: number,
  aspect: number,
  near: number,
  far: number,
): Mat4 {
  const top = near * Math.tan(0.5 * fovDeg * RAD);
  const height = 2 * top;
  const width = aspect * height;
  const left = -0.5 * width;
  const m = new Float64Array(16);
  m[0] = (2 * near) / width;
  m[5] = (2 * near) / height;
  m[8] = (2 * left + width) / width; // (r + l) / (r − l) = 0 : projection centrée
  m[9] = 0;
  m[10] = -(far + near) / (far - near);
  m[11] = -1;
  m[14] = (-2 * far * near) / (far - near);
  return m;
}

/** Applique une matrice 4×4 à un point et divise par w : renvoie [x, y, z, w] (NDC, puis w). */
export function projectPoint(
  m: Mat4,
  p: Vec3,
): [number, number, number, number] {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [x / w, y / w, z / w, w];
}

// ── Caméra d'orbite ──────────────────────────────────────────────────────────

export interface CameraSpec {
  /** Champ vertical (degrés). */
  fovDeg: number;
  /** Azimut (degrés) depuis +Z vers +X du monde three. */
  azimuthDeg: number;
  /** Élévation (degrés) au-dessus de l'horizon. */
  elevationDeg: number;
  /** Distance œil ↔ cible (mm). */
  distance: number;
  /** Point visé, en repère modèle (Z vers le haut, mm). */
  target: Vec3;
}

/** Repère modèle (Z haut) → monde three (Y haut) : rotation de −90° autour de X. */
export function toThreeWorld(v: Vec3): Vec3 {
  return [v[0], v[2], -v[1]];
}

/** Position de l'œil en repère modèle. */
export function cameraEye(spec: CameraSpec): Vec3 {
  const az = spec.azimuthDeg * RAD;
  const el = spec.elevationDeg * RAD;
  const d = spec.distance;
  // Monde three : d × (sin az cos el, sin el, cos az cos el) ; retour au modèle : (x, −z, y).
  return [
    spec.target[0] + d * Math.sin(az) * Math.cos(el),
    spec.target[1] - d * Math.cos(az) * Math.cos(el),
    spec.target[2] + d * Math.sin(el),
  ];
}

/** Matrice de vue × projection d'une caméra d'orbite (aspect = largeur / hauteur). */
export function cameraMatrix(spec: CameraSpec, aspect: number): Mat4 {
  const view = mat4LookAt(cameraEye(spec), spec.target, [0, 0, 1]);
  const near = Math.max(spec.distance * 0.05, 0.1);
  const far = spec.distance * 4;
  return mat4Multiply(mat4Perspective(spec.fovDeg, aspect, near, far), view);
}

/** Extrémités verticales (NDC) d'un nuage de points vu par la caméra : [min, max]. */
export function verticalExtent(
  spec: CameraSpec,
  points: readonly Vec3[],
): [number, number] {
  const m = cameraMatrix(spec, 1);
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) {
    const y = projectPoint(m, p)[1];
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  return [lo, hi];
}

/**
 * Cadrage : règle la distance et la hauteur de la cible pour que le nuage
 * occupe `fraction` de la hauteur de la vue (NDC : 2 = toute la hauteur),
 * centré verticalement. L'objet est centré horizontalement par symétrie
 * (la cible est sur son axe).
 */
export function fitCamera(
  points: readonly Vec3[],
  base: Omit<CameraSpec, "distance" | "target">,
  fraction: number,
  axisZ: [number, number],
): CameraSpec {
  const spec: CameraSpec = {
    ...base,
    distance: 1,
    target: [0, 0, 0.5 * (axisZ[0] + axisZ[1])],
  };
  const extent = axisZ[1] - axisZ[0];
  spec.distance = extent * 3;
  const tan = Math.tan(0.5 * base.fovDeg * RAD);
  const cosEl = Math.cos(base.elevationDeg * RAD);
  for (let i = 0; i < 40; i++) {
    const [lo, hi] = verticalExtent(spec, points);
    const size = hi - lo;
    const centre = 0.5 * (hi + lo);
    // Échelle NDC → mm sur la verticale de l'écran, à la distance de la cible.
    spec.target = [
      spec.target[0],
      spec.target[1],
      spec.target[2] + (centre * spec.distance * tan) / cosEl,
    ];
    spec.distance *= size / (2 * fraction);
    if (Math.abs(size - 2 * fraction) < 1e-9 && Math.abs(centre) < 1e-9) break;
  }
  return spec;
}

// ── Caméra du héros (§5.3) ───────────────────────────────────────────────────

/** fov 20°, élévation 22°, azimut −28°, l'objet occupe 78 % de la hauteur de la vue. */
export const HERO_VIEW = {
  fovDeg: 20,
  azimuthDeg: -28,
  elevationDeg: 22,
  /** Part de la hauteur de la vue occupée par l'objet. */
  fraction: 0.78,
} as const;

/** Points de la silhouette (couronnes du pied, du sommet et intermédiaires) d'un vase. */
export function lavauxOutline(
  config: LavauxConfig,
  zOffset: (z: number) => number = () => 0,
  angles = 72,
): Vec3[] {
  const model = createLavauxModel(config);
  const tmp = new Float64Array(3);
  const points: Vec3[] = [];
  const zs = [0, config.h * 0.25, config.h * 0.5, config.h * 0.75, config.h];
  for (const z of zs) {
    for (let i = 0; i < angles; i++) {
      const theta = (i * 2 * Math.PI) / angles;
      model.outer(theta, z, z >= config.h ? -1 : 1, tmp);
      points.push([
        tmp[0] * Math.cos(theta),
        tmp[0] * Math.sin(theta),
        z + zOffset(z),
      ]);
    }
  }
  return points;
}

/** Cadrage d'un vase entier pour la vue du héros. */
export function heroCameraFor(
  config: LavauxConfig,
  zOffset: (z: number) => number = () => 0,
  totalHeight: number = config.h,
): CameraSpec {
  return fitCamera(
    lavauxOutline(config, zOffset),
    {
      fovDeg: HERO_VIEW.fovDeg,
      azimuthDeg: HERO_VIEW.azimuthDeg,
      elevationDeg: HERO_VIEW.elevationDeg,
    },
    HERO_VIEW.fraction,
    [0, totalHeight],
  );
}

let heroCameraCache: CameraSpec | null = null;

/**
 * Caméra du héros pour HERO_CONFIG (calculée à la première lecture, ≈ 1 ms).
 * Partagée par la scène `print-hero` (WP-HOME) et les posters : c'est ce qui
 * garantit le raccord du poster SSR et de la première frame du Stage.
 */
export function heroCamera(): CameraSpec {
  heroCameraCache ??= heroCameraFor(HERO_CONFIG);
  return heroCameraCache;
}

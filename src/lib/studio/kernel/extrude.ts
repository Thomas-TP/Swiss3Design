// Extrusion de polygones avec trous (brief « Strates », §6.3.2 :
// `kernel/extrude.ts` — polygones avec trous → faces par `earcut`, parois,
// coque fermée). Sert aux objets plats (plaque, relief, porte-nom) de WP-02 ;
// WP-01 livre le socle testé, WP-02 le complète (glyphes, bandes).
//
// Conventions : un polygone = un contour extérieur (sens trigonométrique vu
// de dessus, +Z vers l'observateur) et des trous (sens horaire). Les
// contours fournis dans l'autre sens sont retournés ici : l'appelant n'a pas
// à s'en soucier. Aucun point n'est répété en fin de contour.
import earcut from "earcut";
import { MeshBuilder } from "./mesh";
import type { Vec2 } from "./simplify";

export interface Polygon {
  outer: readonly Vec2[];
  holes?: readonly (readonly Vec2[])[];
}

export interface ExtrudeOptions {
  /** Bande de couleur des triangles (par défaut 0). */
  band?: number;
  /** Attribut `side` des sommets des parois (0 paroi extérieure du matériau d'impression). */
  side?: number;
  /**
   * Angle de crête (degrés) sous lequel les normales des parois sont lissées
   * entre deux arêtes voisines ; au-delà, l'arête reste vive. 0 = tout à plat.
   */
  creaseDeg?: number;
}

/** Aire signée d'un contour (positive dans le sens trigonométrique). */
export function ringArea(ring: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Retire les points confondus avec leur voisin (et le point final répété). */
export function cleanRing(ring: readonly Vec2[], eps = 1e-9): Vec2[] {
  const out: Vec2[] = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > eps) {
      out.push([p[0], p[1]]);
    }
  }
  while (
    out.length > 1 &&
    Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <=
      eps
  ) {
    out.pop();
  }
  return out;
}

function oriented(ring: readonly Vec2[], counterClockwise: boolean): Vec2[] {
  const clean = cleanRing(ring);
  const isCcw = ringArea(clean) > 0;
  return isCcw === counterClockwise ? clean : clean.reverse();
}

function pointInRing(p: Vec2, ring: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Classe des contours en polygones avec trous par inclusion (règle
 * pair-impair) : un contour contenu dans un nombre pair de contours est un
 * extérieur, dans un nombre impair un trou de son plus petit contenant.
 * Chaîne des glyphes (§6.3.3) : les « o », « a », « e » donnent un trou, et
 * l'îlot au centre d'un trou redevient un extérieur.
 */
export function classifyRings(rings: readonly (readonly Vec2[])[]): Polygon[] {
  const clean = rings.map((r) => cleanRing(r)).filter((r) => r.length >= 3);
  const area = clean.map((r) => Math.abs(ringArea(r)));
  // Un point de chaque contour sert de témoin d'inclusion (les contours d'une
  // même pièce ne se croisent pas).
  const containers: number[][] = clean.map((r, i) =>
    clean
      .map((_, j) => j)
      .filter((j) => j !== i && area[j] > area[i] && pointInRing(r[0], clean[j])),
  );
  const polygons: Polygon[] = [];
  const polygonOf = new Map<number, Polygon>();
  clean.forEach((ring, i) => {
    if (containers[i].length % 2 === 0) {
      const poly: Polygon = { outer: oriented(ring, true), holes: [] };
      polygons.push(poly);
      polygonOf.set(i, poly);
    }
  });
  clean.forEach((ring, i) => {
    if (containers[i].length % 2 === 1) {
      // Plus petit contenant = le dernier par aire décroissante.
      const parent = containers[i].reduce((best, j) =>
        area[j] < area[best] ? j : best,
      );
      (polygonOf.get(parent)?.holes as Vec2[][] | undefined)?.push(
        oriented(ring, false),
      );
    }
  });
  return polygons;
}

function flatten(outer: readonly Vec2[], holes: readonly (readonly Vec2[])[]) {
  const coords: number[] = [];
  const holeIndices: number[] = [];
  const points: Vec2[] = [];
  for (const p of outer) {
    coords.push(p[0], p[1]);
    points.push(p);
  }
  for (const hole of holes) {
    holeIndices.push(points.length);
    for (const p of hole) {
      coords.push(p[0], p[1]);
      points.push(p);
    }
  }
  return { coords, holeIndices, points };
}

/** Normale sortante (vers la droite de l'arête, contour extérieur en sens trigo). */
function edgeNormal(a: Vec2, b: Vec2): Vec2 {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dy / len, -dx / len];
}

function addWalls(
  builder: MeshBuilder,
  ring: readonly Vec2[],
  z0: number,
  z1: number,
  band: number,
  side: number,
  creaseCos: number,
): void {
  const n = ring.length;
  if (n < 3) return;
  const normals: Vec2[] = [];
  for (let i = 0; i < n; i++) normals.push(edgeNormal(ring[i], ring[(i + 1) % n]));
  // Normale de sommet : moyenne des deux arêtes voisines si elles sont presque
  // alignées (arrondi de coin), sinon celle de l'arête traitée (arête vive).
  const vertexNormal = (edge: number, atStart: boolean): Vec2 => {
    const own = normals[edge];
    const other = normals[(edge + (atStart ? n - 1 : 1)) % n];
    if (own[0] * other[0] + own[1] * other[1] < creaseCos) return own;
    const x = own[0] + other[0];
    const y = own[1] + other[1];
    const len = Math.hypot(x, y) || 1;
    return [x / len, y / len];
  };
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const na = vertexNormal(i, true);
    const nb = vertexNormal(i, false);
    const v0 = builder.addVertex(a[0], a[1], z0, na[0], na[1], 0, side);
    const v1 = builder.addVertex(b[0], b[1], z0, nb[0], nb[1], 0, side);
    const v2 = builder.addVertex(b[0], b[1], z1, nb[0], nb[1], 0, side);
    const v3 = builder.addVertex(a[0], a[1], z1, na[0], na[1], 0, side);
    builder.addQuad(v0, v1, v2, v3, band);
  }
}

function addCap(
  builder: MeshBuilder,
  points: readonly Vec2[],
  triangles: readonly number[],
  z: number,
  up: boolean,
  band: number,
  side: number,
): void {
  const base = builder.vertexCount;
  const nz = up ? 1 : -1;
  for (const p of points) builder.addVertex(p[0], p[1], z, 0, 0, nz, side);
  for (let t = 0; t < triangles.length; t += 3) {
    const a = triangles[t];
    const b = triangles[t + 1];
    const c = triangles[t + 2];
    const pa = points[a];
    const pb = points[b];
    const pc = points[c];
    const cross =
      (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
    if (cross === 0) continue; // triangle dégénéré : ni aire ni normale
    const ccw = cross > 0;
    // Dessus : sens trigo vu de +Z ; dessous : sens inverse.
    if (ccw === up) builder.addTriangle(base + a, base + b, base + c, band);
    else builder.addTriangle(base + a, base + c, base + b, band);
  }
}

/**
 * Coque fermée d'un polygone (avec trous) extrudé de z0 à z1 : parois + faces
 * du dessus et du dessous. Ajoute au constructeur fourni ; renvoie le nombre
 * de triangles ajoutés.
 */
export function extrudePolygon(
  builder: MeshBuilder,
  polygon: Polygon,
  z0: number,
  z1: number,
  { band = 0, side = 0, creaseDeg = 25 }: ExtrudeOptions = {},
): number {
  if (!(z1 > z0)) throw new Error("extrudePolygon : z1 doit dépasser z0");
  const outer = oriented(polygon.outer, true);
  const holes = (polygon.holes ?? []).map((h) => oriented(h, false));
  if (outer.length < 3) throw new Error("extrudePolygon : contour de moins de 3 points");
  const before = builder.triangleCount;
  const creaseCos = Math.cos((creaseDeg * Math.PI) / 180);
  addWalls(builder, outer, z0, z1, band, side, creaseCos);
  for (const hole of holes) addWalls(builder, hole, z0, z1, band, side, creaseCos);
  const { coords, holeIndices, points } = flatten(outer, holes);
  const triangles = earcut(coords, holeIndices.length ? holeIndices : null, 2);
  addCap(builder, points, triangles, z1, true, band, side);
  addCap(builder, points, triangles, z0, false, band, side);
  return builder.triangleCount - before;
}

/** Plusieurs polygones d'un coup (mêmes bornes en Z). */
export function extrudePolygons(
  builder: MeshBuilder,
  polygons: readonly Polygon[],
  z0: number,
  z1: number,
  options?: ExtrudeOptions,
): number {
  let total = 0;
  for (const p of polygons) total += extrudePolygon(builder, p, z0, z1, options);
  return total;
}

/** Aire d'un polygone avec trous (mm²). */
export function polygonArea(polygon: Polygon): number {
  let a = Math.abs(ringArea(polygon.outer));
  for (const h of polygon.holes ?? []) a -= Math.abs(ringArea(h));
  return a;
}

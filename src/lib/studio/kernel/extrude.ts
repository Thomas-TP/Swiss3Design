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

/** Périmètre d'un contour fermé (mm). */
export function ringPerimeter(ring: readonly Vec2[]): number {
  let length = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    length += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return length;
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
    Math.hypot(
      out[0][0] - out[out.length - 1][0],
      out[0][1] - out[out.length - 1][1],
    ) <= eps
  ) {
    out.pop();
  }
  return out;
}

/** Arête minimale (mm) d'un contour extrudé : en dessous, un quad de paroi n'a plus d'aire. */
export const MIN_EDGE_MM = 0.01;
/** Écart (mm) sous lequel un sommet est considéré aligné sur ses voisins et retiré. */
export const COLLINEAR_EPS_MM = 5e-4;

/**
 * Contour prêt pour l'extrusion (WP-02) : points confondus fusionnés, arêtes
 * plus courtes que `minEdge` absorbées, sommets alignés (écart < `lineEps`) et
 * pointes (retour sur soi) retirés. Sans cela un glyphe ou une strate produit
 * des triangles d'aire nulle (quad de 5 µm, sommet sur la droite de ses
 * voisins), donc un maillage qui échoue au test de variété. Idempotent.
 */
export function tidyRing(
  ring: readonly Vec2[],
  minEdge = MIN_EDGE_MM,
  lineEps = COLLINEAR_EPS_MM,
): Vec2[] {
  let pts = cleanRing(ring);
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    // Arêtes trop courtes : on garde le premier point de la paire.
    const kept: Vec2[] = [];
    for (const p of pts) {
      const last = kept[kept.length - 1];
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < minEdge) {
        changed = true;
        continue;
      }
      kept.push(p);
    }
    while (
      kept.length > 3 &&
      Math.hypot(
        kept[0][0] - kept[kept.length - 1][0],
        kept[0][1] - kept[kept.length - 1][1],
      ) < minEdge
    ) {
      kept.pop();
      changed = true;
    }
    pts = kept;
    // Sommets alignés ou en pointe : distance du sommet à la droite de ses voisins.
    const n = pts.length;
    if (n <= 3) break;
    const out: Vec2[] = [];
    for (let i = 0; i < n; i++) {
      const a = out.length > 0 ? out[out.length - 1] : pts[(i + n - 1) % n];
      const b = pts[i];
      const c = pts[(i + 1) % n];
      const abx = c[0] - a[0];
      const aby = c[1] - a[1];
      const len = Math.hypot(abx, aby);
      const dist =
        len < 1e-12
          ? Math.hypot(b[0] - a[0], b[1] - a[1])
          : Math.abs(abx * (b[1] - a[1]) - aby * (b[0] - a[0])) / len;
      if (dist < lineEps && out.length + (n - i - 1) > 2) {
        changed = true;
        continue;
      }
      out.push(b);
    }
    pts = out;
  }
  return pts;
}

function oriented(ring: readonly Vec2[], counterClockwise: boolean): Vec2[] {
  const clean = tidyRing(ring);
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
  const clean = rings.map((r) => tidyRing(r)).filter((r) => r.length >= 3);
  const area = clean.map((r) => Math.abs(ringArea(r)));
  // Un point de chaque contour sert de témoin d'inclusion (les contours d'une
  // même pièce ne se croisent pas).
  const containers: number[][] = clean.map((r, i) =>
    clean
      .map((_, j) => j)
      .filter(
        (j) => j !== i && area[j] > area[i] && pointInRing(r[0], clean[j]),
      ),
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

/**
 * Coupe chaque triangle dont une arête traverse un sommet du polygone (jonction
 * en T) : (a, b, c) avec v sur ab devient (a, v, c) et (v, b, c), même sens,
 * même aire. `earcut` produit ces arêtes quand trois sommets sont alignés
 * (un pont de trou qui passe par un autre sommet, un sommet oublié comme
 * « colinéaire ») ; les parois, elles, passent par tous les sommets, et la coque
 * serait ouverte à cet endroit. Recherche par grille : coût proche du linéaire.
 */
function conformTriangles(
  points: readonly Vec2[],
  triangles: number[],
): number[] {
  const n = points.length;
  if (n === 0) return triangles;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  const side = Math.max(1, Math.ceil(Math.sqrt(n)));
  const cw = Math.max((x1 - x0) / side, 1e-9);
  const ch = Math.max((y1 - y0) / side, 1e-9);
  const cellOf = (x: number, y: number): [number, number] => [
    Math.min(side - 1, Math.max(0, Math.floor((x - x0) / cw))),
    Math.min(side - 1, Math.max(0, Math.floor((y - y0) / ch))),
  ];
  const grid = new Map<number, number[]>();
  points.forEach((p, i) => {
    const [cx, cy] = cellOf(p[0], p[1]);
    const key = cy * side + cx;
    const list = grid.get(key);
    if (list) list.push(i);
    else grid.set(key, [i]);
  });
  const EPS = 1e-6;
  /** Sommets strictement à l'intérieur de l'arête ab, triés de a vers b. */
  const inside = (a: number, b: number): number[] => {
    const pa = points[a];
    const pb = points[b];
    const dx = pb[0] - pa[0];
    const dy = pb[1] - pa[1];
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return [];
    const len = Math.sqrt(len2);
    const [c0, r0] = cellOf(
      Math.min(pa[0], pb[0]) - EPS,
      Math.min(pa[1], pb[1]) - EPS,
    );
    const [c1, r1] = cellOf(
      Math.max(pa[0], pb[0]) + EPS,
      Math.max(pa[1], pb[1]) + EPS,
    );
    const found: [number, number][] = [];
    for (let r = r0; r <= r1; r++) {
      for (let cc = c0; cc <= c1; cc++) {
        for (const v of grid.get(r * side + cc) ?? []) {
          if (v === a || v === b) continue;
          const p = points[v];
          const s = ((p[0] - pa[0]) * dx + (p[1] - pa[1]) * dy) / len2;
          if (s * len <= EPS || (1 - s) * len <= EPS) continue;
          const off = Math.abs(dx * (p[1] - pa[1]) - dy * (p[0] - pa[0])) / len;
          if (off <= EPS) found.push([s, v]);
        }
      }
    }
    return found.sort((u, w) => u[0] - w[0]).map((f) => f[1]);
  };
  const cache = new Map<number, number[]>();
  const edgeInside = (a: number, b: number): number[] => {
    const key = a < b ? a * n + b : b * n + a;
    let list = cache.get(key);
    if (!list) {
      list = inside(a < b ? a : b, a < b ? b : a);
      cache.set(key, list);
    }
    return a < b ? list : list.slice().reverse();
  };
  const work: number[] = triangles.slice();
  const out: number[] = [];
  while (work.length > 0) {
    const c = work.pop()!;
    const b = work.pop()!;
    const a = work.pop()!;
    // Les trois arêtes (a,b), (b,c), (c,a) : la première qui porte un sommet est coupée.
    const tri = [a, b, c];
    let split = false;
    for (let e = 0; e < 3 && !split; e++) {
      const p = tri[e];
      const q = tri[(e + 1) % 3];
      const r = tri[(e + 2) % 3];
      const vs = edgeInside(p, q);
      if (vs.length === 0) continue;
      // Éventail depuis r : (p, v1, r), (v1, v2, r), …, (vk, q, r).
      let from = p;
      for (const v of vs) {
        work.push(from, v, r);
        from = v;
      }
      work.push(from, q, r);
      split = true;
    }
    if (!split) out.push(a, b, c);
  }
  return out;
}

/**
 * Triangulation d'un polygone avec trous, sans jonction en T (voir
 * `conformTriangles`) : les parois et les faces partagent exactement les mêmes
 * sommets, donc la coque est fermée.
 */
function triangulate(
  outer: readonly Vec2[],
  holes: readonly (readonly Vec2[])[],
): { points: Vec2[]; triangles: number[] } {
  const { coords, holeIndices, points } = flatten(outer, holes);
  const raw = Array.from(
    earcut(coords, holeIndices.length ? holeIndices : null, 2),
  );
  return { points, triangles: conformTriangles(points, raw) };
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
  for (let i = 0; i < n; i++)
    normals.push(edgeNormal(ring[i], ring[(i + 1) % n]));
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

/** Une dalle d'une extrusion par bandes : de `z0` à `z1`, dans la bande `band`. */
export interface Slab {
  z0: number;
  z1: number;
  band: number;
}

export interface SlabOptions extends Omit<ExtrudeOptions, "band"> {
  /** Face du dessus (défaut : oui). Faux quand une autre pièce la recouvre ou qu'elle est tracée à part. */
  topCap?: boolean;
  /** Face du dessous (défaut : oui). */
  bottomCap?: boolean;
}

/** Polygone orienté (extérieur trigo, trous horaires), contours nettoyés. */
function orientedPolygon(polygon: Polygon): {
  outer: Vec2[];
  holes: Vec2[][];
} {
  const outer = oriented(polygon.outer, true);
  if (outer.length < 3)
    throw new Error("extrudePolygon : contour de moins de 3 points");
  const holes = (polygon.holes ?? [])
    .map((h) => oriented(h, false))
    .filter((h) => h.length >= 3);
  return { outer, holes };
}

/**
 * Coque fermée d'un polygone (avec trous) extrudé par DALLES contiguës (une
 * bande par dalle) : parois découpées à chaque z de frontière, face du dessous
 * dans la bande de la première dalle, face du dessus dans celle de la dernière.
 * Sert à une lettre posée sur une strate qu'une frontière de couleur traverse.
 * `topCap` et `bottomCap` retirent une face (gravure en une seule coque : le
 * fond des poches est tracé à part par `capPolygon`).
 */
export function extrudeSlabs(
  builder: MeshBuilder,
  polygon: Polygon,
  slabs: readonly Slab[],
  {
    side = 0,
    creaseDeg = 25,
    topCap = true,
    bottomCap = true,
  }: SlabOptions = {},
): number {
  if (slabs.length === 0) throw new Error("extrudeSlabs : aucune dalle");
  for (let i = 0; i < slabs.length; i++) {
    if (!(slabs[i].z1 > slabs[i].z0))
      throw new Error("extrudePolygon : z1 doit dépasser z0");
    if (i > 0 && slabs[i].z0 !== slabs[i - 1].z1)
      throw new Error("extrudeSlabs : dalles non contiguës");
  }
  const { outer, holes } = orientedPolygon(polygon);
  const before = builder.triangleCount;
  const creaseCos = Math.cos((creaseDeg * Math.PI) / 180);
  for (const slab of slabs) {
    addWalls(builder, outer, slab.z0, slab.z1, slab.band, side, creaseCos);
    for (const hole of holes)
      addWalls(builder, hole, slab.z0, slab.z1, slab.band, side, creaseCos);
  }
  if (topCap || bottomCap) {
    const { points, triangles } = triangulate(outer, holes);
    const first = slabs[0];
    const last = slabs[slabs.length - 1];
    if (topCap)
      addCap(builder, points, triangles, last.z1, true, last.band, side);
    if (bottomCap)
      addCap(builder, points, triangles, first.z0, false, first.band, side);
  }
  return builder.triangleCount - before;
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
  return extrudeSlabs(builder, polygon, [{ z0, z1, band }], {
    side,
    creaseDeg,
  });
}

/**
 * Face plane d'un polygone (avec trous) à la hauteur `z`, vers le haut (`up`)
 * ou vers le bas : le fond d'une poche de gravure. Aucune paroi.
 */
export function capPolygon(
  builder: MeshBuilder,
  polygon: Polygon,
  z: number,
  up: boolean,
  { band = 0, side = 0 }: Pick<ExtrudeOptions, "band" | "side"> = {},
): number {
  const { outer, holes } = orientedPolygon(polygon);
  const before = builder.triangleCount;
  const { points, triangles } = triangulate(outer, holes);
  addCap(builder, points, triangles, z, up, band, side);
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
  for (const p of polygons)
    total += extrudePolygon(builder, p, z0, z1, options);
  return total;
}

/** Aire d'un polygone avec trous (mm²). */
export function polygonArea(polygon: Polygon): number {
  let a = Math.abs(ringArea(polygon.outer));
  for (const h of polygon.holes ?? []) a -= Math.abs(ringArea(h));
  return a;
}

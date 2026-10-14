// Maillage de la « Montagne » (brief « Strates », §6.3.4). Le modèle (socle,
// emprise, étiquette, grilles) est dans `montagne-model.ts`, la carte d'altitude
// dans `montagne-field.ts` ; ici on construit les COQUES, toutes fermées, que
// les trancheurs unissent (comme les lettres posées sur une plaque) :
//
//  - le SOCLE : prisme du contour, de 0 à la hauteur du socle ;
//  - la MONTAGNE, empilée sur lui, selon le style :
//      · « Lissé » : la surface continue `Z = socle + hauteur × carte(x, y)` sur
//        une grille régulière (deux triangles par cellule, diagonale choisie sur
//        la plus faible différence d'altitude), refermée par un dessous plat à
//        la hauteur du socle. Une surface d'altitude ne surplombe jamais : aucun
//        support. Les cellules plates (carte nulle) n'ont aucune épaisseur : elles
//        sont retirées, et la ligne de niveau où la surface rejoint le socle est
//        une arête vive commune au dessus et au dessous (les mêmes sommets), donc
//        la coque est fermée sans jonction en T ;
//      · « En strates » : une coque par polygone de contour (d3-contour sur la
//        grille de la carte), extrudée de son sommet de strate au suivant ;
//  - l'ÉTIQUETTE : nom et altitude en relief de 0,8 mm, posés sur le dessus du
//    socle (zone plate à l'avant).
//
// Les couleurs changent à la couche : une dalle traversée par une frontière de
// bande est découpée à cette frontière. Éclaté d'affichage (jamais dans
// l'export) : en lissé, la surface est découpée à chaque frontière de bande par
// la même coupe exacte (dessus tronqué, dessous plat à la hauteur de la
// frontière basse), une coque fermée par bande ; en strates, les dalles
// découpées sont déjà des coques fermées.
//
// Précision : les hauteurs qui tombent à 0,02 mm d'une frontière (ou du dessus du
// socle) sont ramenées EXACTEMENT sur elle, ce qui écarte les triangles
// dégénérés d'une coupe qui frôle un sommet (écart invisible : un dixième de
// couche). Les sommets de coupe sont calculés une seule fois par arête de
// grille : deux triangles voisins partagent des coordonnées identiques au bit
// près.
//
// Niveaux de détail : le lissé compte des cellules en travers du disque
// (drag 56, C1 96, C2 144, export 240, jamais sous 0,5 mm de côté : au plus
// ≈ 6 k, 17 k, 37 k et 82 k triangles), les strates leur grille de contours
// (64, 112, 160, 224) et leur tolérance de simplification (0,4 ; 0,25 ; 0,15 ;
// 0,1 mm).
// Nécessite la police des glyphes dès qu'une étiquette est tracée.
import {
  capRingsExact,
  extrudeSlabs,
  type Polygon,
  type Slab,
} from "../kernel/extrude";
import { MeshBuilder } from "../kernel/mesh";
import type { Vec2 } from "../kernel/simplify";
import type { ShapeLod } from "../text/geometry";
import type { GlyphFont } from "../text/glyphs";
import { linesPolygons } from "../text/shapes";
import type { Band, MeshData, MontagneConfig, StudioTexts } from "../types";
import {
  bandOfSlab,
  contourLevels,
  LABEL_HEIGHT_MM,
  layoutMontagne,
  mountainGrid,
  plinthOutline,
  strataThresholds,
  type Locale,
  type MountainGrid,
} from "./montagne-model";

// Contrat de la fiche WP-02 : `peakLabel(name, locale)` et `peakAltitude(name)`
// sont servis par l'objet ; le code de rendu serveur, qui n'a pas besoin de
// l'extrusion, les importe de `montagne-model` (plus léger).
export { peakAltitude, peakLabel, type Locale } from "./montagne-model";

export interface MontagneBuildOptions {
  lod: ShapeLod;
  /** `display` : 2 = C2 (≈ 37 k triangles au plus), 1 = C1 (≈ 17 k). Défaut 2. */
  tier?: 1 | 2;
  /** Une coque fermée par bande (éclaté d'affichage) : jamais dans l'export. */
  separateBands?: boolean;
  font?: GlyphFont | null;
  /** Langue de l'étiquette (séparateur de milliers). */
  locale?: Locale;
}

/** Côté minimal d'une cellule (mm) : en dessous, la buse de 0,4 mm n'y voit rien. */
const MIN_CELL_MM = 0.5;
/** Cellules en travers du disque d'emprise (lissé) et de la grille de contours (strates). */
const SMOOTH_ACROSS = { drag: 56, display1: 96, display2: 144, export: 240 };
const STRATA_ACROSS = { drag: 64, display1: 112, display2: 160, export: 224 };
const STRATA_TOLERANCE_MM = {
  drag: 0.4,
  display1: 0.25,
  display2: 0.15,
  export: 0.1,
};
/** Hauteurs ramenées sur une frontière quand elles en sont à moins de (mm). */
const SNAP_MM = 0.02;

function lodKey(options: Pick<MontagneBuildOptions, "lod" | "tier">) {
  return options.lod === "display"
    ? options.tier === 1
      ? "display1"
      : "display2"
    : options.lod;
}

/** Cellules en travers du disque pour un niveau de détail (lissé et strates). */
export function montagneAcross(
  style: MontagneConfig["style"],
  options: Pick<MontagneBuildOptions, "lod" | "tier">,
  radius: number,
): number {
  const key = lodKey(options);
  const wanted = (style === "lisse" ? SMOOTH_ACROSS : STRATA_ACROSS)[key];
  return Math.min(wanted, Math.max(24, Math.ceil((2 * radius) / MIN_CELL_MM)));
}

/** Dalles d'une extrusion de z0 à z1, découpées aux frontières de bande qui la traversent. */
function slabsBetween(bands: readonly Band[], z0: number, z1: number): Slab[] {
  const cuts = bands
    .slice(0, -1)
    .map((b) => b.toMm)
    .filter((z) => z > z0 + 1e-6 && z < z1 - 1e-6);
  const zs = [z0, ...cuts, z1];
  const slabs: Slab[] = [];
  for (let i = 0; i + 1 < zs.length; i++) {
    slabs.push({
      z0: zs[i],
      z1: zs[i + 1],
      band: bandOfSlab(bands, zs[i], zs[i + 1]),
    });
  }
  return slabs;
}

// ── Surface lissée : coupe exacte d'une grille d'altitude ────────────────────

/** Sommet de grille ou point de coupe, avec sa normale lissée. */
interface Corner {
  /** Identifiant « plan » : nœud de grille, ou point de coupe (≥ side²). */
  id: number;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  /** Arête de grille portant un point de coupe (clé), −1 pour un nœud. */
  edge: number;
}

const EDGE_SHIFT = 2 ** 21;
/** Identifiants des deux niveaux d'une coupe (clé des points de coupe). */
const LO = 0;
const HI = 1;
const edgeKey = (a: number, b: number) =>
  a < b ? a * EDGE_SHIFT + b : b * EDGE_SHIFT + a;

interface Terrain {
  side: number;
  cell: number;
  x0: number;
  y0: number;
  z: Float64Array;
  nx: Float32Array;
  ny: Float32Array;
  nz: Float32Array;
}

/** Hauteurs absolues, ramenées sur les frontières proches, et normales aux nœuds. */
function prepareTerrain(
  grid: MountainGrid,
  plinth: number,
  height: number,
  levels: readonly number[],
): Terrain {
  const side = grid.m + 1;
  const z = new Float64Array(side * side);
  for (let k = 0; k < z.length; k++) {
    let h = plinth + height * grid.values[k];
    for (const level of levels) {
      if (Math.abs(h - level) < SNAP_MM) {
        h = level;
        break;
      }
    }
    z[k] = h;
  }
  const nx = new Float32Array(side * side);
  const ny = new Float32Array(side * side);
  const nz = new Float32Array(side * side);
  const inv = 1 / (2 * grid.cell);
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      const k = j * side + i;
      const l = i > 0 ? k - 1 : k;
      const r = i < side - 1 ? k + 1 : k;
      const d = j > 0 ? k - side : k;
      const u = j < side - 1 ? k + side : k;
      // Au bord de la grille la différence est unilatérale : deux fois plus courte.
      const gx = (z[r] - z[l]) * inv * (i > 0 && i < side - 1 ? 1 : 2);
      const gy = (z[u] - z[d]) * inv * (j > 0 && j < side - 1 ? 1 : 2);
      const n = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      nx[k] = -gx * n;
      ny[k] = -gy * n;
      nz[k] = n;
    }
  }
  return { side, cell: grid.cell, x0: grid.x0, y0: grid.y0, z, nx, ny, nz };
}

/** Coupe d'un polygone convexe par un plan z = niveau (Sutherland–Hodgman), côté « au-dessus » ou « au-dessous ». */
function clipPolygon(
  poly: readonly Corner[],
  level: number,
  levelId: number,
  above: boolean,
  cross: (p: Corner, q: Corner, level: number, levelId: number) => Corner,
): Corner[] {
  const out: Corner[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const pin = (above ? p.z - level : level - p.z) >= 0;
    const qin = (above ? q.z - level : level - q.z) >= 0;
    if (pin && qin) out.push(q);
    else if (pin) out.push(cross(p, q, level, levelId));
    else if (qin) {
      out.push(cross(p, q, level, levelId));
      out.push(q);
    }
  }
  // Doublons consécutifs (un point de coupe qui retombe sur un nœud de niveau).
  const clean: Corner[] = [];
  for (const c of out) {
    if (clean.length === 0 || clean[clean.length - 1].id !== c.id)
      clean.push(c);
  }
  while (clean.length > 1 && clean[0].id === clean[clean.length - 1].id)
    clean.pop();
  return clean;
}

/** Aire (mm²) d'un polygone de coins, au signe de l'orientation. */
function cornersArea(poly: readonly Corner[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/**
 * Émet, dans `b`, la partie de la surface comprise entre les niveaux `lo` et
 * `hi` : dessus (lissé entre les deux, plat à `hi` au-dessus), et dessous plat à
 * `lo`, fermé par les lignes de niveau. `bandOf` donne la bande d'une face à
 * partir de sa hauteur moyenne.
 */
function emitSurface(
  b: MeshBuilder,
  terrain: Terrain,
  lo: number,
  hi: number,
  bandOf: (z: number) => number,
  bottomBand: number,
): void {
  const { side, cell, x0, y0, z, nx, ny, nz } = terrain;
  const nodes: (Corner | undefined)[] = Array.from(
    { length: side * side },
    () => undefined,
  );
  const cornerOfNode = (id: number): Corner => {
    let c = nodes[id];
    if (!c) {
      const i = id % side;
      const j = (id - i) / side;
      c = {
        id,
        x: x0 + i * cell,
        y: y0 + j * cell,
        z: z[id],
        nx: nx[id],
        ny: ny[id],
        nz: nz[id],
        edge: -1,
      };
      nodes[id] = c;
    }
    return c;
  };

  // Points de coupe : un seul par (arête de grille, niveau), calculé depuis les
  // deux nœuds de l'arête, dans l'ordre de leurs identifiants.
  const crossings = new Map<number, Corner>();
  let crossingId = side * side;
  const cross = (p: Corner, q: Corner, level: number, levelId: number) => {
    if (p.z === level) return p;
    if (q.z === level) return q;
    const edge =
      p.edge >= 0 ? p.edge : q.edge >= 0 ? q.edge : edgeKey(p.id, q.id);
    const key = edge * 4 + levelId;
    let c = crossings.get(key);
    if (!c) {
      const hiNode = edge % EDGE_SHIFT;
      const loNode = (edge - hiNode) / EDGE_SHIFT;
      const a = cornerOfNode(loNode);
      const bb = cornerOfNode(hiNode);
      const t = (level - a.z) / (bb.z - a.z);
      let cnx = a.nx + t * (bb.nx - a.nx);
      let cny = a.ny + t * (bb.ny - a.ny);
      let cnz = a.nz + t * (bb.nz - a.nz);
      const inv = 1 / Math.sqrt(cnx * cnx + cny * cny + cnz * cnz);
      cnx *= inv;
      cny *= inv;
      cnz *= inv;
      c = {
        id: crossingId++,
        x: a.x + t * (bb.x - a.x),
        y: a.y + t * (bb.y - a.y),
        z: level,
        nx: cnx,
        ny: cny,
        nz: cnz,
        edge,
      };
      crossings.set(key, c);
    }
    return c;
  };

  // Sommets émis : dessus lissé, dessus plat à `hi` ; un cache par nœud et par point de coupe.
  const smoothNode = new Int32Array(side * side).fill(-1);
  const flatNode = new Int32Array(side * side).fill(-1);
  const smoothCross = new Map<number, number>();
  const flatCross = new Map<number, number>();
  const smoothVertex = (c: Corner): number => {
    const cache = c.edge < 0 ? null : smoothCross;
    if (cache === null) {
      let v = smoothNode[c.id];
      if (v < 0) {
        v = b.addVertex(c.x, c.y, c.z, c.nx, c.ny, c.nz, 0);
        smoothNode[c.id] = v;
      }
      return v;
    }
    let v = cache.get(c.id);
    if (v === undefined) {
      v = b.addVertex(c.x, c.y, c.z, c.nx, c.ny, c.nz, 0);
      cache.set(c.id, v);
    }
    return v;
  };
  const flatVertex = (c: Corner): number => {
    if (c.edge < 0) {
      let v = flatNode[c.id];
      if (v < 0) {
        v = b.addVertex(c.x, c.y, hi, 0, 0, 1, 0);
        flatNode[c.id] = v;
      }
      return v;
    }
    let v = flatCross.get(c.id);
    if (v === undefined) {
      v = b.addVertex(c.x, c.y, hi, 0, 0, 1, 0);
      flatCross.set(c.id, v);
    }
    return v;
  };

  // Arêtes de plan à la hauteur `lo` (les deux bouts exactement à `lo`) : celles
  // qui n'ont pas leur inverse bordent la région, donc le dessous.
  const flatEdges = new Map<number, [Corner, Corner]>();
  const noteEdges = (poly: readonly Corner[]) => {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      if (p.z !== lo || q.z !== lo) continue;
      const reverse = q.id * EDGE_SHIFT + p.id;
      if (flatEdges.has(reverse)) flatEdges.delete(reverse);
      else flatEdges.set(p.id * EDGE_SHIFT + q.id, [p, q]);
    }
  };

  const fan = (
    poly: readonly Corner[],
    vertex: (c: Corner) => number,
    band: number,
  ) => {
    const v0 = vertex(poly[0]);
    for (let i = 1; i + 1 < poly.length; i++) {
      b.addTriangle(v0, vertex(poly[i]), vertex(poly[i + 1]), band);
    }
  };

  const hiFinite = Number.isFinite(hi);
  const process = (n0: number, n1: number, n2: number) => {
    const c0 = cornerOfNode(n0);
    const c1 = cornerOfNode(n1);
    const c2 = cornerOfNode(n2);
    if (Math.max(c0.z, c1.z, c2.z) <= lo) return;
    const kept = clipPolygon([c0, c1, c2], lo, LO, true, cross);
    if (kept.length < 3 || Math.abs(cornersArea(kept)) < 1e-9) return;
    let below = kept;
    let above: Corner[] = [];
    if (hiFinite && Math.max(c0.z, c1.z, c2.z) > hi) {
      below = clipPolygon(kept, hi, HI, false, cross);
      above = clipPolygon(kept, hi, HI, true, cross);
    }
    if (below.length >= 3 && Math.abs(cornersArea(below)) >= 1e-9) {
      noteEdges(below);
      const zc = below.reduce((s, c) => s + c.z, 0) / below.length;
      fan(below, smoothVertex, bandOf(zc));
    }
    if (above.length >= 3 && Math.abs(cornersArea(above)) >= 1e-9) {
      noteEdges(above);
      fan(above, flatVertex, bandOf(hi));
    }
  };

  for (let j = 0; j < side - 1; j++) {
    for (let i = 0; i < side - 1; i++) {
      const a = j * side + i;
      const bb = a + 1;
      const d = a + side;
      const c = d + 1;
      const top = Math.max(z[a], z[bb], z[c], z[d]);
      if (top <= lo) continue;
      // Diagonale sur la plus faible différence d'altitude : moins de plis parasites.
      if (Math.abs(z[a] - z[c]) <= Math.abs(z[bb] - z[d])) {
        process(a, bb, c);
        process(a, c, d);
      } else {
        process(a, bb, d);
        process(bb, c, d);
      }
    }
  }

  // Dessous plat : les contours de la région (sens trigonométrique, trous dans
  // l'autre sens), triangulés avec exactement les sommets de la surface.
  closeBottom(b, flatEdges, lo, bottomBand);
}

/** Boucles fermées des arêtes de bord, puis face plane vers le bas à `z`. */
function closeBottom(
  b: MeshBuilder,
  edges: Map<number, [Corner, Corner]>,
  z: number,
  band: number,
): void {
  if (edges.size === 0) return;
  const next = new Map<number, [Corner, Corner][]>();
  for (const e of edges.values()) {
    const list = next.get(e[0].id);
    if (list) list.push(e);
    else next.set(e[0].id, [e]);
  }
  const used = new Set<[Corner, Corner]>();
  const rings: Vec2[][] = [];
  for (const start of edges.values()) {
    if (used.has(start)) continue;
    const ring: Vec2[] = [];
    let edge: [Corner, Corner] | undefined = start;
    while (edge && !used.has(edge)) {
      used.add(edge);
      ring.push([edge[0].x, edge[0].y]);
      const candidates: [Corner, Corner][] | undefined = next.get(edge[1].id);
      edge = candidates?.find((e) => !used.has(e));
    }
    if (ring.length >= 3) rings.push(ring);
  }
  const area = (ring: readonly Vec2[]) => {
    let a = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  };
  const inside = (p: Vec2, ring: readonly Vec2[]) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const c = ring[j];
      if (
        a[1] > p[1] !== c[1] > p[1] &&
        p[0] < ((c[0] - a[0]) * (p[1] - a[1])) / (c[1] - a[1]) + a[0]
      )
        hit = !hit;
    }
    return hit;
  };
  const outers = rings.filter((r) => area(r) > 0);
  const holes = rings.filter((r) => area(r) < 0);
  const owned = new Map<Vec2[], Vec2[][]>(outers.map((o) => [o, []]));
  for (const hole of holes) {
    let owner: Vec2[] | null = null;
    for (const outer of outers) {
      if (
        inside(hole[0], outer) &&
        (owner === null || Math.abs(area(outer)) < Math.abs(area(owner)))
      )
        owner = outer;
    }
    if (owner) owned.get(owner)!.push(hole);
  }
  for (const [outer, inner] of owned) {
    capRingsExact(b, outer, inner, z, false, { band, side: 1 });
  }
}

// ── Montagne : lissée ou en strates ──────────────────────────────────────────

/**
 * Extrusion d'un polygone par dalles de bande. Une seule coque fermée (parois
 * découpées aux frontières, faces aux deux bouts) ; dans l'éclaté, chaque dalle
 * est sa propre coque fermée (une face à chaque frontière), pour que chaque
 * bande écartée soit pleine. Jamais dans l'export.
 */
function extrudeBanded(
  b: MeshBuilder,
  polygon: Polygon,
  slabs: readonly Slab[],
  separate: boolean,
): void {
  if (!separate || slabs.length === 1) {
    extrudeSlabs(b, polygon, slabs);
    return;
  }
  for (const slab of slabs) extrudeSlabs(b, polygon, [slab]);
}

export function buildMontagne(
  config: MontagneConfig,
  texts: StudioTexts | undefined,
  options: MontagneBuildOptions,
): MeshData {
  const model = layoutMontagne(config, texts, options.locale ?? "fr");
  const bands = config.bands;
  const plinth = config.plinth;
  const b = new MeshBuilder(8192, 16384);
  const separate = options.separateBands === true && options.lod !== "export";

  // Socle.
  extrudeBanded(
    b,
    { outer: plinthOutline(config, options.lod) },
    slabsBetween(bands, 0, plinth),
    separate,
  );

  // Montagne.
  const across = montagneAcross(config.style, options, model.footprint.radius);
  const grid = mountainGrid(config, across);
  if (config.style === "strates") {
    const thresholds = strataThresholds(config);
    const levels: Polygon[][] = contourLevels(
      grid,
      thresholds,
      STRATA_TOLERANCE_MM[lodKey(options)],
    );
    levels.forEach((polygons, k) => {
      const slabs = slabsBetween(bands, model.tops[k], model.tops[k + 1]);
      for (const polygon of polygons)
        extrudeBanded(b, polygon, slabs, separate);
    });
  } else {
    const boundaries = bands.slice(0, -1).map((band) => band.toMm);
    const terrain = prepareTerrain(grid, plinth, config.height, boundaries);
    if (separate) {
      // Une coque fermée par bande de montagne (la bande 0 est le socle).
      for (let k = 1; k < bands.length; k++) {
        const lo = k === 1 ? plinth : bands[k - 1].toMm;
        const hi =
          k === bands.length - 1 ? Number.POSITIVE_INFINITY : bands[k].toMm;
        emitSurface(b, terrain, lo, hi, () => k, k);
      }
    } else {
      emitSurface(
        b,
        terrain,
        plinth,
        Number.POSITIVE_INFINITY,
        (zc) => bandOfSlab(bands, zc, zc),
        bandOfSlab(bands, plinth, plinth + 0.2),
      );
    }
  }

  // Étiquette.
  const label = linesPolygons(model.lines, options.lod, options.font);
  const labelSlabs = slabsBetween(bands, plinth, plinth + LABEL_HEIGHT_MM);
  for (const polygon of label) extrudeBanded(b, polygon, labelSlabs, separate);
  return b.build();
}

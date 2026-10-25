// Outils de l'atelier 3D, à la manière des trancheurs : pinceau (sphère), triangle
// et bandes de hauteur ; les remplissages sont dans bucket.ts. Ils agissent sur le document dans l'étape ouverte par l'appelant
// (un trait = une étape = un « annuler »). Le pinceau et les hauteurs coupent les
// grands triangles le long de leur bord (selector.ts) : un trait reste rond et une
// bande horizontale nette sur un maillage grossier, sans toucher à la géométrie.
import { queryBvhSphere } from "./bvh";
import type { PaintDocument } from "./document";
import {
  collapse,
  isSplit,
  MAX_PAINT_DEPTH,
  splitCorners,
  splitRule,
  type PaintNode,
} from "./selector";

// ── Géométrie ────────────────────────────────────────────────────────────────

/** Distance² d'un point au triangle (Ericson, « Real-Time Collision Detection », 5.1.5). */
export function pointTriangleDistance2(
  p: ArrayLike<number>,
  px: number,
  py: number,
  pz: number,
): number {
  const ax = p[0];
  const ay = p[1];
  const az = p[2];
  const abx = p[3] - ax;
  const aby = p[4] - ay;
  const abz = p[5] - az;
  const acx = p[6] - ax;
  const acy = p[7] - ay;
  const acz = p[8] - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  const dist2 = (x: number, y: number, z: number) =>
    (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2;
  if (d1 <= 0 && d2 <= 0) return dist2(ax, ay, az);
  const bpx = px - p[3];
  const bpy = py - p[4];
  const bpz = pz - p[5];
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return dist2(p[3], p[4], p[5]);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return dist2(ax + abx * v, ay + aby * v, az + abz * v);
  }
  const cpx = px - p[6];
  const cpy = py - p[7];
  const cpz = pz - p[8];
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return dist2(p[6], p[7], p[8]);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return dist2(ax + acx * w, ay + acy * w, az + acz * w);
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return dist2(
      p[3] + (p[6] - p[3]) * w,
      p[4] + (p[7] - p[4]) * w,
      p[5] + (p[8] - p[5]) * w,
    );
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return dist2(
    ax + abx * v + acx * w,
    ay + aby * v + acy * w,
    az + abz * v + acz * w,
  );
}

// ── Peinture récursive sous un « curseur » ───────────────────────────────────

/** Où un triangle se trouve par rapport au curseur. */
const OUTSIDE = 0;
const INSIDE = 1;
const PARTIAL = 2;

interface Cursor {
  classify(corners: ArrayLike<number>): number;
  /** Le centre du triangle est-il dans le curseur (feuille trop petite pour être coupée) ? */
  centroidInside(corners: ArrayLike<number>): boolean;
}

/**
 * Peint `state` dans la partie de l'arbre `node` (triangle aux sommets
 * `corners`) couverte par le curseur. Les feuilles à cheval sont coupées tant
 * qu'un côté dépasse `limit`, puis prises si leur centre est dedans.
 */
function paintUnder(
  node: PaintNode,
  corners: ArrayLike<number>,
  cursor: Cursor,
  state: number,
  limit: number,
  depth: number,
): PaintNode {
  const where = cursor.classify(corners);
  if (where === OUTSIDE) return node;
  if (where === INSIDE) return state;
  if (isSplit(node)) {
    const children = splitCorners(corners, node.s, node.k);
    let changed = false;
    const next = node.c.map((child, i) => {
      const painted = paintUnder(
        child,
        children[i],
        cursor,
        state,
        limit,
        depth + 1,
      );
      if (painted !== child) changed = true;
      return painted;
    });
    return changed ? collapse({ ...node, c: next }) : node;
  }
  if (node === state) return node;
  const rule = depth < MAX_PAINT_DEPTH ? splitRule(corners, limit) : null;
  if (!rule) return cursor.centroidInside(corners) ? state : node;
  const children = splitCorners(corners, rule.s, rule.k);
  return collapse({
    s: rule.s,
    k: rule.k,
    c: children.map((child) =>
      paintUnder(node, child, cursor, state, limit, depth + 1),
    ),
  });
}

function sphereCursor(
  cx: number,
  cy: number,
  cz: number,
  radius: number,
): Cursor {
  const r2 = radius * radius;
  const inside = (p: ArrayLike<number>, o: number) =>
    (p[o] - cx) ** 2 + (p[o + 1] - cy) ** 2 + (p[o + 2] - cz) ** 2 <= r2;
  return {
    classify(p) {
      const n =
        (inside(p, 0) ? 1 : 0) +
        (inside(p, 3) ? 1 : 0) +
        (inside(p, 6) ? 1 : 0);
      if (n === 3) return INSIDE;
      if (n > 0) return PARTIAL;
      return pointTriangleDistance2(p, cx, cy, cz) <= r2 ? PARTIAL : OUTSIDE;
    },
    centroidInside(p) {
      return (
        ((p[0] + p[3] + p[6]) / 3 - cx) ** 2 +
          ((p[1] + p[4] + p[7]) / 3 - cy) ** 2 +
          ((p[2] + p[5] + p[8]) / 3 - cz) ** 2 <=
        r2
      );
    },
  };
}

export interface BrushOptions {
  /** État peint (0 : gomme). */
  state: number;
  /** Rayon, en unités du fichier. */
  radius: number;
  /**
   * Direction du regard vers la caméra (repère du fichier) : seules les faces
   * tournées vers elle se peignent. null : la sphère traverse la pièce.
   */
  facing: readonly [number, number, number] | null;
}

/** Pinceau sphérique centré en un point du fichier. Renvoie le nombre de triangles changés. */
export function paintSphere(
  doc: PaintDocument,
  center: readonly [number, number, number],
  options: BrushOptions,
): number {
  const [cx, cy, cz] = center;
  const cursor = sphereCursor(cx, cy, cz, options.radius);
  // Un trait rond sur un maillage grossier : coupe jusqu'au huitième du rayon
  // (au quart, le bord d'une pastille restait crénelé).
  const limit = Math.max(options.radius / 8, 1e-4);
  const normals = doc.topology.faceNormals;
  let changed = 0;
  queryBvhSphere(doc.bvh, cx, cy, cz, options.radius, (t) => {
    if (options.facing) {
      const [fx, fy, fz] = options.facing;
      if (
        normals[t * 3] * fx +
          normals[t * 3 + 1] * fy +
          normals[t * 3 + 2] * fz <
        -1e-6
      )
        return;
    }
    const node = doc.node(t);
    const next = paintUnder(
      node,
      doc.corners(t),
      cursor,
      options.state,
      limit,
      0,
    );
    if (next !== node && doc.setNode(t, next)) changed++;
  });
  return changed;
}

/** Peint des triangles d'origine entiers (outil « triangle », remplissages). */
export function paintTriangles(
  doc: PaintDocument,
  triangles: ArrayLike<number>,
  state: number,
): number {
  let changed = 0;
  for (let i = 0; i < triangles.length; i++)
    if (doc.setNode(triangles[i], state)) changed++;
  return changed;
}

// ── Remplissages ─────────────────────────────────────────────────────────────

/**
 * Modes du remplissage (bucket.ts, au niveau des feuilles de la peinture) :
 *  - « zone » : la même couleur, jusqu'aux arêtes plus vives que l'angle (le pot
 *    de peinture de Bambu Studio, « détection des arêtes ») ;
 *  - « color » : toute la zone de même couleur, sans limite d'angle ;
 *  - « surface » : la surface lisse, quelles que soient les couleurs (le
 *    « remplissage intelligent » des trancheurs) ;
 *  - « part » : toute la pièce (les triangles reliés par des arêtes).
 */
export type FillMode = "zone" | "color" | "surface" | "part";

export function fillOptions(
  mode: FillMode,
  angleDeg: number,
): { sameColor: boolean; angle: number | null } {
  return {
    sameColor: mode === "zone" || mode === "color",
    angle: mode === "zone" || mode === "surface" ? angleDeg : null,
  };
}

// ── Bandes de hauteur ────────────────────────────────────────────────────────

/**
 * Peint `state` sur tout ce qui est entre `zMin` et `zMax` (mm, sur le plateau,
 * dans l'orientation choisie). Les triangles à cheval sur une limite sont coupés
 * jusqu'à `resolution` mm : la limite tombe à une couche près.
 */
export function paintHeightRange(
  doc: PaintDocument,
  zMin: number,
  zMax: number,
  state: number,
  resolution = 0.2,
): number {
  const r = doc.rotation;
  const s = doc.scale;
  const z0 = doc.worldZ(0, 0, 0);
  const zOf = (p: ArrayLike<number>, o: number) =>
    s * (r[6] * p[o] + r[7] * p[o + 1] + r[8] * p[o + 2]) + z0;
  const cursor: Cursor = {
    classify(p) {
      const a = zOf(p, 0);
      const b = zOf(p, 3);
      const c = zOf(p, 6);
      const lo = Math.min(a, b, c);
      const hi = Math.max(a, b, c);
      if (hi < zMin || lo > zMax) return OUTSIDE;
      if (lo >= zMin && hi <= zMax) return INSIDE;
      return PARTIAL;
    },
    centroidInside(p) {
      const z = (zOf(p, 0) + zOf(p, 3) + zOf(p, 6)) / 3;
      return z >= zMin && z <= zMax;
    },
  };
  const limit = resolution / s;
  let changed = 0;
  for (let t = 0; t < doc.triangleCount; t++) {
    const node = doc.node(t);
    const next = paintUnder(node, doc.corners(t), cursor, state, limit, 0);
    if (next !== node && doc.setNode(t, next)) changed++;
  }
  return changed;
}

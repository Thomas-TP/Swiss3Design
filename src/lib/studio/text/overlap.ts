// Chevauchement de formes d'encre (brief « Strates », §6.3.4) : la gravure sans
// CSG classe les contours de la plaque et de l'encre par inclusion
// (`plateMinusInk`), ce qui suppose des formes d'encre DISJOINTES. Deux lettres
// ou une lettre et un filet qui se touchent donneraient une coque ouverte.
// Ce module ne sert qu'à le vérifier (tests, fabrication des glyphes) : pur
// TypeScript, jamais importé par un chemin chaud.
import type { Polygon } from "../kernel/extrude";
import type { Vec2 } from "../kernel/simplify";

function ringsOf(polygon: Polygon): readonly (readonly Vec2[])[] {
  return [polygon.outer, ...(polygon.holes ?? [])];
}

function boxOf(polygon: Polygon): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of polygon.outer) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return [x0, y0, x1, y1];
}

/** Distance² d'un point à un segment. */
function pointSegmentDist2(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0
      ? 0
      : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
  const qx = ax + t * dx - px;
  const qy = ay + t * dy - py;
  return qx * qx + qy * qy;
}

function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** Les segments [a, b] et [c, d] se coupent (croisement propre ; le contact est traité par la distance). */
function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o1 = orient(a[0], a[1], b[0], b[1], c[0], c[1]);
  const o2 = orient(a[0], a[1], b[0], b[1], d[0], d[1]);
  const o3 = orient(c[0], c[1], d[0], d[1], a[0], a[1]);
  const o4 = orient(c[0], c[1], d[0], d[1], b[0], b[1]);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/** Distance² entre deux segments (0 s'ils se croisent). */
function segmentDist2(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  if (segmentsCross(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDist2(a[0], a[1], c[0], c[1], d[0], d[1]),
    pointSegmentDist2(b[0], b[1], c[0], c[1], d[0], d[1]),
    pointSegmentDist2(c[0], c[1], a[0], a[1], b[0], b[1]),
    pointSegmentDist2(d[0], d[1], a[0], a[1], b[0], b[1]),
  );
}

function inRing(ring: readonly Vec2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Le point est dans la matière du polygone (dans l'extérieur, hors des trous). */
function inMatter(polygon: Polygon, x: number, y: number): boolean {
  if (!inRing(polygon.outer, x, y)) return false;
  return !(polygon.holes ?? []).some((hole) => inRing(hole, x, y));
}

/**
 * Plus petite distance (mm) entre les matières de deux polygones : 0 s'ils se
 * touchent, se croisent ou si l'un est dans la matière de l'autre ; sinon la
 * plus courte distance entre contours. `Infinity` dès que l'écart dépasse `stopAt`
 * (le calcul s'arrête : on ne veut qu'un test « plus proche que `stopAt` »).
 */
export function polygonGap(
  a: Polygon,
  b: Polygon,
  stopAt: number = Infinity,
): number {
  const ba = boxOf(a);
  const bb = boxOf(b);
  const pad = Number.isFinite(stopAt) ? stopAt : 0;
  if (
    Number.isFinite(stopAt) &&
    (ba[2] + pad < bb[0] ||
      bb[2] + pad < ba[0] ||
      ba[3] + pad < bb[1] ||
      bb[3] + pad < ba[1])
  ) {
    return Infinity;
  }
  let best = Infinity;
  for (const ra of ringsOf(a)) {
    for (const rb of ringsOf(b)) {
      for (let i = 0; i < ra.length; i++) {
        const p = ra[i];
        const q = ra[(i + 1) % ra.length];
        for (let j = 0; j < rb.length; j++) {
          const d2 = segmentDist2(p, q, rb[j], rb[(j + 1) % rb.length]);
          if (d2 < best) {
            best = d2;
            if (best === 0) return 0;
          }
        }
      }
    }
  }
  // Aucun contour ne se touche : l'un peut contenir l'autre (îlot d'un trou exclu).
  if (
    inMatter(b, a.outer[0][0], a.outer[0][1]) ||
    inMatter(a, b.outer[0][0], b.outer[0][1])
  ) {
    return 0;
  }
  const gap = Math.sqrt(best);
  return gap > stopAt ? Infinity : gap;
}

/** Vrai si les deux polygones se touchent, se croisent ou se contiennent (distance < `clearance`). */
export function polygonsOverlap(
  a: Polygon,
  b: Polygon,
  clearance = 0,
): boolean {
  const gap = polygonGap(a, b, clearance);
  return clearance > 0 ? gap < clearance : gap === 0;
}

/**
 * Paires (i, j) de formes plus proches que `clearance` mm (0 : qui se touchent
 * ou se recouvrent). Les formes sont triées par abscisse pour ne comparer que
 * les voisines : quadratique seulement dans le pire cas.
 */
export function findOverlaps(
  polygons: readonly Polygon[],
  clearance = 0,
): [number, number][] {
  const items = polygons
    .map((polygon, index) => ({ polygon, index, box: boxOf(polygon) }))
    .sort((p, q) => p.box[0] - q.box[0]);
  const out: [number, number][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[j].box[0] > items[i].box[2] + clearance) break;
      if (polygonsOverlap(items[i].polygon, items[j].polygon, clearance)) {
        const pair: [number, number] = [items[i].index, items[j].index];
        out.push(pair[0] < pair[1] ? pair : [pair[1], pair[0]]);
      }
    }
  }
  return out;
}

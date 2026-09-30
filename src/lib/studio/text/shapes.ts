// Formes planes du Studio (brief « Strates », §6.3.3 et §6.3.4, WP-02) :
// contours de plaques (rectangle arrondi, pilule, étiquette, goutte, pic),
// disques, cadres, et placement des glyphes d'une ligne de texte. Tout en mm,
// X vers la droite, Y vers le haut, objet centré sur l'origine. Les contours
// sont de simples listes de points (sens trigonométrique pour un extérieur) :
// `kernel/extrude.ts` les oriente, les nettoie et les triangule.
//
// JAMAIS de croix suisse ni d'armoiries (brief §6.3.4) ; la forme « pic » est un
// triangle arrondi générique, ni le mark de Swiss3Design ni une croix.
import {
  classifyRings,
  ringArea,
  ringPerimeter,
  type Polygon,
} from "../kernel/extrude";
import type { Vec2 } from "../kernel/simplify";
import { requireGlyphFont, type GlyphDetail, type GlyphFont } from "./glyphs";
import { codePoints, TRACKING_EM, type PlacedLine } from "./layout";

export type Ring = Vec2[];

/** Finesse des arcs : segments par quart de cercle (le maillage `export` est le plus fin). */
export type ShapeLod = "drag" | "display" | "export";

export const ARC_SEGMENTS: Record<ShapeLod, number> = {
  drag: 3,
  display: 6,
  export: 10,
};

/** Précision des glyphes selon le niveau de détail. */
export function glyphDetail(lod: ShapeLod): GlyphDetail {
  return lod === "drag" ? "coarse" : "fine";
}

/** Disque (cercle de `segments` côtés, sens trigonométrique, premier point à l'est). */
export function circleRing(
  cx: number,
  cy: number,
  r: number,
  segments: number,
): Ring {
  const ring: Ring = [];
  for (let i = 0; i < segments; i++) {
    const a = (i * 2 * Math.PI) / segments;
    ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return ring;
}

/** Arc de cercle de a0 à a1 (radians), points intermédiaires compris, `steps` segments. */
function arcPoints(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  steps: number,
): Ring {
  const out: Ring = [];
  for (let k = 0; k <= steps; k++) {
    const a = a0 + ((a1 - a0) * k) / steps;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/**
 * Rectangle [x0, x1] × [y0, y1] à coins arrondis de rayon `r` (0 : coins vifs),
 * `arcSegs` segments par quart de cercle. Le rayon est borné à la moitié du
 * petit côté : r = h / 2 donne une pilule.
 */
export function roundedRectRing(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  arcSegs: number,
): Ring {
  const radius = Math.min(Math.max(r, 0), (x1 - x0) / 2, (y1 - y0) / 2);
  if (radius < 1e-6) {
    return [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ];
  }
  const h = Math.PI / 2;
  return [
    ...arcPoints(x1 - radius, y0 + radius, radius, -h, 0, arcSegs),
    ...arcPoints(x1 - radius, y1 - radius, radius, 0, h, arcSegs),
    ...arcPoints(x0 + radius, y1 - radius, radius, h, 2 * h, arcSegs),
    ...arcPoints(x0 + radius, y0 + radius, radius, 2 * h, 3 * h, arcSegs),
  ];
}

/**
 * Polygone convexe aux coins arrondis (congés de rayon `r`, bornés au tiers des
 * arêtes voisines), sens trigonométrique. Sert au pic (triangle arrondi) et à
 * l'étiquette (rectangle à coin coupé).
 */
export function roundedPolygonRing(
  points: readonly Vec2[],
  r: number,
  arcSegs: number,
): Ring {
  const n = points.length;
  const out: Ring = [];
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const a = points[(i + n - 1) % n];
    const b = points[(i + 1) % n];
    const ux = a[0] - p[0];
    const uy = a[1] - p[1];
    const vx = b[0] - p[0];
    const vy = b[1] - p[1];
    const lu = Math.hypot(ux, uy);
    const lv = Math.hypot(vx, vy);
    const cos = (ux * vx + uy * vy) / (lu * lv);
    const theta = Math.acos(Math.min(1, Math.max(-1, cos)));
    const tanHalf = Math.tan(theta / 2);
    // Distance du sommet aux points de tangence.
    const t = Math.min(r / tanHalf, lu / 3, lv / 3);
    const radius = t * tanHalf;
    if (!(radius > 1e-6) || theta > Math.PI - 1e-3) {
      out.push([p[0], p[1]]);
      continue;
    }
    const t1: Vec2 = [p[0] + (ux / lu) * t, p[1] + (uy / lu) * t];
    const t2: Vec2 = [p[0] + (vx / lv) * t, p[1] + (vy / lv) * t];
    // Centre : sur la bissectrice, à `radius / sin(theta / 2)` du sommet.
    const bx = ux / lu + vx / lv;
    const by = uy / lu + vy / lv;
    const bl = Math.hypot(bx, by);
    const dist = radius / Math.sin(theta / 2);
    const cx = p[0] + (bx / bl) * dist;
    const cy = p[1] + (by / bl) * dist;
    const a0 = Math.atan2(t1[1] - cy, t1[0] - cx);
    let a1 = Math.atan2(t2[1] - cy, t2[0] - cx);
    // Contour trigonométrique, sommet convexe (produit vectoriel < 0) : le
    // centre est à gauche du sens de marche, l'arc tourne dans le sens trigo.
    const turn = ux * vy - uy * vx;
    if (turn < 0) {
      while (a1 < a0) a1 += 2 * Math.PI;
    } else {
      while (a1 > a0) a1 -= 2 * Math.PI;
    }
    const steps = Math.max(
      1,
      Math.round((Math.abs(a1 - a0) / (Math.PI / 2)) * arcSegs),
    );
    for (let k = 0; k <= steps; k++) {
      const a = a0 + ((a1 - a0) * k) / steps;
      out.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
    }
  }
  return out;
}

/** Enveloppe convexe (Andrew), sens trigonométrique. */
export function hullRing(points: readonly Vec2[]): Ring {
  const pts = points
    .map((p) => [p[0], p[1]] as Vec2)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Vec2, a: Vec2, b: Vec2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** Le contour, décalé de (dx, dy). */
export function translateRing(
  ring: readonly Vec2[],
  dx: number,
  dy: number,
): Ring {
  return ring.map((p) => [p[0] + dx, p[1] + dy] as Vec2);
}

/** Symétrie par rapport à la verticale x = `cx`, en gardant le sens trigonométrique. */
export function mirrorRingX(ring: readonly Vec2[], cx: number): Ring {
  return ring.map((p) => [2 * cx - p[0], p[1]] as Vec2).reverse();
}

/** Boîte [x0, y0, x1, y1] d'une liste de contours. */
export function ringsBox(
  rings: readonly (readonly Vec2[])[],
): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
  }
  return [x0, y0, x1, y1];
}

/** Aire (mm²) d'un polygone avec trous. */
export function polygonsArea(polygons: readonly Polygon[]): number {
  let area = 0;
  for (const p of polygons) {
    area += Math.abs(ringArea(p.outer));
    for (const h of p.holes ?? []) area -= Math.abs(ringArea(h));
  }
  return area;
}

/** Périmètre total (mm) des contours de polygones, trous compris. */
export function polygonsPerimeter(polygons: readonly Polygon[]): number {
  let length = 0;
  for (const p of polygons) {
    length += ringPerimeter(p.outer);
    for (const h of p.holes ?? []) length += ringPerimeter(h);
  }
  return length;
}

// ── Texte : des glyphes aux polygones ────────────────────────────────────────

/**
 * Polygones d'une ligne placée : chaque caractère à son échelle et à sa
 * position (chasse × échelle + 0,02 em, sans crénage). Les glyphes sont des
 * coques séparées (leurs contours ne se recoupent pas : test sur le jeu
 * complet) ; chacun garde ses trous (« o », « a », « e »).
 */
export function linePolygons(
  line: PlacedLine,
  lod: ShapeLod = "export",
  font?: GlyphFont | null,
): Polygon[] {
  const f = requireGlyphFont(font);
  const scale = line.capMm / f.capHeight;
  const tracking = TRACKING_EM * f.unitsPerEm * scale;
  const detail = glyphDetail(lod);
  const out: Polygon[] = [];
  let pen = line.x;
  for (const ch of codePoints(line.text)) {
    if (!f.has(ch)) continue;
    for (const glyph of f.polygons(ch, detail)) {
      const place = (ring: readonly Vec2[]): Ring =>
        ring.map((p) => [pen + p[0] * scale, line.y + p[1] * scale] as Vec2);
      out.push({
        outer: place(glyph.outer),
        holes: (glyph.holes ?? []).map(place),
      });
    }
    pen += f.advance(ch) * scale + tracking;
  }
  return out;
}

/** Polygones de plusieurs lignes, puis re-classés : un îlot de gravure reste un extérieur. */
export function linesPolygons(
  lines: readonly PlacedLine[],
  lod: ShapeLod = "export",
  font?: GlyphFont | null,
): Polygon[] {
  const all: Polygon[] = [];
  for (const line of lines) all.push(...linePolygons(line, lod, font));
  return all;
}

/** Tous les contours d'une liste de polygones (extérieurs puis trous). */
export function polygonRings(polygons: readonly Polygon[]): Ring[] {
  const rings: Ring[] = [];
  for (const p of polygons) {
    rings.push(p.outer as Ring);
    for (const h of p.holes ?? []) rings.push(h as Ring);
  }
  return rings;
}

/**
 * Région « plaque moins encre » : les contours de la plaque et ceux de l'encre
 * re-classés par inclusion (pair-impair) : les lettres deviennent des trous de
 * la plaque et les contrepoinçons (o, a, e…) des îlots qui restent en surface.
 * C'est la face du dessus d'une plaque gravée.
 */
export function plateMinusInk(
  plate: Polygon,
  ink: readonly Polygon[],
): Polygon[] {
  return classifyRings([
    plate.outer,
    ...(plate.holes ?? []),
    ...polygonRings(ink),
  ]);
}

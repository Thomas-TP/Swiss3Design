// Des glyphes aux polygones (brief « Strates », §6.3.3, WP-02) : place chaque
// caractère d'une ligne de texte à son échelle et à sa position, avec les
// contours de la police enregistrée (`setGlyphFont`). Ce module charge les
// contours : seuls le maillage (Worker, client, tests) l'importent, jamais les
// statistiques ni les garde-fous (qui passent par `geometry.ts` et les métriques).
import { classifyRings, type Polygon } from "../kernel/extrude";
import type { Vec2 } from "../kernel/simplify";
import { requireGlyphFont, type GlyphDetail, type GlyphFont } from "./glyphs";
import {
  codePoints,
  pairExtraUnits,
  TRACKING_EM,
  type PlacedLine,
} from "./layout";
import { polygonRings, type Ring, type ShapeLod } from "./geometry";

/** Précision des glyphes selon le niveau de détail. */
export function glyphDetail(lod: ShapeLod): GlyphDetail {
  return lod === "drag" ? "coarse" : "fine";
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
  let previous = "";
  for (const ch of codePoints(line.text)) {
    if (!f.has(ch)) continue;
    // Anticollision : le même espace supplémentaire que la mesure (layout.ts).
    if (previous) pen += pairExtraUnits(previous, ch) * scale;
    previous = ch;
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

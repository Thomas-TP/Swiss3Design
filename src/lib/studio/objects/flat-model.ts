// Modèle commun des objets plats à texte, Cartouche et Borne (brief « Strates »,
// §6.3.4) : une plaque (contour avec trous éventuels) portant de l'encre, c'est-
// à-dire des lettres et des formes (disque, cadre, filet) qui forment soit un
// RELIEF posé sur la plaque, soit une GRAVURE dans son épaisseur.
//
// Ce module n'a besoin d'aucun contour de glyphe : les lignes de texte sont
// placées et mesurées par la table de métriques (`text/layout.ts`), donc les
// statistiques et les garde-fous tournent en SSR comme côté client. Le maillage
// (`flat.ts`) pose ensuite les vrais contours aux positions calculées ici.
//
// Bandes de couleur (les trancheurs changent de filament à la couche) :
//   relief   : [{ plaque, t }, { encre, t + e }]
//   gravure  : [{ encre, t − e }, { plaque, t }]  (les lettres gravées révèlent
//              la couleur du dessous : incrustation par changement de hauteur)
import type { Polygon } from "../kernel/extrude";
import type { TextIssue } from "../text/check";
import { measureText, type PlacedLine } from "../text/layout";
import {
  polygonRings,
  polygonsArea,
  polygonsPerimeter,
  ringsBox,
} from "../text/geometry";
import type { Band, FilamentId } from "../types";

export type InkMode = "relief" | "gravure";

export interface FlatModel {
  object: "cartouche" | "borne";
  mode: InkMode;
  /** Silhouette de la plaque (mm), centrée sur l'origine : extérieur et trous (anneau du porte-nom). */
  outline: Polygon;
  /** Lignes de texte placées, capitales après ajustement. */
  lines: PlacedLine[];
  /** Formes d'encre qui ne sont pas du texte : disque, cadre, filet. */
  decor: Polygon[];
  /** Épaisseur de la plaque `t` et hauteur du relief ou profondeur de la gravure `e` (mm). */
  plateMm: number;
  inkMm: number;
  widthMm: number;
  depthMm: number;
  plate: FilamentId;
  ink: FilamentId;
  issues: TextIssue[];
}

/** Vrai s'il y a quelque chose à imprimer en encre : une ligne de texte, ou un disque, un cadre, un filet. */
export function hasInk(m: Pick<FlatModel, "lines" | "decor">): boolean {
  return m.lines.length > 0 || m.decor.length > 0;
}

/**
 * Hauteur totale de la pièce : plaque + relief, ou plaque seule pour une
 * gravure. Un relief sans aucune encre (pas de texte) reste à la hauteur de la
 * plaque : le maillage n'a rien à poser dessus.
 */
export function flatHeight(
  m: Pick<FlatModel, "mode" | "plateMm" | "inkMm" | "lines" | "decor">,
): number {
  return m.mode === "relief" && hasInk(m)
    ? Math.round((m.plateMm + m.inkMm) * 10) / 10
    : m.plateMm;
}

/**
 * Bandes de couleur dérivées de la plaque et du texte (§6.3.4). Un relief
 * sans encre n'a qu'une bande ; une gravure garde ses deux bandes (les couleurs
 * changent à `t − e` quoi qu'on grave, comme dans le maillage).
 */
export function flatBands(
  m: Pick<
    FlatModel,
    "mode" | "plateMm" | "inkMm" | "plate" | "ink" | "lines" | "decor"
  >,
): Band[] {
  const { plateMm: t, inkMm: e } = m;
  const round = (x: number) => Math.round(x * 10) / 10;
  if (m.mode === "relief") {
    return hasInk(m)
      ? [
          { filament: m.plate, toMm: round(t) },
          { filament: m.ink, toMm: round(t + e) },
        ]
      : [{ filament: m.plate, toMm: round(t) }];
  }
  return [
    { filament: m.ink, toMm: round(t - e) },
    { filament: m.plate, toMm: round(t) },
  ];
}

export interface FlatAnalysis {
  /** Aire de la plaque (mm², trous déduits) et aire d'encre (lettres + formes). */
  plateAreaMm2: number;
  inkAreaMm2: number;
  /** Volume de matière (mm³) et par bande, dans l'ordre de `flatBands`. */
  volumeMm3: number;
  bandVolumesMm3: [number, number];
  /** Surface extérieure (mm²) : sert à la coque pleine des objets épais. */
  surfaceMm2: number;
}

/** Aire, périmètre d'encre d'un modèle (formes exactes + texte par les métriques). */
export function inkMeasures(m: Pick<FlatModel, "lines" | "decor">): {
  area: number;
  perimeter: number;
} {
  let area = polygonsArea(m.decor);
  let perimeter = polygonsPerimeter(m.decor);
  for (const line of m.lines) {
    const meas = measureText(line.text);
    area += meas.areaPerCap2 * line.capMm * line.capMm;
    perimeter += meas.perimeterPerCap * line.capMm;
  }
  return { area, perimeter };
}

/** Analyse analytique : aires exactes des polygones, épaisseurs des dalles. */
export function analyzeFlat(m: FlatModel): FlatAnalysis {
  const plateArea = polygonsArea([m.outline]);
  const { area: ink, perimeter } = inkMeasures(m);
  const { plateMm: t, inkMm: e } = m;
  const outlinePerimeter = polygonsPerimeter([m.outline]);
  const volumes: [number, number] =
    m.mode === "relief"
      ? [plateArea * t, ink * e]
      : [plateArea * (t - e), (plateArea - ink) * e];
  return {
    plateAreaMm2: plateArea,
    inkAreaMm2: ink,
    volumeMm3: volumes[0] + volumes[1],
    bandVolumesMm3: volumes,
    surfaceMm2: 2 * plateArea + outlinePerimeter * t + perimeter * e,
  };
}

/** Boîte [x0, y0, x1, y1] de la plaque. */
export function flatBox(
  m: Pick<FlatModel, "outline">,
): [number, number, number, number] {
  return ringsBox(polygonRings([m.outline]));
}

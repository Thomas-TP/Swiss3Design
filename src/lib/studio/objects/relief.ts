// Maillage du sous-verre « Relief » (brief « Strates », §6.3.4). Le modèle
// (carte d'altitude, contours, étiquette) est dans `relief-model.ts` ; ici on
// extrude : le socle, puis chaque strate de `socle + (k − 1) × Δ` à
// `socle + k × Δ` (coques empilées, une par polygone de contour), puis
// l'étiquette de 0,6 mm sur la zone plate. Une dalle traversée par une
// frontière de bande est découpée à cette frontière (les couleurs changent à la
// couche). Nécessite la police des glyphes dès qu'une étiquette est tracée.
import { extrudePolygon, extrudeSlabs, type Slab } from "../kernel/extrude";
import { MeshBuilder } from "../kernel/mesh";
import type { GlyphFont } from "../text/glyphs";
import type { ShapeLod } from "../text/geometry";
import { linesPolygons } from "../text/shapes";
import type { MeshData, ReliefConfig, StudioTexts } from "../types";
import {
  bandOfSlab,
  LABEL_HEIGHT_MM,
  layoutRelief,
  reliefLevels,
  reliefOutline,
  RELIEF_GRID,
  type Locale,
} from "./relief-model";

export interface ReliefBuildOptions {
  lod: ShapeLod;
  separateBands?: boolean;
  font?: GlyphFont | null;
  /** Langue de l'étiquette (« POINTE » / « PIZ » / « PIZZO » / « MOUNT »), français par défaut. */
  locale?: Locale;
}

/** Dalles d'une extrusion de z0 à z1, découpées aux frontières de bande qui la traversent. */
function slabsBetween(
  bands: ReliefConfig["bands"],
  z0: number,
  z1: number,
): Slab[] {
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

export function buildRelief(
  config: ReliefConfig,
  texts: StudioTexts | undefined,
  options: ReliefBuildOptions,
): MeshData {
  const model = layoutRelief(config, texts, options.locale ?? "fr");
  const { tops, config: cfg } = model;
  const bands = cfg.bands;
  const b = new MeshBuilder(8192, 16384);
  extrudeSlabs(
    b,
    { outer: reliefOutline(cfg, options.lod) },
    slabsBetween(bands, 0, tops[0]),
  );
  const levels = reliefLevels(cfg, RELIEF_GRID[options.lod]);
  levels.forEach((polygons, k) => {
    const z0 = tops[k];
    const z1 = tops[k + 1];
    const band = bandOfSlab(bands, z0, z1);
    for (const polygon of polygons)
      extrudePolygon(b, polygon, z0, z1, { band });
  });
  const label = linesPolygons(model.lines, options.lod, options.font);
  const labelSlabs = slabsBetween(bands, tops[0], tops[0] + LABEL_HEIGHT_MM);
  for (const polygon of label) extrudeSlabs(b, polygon, labelSlabs);
  return b.build();
}

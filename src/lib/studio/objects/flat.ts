// Maillage d'une plaque portant de l'encre (Cartouche, Borne ; brief « Strates »,
// §6.3.4). Deux modes :
//
//  - RELIEF : la plaque (contour avec trous) extrudée de 0 à t, puis chaque
//    lettre et chaque forme extrudée de t à t + e, en coques séparées posées sur
//    la plaque (les trancheurs les unissent). Bandes : plaque, puis encre.
//  - GRAVURE sans CSG : une seule coque fermée. Les lettres sont des poches de
//    t − e à t ; leur fond (la couleur du dessous) est tracé à part. La plaque
//    se décompose en deux dalles : la basse, pleine (0 → t − e, bande de
//    l'encre), et la haute (t − e → t, bande de la plaque), percée des contours
//    des glyphes dont les contrepoinçons (o, a, e…) redeviennent des îlots.
//    `separateBands` (éclaté d'affichage) livre ces deux dalles en deux coques
//    fermées ; l'export, lui, recolle le fond des poches et n'a qu'une coque.
//
// Tous les sommets des parois et des faces viennent des mêmes contours
// nettoyés : la coque est fermée sans jonction en T (test de variété).
import {
  capPolygon,
  classifyRings,
  extrudePolygon,
  extrudeSlabs,
} from "../kernel/extrude";
import { MeshBuilder } from "../kernel/mesh";
import type { GlyphFont } from "../text/glyphs";
import type { ShapeLod } from "../text/geometry";
import { polygonRings } from "../text/geometry";
import { linesPolygons, plateMinusInk } from "../text/shapes";
import type { MeshData } from "../types";
import type { FlatModel } from "./flat-model";

export interface FlatBuildOptions {
  lod: ShapeLod;
  /** Éclaté d'affichage : une coque fermée par bande (jamais dans l'export). */
  separateBands?: boolean;
  /** Police des glyphes ; défaut : celle que le Worker a enregistrée. */
  font?: GlyphFont | null;
}

export function buildFlat(
  model: FlatModel,
  options: FlatBuildOptions,
): MeshData {
  const b = new MeshBuilder(4096, 8192);
  const t = model.plateMm;
  const e = model.inkMm;
  const ink = [
    ...model.decor,
    ...linesPolygons(model.lines, options.lod, options.font),
  ];

  if (model.mode === "relief") {
    extrudePolygon(b, model.outline, 0, t, { band: 0 });
    for (const polygon of ink)
      extrudePolygon(b, polygon, t, t + e, { band: 1 });
    return b.build();
  }

  const floor = t - e;
  if (ink.length === 0) {
    // Rien à graver : la dalle pleine, dans ses deux bandes (les couleurs
    // changent à t − e quoi qu'on grave).
    extrudeSlabs(b, model.outline, [
      { z0: 0, z1: floor, band: 0 },
      { z0: floor, z1: t, band: 1 },
    ]);
    return b.build();
  }
  const top = plateMinusInk(model.outline, ink);
  // L'éclaté est une vue : jamais dans l'export (une seule coque, comme le vase).
  if (options.separateBands && options.lod !== "export") {
    extrudePolygon(b, model.outline, 0, floor, { band: 0 });
    for (const polygon of top)
      extrudePolygon(b, polygon, floor, t, { band: 1 });
    return b.build();
  }
  // Une seule coque : parois de la dalle basse, dalle haute sans face du
  // dessous, fond des poches (vers le haut, dans la bande de l'encre).
  extrudeSlabs(b, model.outline, [{ z0: 0, z1: floor, band: 0 }], {
    topCap: false,
  });
  for (const polygon of top) {
    extrudeSlabs(b, polygon, [{ z0: floor, z1: t, band: 1 }], {
      bottomCap: false,
    });
  }
  for (const pocket of classifyRings(polygonRings(ink))) {
    capPolygon(b, pocket, floor, true, { band: 0 });
  }
  return b.build();
}

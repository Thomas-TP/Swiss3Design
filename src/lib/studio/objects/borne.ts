// Maillage du porte-nom « Borne » (brief « Strates », §6.3.4). Le modèle
// (contour, anneau, texte ajusté) est dans `borne-model.ts` ; ce module pose les
// contours des glyphes et extrude. Nécessite la police des glyphes dès qu'un
// texte est saisi (`GlyphsNotLoadedError` sinon).
import type { BorneConfig, MeshData, StudioTexts } from "../types";
import { buildFlat, type FlatBuildOptions } from "./flat";
import { layoutBorne } from "./borne-model";

export function buildBorne(
  config: BorneConfig,
  texts: StudioTexts | undefined,
  options: FlatBuildOptions,
): MeshData {
  return buildFlat(layoutBorne(config, texts, options.lod), options);
}

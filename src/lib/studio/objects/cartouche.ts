// Maillage de la carte « Cartouche » (brief « Strates », §6.3.4). Le modèle
// (mise en page, textes, aires) est dans `cartouche-model.ts` ; ce module pose
// les contours des glyphes et extrude. Nécessite la police des glyphes dès
// qu'un texte est saisi (`GlyphsNotLoadedError` sinon).
import type { CartoucheConfig, MeshData, StudioTexts } from "../types";
import { buildFlat, type FlatBuildOptions } from "./flat";
import { layoutCartouche } from "./cartouche-model";

export function buildCartouche(
  config: CartoucheConfig,
  texts: StudioTexts | undefined,
  options: FlatBuildOptions,
): MeshData {
  return buildFlat(layoutCartouche(config, texts, options.lod), options);
}

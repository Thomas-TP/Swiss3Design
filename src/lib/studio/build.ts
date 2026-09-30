// Point d'entrée unique de la géométrie du Studio : le Worker
// (src/motion/studio/geometry.worker.ts, WP-STUDIO), le SSR et les tests
// appellent ceci, jamais un générateur d'objet directement.
//
// Les objets à texte (Cartouche, Relief, Borne) ont besoin des contours des
// glyphes dès qu'un texte est saisi : le Worker charge `GLYPH_URL` une fois
// (`loadGlyphFont`, qui enregistre la police) ; sans elle, `buildStudioMesh`
// lève `GlyphsNotLoadedError` plutôt que de rendre un objet sans ses lettres.
import type { GlyphFont } from "./text/glyphs";
import { buildBorne } from "./objects/borne";
import { buildCartouche } from "./objects/cartouche";
import { buildLavaux, type LavauxBuildOptions } from "./objects/lavaux";
import { buildRelief } from "./objects/relief";
import type { Locale } from "./objects/relief-model";
import {
  stlFileName,
  stlHeader,
  studioHash,
  writeBinaryStl,
  type StlResult,
} from "./stl";
import type { MeshData, StudioConfig, StudioTexts } from "./types";

export interface BuildOptions extends LavauxBuildOptions {
  /** Police des glyphes ; défaut : celle que `loadGlyphFont` / `setGlyphFont` a enregistrée. */
  font?: GlyphFont | null;
  /** Langue de l'étiquette du sous-verre (« POINTE » / « PIZ » / « PIZZO » / « MOUNT »), français par défaut. */
  locale?: Locale;
}

/** Maillage d'une configuration au niveau de détail demandé (drag, display, export). */
export function buildStudioMesh(
  config: StudioConfig,
  texts: StudioTexts,
  options: BuildOptions,
): MeshData {
  switch (config.object) {
    case "lavaux":
      return buildLavaux(config, options);
    case "cartouche":
      return buildCartouche(config, texts, options);
    case "relief":
      return buildRelief(config, texts, options);
    case "borne":
      return buildBorne(config, texts, options);
  }
}

export interface ExportedStl extends StlResult {
  hash: string;
  fileName: string;
}

/**
 * Export STL (LOD `export`, jamais de bouchons d'éclaté) : `84 + 50 × n`
 * octets, en-tête `Swiss3Design Studio v1 <objet> <hash8>`.
 */
export function exportStl(
  config: StudioConfig,
  texts: StudioTexts = {},
  options: Pick<BuildOptions, "font" | "locale"> = {},
): ExportedStl {
  const mesh = buildStudioMesh(config, texts, { ...options, lod: "export" });
  const hash = studioHash(config, texts, options.locale);
  const stl = writeBinaryStl(mesh, stlHeader(config.object, hash));
  return { ...stl, hash, fileName: stlFileName(config, hash) };
}

// Point d'entrée unique de la géométrie du Studio : le Worker
// (src/motion/studio/geometry.worker.ts, WP-STUDIO), le SSR et les tests
// appellent ceci, jamais un générateur d'objet directement. Les générateurs de
// Cartouche, Relief et Borne (WP-02) s'y branchent ; en attendant ils lèvent
// plutôt que de rendre un maillage vide.
import { buildLavaux, type LavauxBuildOptions } from "./objects/lavaux";
import {
  stlFileName,
  stlHeader,
  studioHash,
  writeBinaryStl,
  type StlResult,
} from "./stl";
import type { MeshData, StudioConfig, StudioTexts } from "./types";

export type BuildOptions = LavauxBuildOptions;

/** Maillage d'une configuration au niveau de détail demandé (drag, display, export). */
export function buildStudioMesh(
  config: StudioConfig,
  texts: StudioTexts,
  options: BuildOptions,
): MeshData {
  void texts;
  if (config.object === "lavaux") return buildLavaux(config, options);
  throw new Error(`buildStudioMesh : « ${config.object} » est livré par WP-02`);
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
): ExportedStl {
  const mesh = buildStudioMesh(config, texts, { lod: "export" });
  const hash = studioHash(config, texts);
  const stl = writeBinaryStl(mesh, stlHeader(config.object, hash));
  return { ...stl, hash, fileName: stlFileName(config, hash) };
}

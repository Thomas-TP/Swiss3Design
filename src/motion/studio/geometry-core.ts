// Cœur du Worker de géométrie du Studio, SANS les API de Worker : une fonction
// par message, qui prend une requête et rend la réponse. Le Worker
// (geometry.worker.ts) n'est qu'un fil de messages autour ; le repli sur le fil
// principal (worker-client.ts, quand un Worker ne peut pas être créé) appelle
// les mêmes fonctions ; les tests aussi. Importe `src/lib/studio/**` (pur
// TypeScript) : aucun three, aucun DOM.
//
// Les glyphes (≈ 124 Ko de JSON, ≤ 45 Ko gzip) sont chargés à la demande, une
// seule fois, dès qu'un objet à texte est construit : le vase n'en a jamais
// besoin (brief §4.11).
import { bandStatsFor } from "@/lib/studio/band-stats";
import { buildStudioMesh, exportStl } from "@/lib/studio/build";
import { PRICING } from "@/lib/studio/pricing-params";
import { sanitizeTexts } from "@/lib/studio/text/fields";
import {
  GLYPH_URL,
  getGlyphFont,
  loadGlyphFont,
} from "@/lib/studio/text/glyphs";
import type { StudioConfig, StudioTexts } from "@/lib/studio/types";
import {
  StudioWorkerError,
  type BuildJob,
  type BuiltMesh,
  type ExportedFile,
} from "./protocol";

let glyphsPending: Promise<void> | null = null;

/**
 * Charge les glyphes une fois. La police enregistrée fait foi ; la promesse
 * n'est gardée que pendant le chargement (deux constructions simultanées
 * n'envoient qu'une requête), un échec réseau n'est jamais mémorisé.
 */
export function ensureGlyphs(url: string = GLYPH_URL): Promise<void> {
  if (getGlyphFont()) return Promise.resolve();
  glyphsPending ??= loadGlyphFont(url)
    .then(() => undefined)
    .catch((error: unknown) => {
      throw new StudioWorkerError(
        "glyphs",
        error instanceof Error ? error.message : String(error),
      );
    })
    .finally(() => {
      glyphsPending = null;
    });
  return glyphsPending;
}

const needsGlyphs = (config: StudioConfig, texts: StudioTexts) =>
  config.object !== "lavaux" &&
  Object.keys(sanitizeTexts(config.object, texts)).length > 0;

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

/**
 * Niveau de détail du générateur pour une construction d'affichage. `fine` en
 * C2 prend le maillage d'export (arêtes lisses : jusqu'à 360 segments et des
 * anneaux resserrés là où le motif change vite) ; en C1 il monte seulement à la
 * définition C2, que la mémoire d'un mobile supporte sans souci.
 */
export function generatorLevel(job: Pick<BuildJob, "lod" | "tier">): {
  lod: "drag" | "display" | "export";
  tier: 1 | 2;
} {
  if (job.lod !== "fine") return { lod: job.lod, tier: job.tier };
  return job.tier === 2
    ? { lod: "export", tier: 2 }
    : { lod: "display", tier: 2 };
}

export async function runBuild(job: BuildJob): Promise<BuiltMesh> {
  const texts = sanitizeTexts(job.config.object, job.texts);
  if (needsGlyphs(job.config, texts)) await ensureGlyphs();
  const start = now();
  try {
    const level = generatorLevel(job);
    const mesh = buildStudioMesh(job.config, texts, {
      lod: level.lod,
      tier: level.tier,
      separateBands: job.separate,
      locale: job.locale,
    });
    const summary = bandStatsFor(job.config, texts, PRICING, job.locale);
    const bands = summary.bands.map((b) => ({
      filament: b.filament,
      toMm: b.toMm,
    }));
    return {
      mesh,
      ms: Math.round((now() - start) * 10) / 10,
      bands,
      heightMm: bands.length > 0 ? bands[bands.length - 1].toMm : mesh.bbox[5],
    };
  } catch (error) {
    if (error instanceof StudioWorkerError) throw error;
    throw new StudioWorkerError(
      "build",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function runExport(
  config: StudioConfig,
  rawTexts: StudioTexts,
  locale: BuildJob["locale"],
): Promise<ExportedFile> {
  const texts = sanitizeTexts(config.object, rawTexts);
  if (needsGlyphs(config, texts)) await ensureGlyphs();
  const start = now();
  try {
    const stl = exportStl(config, texts, { locale });
    return {
      buffer: stl.buffer,
      triangles: stl.triangles,
      bytes: stl.bytes,
      ms: Math.round((now() - start) * 10) / 10,
      hash: stl.hash,
      fileName: stl.fileName,
    };
  } catch (error) {
    if (error instanceof StudioWorkerError) throw error;
    throw new StudioWorkerError(
      "export",
      error instanceof Error ? error.message : String(error),
    );
  }
}

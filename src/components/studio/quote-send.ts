import { track as trackEvent } from "@/lib/analytics";
import { motionBridge } from "@/lib/motion-bridge/store";
import type { BridgeStudio } from "@/lib/motion-bridge/types";
import { uploadQuoteFile } from "@/lib/quote-upload-client";
import { studioHash, stlFileName } from "@/lib/studio/stl";
import type {
  StudioConfig,
  StudioObjectId,
  StudioTexts,
} from "@/lib/studio/types";
import {
  readCachedUpload,
  uploadHash,
  writeCachedUpload,
  type CachedUpload,
} from "./upload-cache";

// Préparation du fichier de la demande (brief « Strates », §6.9, points 2 et 3) :
// « 1/3 Préparation du fichier » (le Worker écrit le STL du maillage `export`),
// « 2/3 Envoi à l'atelier » (XHR, progression) ; la 3e étape, l'enregistrement
// de la demande, est la Server Action du formulaire partagé. Appelée par
// `attachment.prepare` du formulaire : son résultat y est gardé, et ce module
// garde le sien (upload-cache.ts, 24 h) : une configuration inchangée ne
// repart jamais, un « Réessayer » après une erreur de la Server Action non plus.
//
// Aucun texte saisi dans l'événement `Studio Sent` : l'objet, le nombre de
// bandes, la taille du fichier et, si elle est affichée, l'estimation (§4.10).

/** Erreur dont le message est déjà rédigé pour le visiteur (convention de quote-logic.ts). */
export class StudioSendError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string) {
    super(userMessage);
    this.name = "StudioSendError";
    this.userMessage = userMessage;
  }
}

export interface PreparedFile {
  key: string;
  name: string;
  bytes: number;
  triangles: number;
}

export interface PrepareProgress {
  phase: "prepare" | "upload";
  loaded?: number;
  total?: number;
  triangles?: number;
}

export interface PrepareInput {
  config: StudioConfig;
  /** Textes SAISIS (jamais les exemples). */
  texts: StudioTexts;
  locale: string;
  object: StudioObjectId;
  bands: number;
  estimate?: { lowCents: number; highCents: number } | null;
  messages: { engine: string; export: string };
  onProgress: (progress: PrepareProgress) => void;
}

export interface PrepareDeps {
  engine: (timeoutMs: number) => Promise<BridgeStudio | null>;
  upload: typeof uploadQuoteFile;
  track: typeof trackEvent;
  readCached: typeof readCachedUpload;
  writeCached: typeof writeCachedUpload;
  engineTimeoutMs: number;
}

/** Le moteur du Studio (export STL), attendu au plus `timeoutMs` : il se charge après l'hydratation. */
export function waitForEngine(timeoutMs: number): Promise<BridgeStudio | null> {
  const ready = motionBridge.get().studio;
  if (ready) return Promise.resolve(ready);
  return new Promise((resolve) => {
    const off = motionBridge.subscribe(() => {
      const studio = motionBridge.get().studio;
      if (!studio) return;
      window.clearTimeout(timer);
      off();
      resolve(studio);
    });
    const timer = window.setTimeout(() => {
      off();
      resolve(motionBridge.get().studio);
    }, timeoutMs);
  });
}

const DEFAULT_DEPS: PrepareDeps = {
  engine: waitForEngine,
  upload: uploadQuoteFile,
  track: trackEvent,
  readCached: readCachedUpload,
  writeCached: writeCachedUpload,
  engineTimeoutMs: 10_000,
};

/** Empreinte et nom de fichier d'un envoi : `s3d-lavaux-<hash8>.stl`. */
export function uploadName(
  config: StudioConfig,
  texts: StudioTexts,
  locale: string,
): string {
  return stlFileName(config, studioHash(config, texts, locale));
}

/**
 * Exporte (Worker) puis envoie (XHR) le STL de la configuration ; réutilise un
 * envoi déjà fait pour la même empreinte. Lève une QuoteUploadError (429, 413,
 * 415, 400, réseau : messages prêts dans `quote.errors`) ou une StudioSendError.
 */
export async function prepareStudioFile(
  input: PrepareInput,
  deps: Partial<PrepareDeps> = {},
): Promise<PreparedFile> {
  const d = { ...DEFAULT_DEPS, ...deps };
  const hash = uploadHash(input.config, input.texts, input.locale);
  const cached: CachedUpload | null = d.readCached(hash);
  if (cached) {
    return {
      key: cached.key,
      name: cached.name,
      bytes: cached.bytes,
      triangles: cached.triangles,
    };
  }

  input.onProgress({ phase: "prepare" });
  const engine = await d.engine(d.engineTimeoutMs);
  if (!engine) throw new StudioSendError(input.messages.engine);
  const name = uploadName(input.config, input.texts, input.locale);
  let exported: Awaited<ReturnType<BridgeStudio["exportStl"]>>;
  try {
    exported = await engine.exportStl(input.config, input.texts, name);
  } catch (error) {
    console.error("[studio] export impossible", error);
    throw new StudioSendError(input.messages.export);
  }
  input.onProgress({ phase: "prepare", triangles: exported.triangles });

  const uploaded = await d.upload(
    exported.blob,
    (progress) =>
      input.onProgress({
        phase: "upload",
        loaded: progress.loaded,
        total: progress.total,
      }),
    { fileName: name },
  );

  d.writeCached(hash, {
    key: uploaded.key,
    name,
    bytes: exported.bytes,
    triangles: exported.triangles,
    at: Date.now(),
  });
  d.track("Studio Sent", {
    object: input.object,
    bands: input.bands,
    triangles: exported.triangles,
    bytes: exported.bytes,
    ...(input.estimate
      ? {
          estimate_low: input.estimate.lowCents / 100,
          estimate_high: input.estimate.highCents / 100,
        }
      : {}),
  });
  return {
    key: uploaded.key,
    name,
    bytes: exported.bytes,
    triangles: exported.triangles,
  };
}

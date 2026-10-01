// Client du Worker de géométrie du Studio (brief « Strates », §6.11, §9.2) :
// UN Worker pour la page, partagé par la scène `studio-object` (affichage) et le
// moteur (export STL). Chaque appel reçoit un `id` ; la réponse correspondante
// résout la promesse. Le client ne décide pas de ce qui est périmé : la scène le
// fait (un seul calcul en vol, le plus récent après lui), ici on ne perd rien.
//
// Le singleton est posé sur `globalThis` : la scène et le moteur sont deux
// chunks, et un bundler qui dupliquerait ce module ferait démarrer deux Workers
// (deux fois les glyphes, deux fois la mémoire).
//
// Repli : si un Worker ne peut pas démarrer (script bloqué, navigateur
// ancien), les mêmes fonctions tournent sur le fil principal (geometry-core).
// Plus lent (le glissé saccade), mais le Studio, l'export et le devis restent
// utilisables : la 3D n'est pas la seule voie vers la commande.
import { GLYPH_URL } from "@/lib/studio/text/glyphs";
import type { StudioLocale } from "@/components/studio/scene-props";
import type { StudioConfig, StudioTexts } from "@/lib/studio/types";
import {
  StudioWorkerError,
  type BuildJob,
  type BuiltMesh,
  type ExportedFile,
  type FromWorker,
  type ToWorker,
} from "./protocol";

export interface StudioWorkerClient {
  build(job: BuildJob): Promise<BuiltMesh>;
  exportStl(
    config: StudioConfig,
    texts: StudioTexts,
    name: string,
    locale: StudioLocale,
  ): Promise<ExportedFile>;
  /** Charge les glyphes d'avance (objets à texte) ; sans effet pour le vase. */
  preloadGlyphs(): void;
}

interface Pending {
  resolve(value: BuiltMesh | ExportedFile): void;
  reject(error: unknown): void;
}

const KEY = "__s3dStudioWorkerClient";

function create(): StudioWorkerClient {
  let worker: Worker | null = null;
  let failed = false;
  let seq = 0;
  const pending = new Map<number, Pending>();

  function failAll(error: StudioWorkerError) {
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  }

  function start(): Worker | null {
    if (worker || failed) return worker;
    try {
      const next = new Worker(new URL("./geometry.worker.ts", import.meta.url), {
        type: "module",
      });
      next.onmessage = (event: MessageEvent<FromWorker>) => {
        const message = event.data;
        if (message.t === "glyphs") return;
        const entry = pending.get(message.id);
        if (!entry) return;
        pending.delete(message.id);
        if (message.t === "error")
          entry.reject(new StudioWorkerError(message.code, message.message));
        else if (message.t === "mesh")
          entry.resolve({
            mesh: message.mesh,
            ms: message.ms,
            bands: message.bands,
            heightMm: message.heightMm,
          });
        else
          entry.resolve({
            buffer: message.buffer,
            triangles: message.triangles,
            bytes: message.bytes,
            ms: message.ms,
            hash: message.hash,
            fileName: message.fileName,
          });
      };
      next.onerror = (event) => {
        // Script introuvable ou bloqué : on bascule sur le fil principal.
        event.preventDefault?.();
        failed = true;
        worker = null;
        next.terminate();
        failAll(new StudioWorkerError("build", "worker-unavailable"));
      };
      worker = next;
    } catch {
      failed = true;
    }
    return worker;
  }

  function post<T extends BuiltMesh | ExportedFile>(
    make: (id: number) => ToWorker,
  ): Promise<T> | null {
    const target = start();
    if (!target) return null;
    const id = ++seq;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, {
        resolve: resolve as Pending["resolve"],
        reject,
      });
      try {
        target.postMessage(make(id));
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  }

  /** Une requête déjà en vol quand le Worker meurt : on la rejoue sur le fil principal. */
  async function withFallback<T extends BuiltMesh | ExportedFile>(
    viaWorker: () => Promise<T> | null,
    inline: () => Promise<T>,
  ): Promise<T> {
    const first = viaWorker();
    if (!first) return inline();
    try {
      return await first;
    } catch (error) {
      if (
        failed &&
        error instanceof StudioWorkerError &&
        error.message === "worker-unavailable"
      )
        return inline();
      throw error;
    }
  }

  return {
    build(job) {
      return withFallback<BuiltMesh>(
        () => post<BuiltMesh>((id) => ({ t: "build", id, ...job })),
        async () => (await import("./geometry-core")).runBuild(job),
      );
    },
    exportStl(config, texts, name, locale) {
      return withFallback<ExportedFile>(
        () =>
          post<ExportedFile>((id) => ({
            t: "export",
            id,
            config,
            texts,
            name,
            locale,
          })),
        async () =>
          (await import("./geometry-core")).runExport(config, texts, locale),
      );
    },
    preloadGlyphs() {
      const target = start();
      if (target) target.postMessage({ t: "glyphs", url: GLYPH_URL } satisfies ToWorker);
      else void import("./geometry-core").then((core) => core.ensureGlyphs()).catch(() => {});
    },
  };
}

/** Le client unique de la page. */
export function getStudioWorker(): StudioWorkerClient {
  const holder = globalThis as unknown as Record<string, StudioWorkerClient>;
  holder[KEY] ??= create();
  return holder[KEY];
}

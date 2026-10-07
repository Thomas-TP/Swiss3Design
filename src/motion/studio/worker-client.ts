// Client du Worker de géométrie du Studio (brief « Strates », §6.11, §9.2) :
// les Workers de la page, partagés par la scène `studio-object` (affichage) et
// le moteur (export STL). Chaque appel reçoit un `id` ; la réponse correspondante
// résout la promesse. Le client ne décide pas de ce qui est périmé : la scène le
// fait (un seul calcul en vol par voie, le plus récent après lui), ici on ne
// perd rien.
//
// Deux voies, deux Workers : la voie `main` sert les gestes (basse définition,
// définition d'affichage) et l'export ; la voie `fine` ne sert que le maillage
// fin du repos (jusqu'à ≈ 200 k triangles, 30 à 300 ms selon la machine). Un
// seul Worker ferait attendre le geste suivant derrière ce calcul ; deux, il ne
// l'attend jamais. Le second ne démarre qu'à la première demande fine.
//
// Les singletons sont posés sur `globalThis` : la scène et le moteur sont deux
// chunks, et un bundler qui dupliquerait ce module ferait démarrer deux fois
// chaque Worker (deux fois les glyphes, deux fois la mémoire).
//
// Repli : si un Worker ne peut pas démarrer (script bloqué, navigateur
// ancien), les mêmes fonctions tournent sur le fil principal (geometry-core).
// Plus lent (le glissé saccade), mais le Studio, l'export et le devis restent
// utilisables : la 3D n'est pas la seule voie vers la commande. Le maillage
// fin, lui, n'a pas de repli : sans second Worker on garde l'affichage.
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

type LaneName = "main" | "fine";

interface Lane {
  worker: Worker | null;
  failed: boolean;
}

interface Pending {
  lane: LaneName;
  resolve(value: BuiltMesh | ExportedFile): void;
  reject(error: unknown): void;
}

const KEY = "__s3dStudioWorkerClient";

function create(): StudioWorkerClient {
  const lanes: Record<LaneName, Lane> = {
    main: { worker: null, failed: false },
    fine: { worker: null, failed: false },
  };
  let seq = 0;
  const pending = new Map<number, Pending>();

  function failLane(lane: LaneName, error: StudioWorkerError) {
    for (const [id, entry] of Array.from(pending)) {
      if (entry.lane !== lane) continue;
      pending.delete(id);
      entry.reject(error);
    }
  }

  function onMessage(event: MessageEvent<FromWorker>) {
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
  }

  function start(name: LaneName): Worker | null {
    const lane = lanes[name];
    if (lane.worker || lane.failed) return lane.worker;
    try {
      const next = new Worker(
        new URL("./geometry.worker.ts", import.meta.url),
        {
          type: "module",
        },
      );
      next.onmessage = onMessage;
      next.onerror = (event) => {
        // Script introuvable ou bloqué : cette voie bascule sur le fil principal.
        event.preventDefault?.();
        lane.failed = true;
        lane.worker = null;
        next.terminate();
        failLane(name, new StudioWorkerError("build", "worker-unavailable"));
      };
      lane.worker = next;
    } catch {
      lane.failed = true;
    }
    return lane.worker;
  }

  function post<T extends BuiltMesh | ExportedFile>(
    name: LaneName,
    make: (id: number) => ToWorker,
  ): Promise<T> | null {
    const target = start(name);
    if (!target) return null;
    const id = ++seq;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, {
        lane: name,
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
    name: LaneName,
    viaWorker: () => Promise<T> | null,
    inline: () => Promise<T>,
  ): Promise<T> {
    const first = viaWorker();
    if (!first) return inline();
    try {
      return await first;
    } catch (error) {
      if (
        lanes[name].failed &&
        error instanceof StudioWorkerError &&
        error.message === "worker-unavailable"
      )
        return inline();
      throw error;
    }
  }

  return {
    build(job) {
      const lane: LaneName = job.lod === "fine" ? "fine" : "main";
      return withFallback<BuiltMesh>(
        lane,
        () => post<BuiltMesh>(lane, (id) => ({ t: "build", id, ...job })),
        async () => {
          // Le fil principal ne calcule jamais le maillage fin : on garde l'affichage.
          if (lane === "fine")
            throw new StudioWorkerError("build", "fine-unavailable");
          return (await import("./geometry-core")).runBuild(job);
        },
      );
    },
    exportStl(config, texts, name, locale) {
      return withFallback<ExportedFile>(
        "main",
        () =>
          post<ExportedFile>("main", (id) => ({
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
      const target = start("main");
      if (target)
        target.postMessage({ t: "glyphs", url: GLYPH_URL } satisfies ToWorker);
      else
        void import("./geometry-core")
          .then((core) => core.ensureGlyphs())
          .catch(() => {});
    },
  };
}

/** Le client unique de la page. */
export function getStudioWorker(): StudioWorkerClient {
  const holder = globalThis as unknown as Record<string, StudioWorkerClient>;
  holder[KEY] ??= create();
  return holder[KEY];
}

// Estimation du poids d'un fichier 3D, DANS LE NAVIGATEUR (rien n'est envoyé pour
// cela) : STL, OBJ et 3MF par un Web Worker maison (worker.ts), STEP et STP par
// occt-import-js (OpenCascade en WebAssembly) dans un Web Worker classique servi
// depuis public/vendor/occt/ : ni l'un ni l'autre dans le Worker Cloudflare (règle
// d'or 10). Aucun import de three, gsap ou lenis (règle d'or 11).
//
// Échec (fichier illisible, mémoire, délai de 20 s dépassé) : AUCUNE estimation
// inventée ; le formulaire montre un message clair et n'envoie pas la demande.
import { estimateFromMesh, type EstimateIssue } from "./estimate";
import type { MeshStats } from "./geometry";
import type { MeshResponse } from "./worker";

export const ESTIMATE_TIMEOUT_MS = 20_000;

export type EstimateFailure =
  | "unsupported"
  | "unreadable"
  | "timeout"
  /** Maillage vide ou volume nul. */
  | "empty"
  /** Plus petit que 2 mm : unité probablement fausse. */
  | "tiny";

export type EstimateResult =
  | {
      ok: true;
      /** Grammes d'UNE pièce, valeur brute (affichée au client). */
      grams: number;
      issue: EstimateIssue | null;
      stats: MeshStats;
      format: "mesh" | "step";
      /** STEP : ses triangles en mm (aperçu 3D), convertis une seule fois. */
      positions?: Float32Array;
    }
  | { ok: false; reason: EstimateFailure; format: "mesh" | "step" };

const STEP_WORKER = "/vendor/occt/occt-step-worker.js";

export const isStepName = (name: string) => /\.(?:step|stp)$/i.test(name);
const isMeshName = (name: string) => /\.(?:stl|obj|3mf)$/i.test(name);

type StepResponse =
  | {
      id: number;
      ok: true;
      volumeMm3: number;
      areaMm2: number;
      bbox: MeshStats["bbox"];
      triangles: number;
      positions?: Float32Array;
    }
  | { id: number; ok: false; reason: "unreadable" };

/** Envoie un tampon à un Worker et attend sa réponse, au plus `timeoutMs`. */
function run<R extends { id: number }>(
  worker: Worker,
  message: object,
  transfer: Transferable[],
  timeoutMs: number,
): Promise<R | "timeout" | "failed"> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      worker.terminate();
      resolve("timeout");
    }, timeoutMs);
    worker.onmessage = (event: MessageEvent<R>) => {
      window.clearTimeout(timer);
      resolve(event.data);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      window.clearTimeout(timer);
      resolve("failed");
    };
    worker.postMessage(message, transfer);
  });
}

export async function estimateFile(
  file: File,
  timeoutMs = ESTIMATE_TIMEOUT_MS,
): Promise<EstimateResult> {
  const step = isStepName(file.name);
  const format = step ? "step" : "mesh";
  if (!step && !isMeshName(file.name))
    return { ok: false, reason: "unsupported", format };
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return { ok: false, reason: "unreadable", format };
  }
  let worker: Worker;
  try {
    worker = step
      ? new Worker(STEP_WORKER)
      : new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  } catch {
    return { ok: false, reason: "unreadable", format };
  }
  try {
    const answer = await run<MeshResponse | StepResponse>(
      worker,
      // STEP : les triangles reviennent aussi, pour l'aperçu 3D.
      { id: 1, name: file.name, buffer, mesh: step },
      [buffer],
      timeoutMs,
    );
    if (answer === "timeout") return { ok: false, reason: "timeout", format };
    if (answer === "failed" || !answer.ok)
      return { ok: false, reason: "unreadable", format };
    const stats: MeshStats =
      "stats" in answer
        ? answer.stats
        : {
            volumeMm3: answer.volumeMm3,
            areaMm2: answer.areaMm2,
            bbox: answer.bbox,
            triangles: answer.triangles,
          };
    const estimate = estimateFromMesh(stats);
    if (estimate.blocking)
      return {
        ok: false,
        reason: estimate.issue === "tiny" ? "tiny" : "empty",
        format,
      };
    return {
      ok: true,
      grams: estimate.grams,
      issue: estimate.issue,
      stats,
      format,
      positions: "positions" in answer ? answer.positions : undefined,
    };
  } finally {
    worker.terminate();
  }
}

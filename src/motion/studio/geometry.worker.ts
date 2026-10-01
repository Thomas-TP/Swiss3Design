// Worker de géométrie du Studio (brief « Strates », §6.11) : tout le calcul des
// maillages (display, éclaté) et de l'export STL hors du fil principal. Un fil de
// messages autour de geometry-core.ts ; les `Float32Array` / `Uint32Array` sont
// TRANSFÉRÉS (aucune copie). Les réponses portent l'`id` de la requête : le
// client ignore les périmées.
//
// Les requêtes sont servies une à une, dans l'ordre : le client n'en garde
// qu'une en vol par canal (la scène recoupe les glissés, voir studio-object.ts).
import { StudioWorkerError, type FromWorker, type ToWorker } from "./protocol";
import { ensureGlyphs, runBuild, runExport } from "./geometry-core";

interface WorkerScope {
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
  postMessage(message: FromWorker, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;

const codeOf = (error: unknown, fallback: "build" | "export") =>
  error instanceof StudioWorkerError ? error.code : fallback;
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Tampons à transférer, sans doublon (un doublon lève DataCloneError). */
function uniqueBuffers(
  ...arrays: (ArrayBufferView | undefined)[]
): Transferable[] {
  const seen = new Set<ArrayBufferLike>();
  for (const array of arrays) if (array) seen.add(array.buffer);
  return [...seen].filter(
    (buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer,
  );
}

scope.onmessage = async (event) => {
  const message = event.data;
  switch (message.t) {
    case "glyphs": {
      try {
        await ensureGlyphs(message.url);
        scope.postMessage({ t: "glyphs", ok: true });
      } catch (error) {
        scope.postMessage({
          t: "glyphs",
          ok: false,
          message: messageOf(error),
        });
      }
      return;
    }
    case "build": {
      try {
        const built = await runBuild(message);
        scope.postMessage(
          { t: "mesh", id: message.id, ...built },
          uniqueBuffers(
            built.mesh.positions,
            built.mesh.normals,
            built.mesh.indices,
            built.mesh.side,
          ),
        );
      } catch (error) {
        scope.postMessage({
          t: "error",
          id: message.id,
          code: codeOf(error, "build"),
          message: messageOf(error),
        });
      }
      return;
    }
    case "export": {
      try {
        const file = await runExport(
          message.config,
          message.texts,
          message.locale,
        );
        scope.postMessage({ t: "stl", id: message.id, ...file }, [file.buffer]);
      } catch (error) {
        scope.postMessage({
          t: "error",
          id: message.id,
          code: codeOf(error, "export"),
          message: messageOf(error),
        });
      }
      return;
    }
  }
};

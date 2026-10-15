// Web Worker (module) de l'estimation du poids : lit un STL, OBJ ou 3MF hors du
// fil principal, sans jamais le garder. Voir client.ts.
import { meshFormatOf, parseMesh } from "./formats";
import type { MeshStats } from "./geometry";

export interface MeshRequest {
  id: number;
  name: string;
  buffer: ArrayBuffer;
}

export type MeshResponse =
  | { id: number; ok: true; stats: MeshStats }
  | { id: number; ok: false; reason: "unreadable" | "unsupported" };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<MeshRequest>) => void) | null;
  postMessage: (message: MeshResponse) => void;
};

scope.onmessage = async (event) => {
  const { id, name, buffer } = event.data;
  const post = (message: MeshResponse) => scope.postMessage(message);
  const format = meshFormatOf(name);
  if (!format) return post({ id, ok: false, reason: "unsupported" });
  try {
    const stats = await parseMesh(format, buffer);
    post(
      stats ? { id, ok: true, stats } : { id, ok: false, reason: "unreadable" },
    );
  } catch {
    post({ id, ok: false, reason: "unreadable" });
  }
};

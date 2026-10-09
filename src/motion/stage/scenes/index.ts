// Registre des scènes du Stage (brief « Strates », §4.4) : quatre scènes v1,
// un chunk chacune, chargé à la première vue qui le demande. Chaque package a
// livré le fichier de sa scène sans toucher à ce registre (la scène témoin de
// WP-00 a été retirée par WP-99).
import type { SceneId } from "@/lib/motion-bridge/types";
import type { SceneModule } from "../types";

export const SCENES: Record<SceneId, () => Promise<SceneModule<unknown>>> = {
  "print-hero": () => import("./print-hero"),
  "contour-field": () => import("./contour-field"),
  "studio-object": () => import("./studio-object"),
  "product-viewer": () => import("./product-viewer"),
};

// Un module par scène, partagé par toutes ses vues et par le service bake.
const loaded = new Map<SceneId, Promise<SceneModule<unknown>>>();

export function loadScene(id: SceneId): Promise<SceneModule<unknown>> {
  let pending = loaded.get(id);
  if (!pending) {
    pending = SCENES[id]();
    // Échec réseau : on pourra réessayer à la prochaine vue.
    pending.catch(() => loaded.delete(id));
    loaded.set(id, pending);
  }
  return pending;
}

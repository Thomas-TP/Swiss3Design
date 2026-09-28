// STUB de WP-00 (brief « Strates », §4.4, §9.2) : l'objet du Studio et du
// chapitre 02 de l'accueil. Remplacé par WP-STUDIO, qui prend la propriété de
// ce fichier (maillages construits par le Worker partagé,
// src/motion/studio/worker-client.ts). Tant que c'est un stub, le poster SSR
// reste visible en production (holdPoster) : l'accueil fonctionne sans elle.
import type { StudioObjectViewProps } from "@/lib/motion-bridge/types";
import type { SceneModule } from "../types";
import { createStubScene } from "./stub-cube";

const create: SceneModule<StudioObjectViewProps>["default"] = (ctx) =>
  createStubScene(ctx, { print: true });

export default create;

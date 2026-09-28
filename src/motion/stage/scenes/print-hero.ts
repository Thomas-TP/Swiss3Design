// STUB de WP-00 (brief « Strates », §4.4, §5.3) : l'impression réglable du
// héros et l'éclaté du chapitre 01. Remplacé par WP-HOME, qui prend la
// propriété de ce fichier (contrôleur PrintHeroController). Tant que c'est un
// stub, le poster SSR reste visible en production (holdPoster).
import type { SceneModule } from "../types";
import { createStubScene } from "./stub-cube";

const create: SceneModule<unknown>["default"] = (ctx) =>
  createStubScene(ctx, { print: true });

export default create;

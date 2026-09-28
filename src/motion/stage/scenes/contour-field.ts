// STUB de WP-00 (brief « Strates », §4.4, annexe A) : le champ de courbes de
// l'accueil, en C2 seulement. Remplacé par WP-HOME, qui prend la propriété de
// ce fichier (et de materials/field-material.ts). Tant que c'est un stub, le
// poster SSR reste visible en production (holdPoster).
import type { SceneModule } from "../types";
import { createStubScene } from "./stub-cube";

const create: SceneModule<unknown>["default"] = (ctx) =>
  createStubScene(ctx, { print: false });

export default create;

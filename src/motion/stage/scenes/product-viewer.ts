// STUB de WP-00 (brief « Strates », §4.4, §7.9) : le viewer de la fiche du
// Vase spirale. Remplacé par WP-SHOP, qui prend la propriété de ce fichier.
// Matériau ordinaire, jamais le matériau d'impression : le vase de Ian (CC
// BY-ND) se montre et tourne, sans coupe ni teinte non vendue (§1.5). Tant
// que c'est un stub, le poster SSR reste visible en production (holdPoster).
import type { SceneModule } from "../types";
import { createStubScene } from "./stub-cube";

const create: SceneModule<unknown>["default"] = (ctx) =>
  createStubScene(ctx, { print: false });

export default create;

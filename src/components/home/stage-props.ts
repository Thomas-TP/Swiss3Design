// Props (instantanés immuables) des scènes du Stage que l'accueil pilote. Elles
// vivent ici, côté léger, parce que le DOM les fabrique et que le côté lourd
// (src/motion/stage/scenes/*) les lit : le DOM n'a pas le droit d'importer
// src/motion, même pour un type ; la scène, elle, importe ce fichier (`import
// type`). Ajouter un champ est permis, en retirer un casse l'autre côté.
import type { LavauxConfig } from "@/lib/studio/types";
import type { HeroPaletteKey, HeroPatternKey } from "./hero-data";

/** Props de la scène `print-hero` : le héros (impression) ou l'éclaté du chapitre 01. */
export interface PrintHeroProps {
  /** « hero » : plateau, buse, tour de purge ; « exploded » : les bandes écartées. */
  mode: "hero" | "exploded";
  /** La scène réagit à un changement de palette (vague) ou de motif (réimpression). */
  palette: HeroPaletteKey;
  pattern: HeroPatternKey;
  /** `variantConfig(data, palette, pattern)` : bandes, motif et géométrie. */
  config: LavauxConfig;
}

/** Props de la scène `contour-field` : le champ de courbes de l'accueil (C2). */
export interface ContourFieldProps {
  /**
   * Teintes hypsométriques (hex), du bas vers le haut, celles de la palette
   * choisie dans le héros ; null : les courbes seules.
   */
  tint: readonly [string, string, string] | null;
}

// Props (instantanés immuables) des scènes du Stage que l'accueil pilote. Elles
// vivent ici, côté léger, parce que le DOM les fabrique et que le côté lourd
// (src/motion/stage/scenes/*) les lit : le DOM n'a pas le droit d'importer
// src/motion, même pour un type ; la scène, elle, importe ce fichier (`import
// type`). Ajouter un champ est permis, en retirer un casse l'autre côté.
import type { Band, LavauxConfig, LavauxPattern } from "@/lib/studio/types";
import type { HeroPaletteKey, HeroPatternKey } from "./hero-data";

/** Props de la scène `print-hero` : le héros (impression) ou l'éclaté du chapitre 01. */
export interface PrintHeroProps {
  /** « hero » : plateau, tête d'impression, silhouette de la forme finale ; « exploded » : les bandes écartées. */
  mode: "hero" | "exploded";
  /** La scène réagit à un changement de palette (vague) ou de motif (réimpression). */
  palette: HeroPaletteKey;
  pattern: HeroPatternKey;
  /** `variantConfig(data, palette, pattern)` : bandes, motif et géométrie. */
  config: LavauxConfig;
  /**
   * Les trois motifs du héros : la scène en pré-génère les maillages après sa
   * première frame, un changement de motif est alors instantané.
   */
  patterns: Record<HeroPatternKey, LavauxPattern>;
  /**
   * Les trois bandes de référence (palette « Léman ») : leurs frontières sont
   * celles du maillage de toutes les palettes (« Uni » les répète en une seule
   * teinte), si bien qu'une vague de couleur ne change jamais de forme.
   */
  bands3: readonly Band[];
}

/** Props de la scène `contour-field` : le champ de courbes de l'accueil (C2). */
export interface ContourFieldProps {
  /**
   * Teintes hypsométriques (hex), du bas vers le haut, celles de la palette
   * choisie dans le héros ; null : les courbes seules.
   */
  tint: readonly [string, string, string] | null;
  /** Ouverture initiale (0 = rien, 1 = tout le champ) ; la chorégraphie l'anime ensuite. */
  reveal: number;
  /** Centre de l'ouverture, en fractions du rectangle de la vue. */
  anchor: readonly [number, number];
}

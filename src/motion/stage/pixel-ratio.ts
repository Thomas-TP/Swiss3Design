// Rapport de pixels du Stage (brief « Strates », §3.6, §4.4, §4.11) : ce que le
// tampon de dessin du canvas coûte au GPU, en deux règles.
//
// 1. Plafond de 1,5, aux deux paliers (C1 et C2). Décision du propriétaire du
//    08.10.2026 (retour R16) : le canvas est ancré au document aussi en C2, il
//    fait donc plus d'une fenêtre de haut (une marge au-dessus et au-dessous de
//    la fenêtre visible, anchor-margin.ts). Pas de plancher (« DPR ≥ 1,5 », R12
//    optionnel) : à DPR 1 le canvas ancré porte déjà plus de pixels que l'ancien
//    canvas fixe d'une fenêtre, un plancher à 1,5 en ferait 2,25 fois plus.
//
// 2. Budget de pixels du tampon (WP-99, suite du problème ouvert 1 de
//    measures-r16.md : le plafond de 1,5 laisse le coût croître avec la fenêtre,
//    un écran 4K à 150 % aurait un tampon de plus de 12 Mpx). Au-delà du budget
//    du palier, le rapport baisse, sans jamais passer sous 1 : rendu plus petit
//    que sa taille CSS, le canvas serait flou à tout rapport d'écran. Le budget
//    compte les pixels physiques du TAMPON (largeur × hauteur CSS du canvas ×
//    rapport²), pas ceux de l'écran : il ne touche pas un écran à DPR 1, où le
//    rapport est déjà au plancher, ni les fenêtres usuelles à DPR 1,5 ou 2
//    (measures-wp99-canvas.md, §3).
//    - C2 : 6 Mpx. Le tampon est multiéchantillonné (4 échantillons) : sa
//      résolution relit quatre couleurs par pixel à chaque image dessinée, que
//      les vues ne couvrent qu'un coin du canvas ou tout le canvas. À 6 Mpx,
//      ≈ 96 Mo relus par image, ≈ 4 ms sur la bande passante partagée d'un iGPU
//      de 2020 (≈ 25 Go/s) : estimation, non mesurée sur un iGPU (le banc n'a
//      qu'un GPU de bureau), qui laisse de quoi tenir les 8 ms par frame du
//      §4.11 avec la scène par-dessus.
//    - C1 : 4 Mpx, pour un appareil à pointeur précis seul (ordinateur). C'est
//      là qu'aboutit une machine déclassée en cours de session : stage.ts,
//      applyCapability, recalcule le rapport et réalloue le tampon (l'
//      antialiasing, fixé à la création du contexte, reste). Ne retire des pixels
//      qu'à DPR > 1. Un appareil tactile garde le budget de C2 : son C1 est un
//      état de départ (tablette, téléphone), pas un déclassement, et une
//      tablette de 12,9 pouces perdrait de la netteté pour rien.
import type { Capability } from "@/lib/motion-bridge/types";

/** Plafond du rapport de pixels du canvas du Stage. */
export const STAGE_MAX_PIXEL_RATIO = 1.5;

/** Budget de pixels du tampon de dessin (largeur × hauteur × rapport²), par palier. */
export const STAGE_PIXEL_BUDGET: Readonly<Record<1 | 2, number>> = {
  2: 6_000_000,
  1: 4_000_000,
};

/** Taille du canvas en pixels CSS : la surface sur laquelle le budget se partage. */
export interface CanvasCssSize {
  width: number;
  height: number;
}

/**
 * Rapport de pixels du canvas pour un `devicePixelRatio` donné (NaN, 0 ou
 * négatif : 1), plafonné à 1,5, puis abaissé (jamais sous 1) pour tenir dans le
 * budget de pixels du palier quand la taille du canvas et le palier sont connus.
 * Un écran dézoomé (DPR < 1) garde son rapport : le plancher est `min(base, 1)`.
 * `coarsePointer` : l'appareil a un doigt (anchor-margin.ts) ; son budget est
 * celui de C2 quel que soit son palier.
 */
export function stagePixelRatio(
  devicePixelRatio: number,
  size?: CanvasCssSize,
  capability?: Capability,
  coarsePointer = false,
): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const base = Math.min(dpr, STAGE_MAX_PIXEL_RATIO);
  if (!size || capability === undefined || capability === 0) return base;
  const area = size.width * size.height;
  if (!(area > 0)) return base;
  const budget = STAGE_PIXEL_BUDGET[coarsePointer ? 2 : capability];
  if (area * base * base <= budget) return base;
  return Math.max(Math.min(base, 1), Math.sqrt(budget / area));
}

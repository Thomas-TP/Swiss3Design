// Budget de pixels du Stage (brief « Strates », §3.6, §4.4, §4.11) : ce que le
// canvas coûte au GPU, à trois endroits qui se règlent ensemble.
//
// 1. Rapport de pixels plafonné à 1,5, aux deux paliers (C1 et C2).
//    Décision du propriétaire du 08.10.2026 (retour R16) : le canvas est ancré au
//    document aussi en C2, il fait donc plus d'une fenêtre de haut (une marge
//    au-dessus et au-dessous de la fenêtre visible, stage-root.tsx). Pas de
//    plancher (« DPR ≥ 1,5 », R12 optionnel) : sur un écran à DPR 1 le canvas
//    ancré porte déjà plus de pixels que l'ancien canvas fixe d'une fenêtre, un
//    plancher à 1,5 en ferait 2,25 fois plus.
//
// 2. Budget de pixels du tampon de dessin (WP-99, suite du problème ouvert 1 de
//    measures-r16.md). Le plafond de 1,5 laisse le coût croître avec la fenêtre :
//    un écran 4K à 150 % (2 560 × 1 440 px CSS) aurait un tampon de plus de
//    12 Mpx. Au-delà du budget, le rapport baisse, sans jamais passer sous 1
//    (jamais sous le pixel CSS : un canvas rendu plus petit que sa taille CSS
//    serait flou à tout rapport d'écran). Le budget est un nombre de pixels
//    physiques du TAMPON, pas de l'écran : il ne touche ni les écrans à DPR 1 (le
//    rapport y est déjà au plancher) ni les fenêtres usuelles à DPR 1,5 ou 2.
//    - C2 : 6 Mpx. Le tampon est multiéchantillonné (4 échantillons) : sa
//      résolution relit 4 couleurs par pixel à chaque image dessinée, qu'une
//      vue ne couvre qu'un coin du canvas ou tout le canvas. À 6 Mpx cela fait
//      ≈ 96 Mo relus par image (≈ 4 ms sur la bande passante partagée d'un iGPU
//      de 2020, ≈ 25 Go/s ; estimation, non mesurée sur un iGPU), de quoi tenir
//      le budget de 8 ms par frame du §4.11 avec la scène par-dessus.
//    - C1 : 4 Mpx, pas d'antialiasing (le tampon n'a qu'un échantillon) : le
//      palier existe pour les appareils moins puissants, et c'est le palier où
//      aboutit une machine déclassée en cours de session (stage.ts,
//      applyCapability : le rapport est recalculé, le tampon réalloué).
//
// 3. Marge du canvas ancré (`anchorMargin`), en fraction de la hauteur de la
//    fenêtre, de chaque côté : 0,25 pour un appareil à pointeur précis seul
//    (souris, pavé tactile : défilement par à-coups de quelques dizaines de pixels
//    par image, mesuré ≤ 34 px entamés sur 450), 0,5 dès qu'un pointeur
//    grossier existe (doigt : le lancer d'inertie avance de plusieurs centaines
//    de pixels entre deux frames du fil principal). Le coût en pixels du canvas
//    est (1 + 2 × marge) fenêtres : 1,5 fenêtre au lieu de 2 pour la souris.
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
 */
export function stagePixelRatio(
  devicePixelRatio: number,
  size?: CanvasCssSize,
  capability?: Capability,
): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const base = Math.min(dpr, STAGE_MAX_PIXEL_RATIO);
  if (!size || capability === undefined || capability === 0) return base;
  const area = size.width * size.height;
  if (!(area > 0)) return base;
  const budget = STAGE_PIXEL_BUDGET[capability];
  if (area * base * base <= budget) return base;
  return Math.max(Math.min(base, 1), Math.sqrt(budget / area));
}

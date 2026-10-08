// Rapport de pixels du Stage (brief « Strates », §3.6, §4.4) : plafonné à 1,5,
// aux deux paliers (C1 et C2).
//
// Décision du propriétaire du 08.10.2026 (retour R16) : le canvas est ancré au
// document aussi en C2, et il fait donc DEUX fenêtres de haut (une demi-fenêtre
// de marge au-dessus et au-dessous de la fenêtre visible, stage-root.tsx). À
// 1,5 il coûte à peu près la même surface de pixels que l'ancien canvas fixe
// d'une fenêtre à 2 (1440 × 900 : 5,8 Mpx contre 5,2 Mpx), multiéchantillonnée
// en C2 : le plafond de 2 d'avant doublerait la mémoire et le remplissage du
// GPU. Pas de plancher (« DPR ≥ 1,5 », R12 optionnel) : sur un écran à DPR 1 le
// canvas de deux fenêtres porte déjà deux fois les pixels de l'ancien canvas
// fixe, un plancher à 1,5 en ferait 4,5 fois plus.

/** Plafond du rapport de pixels du canvas du Stage. */
export const STAGE_MAX_PIXEL_RATIO = 1.5;

/** Rapport de pixels du canvas pour un `devicePixelRatio` donné (NaN, 0 ou négatif : 1). */
export function stagePixelRatio(devicePixelRatio: number): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(dpr, STAGE_MAX_PIXEL_RATIO);
}

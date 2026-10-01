// Couches d'impression (brief « Strates », §6.7, vue « Couches ») : calculs
// purs partagés par l'interface (réglette Z) et par la scène (coupe, simulation).
// Ils vivent ici, côté léger : la scène (src/motion) peut les importer, le DOM
// n'a pas le droit d'importer src/motion (règle d'or 11).

/** Hauteur de couche des objets du Studio (mm). */
export const LAYER_MM = 0.2;

/** Numéro de couche (depuis 1) atteint à la hauteur `z` ; 0 avant la première. */
export function layerAt(z: number): number {
  return z <= 1e-9 ? 0 : Math.ceil(z / LAYER_MM - 1e-6);
}

/** Hauteur (mm) du haut de la couche `layer` (numérotée depuis 1), bornée à la pièce. */
export function layerTop(layer: number, heightMm: number): number {
  return Math.min(heightMm, Math.max(0, layer) * LAYER_MM);
}

/**
 * Écarte des étiquettes qui se chevaucheraient : chacune garde sa hauteur
 * `ys[i]` (le centre de sa bande) si la place le permet ; sinon elle descend
 * jusqu'à `gap` px de la précédente. Renvoie les positions dans l'ordre de
 * `ys`. Si le bas déborde (`max`), tout le paquet remonte d'autant (jamais
 * au-dessus de `min`). Pur et testé : l'éclaté en dépend pour rester lisible.
 */
export function spreadVertically(
  ys: readonly number[],
  gap: number,
  min: number,
  max: number,
): number[] {
  const order = ys.map((_, index) => index).sort((a, b) => ys[a] - ys[b]);
  const placed = Array.from({ length: ys.length }, () => 0);
  let previous = Number.NEGATIVE_INFINITY;
  for (const index of order) {
    const y = Math.max(ys[index], min, previous + gap);
    placed[index] = y;
    previous = y;
  }
  const overflow = (previous === Number.NEGATIVE_INFINITY ? 0 : previous) - max;
  if (overflow > 0) {
    // Remonte le paquet, sans passer sous `min` pour la première étiquette.
    const first = Math.min(...placed);
    const shift = Math.min(overflow, Math.max(0, first - min));
    return placed.map((y) => y - shift);
  }
  return placed;
}

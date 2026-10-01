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

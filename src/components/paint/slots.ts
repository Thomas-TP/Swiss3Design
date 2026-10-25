import type { ColorSetup } from "./types";

/**
 * Couleurs réellement imprimées (ids du stock) : les couleurs distinctes des
 * emplacements, dans l'ordre, ou la principale seule en « une couleur ». Même
 * règle que printedPalette (lib/paint3d/palette.ts), sans importer l'atelier
 * dans la page.
 */
export function printedRefs(setup: ColorSetup): string[] {
  if (!setup.several || setup.refs.length <= 1) return setup.refs.slice(0, 1);
  return [...new Set(setup.refs)];
}

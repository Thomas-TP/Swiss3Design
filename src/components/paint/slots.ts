import type { ColorSetup } from "./types";

/**
 * Couleurs réellement imprimées (ids du stock) : les couleurs distinctes du
 * fichier en « plusieurs couleurs », la couleur unique sinon. Même règle que
 * printedPalette (lib/paint3d/palette.ts), sans importer l'atelier dans la page.
 */
export function printedRefs(setup: ColorSetup): string[] {
  if (setup.several && setup.refs.length > 1) return [...new Set(setup.refs)];
  return setup.single ? [setup.single] : [];
}

import type { ColorSetup, ColorSlot } from "./types";

// Emplacements de couleur (types.ts) : un identifiant stable par emplacement,
// pour que l'atelier sache lequel a été retiré (ses zones reviennent à la
// couleur principale) même quand deux emplacements ont la même couleur.

let nextId = 1;

export function newSlot(ref: string): ColorSlot {
  return { id: nextId++, ref };
}

/**
 * Couleurs réellement imprimées (ids du stock) : les emplacements distincts dans
 * l'ordre, ou la couleur principale seule en « une couleur ». Même règle que
 * printedPalette (lib/paint3d/palette.ts), sans importer l'atelier dans la page.
 */
export function printedRefs(setup: ColorSetup): string[] {
  const refs = setup.slots.map((slot) => slot.ref);
  if (!setup.several || refs.length <= 1) return refs.slice(0, 1);
  return [...new Set(refs)];
}

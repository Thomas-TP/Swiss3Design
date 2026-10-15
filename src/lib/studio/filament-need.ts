// Besoin de filament d'une pièce du Studio, PAR couleur (pur, sans three) : la
// base de la réservation (« réservé ») et du filtre « couleur épuisée ».
//
// Une bande consomme sa masse (`bandStatsFor`) ; la purge de chaque changement
// de filament est imputée au filament ENTRANT (celui qui chasse le précédent de
// la buse). Les volumes de bande ne dépendent pas de la couleur : on peut donc
// calculer, pour une couleur candidate sur une bande, ce que la pièce
// consommerait, sans recalculer la géométrie.
import { bandStatsFor, type BandSummary } from "./band-stats";
import { PRINT } from "./print-params";
import type { FilamentId, StudioConfig, StudioTexts } from "./types";
import type { Locale } from "./objects/montagne-model";

/** Grammes par couleur, au gramme SUPÉRIEUR (on réserve large). */
export type FilamentGrams = Partial<Record<FilamentId, number>>;

interface Slice {
  filament: FilamentId;
  grams: number;
}

function slices(summary: BandSummary): Slice[] {
  return summary.bands.map((b) => ({ filament: b.filament, grams: b.grams }));
}

function gramsOfSlices(list: readonly Slice[]): FilamentGrams {
  const exact = new Map<FilamentId, number>();
  list.forEach((slice, k) => {
    let grams = slice.grams;
    if (k > 0 && list[k - 1].filament !== slice.filament)
      grams += PRINT.purgeGrams;
    exact.set(slice.filament, (exact.get(slice.filament) ?? 0) + grams);
  });
  const out: FilamentGrams = {};
  for (const [filament, grams] of exact)
    out[filament] = Math.ceil(grams - 1e-9);
  return out;
}

/** Grammes par couleur d'UNE pièce, d'après le résumé par bande. */
export function filamentGramsFromSummary(summary: BandSummary): FilamentGrams {
  return gramsOfSlices(slices(summary));
}

/** Grammes par couleur d'UNE pièce (langue canonique du prix, comme `computeStats`). */
export function filamentGramsOf(
  config: StudioConfig,
  texts?: StudioTexts,
  locale?: Locale,
): FilamentGrams {
  return filamentGramsFromSummary(bandStatsFor(config, texts, PRINT, locale));
}

/** Multiplie par la quantité (grammes entiers). */
export function scaleGrams(grams: FilamentGrams, quantity: number) {
  const out: FilamentGrams = {};
  for (const [filament, g] of Object.entries(grams))
    out[filament as FilamentId] = (g ?? 0) * quantity;
  return out;
}

/** Somme de plusieurs lignes (déjà multipliées par leur quantité). */
export function sumGrams(list: readonly FilamentGrams[]): FilamentGrams {
  const out: FilamentGrams = {};
  for (const grams of list)
    for (const [filament, g] of Object.entries(grams))
      out[filament as FilamentId] =
        (out[filament as FilamentId] ?? 0) + (g ?? 0);
  return out;
}

/**
 * Ce que la pièce consommerait de `candidate` si la bande `bandIndex` lui était
 * donnée (les autres bandes inchangées), pour `quantity` pièces : sert à griser
 * une pastille « épuisée » dont le stock ne suffirait pas.
 */
export function needIfAssigned(
  summary: BandSummary,
  bandIndex: number,
  candidate: FilamentId,
  quantity = 1,
): number {
  const list = slices(summary).map((slice, k) =>
    k === bandIndex ? { ...slice, filament: candidate } : slice,
  );
  return (gramsOfSlices(list)[candidate] ?? 0) * quantity;
}

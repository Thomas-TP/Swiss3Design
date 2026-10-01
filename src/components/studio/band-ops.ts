// Opérations sur les bandes du SOUS-VERRE (brief « Strates », §6.4 : « pour
// Relief, [les bandes] se calent sur les sommets de strates »). Le vase a les
// siennes dans src/lib/studio/bands.ts (0,2 mm, 2 mm minimum) ; ici une frontière
// ne peut tomber que sur un sommet de strate (`strataTops`), strictement entre
// ses voisines. Pures et testées (band-ops.test.ts) : la barre altimétrique ne
// fait que les appeler.
import { FILAMENT_IDS } from "@/lib/studio/filaments";
import {
  MAX_BANDS,
  snapReliefBands,
  strataThickness,
  strataTops,
} from "@/lib/studio/ranges";
import type { Band, FilamentId, ReliefConfig } from "@/lib/studio/types";

export const MIN_RELIEF_BANDS = 2;

type Geometry = Pick<ReliefConfig, "base" | "relief" | "levels">;

/** Indice de strate (0 = le socle) du sommet le plus proche de `z`. */
function strataIndex(tops: readonly number[], z: number): number {
  let best = 0;
  for (let k = 1; k < tops.length; k++) {
    if (Math.abs(tops[k] - z) < Math.abs(tops[best] - z)) best = k;
  }
  return best;
}

/** Cran d'une flèche du clavier pour ce sous-verre (mm) : une strate. */
export function reliefStep(g: Geometry): number {
  return strataThickness(g.levels, g.relief);
}

/**
 * Déplace la frontière haute de la bande `index` vers `rawMm` : ramenée au
 * sommet de strate le plus proche, sans dépasser ses voisines (la bande d'en
 * dessous garde une strate au moins, celle d'au-dessus aussi).
 */
export function moveReliefBoundary(
  bands: readonly Band[],
  index: number,
  rawMm: number,
  g: Geometry,
): Band[] {
  if (index < 0 || index >= bands.length - 1) return bands.map((b) => ({ ...b }));
  const tops = strataTops(g.base, g.relief, g.levels);
  const floor = index === 0 ? 0 : strataIndex(tops, bands[index - 1].toMm) + 1;
  const ceiling = strataIndex(tops, bands[index + 1].toMm) - 1;
  const wanted = strataIndex(tops, rawMm);
  const k = Math.min(Math.max(wanted, floor), Math.max(floor, ceiling));
  return bands.map((b, i) => (i === index ? { ...b, toMm: tops[k] } : { ...b }));
}

export function canAddReliefBand(bands: readonly Band[], g: Geometry): boolean {
  if (bands.length >= MAX_BANDS) return false;
  const tops = strataTops(g.base, g.relief, g.levels);
  let from = -1;
  return bands.some((band, i) => {
    const to = i === bands.length - 1 ? g.levels : strataIndex(tops, band.toMm);
    const room = to - from >= 2;
    from = to;
    return room;
  });
}

/**
 * Coupe en deux la bande la plus épaisse (en strates ; la plus basse en cas
 * d'égalité) : la moitié basse garde son filament, la moitié haute prend le
 * premier filament différent de ses voisines.
 */
export function addReliefBand(
  bands: readonly Band[],
  g: Geometry,
  filament?: FilamentId,
): Band[] {
  if (!canAddReliefBand(bands, g)) return bands.map((b) => ({ ...b }));
  const tops = strataTops(g.base, g.relief, g.levels);
  const ends = bands.map((band, i) =>
    i === bands.length - 1 ? g.levels : strataIndex(tops, band.toMm),
  );
  let target = -1;
  let widest = 1;
  let from = -1;
  ends.forEach((end, i) => {
    const size = end - from;
    if (size > widest) {
      widest = size;
      target = i;
    }
    from = end;
  });
  const start = target === 0 ? -1 : ends[target - 1];
  const mid = start + Math.floor((ends[target] - start) / 2);
  const below = bands[target].filament;
  const above = bands[target + 1]?.filament;
  const chosen =
    filament ??
    FILAMENT_IDS.find((id) => id !== below && id !== above) ??
    FILAMENT_IDS[0];
  const out: Band[] = [];
  bands.forEach((band, i) => {
    if (i === target) {
      out.push(
        { filament: below, toMm: tops[Math.max(mid, 0)] },
        { filament: chosen, toMm: band.toMm },
      );
    } else out.push({ ...band });
  });
  return snapReliefBands(out, g.base, g.relief, g.levels);
}

export function canRemoveReliefBand(bands: readonly Band[]): boolean {
  return bands.length > MIN_RELIEF_BANDS;
}

/** Retire la bande `index` : celle du dessous absorbe son épaisseur (la première : celle du dessus descend). */
export function removeReliefBand(
  bands: readonly Band[],
  index: number,
  g: Geometry,
): Band[] {
  if (!canRemoveReliefBand(bands) || index < 0 || index >= bands.length)
    return bands.map((b) => ({ ...b }));
  if (index === 0) return snapReliefBands(bands.slice(1), g.base, g.relief, g.levels);
  const out = bands.map((b) => ({ ...b }));
  out[index - 1].toMm = bands[index].toMm;
  out.splice(index, 1);
  return snapReliefBands(out, g.base, g.relief, g.levels);
}

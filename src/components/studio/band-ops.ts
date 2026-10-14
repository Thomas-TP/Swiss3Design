// Opérations sur les bandes de la MONTAGNE (brief « Strates », §6.4). Le vase a
// les siennes dans src/lib/studio/bands.ts (0,2 mm, 2 mm minimum, toutes les
// bandes libres) ; la montagne en diffère sur un point : sa PREMIÈRE bande est le
// socle, et sa frontière est le dessus du socle, qui ne bouge pas (c'est elle
// qui fait ressortir l'étiquette posée dessus, et le socle a sa propre teinte).
// Les autres frontières (de 2 à 4 bandes en tout) se déplacent à la couche près,
// 2 mm d'épaisseur au moins. Pures et testées (band-ops.test.ts) : la barre
// altimétrique ne fait que les appeler.
import { FILAMENT_IDS } from "@/lib/studio/filaments";
import { MAX_BANDS, MIN_BAND_MM, quantizeMm } from "@/lib/studio/ranges";
import { moveBoundary, removeBand } from "@/lib/studio/bands";
import type { Band, FilamentId } from "@/lib/studio/types";

export const MIN_MONTAGNE_BANDS = 2;
/** Nombre de frontières du bas qui ne se déplacent pas : le dessus du socle. */
export const LOCKED_BOUNDARIES = 1;

/** Cran d'une flèche du clavier (mm) : une couche. */
export const MONTAGNE_STEP_MM = 0.2;

const copy = (bands: readonly Band[]): Band[] => bands.map((b) => ({ ...b }));

/**
 * Déplace la frontière haute de la bande `index` vers `rawMm` : jamais celle
 * du socle (la bande 0), à la couche près, à 2 mm au moins de ses voisines.
 */
export function moveMontagneBoundary(
  bands: readonly Band[],
  index: number,
  rawMm: number,
): Band[] {
  if (index < LOCKED_BOUNDARIES || index >= bands.length - 1)
    return copy(bands);
  return moveBoundary(bands, index, rawMm);
}

/** Vrai s'il reste de la place pour une bande de plus dans la montagne (une bande de 4 mm au moins à couper). */
export function canAddMontagneBand(bands: readonly Band[]): boolean {
  if (bands.length >= MAX_BANDS) return false;
  return bands.some(
    (band, k) =>
      k >= 1 && band.toMm - bands[k - 1].toMm >= 2 * MIN_BAND_MM - 1e-9,
  );
}

/**
 * Coupe en deux la bande la plus épaisse de la MONTAGNE (la plus basse en cas
 * d'égalité ; jamais le socle) : la moitié basse garde son filament, la moitié
 * haute prend `filament`, ou à défaut le premier filament différent de ses
 * deux voisines.
 */
export function addMontagneBand(
  bands: readonly Band[],
  filament?: FilamentId,
): Band[] {
  if (!canAddMontagneBand(bands)) return copy(bands);
  let target = -1;
  let widest = -1;
  bands.forEach((band, k) => {
    if (k < 1) return;
    const thickness = band.toMm - bands[k - 1].toMm;
    if (thickness >= 2 * MIN_BAND_MM - 1e-9 && thickness > widest + 1e-9) {
      widest = thickness;
      target = k;
    }
  });
  const from = bands[target - 1].toMm;
  const to = bands[target].toMm;
  const mid = Math.min(
    Math.max(quantizeMm(from + (to - from) / 2), from + MIN_BAND_MM),
    to - MIN_BAND_MM,
  );
  const below = bands[target].filament;
  const above = bands[target + 1]?.filament;
  const chosen =
    filament ??
    FILAMENT_IDS.find((id) => id !== below && id !== above) ??
    FILAMENT_IDS[0];
  const out: Band[] = [];
  bands.forEach((band, k) => {
    if (k === target) {
      out.push({ filament: below, toMm: mid }, { filament: chosen, toMm: to });
    } else out.push({ ...band });
  });
  return out;
}

/** Une bande de la montagne se retire s'il en reste au moins deux après (le socle ne se retire pas). */
export function canRemoveMontagneBand(
  bands: readonly Band[],
  index: number,
): boolean {
  return (
    bands.length > MIN_MONTAGNE_BANDS &&
    index >= LOCKED_BOUNDARIES &&
    index < bands.length
  );
}

/**
 * Retire la bande `index` de la montagne. Celle du DESSUS absorbe son épaisseur
 * (elle descend jusqu'à la bande du dessous), sauf pour la dernière, dont la
 * voisine du dessous monte jusqu'au sommet : la frontière du socle, elle, ne
 * bouge jamais (le `removeBand` du vase ferait absorber la bande 1 par le socle).
 */
export function removeMontagneBand(
  bands: readonly Band[],
  index: number,
): Band[] {
  if (!canRemoveMontagneBand(bands, index)) return copy(bands);
  if (index === bands.length - 1) return removeBand(bands, index);
  return bands.filter((_, k) => k !== index).map((b) => ({ ...b }));
}

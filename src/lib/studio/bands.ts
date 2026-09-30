// Opérations sur les bandes de couleur (brief « Strates », §6.4 et §6.7 : la
// barre altimétrique). Règles du modèle multicolore : bandes contiguës depuis
// z = 0, 1 à 4 bandes, frontières QUANTIFIÉES à 0,2 mm (une couche), épaisseur
// minimale 2 mm (10 couches), la dernière finit à la hauteur totale.
//
// Fonctions pures et testées : la barre altimétrique et ses boutons
// « Ajouter une bande » / « Retirer » (WP-STUDIO) ne font que les appeler, donc
// aucune séquence de gestes ne peut produire une configuration invalide.
import { FILAMENT_IDS } from "./filaments";
import { MAX_BANDS, MIN_BAND_MM, quantizeMm } from "./schemas";
import type { Band, FilamentId } from "./types";

/** Pas d'une frontière : une couche. */
export const BAND_STEP_MM = 0.2;

// `quantizeMm` (une hauteur ramenée à la couche, sans traîne de virgule
// flottante) vit dans schemas.ts, qui borne aussi les configurations décodées.
export { quantizeMm };

/** Bas de la bande `index` (mm). */
function bandFloor(bands: readonly Band[], index: number): number {
  return index === 0 ? 0 : bands[index - 1].toMm;
}

/**
 * Plage admise pour la frontière haute de la bande `index` (`toMm`) : au moins
 * 2 mm au-dessus de la frontière précédente et 2 mm sous la suivante. La
 * dernière frontière (la hauteur du vase) n'est pas déplaçable.
 */
export function boundaryRange(
  bands: readonly Band[],
  index: number,
  minThickness: number = MIN_BAND_MM,
): [number, number] {
  if (index < 0 || index >= bands.length - 1) {
    throw new Error(
      "boundaryRange : seules les frontières intérieures se déplacent",
    );
  }
  return [
    bandFloor(bands, index) + minThickness,
    bands[index + 1].toMm - minThickness,
  ];
}

/** Déplace la frontière haute de la bande `index`, bornée aux voisines et quantifiée. */
export function moveBoundary(
  bands: readonly Band[],
  index: number,
  toMm: number,
  minThickness: number = MIN_BAND_MM,
): Band[] {
  const [lo, hi] = boundaryRange(bands, index, minThickness);
  // `lo` et `hi` sont des multiples de 0,2 tant que les voisines le sont ; on
  // quantifie puis on rebornne vers l'intérieur pour ne jamais sortir de la plage.
  let z = quantizeMm(Math.min(Math.max(toMm, lo), hi));
  while (z < lo - 1e-9) z = quantizeMm(z + BAND_STEP_MM);
  while (z > hi + 1e-9) z = quantizeMm(z - BAND_STEP_MM);
  return bands.map((b, k) => (k === index ? { ...b, toMm: z } : { ...b }));
}

export function canAddBand(
  bands: readonly Band[],
  minThickness: number = MIN_BAND_MM,
): boolean {
  if (bands.length >= MAX_BANDS) return false;
  return bands.some(
    (_, k) => bands[k].toMm - bandFloor(bands, k) >= 2 * minThickness - 1e-9,
  );
}

/**
 * Coupe en deux la bande la plus épaisse (la plus basse en cas d'égalité) :
 * la moitié basse garde son filament, la moitié haute prend `filament`, ou à
 * défaut le premier filament différent de ses deux voisines.
 */
export function addBand(
  bands: readonly Band[],
  filament?: FilamentId,
  minThickness: number = MIN_BAND_MM,
): Band[] {
  if (!canAddBand(bands, minThickness)) return bands.map((b) => ({ ...b }));
  let target = -1;
  let widest = -1;
  bands.forEach((_, k) => {
    const thickness = bands[k].toMm - bandFloor(bands, k);
    if (thickness >= 2 * minThickness - 1e-9 && thickness > widest + 1e-9) {
      widest = thickness;
      target = k;
    }
  });
  const from = bandFloor(bands, target);
  const to = bands[target].toMm;
  let mid = quantizeMm(from + (to - from) / 2);
  mid = Math.min(Math.max(mid, from + minThickness), to - minThickness);
  const below = bands[target].filament;
  const above = bands[target + 1]?.filament;
  const chosen =
    filament ??
    FILAMENT_IDS.find((id) => id !== below && id !== above) ??
    FILAMENT_IDS[0];
  const out: Band[] = [];
  bands.forEach((b, k) => {
    if (k === target) {
      out.push({ filament: below, toMm: mid }, { filament: chosen, toMm: to });
    } else out.push({ ...b });
  });
  return out;
}

export function canRemoveBand(bands: readonly Band[]): boolean {
  return bands.length > 1;
}

/**
 * Retire la bande `index` : la bande du dessous absorbe son épaisseur (pour la
 * toute première, celle du dessus descend jusqu'au plateau). Au moins une bande
 * reste ; la dernière finit toujours à la hauteur du vase.
 */
export function removeBand(bands: readonly Band[], index: number): Band[] {
  if (!canRemoveBand(bands) || index < 0 || index >= bands.length) {
    return bands.map((b) => ({ ...b }));
  }
  if (index === 0) return bands.slice(1).map((b) => ({ ...b }));
  const out = bands.map((b) => ({ ...b }));
  out[index - 1].toMm = bands[index].toMm;
  out.splice(index, 1);
  return out;
}

/** Change le filament d'une bande. */
export function setBandFilament(
  bands: readonly Band[],
  index: number,
  filament: FilamentId,
): Band[] {
  return bands.map((b, k) => (k === index ? { ...b, filament } : { ...b }));
}

/** Épaisseurs des bandes (mm), du bas vers le haut. */
export function bandThicknesses(bands: readonly Band[]): number[] {
  return bands.map(
    (b, k) => Math.round((b.toMm - bandFloor(bands, k)) * 10) / 10,
  );
}

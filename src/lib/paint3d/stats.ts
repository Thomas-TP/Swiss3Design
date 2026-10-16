// Bilan d'un projet de couleurs : part de la surface de chaque couleur, et
// estimation des changements de filament qu'il coûtera à l'impression (une
// imprimante à AMS change de bobine à chaque couleur de chaque couche : c'est ce
// qui allonge l'impression et produit la purge). Indicatif : l'atelier tranche
// lui-même et ajuste.
import type { PaintDocument } from "./document";
import { forEachLeaf, isSplit } from "./selector";

/** Couleur d'un état : emplacement 0 (la base) pour 0 et 1, puis n − 1. */
export const slotOfState = (state: number) => Math.max(0, state - 1);

export interface PaintStats {
  /** Aire (mm², à la taille choisie) par emplacement de la palette. */
  areaBySlot: number[];
  totalArea: number;
  /** Changements de filament estimés (couches de 0,2 mm). */
  changes: number;
  /** Couches contenant plus d'une couleur. */
  mixedLayers: number;
  layers: number;
}

/** Hauteur de couche de l'estimation (mm). */
export const STATS_LAYER_HEIGHT = 0.2;

export function paintStats(doc: PaintDocument, slots = 4): PaintStats {
  const s2 = doc.scale * doc.scale;
  const areas = doc.topology.areas;
  const areaBySlot = Array.from({ length: slots }, () => 0);
  const height = doc.worldBounds().size[2];
  const layers = Math.max(1, Math.ceil(height / STATS_LAYER_HEIGHT));
  // Une table de différences par emplacement : +1 à la première couche touchée,
  // −1 après la dernière ; la somme cumulée dit si la couleur est présente.
  const diff = Array.from({ length: slots }, () => new Int32Array(layers + 1));
  const r = doc.rotation;
  const s = doc.scale;
  const z0 = doc.worldZ(0, 0, 0);
  const zOf = (p: ArrayLike<number>, o: number) =>
    s * (r[6] * p[o] + r[7] * p[o + 1] + r[8] * p[o + 2]) + z0;
  const mark = (slot: number, p: ArrayLike<number>) => {
    const a = zOf(p, 0);
    const b = zOf(p, 3);
    const c = zOf(p, 6);
    const lo = Math.max(0, Math.floor(Math.min(a, b, c) / STATS_LAYER_HEIGHT));
    const hi = Math.min(
      layers - 1,
      Math.floor(Math.max(a, b, c) / STATS_LAYER_HEIGHT),
    );
    if (hi < lo) return;
    diff[slot][lo]++;
    diff[slot][hi + 1]--;
  };
  let totalArea = 0;
  for (let t = 0; t < doc.triangleCount; t++) {
    const area = areas[t] * s2;
    totalArea += area;
    const node = doc.node(t);
    if (!isSplit(node)) {
      const slot = Math.min(slots - 1, slotOfState(node));
      areaBySlot[slot] += area;
      mark(slot, doc.corners(t));
      continue;
    }
    forEachLeaf(node, doc.corners(t), (corners, state, share) => {
      const slot = Math.min(slots - 1, slotOfState(state));
      areaBySlot[slot] += area * share;
      mark(slot, corners);
    });
  }
  // Changements : dans une couche de k couleurs, k − 1 ; et un de plus quand la
  // couche ne contient pas la couleur qui finissait la précédente.
  let changes = 0;
  let mixedLayers = 0;
  const running = new Int32Array(slots);
  let previous = 0;
  for (let layer = 0; layer < layers; layer++) {
    let present = 0;
    let count = 0;
    for (let slot = 0; slot < slots; slot++) {
      running[slot] += diff[slot][layer];
      if (running[slot] > 0) {
        present |= 1 << slot;
        count++;
      }
    }
    if (count === 0) continue;
    if (count > 1) mixedLayers++;
    changes += count - 1;
    if (previous !== 0 && (present & previous) === 0) changes++;
    previous = present;
  }
  return { areaBySlot, totalArea, changes, mixedLayers, layers };
}

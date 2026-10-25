// Passage entre l'atelier 3D et le formulaire de devis : créer le document
// depuis le fichier du visiteur (avec les couleurs d'un 3MF déjà peint, associées
// au stock), produire l'aperçu peint de la vue « salle à manger », le résumé du
// projet et le 3MF à envoyer. Pur TypeScript (la lecture des fichiers et la
// géométrie restent hors de three).
import { PaintDocument } from "./document";
import { mapFileFilaments, printedPalette, type PaletteColor } from "./palette";
import { readMesh, readTriangles, type LoadedMesh } from "./read";
import {
  accumulateShares,
  forEachLeaf,
  isSplit,
  leafCount,
  remapNode,
  type PaintNode,
} from "./selector";
import { paintStats, slotOfState } from "./stats";
import type { ColorProjectSummary } from "./summary";

export type PaintSource =
  | { format: "stl" | "obj" | "3mf"; buffer: ArrayBuffer }
  | { format: "triangles"; positions: Float32Array };

export interface OpenedProject {
  /** Le document, avec les zones du fichier (une par filament) déjà en place. */
  doc: PaintDocument;
  /**
   * Couleur du stock de chaque filament du fichier (emplacements 1 à 4, dans
   * l'ordre ; doublons possibles), ou null : fichier d'une seule couleur.
   */
  fileRefs: string[] | null;
  /** Plus de quatre filaments : les moins présents ont été réunis. */
  merged: boolean;
  producer: LoadedMesh["producer"];
}

/** Aire d'un triangle (9 nombres à partir de `o`). */
function triangleArea(p: Float32Array, o: number): number {
  const ax = p[o + 3] - p[o];
  const ay = p[o + 4] - p[o + 1];
  const az = p[o + 5] - p[o + 2];
  const bx = p[o + 6] - p[o];
  const by = p[o + 7] - p[o + 1];
  const bz = p[o + 8] - p[o + 2];
  return (
    Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) / 2
  );
}

/** Aire de chaque numéro de filament du fichier (peinture et pièces). */
function filamentAreas(loaded: LoadedMesh): Map<number, number> {
  const areas = new Map<number, number>();
  const shares = new Float64Array(256);
  loaded.parts.forEach((part, p) => {
    const own = loaded.partFilaments[p] || 1;
    for (let t = part.first; t < part.first + part.count; t++) {
      const area = triangleArea(loaded.positions, t * 9);
      const node = loaded.paint.get(t);
      if (node === undefined) {
        areas.set(own, (areas.get(own) ?? 0) + area);
        continue;
      }
      shares.fill(0);
      accumulateShares(node, area, shares);
      for (let f = 0; f < shares.length; f++) {
        if (shares[f] === 0) continue;
        const filament = f === 0 ? own : f;
        areas.set(filament, (areas.get(filament) ?? 0) + shares[f]);
      }
    }
  });
  return areas;
}

/**
 * Ouvre le fichier du visiteur. Un 3MF qui porte plusieurs couleurs (peinture,
 * filament par pièce) garde ses zones telles quelles : chaque filament devient
 * un emplacement, associé à la couleur du stock la plus proche ; le visiteur ne
 * fait que changer ces couleurs (ou repasse en une couleur, sans rien perdre).
 */
export async function openProject(
  source: PaintSource,
  stock: readonly PaletteColor[],
  maxColors: number,
): Promise<OpenedProject> {
  const loaded =
    source.format === "triangles"
      ? readTriangles(source.positions)
      : await readMesh(source.format, source.buffer);
  const areas = filamentAreas(loaded);
  const used = [...areas.entries()].filter(([, area]) => area > 0);
  if (used.length < 2 || stock.length === 0) {
    return {
      doc: new PaintDocument({
        positions: loaded.positions,
        parts: loaded.parts,
      }),
      fileRefs: null,
      merged: false,
      producer: loaded.producer,
    };
  }
  const mapping = mapFileFilaments(
    used.map(([filament, area]) => ({
      filament,
      area,
      hex: loaded.filamentColors[filament - 1] ?? null,
    })),
    stock,
    maxColors,
  );
  if (!mapping) {
    return {
      doc: new PaintDocument({
        positions: loaded.positions,
        parts: loaded.parts,
      }),
      fileRefs: null,
      merged: false,
      producer: loaded.producer,
    };
  }
  // Table filament → état du document, appliquée à chaque arbre.
  const table = new Uint8Array(256);
  for (const [filament, state] of mapping.stateOf) table[filament] = state;
  const paint = new Map<number, PaintNode>();
  loaded.parts.forEach((part, p) => {
    const own = mapping.stateOf.get(loaded.partFilaments[p] || 1) ?? 0;
    for (let t = part.first; t < part.first + part.count; t++) {
      const node = loaded.paint.get(t);
      if (node === undefined) {
        if (own > 1) paint.set(t, own);
        continue;
      }
      // Non peint dans l'arbre (0) : le filament de la pièce.
      const local = Uint8Array.from(table);
      local[0] = own;
      paint.set(t, remapNode(node, local));
    }
  });
  return {
    doc: new PaintDocument({
      positions: loaded.positions,
      parts: loaded.parts,
      paint,
    }),
    fileRefs: mapping.refs,
    merged: mapping.merged,
    producer: loaded.producer,
  };
}

/**
 * Feuilles peintes, sur le plateau (mm, Z en haut), pour la vue « salle à
 * manger » : 9 positions et un état par triangle (renuméroté par `states`,
 * table de printedPalette).
 */
export function paintedPreview(
  doc: PaintDocument,
  states?: ArrayLike<number>,
): {
  positions: Float32Array;
  states: Uint8Array;
} {
  let count = 0;
  for (let t = 0; t < doc.triangleCount; t++) count += leafCount(doc.node(t));
  const positions = new Float32Array(count * 9);
  const out = new Uint8Array(count);
  let i = 0;
  const put = (c: ArrayLike<number>, state: number) => {
    for (let k = 0; k < 9; k += 3) {
      const [x, y, z] = doc.toWorld(c[k], c[k + 1], c[k + 2]);
      positions[i * 9 + k] = x;
      positions[i * 9 + k + 1] = y;
      positions[i * 9 + k + 2] = z;
    }
    out[i++] = states && state < states.length ? states[state] : state;
  };
  for (let t = 0; t < doc.triangleCount; t++) {
    const node = doc.node(t);
    if (isSplit(node)) forEachLeaf(node, doc.corners(t), put);
    else put(doc.corners(t), node);
  }
  return { positions, states: out };
}

/**
 * Le projet diffère-t-il du fichier (plusieurs couleurs réellement placées,
 * taille, orientation) ? `slots` : la couleur de chaque emplacement.
 */
export function projectMatters(
  doc: PaintDocument,
  slots: readonly string[],
  several: boolean,
): boolean {
  if (doc.transformed) return true;
  const { refs, states } = printedPalette(slots, several);
  if (refs.length < 2) return false;
  const used = new Set<number>();
  for (const state of doc.usedStates())
    used.add(Math.min(refs.length - 1, slotOfState(states[state] ?? 0)));
  return used.size > 1;
}

/** Résumé du projet pour la demande de devis (couleurs imprimées, distinctes). */
export function projectSummary(
  doc: PaintDocument,
  slots: readonly string[],
  several: boolean,
  origin: ColorProjectSummary["origin"],
): ColorProjectSummary {
  const { refs, states } = printedPalette(slots, several);
  const stats = paintStats(doc, Math.max(1, refs.length), states);
  const total = stats.totalArea || 1;
  const bounds = doc.worldBounds();
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    v: 1,
    scale: Math.round(doc.scale * 10000) / 10000,
    size: [round(bounds.size[0]), round(bounds.size[1]), round(bounds.size[2])],
    rotated: doc.rotation.some((v, i) => v !== [1, 0, 0, 0, 1, 0, 0, 0, 1][i]),
    triangles: doc.triangleCount,
    colors: refs.map((ref, slot) => ({
      ref,
      share: Math.round(((stats.areaBySlot[slot] ?? 0) / total) * 1000) / 1000,
    })),
    changes: refs.length > 1 ? stats.changes : 0,
    origin,
  };
}

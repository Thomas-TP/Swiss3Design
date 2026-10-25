// Remplissage « Zone » de l'atelier 3D, à la manière du pot de peinture de Bambu
// Studio (TriangleSelector::bucket_fill_select_triangles) : la zone se lit au
// niveau des FEUILLES de la peinture (les sous-triangles d'un triangle coupé),
// pas des triangles d'origine. Un clic recolore exactement la zone touchée :
//  - « même couleur » : on ne passe que d'une feuille à une voisine de même
//    couleur, donc la frontière d'une zone déjà peinte (ou venue d'un 3MF) est
//    respectée au sous-triangle près ;
//  - « arêtes » : on s'arrête aux arêtes plus vives que l'angle donné (30° par
//    défaut chez Bambu Studio), comme au bord de la face d'un cube ;
//  - sans l'un ni l'autre : toute la pièce reliée.
//
// Voisinage des feuilles, sans géométrie flottante : les sommets d'une feuille
// sont décrits en coordonnées barycentriques de son triangle d'origine. La
// découpe ne prend que des milieux, donc ces coordonnées sont des fractions
// dyadiques (k / 2^n), exactes en double précision : deux feuilles se touchent
// quand un côté de l'une contient un côté de l'autre, ce qu'on teste par clés
// exactes (et moitiés successives, pour un voisin plus finement coupé). D'un
// triangle d'origine à l'autre, on passe par l'arête partagée (topologie) en
// comparant les intervalles des feuilles le long de cette arête.
//
// Réécriture indépendante d'après le comportement décrit par le code public de
// Bambu Studio (AGPL-3.0) ; aucun code n'en est repris.
import type { PaintDocument } from "./document";
import { collapse, isSplit, splitCorners, type PaintNode } from "./selector";

/** Coordonnées barycentriques des trois coins (sommet i = poids 1 sur i). */
const CORNERS = Float64Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
/** Profondeur maximale des moitiés cherchées (celle des arbres de peinture). */
const MAX_HALVING = 26;

interface EdgeLeaf {
  leaf: number;
  /** Intervalle de la feuille le long de l'arête (0 = coin e, 1 = coin e + 1). */
  lo: number;
  hi: number;
}

/** Feuilles d'un triangle d'origine et leur voisinage interne. */
interface TriangleLeaves {
  /** 9 coordonnées barycentriques par feuille, dans l'ordre de parcours. */
  bary: Float64Array[];
  states: number[];
  /** Voisines dans le même triangle d'origine. */
  inner: number[][];
  /** Feuilles posées sur chaque arête d'origine (arête e : coin e → e + 1). */
  onEdge: [EdgeLeaf[], EdgeLeaf[], EdgeLeaf[]];
  /** Pour chaque feuille, ses côtés posés sur une arête d'origine. */
  borders: Border[][];
}

interface Border {
  e: number;
  lo: number;
  hi: number;
}

const WHOLE_EDGE: EdgeLeaf[] = [{ leaf: 0, lo: 0, hi: 1 }];
const WHOLE_BORDERS: Border[][] = [
  [
    { e: 0, lo: 0, hi: 1 },
    { e: 1, lo: 0, hi: 1 },
    { e: 2, lo: 0, hi: 1 },
  ],
];

const key = (p: ArrayLike<number>, o: number) =>
  `${p[o]},${p[o + 1]},${p[o + 2]}`;

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Feuilles d'un nœud, dans l'ordre de forEachLeaf (enfant 0 d'abord). */
function collectLeaves(
  node: PaintNode,
  bary: Float64Array,
  outBary: Float64Array[],
  outStates: number[],
): void {
  if (!isSplit(node)) {
    outBary.push(bary);
    outStates.push(node);
    return;
  }
  const children = splitCorners(bary, node.s, node.k);
  for (let i = 0; i < node.c.length; i++)
    collectLeaves(node.c[i], children[i], outBary, outStates);
}

function buildLeaves(node: PaintNode): TriangleLeaves {
  if (!isSplit(node))
    return {
      bary: [CORNERS],
      states: [node],
      inner: [[]],
      onEdge: [WHOLE_EDGE, WHOLE_EDGE, WHOLE_EDGE],
      borders: WHOLE_BORDERS,
    };
  const bary: Float64Array[] = [];
  const states: number[] = [];
  collectLeaves(node, CORNERS, bary, states);
  const inner: Set<number>[] = bary.map(() => new Set());
  const onEdge: [EdgeLeaf[], EdgeLeaf[], EdgeLeaf[]] = [[], [], []];
  const borders: Border[][] = bary.map(() => []);
  // Côtés intérieurs : clé exacte de leurs deux extrémités → feuilles.
  const edges = new Map<string, number[]>();
  const vertices = new Set<string>();
  const inside: { leaf: number; a: number; b: number }[] = [];
  for (let leaf = 0; leaf < bary.length; leaf++) {
    const p = bary[leaf];
    for (let i = 0; i < 3; i++) {
      vertices.add(key(p, i * 3));
      const a = i * 3;
      const b = ((i + 1) % 3) * 3;
      // Sur l'arête d'origine e quand le poids du coin opposé (e + 2) est nul
      // aux deux extrémités.
      let border = -1;
      for (let e = 0; e < 3; e++) {
        const opposite = (e + 2) % 3;
        if (p[a + opposite] === 0 && p[b + opposite] === 0) border = e;
      }
      if (border >= 0) {
        const along = (border + 1) % 3;
        const s0 = p[a + along];
        const s1 = p[b + along];
        const lo = Math.min(s0, s1);
        const hi = Math.max(s0, s1);
        onEdge[border].push({ leaf, lo, hi });
        borders[leaf].push({ e: border, lo, hi });
        continue;
      }
      const k = edgeKey(key(p, a), key(p, b));
      const list = edges.get(k);
      if (list) list.push(leaf);
      else edges.set(k, [leaf]);
      inside.push({ leaf, a, b });
    }
  }
  // Un côté touche le côté identique de l'autre feuille, ou les moitiés d'une
  // feuille plus finement coupée (cherchées tant qu'un sommet existe au milieu).
  const link = (x: number, y: number) => {
    if (x === y) return;
    inner[x].add(y);
    inner[y].add(x);
  };
  const search = (
    leaf: number,
    p: number[],
    q: number[],
    depth: number,
  ): void => {
    const pk = `${p[0]},${p[1]},${p[2]}`;
    const qk = `${q[0]},${q[1]},${q[2]}`;
    // Le côté lui-même est dans la table : seules les AUTRES feuilles comptent.
    const found = edges.get(edgeKey(pk, qk))?.filter((other) => other !== leaf);
    if (found?.length) {
      for (const other of found) link(leaf, other);
      return;
    }
    if (depth >= MAX_HALVING) return;
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
    if (!vertices.has(`${m[0]},${m[1]},${m[2]}`)) return;
    search(leaf, p, m, depth + 1);
    search(leaf, m, q, depth + 1);
  };
  for (const { leaf, a, b } of inside) {
    const p = bary[leaf];
    search(leaf, [p[a], p[a + 1], p[a + 2]], [p[b], p[b + 1], p[b + 2]], 0);
  }
  return {
    bary,
    states,
    inner: inner.map((set) => [...set]),
    onEdge,
    borders,
  };
}

/** Feuilles retenues : par triangle d'origine, ses feuilles (null = toutes). */
export interface LeafSelection {
  triangles: Map<number, Set<number> | null>;
  /** État (normalisé) de la feuille de départ. */
  seedState: number;
}

export interface BucketOptions {
  /** Ne passer qu'entre feuilles de la même couleur. */
  sameColor: boolean;
  /** Angle limite entre deux triangles voisins (degrés), ou null : aucun. */
  angle: number | null;
  /** Triangles d'origine permis (coupe horizontale). */
  accept?: (t: number) => boolean;
}

/** 0 (non peint) et 1 (la base peinte) sont la même couleur à l'écran. */
export const sameColorState = (state: number) => (state <= 1 ? 0 : state);

/** Feuilles des triangles parcourus, gardées le temps d'un remplissage. */
class LeafCache {
  private readonly cache = new Map<number, TriangleLeaves>();
  constructor(private readonly doc: PaintDocument) {}
  get(t: number): TriangleLeaves {
    let found = this.cache.get(t);
    if (!found) {
      found = buildLeaves(this.doc.node(t));
      this.cache.set(t, found);
    }
    return found;
  }
}

/** Coordonnées barycentriques d'un point (repère du fichier) dans le triangle t. */
function baryOf(
  doc: PaintDocument,
  t: number,
  point: readonly [number, number, number],
): [number, number, number] {
  const c = doc.corners(t);
  const v0 = [c[3] - c[0], c[4] - c[1], c[5] - c[2]];
  const v1 = [c[6] - c[0], c[7] - c[1], c[8] - c[2]];
  const v2 = [point[0] - c[0], point[1] - c[1], point[2] - c[2]];
  const dot = (a: number[], b: number[]) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const d00 = dot(v0, v0);
  const d01 = dot(v0, v1);
  const d11 = dot(v1, v1);
  const d20 = dot(v2, v0);
  const d21 = dot(v2, v1);
  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 1e-30) return [1 / 3, 1 / 3, 1 / 3];
  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  return [1 - v - w, v, w];
}

/**
 * Feuille du triangle t sous un point (repère du fichier) : son rang dans
 * l'ordre de parcours des feuilles. Le point est ramené dans le triangle ; à la
 * limite de deux feuilles, la plus proche l'emporte.
 */
export function leafAt(
  doc: PaintDocument,
  t: number,
  point: readonly [number, number, number],
): number {
  const node = doc.node(t);
  if (!isSplit(node)) return 0;
  const b = baryOf(doc, t, point);
  let index = 0;
  const descend = (n: PaintNode, corners: Float64Array): void => {
    if (!isSplit(n)) return;
    const children = splitCorners(corners, n.s, n.k);
    // L'enfant où le point a la plus grande « profondeur » (le plus petit
    // poids barycentrique local le plus haut).
    let best = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < children.length; i++) {
      const score = localMinWeight(children[i], b);
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    for (let i = 0; i < best; i++) index += leafTotal(n.c[i]);
    descend(n.c[best], children[best]);
  };
  descend(node, CORNERS);
  return index;
}

function leafTotal(node: PaintNode): number {
  if (!isSplit(node)) return 1;
  let n = 0;
  for (const child of node.c) n += leafTotal(child);
  return n;
}

/**
 * Plus petit poids du point `b` (barycentrique du triangle d'origine) dans la
 * feuille aux sommets `p` (barycentriques aussi) : positif dedans.
 */
function localMinWeight(p: Float64Array, b: readonly number[]): number {
  // Résolution 2D sur les deux premières coordonnées (la troisième en découle).
  const ax = p[0];
  const ay = p[1];
  const v0x = p[3] - ax;
  const v0y = p[4] - ay;
  const v1x = p[6] - ax;
  const v1y = p[7] - ay;
  const v2x = b[0] - ax;
  const v2y = b[1] - ay;
  const det = v0x * v1y - v1x * v0y;
  if (det === 0) return -Infinity;
  const u = (v2x * v1y - v1x * v2y) / det;
  const v = (v0x * v2y - v2x * v0y) / det;
  return Math.min(1 - u - v, u, v);
}

/**
 * Zone d'un clic sur la feuille `seedLeaf` du triangle `seed` : les feuilles
 * reliées par des côtés partagés, selon les options.
 */
export function bucketRegion(
  doc: PaintDocument,
  seed: number,
  seedLeaf: number,
  options: BucketOptions,
): LeafSelection {
  const cache = new LeafCache(doc);
  const { neighbours, vertexOf, faceNormals } = doc.topology;
  const cos =
    options.angle === null
      ? -Infinity
      : Math.cos((Math.min(180, Math.max(0, options.angle)) * Math.PI) / 180) -
        1e-6;
  const start = cache.get(seed);
  const seedState = sameColorState(start.states[seedLeaf] ?? 0);
  const visited = new Map<number, Uint8Array>();
  const seen = (t: number, leaf: number): boolean => {
    let marks = visited.get(t);
    if (!marks) {
      marks = new Uint8Array(cache.get(t).states.length);
      visited.set(t, marks);
    }
    if (marks[leaf]) return true;
    marks[leaf] = 1;
    return false;
  };
  const accepts = (t: number, leaf: number) =>
    !options.sameColor ||
    sameColorState(cache.get(t).states[leaf]) === seedState;
  // Deux triangles d'origine voisins : l'angle de leurs faces (un triangle
  // dégénéré, sans normale, ne bloque pas).
  const smooth = (a: number, b: number) => {
    if (options.angle === null) return true;
    const ax = faceNormals[a * 3];
    const ay = faceNormals[a * 3 + 1];
    const az = faceNormals[a * 3 + 2];
    const bx = faceNormals[b * 3];
    const by = faceNormals[b * 3 + 1];
    const bz = faceNormals[b * 3 + 2];
    if (
      (ax === 0 && ay === 0 && az === 0) ||
      (bx === 0 && by === 0 && bz === 0)
    )
      return true;
    return Math.min(1, Math.max(0, ax * bx + ay * by + az * bz)) >= cos;
  };

  const queueT: number[] = [seed];
  const queueL: number[] = [seedLeaf];
  seen(seed, seedLeaf);
  for (let head = 0; head < queueT.length; head++) {
    const t = queueT[head];
    const leaf = queueL[head];
    const leaves = cache.get(t);
    for (const other of leaves.inner[leaf])
      if (!seen(t, other) && accepts(t, other)) {
        queueT.push(t);
        queueL.push(other);
      }
    for (const { e, lo, hi } of leaves.borders[leaf]) {
      const u = neighbours[t * 3 + e];
      if (u < 0) continue;
      if (options.accept && !options.accept(u)) continue;
      if (!smooth(t, u)) continue;
      // Arête correspondante de u, et son sens.
      const va = vertexOf[t * 3 + e];
      const vb = vertexOf[t * 3 + ((e + 1) % 3)];
      let f = -1;
      let flipped = false;
      for (let g = 0; g < 3; g++) {
        const ua = vertexOf[u * 3 + g];
        const ub = vertexOf[u * 3 + ((g + 1) % 3)];
        if (ua === va && ub === vb) f = g;
        else if (ua === vb && ub === va) {
          f = g;
          flipped = true;
        }
        if (f >= 0) break;
      }
      if (f < 0) continue;
      // Intervalle de la feuille, dans le sens de l'arête de u.
      const a = flipped ? 1 - hi : lo;
      const b = flipped ? 1 - lo : hi;
      for (const entry of cache.get(u).onEdge[f]) {
        if (Math.max(a, entry.lo) >= Math.min(b, entry.hi)) continue;
        if (seen(u, entry.leaf) || !accepts(u, entry.leaf)) continue;
        queueT.push(u);
        queueL.push(entry.leaf);
      }
    }
  }

  const triangles = new Map<number, Set<number> | null>();
  for (let i = 0; i < queueT.length; i++) {
    const t = queueT[i];
    if (triangles.get(t) === null) continue;
    let set = triangles.get(t);
    if (!set) {
      set = new Set();
      triangles.set(t, set);
    }
    set.add(queueL[i]);
  }
  for (const [t, set] of triangles)
    if (set && set.size === cache.get(t).states.length) triangles.set(t, null);
  return { triangles, seedState };
}

/** La feuille `leaf` du triangle t fait-elle partie de la sélection ? */
export function inSelection(
  selection: LeafSelection,
  t: number,
  leaf: number,
): boolean {
  const entry = selection.triangles.get(t);
  return entry === null || (entry !== undefined && entry.has(leaf));
}

function paintLeaves(
  node: PaintNode,
  leaves: ReadonlySet<number>,
  state: number,
  counter: { i: number },
): PaintNode {
  if (!isSplit(node)) return leaves.has(counter.i++) ? state : node;
  return {
    ...node,
    c: node.c.map((c) => paintLeaves(c, leaves, state, counter)),
  };
}

/** Peint la sélection (dans l'étape ouverte par l'appelant). Renvoie les triangles changés. */
export function paintSelection(
  doc: PaintDocument,
  selection: LeafSelection,
  state: number,
): number {
  let changed = 0;
  for (const [t, leaves] of selection.triangles) {
    const next =
      leaves === null
        ? state
        : collapse(paintLeaves(doc.node(t), leaves, state, { i: 0 }));
    if (doc.setNode(t, next)) changed++;
  }
  return changed;
}

/** Sommets (repère du fichier) de chaque feuille sélectionnée. */
export function forEachSelectedLeaf(
  doc: PaintDocument,
  selection: LeafSelection,
  visit: (corners: ArrayLike<number>) => void,
): void {
  for (const [t, leaves] of selection.triangles) {
    const corners = doc.corners(t);
    if (leaves === null) {
      visit(corners);
      continue;
    }
    let i = 0;
    const walk = (node: PaintNode, c: ArrayLike<number>) => {
      if (!isSplit(node)) {
        if (leaves.has(i++)) visit(c);
        return;
      }
      const children = splitCorners(c, node.s, node.k);
      for (let k = 0; k < node.c.length; k++) walk(node.c[k], children[k]);
    };
    walk(doc.node(t), corners);
  }
}

/** Nombre de feuilles d'une sélection (aperçu). */
export function selectionSize(
  doc: PaintDocument,
  selection: LeafSelection,
): number {
  let n = 0;
  for (const [t, leaves] of selection.triangles)
    n += leaves === null ? leafTotal(doc.node(t)) : leaves.size;
  return n;
}

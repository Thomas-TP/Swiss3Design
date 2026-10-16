// Peinture par triangle au format des trancheurs (Bambu Studio, OrcaSlicer,
// PrusaSlicer) : chaque triangle d'origine du maillage porte un arbre de
// subdivision dont les feuilles ont un état (0 = non peint, n = filament n).
// C'est ce que ces logiciels écrivent dans un 3MF (attribut `paint_color` de
// Bambu Studio, `slic3rpe:mmu_segmentation` de PrusaSlicer) : un fichier peint
// ici s'ouvre peint chez eux, et un fichier peint chez eux (MakerWorld) s'ouvre
// peint ici.
//
// Réécriture indépendante du format, d'après sa description publique et le
// comportement de TriangleSelector (PrusaSlicer, Bambu Studio : AGPL-3.0) ;
// aucun code n'en est repris. Le format en bref :
//  - un triangle se découpe en 2, 3 ou 4 enfants selon le nombre de côtés coupés
//    en leur milieu (1, 2 ou 3) et un « côté spécial » (le côté coupé quand il
//    n'y en a qu'un, le côté gardé quand il y en a deux) ;
//  - l'arbre s'écrit en quartets (4 bits, bit de poids faible d'abord) : un
//    nœud coupé donne `côtés | spécial << 2` puis ses enfants, du DERNIER au
//    premier ; une feuille d'état n < 3 donne `n << 2` ; n ≥ 3 donne 0b1100, un
//    quartet 0b1111 par tranche de 15, puis le reste de n − 3 ;
//  - la chaîne hexadécimale (majuscules : Bambu Studio ignore les minuscules)
//    liste les quartets du DERNIER au premier ; un triangle non peint et non
//    coupé n'écrit rien.
// Exemples : filament 1 → "4", 2 → "8", 3 → "0C", 4 → "1C".

/** Nœud d'un arbre : une feuille (état 0..255) ou un triangle coupé. */
export type PaintNode = number | PaintSplit;

export interface PaintSplit {
  /** Nombre de côtés coupés en leur milieu (1, 2 ou 3). */
  s: 1 | 2 | 3;
  /** Côté spécial (0, 1 ou 2) : rotation des sommets avant la découpe. */
  k: 0 | 1 | 2;
  /** Enfants (s + 1). */
  c: PaintNode[];
}

/** État le plus haut accepté (Bambu Studio en adresse bien moins). */
export const MAX_PAINT_STATE = 255;
/** Profondeur maximale d'un arbre (garde-fou contre un fichier piégé). */
export const MAX_PAINT_DEPTH = 24;

export const isSplit = (node: PaintNode): node is PaintSplit =>
  typeof node !== "number";

// ── Géométrie de la découpe ──────────────────────────────────────────────────

/**
 * Sommets des enfants d'un triangle coupé. `p` : les 9 coordonnées des sommets
 * (a, b, c). Le résultat suit l'ordre des enfants du format : l'enfant i d'un
 * nœud est le triangle `out[i]`.
 */
export function splitCorners(
  p: ArrayLike<number>,
  s: 1 | 2 | 3,
  k: number,
): Float64Array[] {
  // Sommets tournés depuis le côté spécial : r0 = sommet k (opposé au côté k).
  const r = (i: number) => ((k + i) % 3) * 3;
  const r0 = r(0);
  const r1 = r(1);
  const r2 = r(2);
  const tri = (...v: number[]) => Float64Array.from(v);
  const mid = (i: number, j: number) => [
    (p[i] + p[j]) / 2,
    (p[i + 1] + p[j + 1]) / 2,
    (p[i + 2] + p[j + 2]) / 2,
  ];
  const at = (i: number) => [p[i], p[i + 1], p[i + 2]];
  if (s === 1) {
    // Un côté coupé (r1–r2), le sommet r0 en face.
    const m = mid(r2, r1);
    return [tri(...at(r0), ...at(r1), ...m), tri(...m, ...at(r2), ...at(r0))];
  }
  if (s === 2) {
    // Deux côtés coupés (r0–r1, r0–r2), r1–r2 gardé.
    const m01 = mid(r1, r0);
    const m02 = mid(r0, r2);
    return [
      tri(...at(r0), ...m01, ...m02),
      tri(...m01, ...at(r1), ...m02),
      tri(...at(r1), ...at(r2), ...m02),
    ];
  }
  // Trois côtés coupés : trois coins et le triangle central, en dernier.
  const m01 = mid(r1, r0);
  const m12 = mid(r2, r1);
  const m20 = mid(r0, r2);
  return [
    tri(...at(r0), ...m01, ...m20),
    tri(...m01, ...at(r1), ...m12),
    tri(...m12, ...at(r2), ...m20),
    tri(...m01, ...m12, ...m20),
  ];
}

/**
 * Part de l'aire du parent de chaque enfant (sans géométrie) : les milieux
 * coupent les aires en moitiés ou en quarts.
 */
export function childAreaShares(s: 1 | 2 | 3): readonly number[] {
  if (s === 1) return [0.5, 0.5];
  if (s === 2) return [0.25, 0.25, 0.5];
  return [0.25, 0.25, 0.25, 0.25];
}

/**
 * Découpe à la manière des trancheurs : les côtés plus longs que `limit` sont
 * coupés (aucun : null). Côté i = celui opposé au sommet i.
 */
export function splitRule(
  p: ArrayLike<number>,
  limit: number,
): { s: 1 | 2 | 3; k: 0 | 1 | 2 } | null {
  const d = (i: number, j: number) =>
    (p[i] - p[j]) ** 2 +
    (p[i + 1] - p[j + 1]) ** 2 +
    (p[i + 2] - p[j + 2]) ** 2;
  const sides = [d(6, 3), d(0, 6), d(3, 0)];
  const limit2 = limit * limit;
  const cut: number[] = [];
  let keep = 0;
  for (let i = 0; i < 3; i++) {
    if (sides[i] > limit2) cut.push(i);
    else keep = i;
  }
  if (cut.length === 0) return null;
  if (cut.length === 3) return { s: 3, k: 0 };
  if (cut.length === 2) return { s: 2, k: keep as 0 | 1 | 2 };
  return { s: 1, k: cut[0] as 0 | 1 | 2 };
}

// ── Arbres ───────────────────────────────────────────────────────────────────

/** Un triangle coupé dont toutes les feuilles ont le même état redevient une feuille. */
export function collapse(node: PaintNode): PaintNode {
  if (!isSplit(node)) return node;
  let same: number | null = null;
  let changed = false;
  const children = node.c.map((child) => {
    const next = collapse(child);
    if (next !== child) changed = true;
    return next;
  });
  for (const child of children) {
    if (isSplit(child)) return changed ? { ...node, c: children } : node;
    if (same === null) same = child;
    else if (same !== child) return changed ? { ...node, c: children } : node;
  }
  return same ?? 0;
}

/** Parcourt les feuilles (sommets et état) d'un triangle d'origine. */
export function forEachLeaf(
  node: PaintNode,
  corners: ArrayLike<number>,
  visit: (corners: ArrayLike<number>, state: number, share: number) => void,
  share = 1,
): void {
  if (!isSplit(node)) {
    visit(corners, node, share);
    return;
  }
  const children = splitCorners(corners, node.s, node.k);
  const shares = childAreaShares(node.s);
  for (let i = 0; i < node.c.length; i++)
    forEachLeaf(node.c[i], children[i], visit, share * shares[i]);
}

/** Nombre de feuilles d'un arbre. */
export function leafCount(node: PaintNode): number {
  if (!isSplit(node)) return 1;
  let n = 0;
  for (const child of node.c) n += leafCount(child);
  return n;
}

/** Ajoute à `area` la part d'aire de chaque état (sans géométrie). */
export function accumulateShares(
  node: PaintNode,
  area: number,
  out: Float64Array,
): void {
  if (!isSplit(node)) {
    if (node < out.length) out[node] += area;
    return;
  }
  const shares = childAreaShares(node.s);
  for (let i = 0; i < node.c.length; i++)
    accumulateShares(node.c[i], area * shares[i], out);
}

/** Remplace chaque état par `map[état]` (états absents de la table : inchangés). */
export function remapNode(node: PaintNode, map: ArrayLike<number>): PaintNode {
  if (!isSplit(node)) return node < map.length ? map[node] : node;
  return collapse({ ...node, c: node.c.map((child) => remapNode(child, map)) });
}

/** Copie profonde (pour l'historique : un arbre n'est jamais muté en place). */
export function cloneNode(node: PaintNode): PaintNode {
  return isSplit(node)
    ? { s: node.s, k: node.k, c: node.c.map(cloneNode) }
    : node;
}

// ── Écriture et lecture de la chaîne hexadécimale ────────────────────────────

const HEX = "0123456789ABCDEF";

function pushNibbles(node: PaintNode, out: number[]): void {
  if (!isSplit(node)) {
    if (node < 3) out.push(node << 2);
    else {
      out.push(0b1100);
      let rest = node - 3;
      while (rest >= 15) {
        out.push(0b1111);
        rest -= 15;
      }
      out.push(rest);
    }
    return;
  }
  out.push(node.s | (node.k << 2));
  for (let i = node.s; i >= 0; i--) pushNibbles(node.c[i], out);
}

/** Chaîne du format (vide pour un triangle non peint et non coupé). */
export function encodePaint(node: PaintNode): string {
  if (node === 0) return "";
  const nibbles: number[] = [];
  pushNibbles(node, nibbles);
  let out = "";
  for (let i = nibbles.length - 1; i >= 0; i--) out += HEX[nibbles[i]];
  return out;
}

/**
 * Lit la chaîne d'un triangle. null pour une chaîne malformée (caractère hors
 * de [0-9A-F], flux tronqué, côté spécial impossible, arbre trop profond) :
 * le triangle reste alors non peint, comme chez les trancheurs.
 */
export function decodePaint(text: string): PaintNode | null {
  const length = text.length;
  if (length === 0) return 0;
  const nibbles = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    const code = text.charCodeAt(length - 1 - i);
    if (code >= 48 && code <= 57) nibbles[i] = code - 48;
    else if (code >= 65 && code <= 70) nibbles[i] = code - 55;
    else return null;
  }
  let cursor = 0;
  const read = (): number => (cursor < length ? nibbles[cursor++] : -1);

  function node(depth: number): PaintNode | null {
    if (depth > MAX_PAINT_DEPTH) return null;
    const code = read();
    if (code < 0) return null;
    const sides = code & 0b11;
    if (sides === 0) {
      if ((code & 0b1100) !== 0b1100) return code >> 2;
      let runs = 0;
      let next = read();
      while (next === 0b1111) {
        runs++;
        next = read();
      }
      if (next < 0) return null;
      const state = next + 15 * runs + 3;
      return state <= MAX_PAINT_STATE ? state : null;
    }
    const special = code >> 2;
    if (special > 2) return null;
    const children: PaintNode[] = Array.from({ length: sides + 1 }, () => 0);
    // Enfants écrits du dernier au premier.
    for (let i = sides; i >= 0; i--) {
      const child = node(depth + 1);
      if (child === null) return null;
      children[i] = child;
    }
    return { s: sides as 1 | 2 | 3, k: special as 0 | 1 | 2, c: children };
  }

  return node(0);
}

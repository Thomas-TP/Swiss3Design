// Hiérarchie de boîtes englobantes (BVH) des triangles d'un maillage : le
// pinceau et le pointeur de l'atelier 3D interrogent un maillage d'un million de
// triangles en quelques microsecondes (rayon du pointeur, sphère du pinceau).
// Pur TypeScript, tableaux typés seulement (transférables à un Worker), sans
// three : la scène lui passe le rayon dans le repère du modèle.
//
// Construction : découpe au milieu de l'axe le plus long des centres, en place
// (O(n log n)), feuilles de 8 triangles au plus.

const LEAF = 0x80000000;

export interface Bvh {
  /** 6 nombres par nœud : min x, y, z puis max x, y, z. */
  bounds: Float32Array;
  /** 2 par nœud : enfants (gauche, droite) ou feuille (début, nombre | LEAF). */
  links: Uint32Array;
  /** Triangles dans l'ordre des feuilles. */
  order: Uint32Array;
  nodeCount: number;
}

export interface RayHit {
  triangle: number;
  /** Distance le long du rayon (unités du rayon). */
  t: number;
  /** Point touché. */
  point: [number, number, number];
  /** Coordonnées barycentriques (u, v) du point dans le triangle. */
  u: number;
  v: number;
}

export function buildBvh(positions: Float32Array, leafSize = 8): Bvh {
  const count = Math.floor(positions.length / 9);
  const centers = new Float32Array(count * 3);
  for (let t = 0; t < count; t++) {
    const o = t * 9;
    centers[t * 3] = (positions[o] + positions[o + 3] + positions[o + 6]) / 3;
    centers[t * 3 + 1] =
      (positions[o + 1] + positions[o + 4] + positions[o + 7]) / 3;
    centers[t * 3 + 2] =
      (positions[o + 2] + positions[o + 5] + positions[o + 8]) / 3;
  }
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;

  let capacity = Math.max(16, Math.ceil((count / leafSize) * 4));
  let bounds = new Float32Array(capacity * 6);
  let links = new Uint32Array(capacity * 2);
  let nodeCount = 0;
  const allocate = () => {
    if (nodeCount === capacity) {
      capacity *= 2;
      const b = new Float32Array(capacity * 6);
      b.set(bounds);
      bounds = b;
      const l = new Uint32Array(capacity * 2);
      l.set(links);
      links = l;
    }
    return nodeCount++;
  };

  const stack: number[] = [];
  const root = allocate();
  stack.push(root, 0, count);
  while (stack.length > 0) {
    const end = stack.pop()!;
    const start = stack.pop()!;
    const node = stack.pop()!;
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    let cMinX = Infinity;
    let cMinY = Infinity;
    let cMinZ = Infinity;
    let cMaxX = -Infinity;
    let cMaxY = -Infinity;
    let cMaxZ = -Infinity;
    for (let i = start; i < end; i++) {
      const t = order[i];
      const o = t * 9;
      for (let k = 0; k < 9; k += 3) {
        const x = positions[o + k];
        const y = positions[o + k + 1];
        const z = positions[o + k + 2];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
      const cx = centers[t * 3];
      const cy = centers[t * 3 + 1];
      const cz = centers[t * 3 + 2];
      if (cx < cMinX) cMinX = cx;
      if (cx > cMaxX) cMaxX = cx;
      if (cy < cMinY) cMinY = cy;
      if (cy > cMaxY) cMaxY = cy;
      if (cz < cMinZ) cMinZ = cz;
      if (cz > cMaxZ) cMaxZ = cz;
    }
    const b = node * 6;
    bounds[b] = minX;
    bounds[b + 1] = minY;
    bounds[b + 2] = minZ;
    bounds[b + 3] = maxX;
    bounds[b + 4] = maxY;
    bounds[b + 5] = maxZ;
    const n = end - start;
    const ex = cMaxX - cMinX;
    const ey = cMaxY - cMinY;
    const ez = cMaxZ - cMinZ;
    if (n <= leafSize || Math.max(ex, ey, ez) <= 0) {
      links[node * 2] = start;
      links[node * 2 + 1] = (n | LEAF) >>> 0;
      continue;
    }
    const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
    const mid =
      axis === 0
        ? (cMinX + cMaxX) / 2
        : axis === 1
          ? (cMinY + cMaxY) / 2
          : (cMinZ + cMaxZ) / 2;
    let i = start;
    let j = end - 1;
    while (i <= j) {
      if (centers[order[i] * 3 + axis] < mid) i++;
      else {
        const swap = order[i];
        order[i] = order[j];
        order[j] = swap;
        j--;
      }
    }
    let split = i;
    if (split === start || split === end) split = (start + end) >> 1;
    const left = allocate();
    const right = allocate();
    links[node * 2] = left;
    links[node * 2 + 1] = right;
    stack.push(left, start, split, right, split, end);
  }
  return {
    bounds: bounds.slice(0, nodeCount * 6),
    links: links.slice(0, nodeCount * 2),
    order,
    nodeCount,
  };
}

const isLeaf = (bvh: Bvh, node: number) =>
  (bvh.links[node * 2 + 1] & LEAF) !== 0;

/** Entrée du rayon dans la boîte du nœud (Infinity s'il la manque). */
function slab(
  bvh: Bvh,
  node: number,
  ox: number,
  oy: number,
  oz: number,
  ix: number,
  iy: number,
  iz: number,
  far: number,
): number {
  const b = node * 6;
  let t1 = (bvh.bounds[b] - ox) * ix;
  let t2 = (bvh.bounds[b + 3] - ox) * ix;
  let tmin = Math.min(t1, t2);
  let tmax = Math.max(t1, t2);
  t1 = (bvh.bounds[b + 1] - oy) * iy;
  t2 = (bvh.bounds[b + 4] - oy) * iy;
  tmin = Math.max(tmin, Math.min(t1, t2));
  tmax = Math.min(tmax, Math.max(t1, t2));
  t1 = (bvh.bounds[b + 2] - oz) * iz;
  t2 = (bvh.bounds[b + 5] - oz) * iz;
  tmin = Math.max(tmin, Math.min(t1, t2));
  tmax = Math.min(tmax, Math.max(t1, t2));
  // NaN (rayon parallèle à une face, sur son plan) : on garde la boîte.
  if (Number.isNaN(tmin) || Number.isNaN(tmax)) return 0;
  return tmax >= Math.max(tmin, 0) && tmin <= far
    ? Math.max(tmin, 0)
    : Infinity;
}

/**
 * Premier triangle touché par le rayon (deux faces), ou null. `accept` écarte
 * un impact (plan de coupe : la partie masquée ne se peint pas) ; le suivant
 * le long du rayon est alors retenu.
 */
export function raycastBvh(
  bvh: Bvh,
  positions: Float32Array,
  origin: readonly [number, number, number],
  direction: readonly [number, number, number],
  accept?: (x: number, y: number, z: number, triangle: number) => boolean,
): RayHit | null {
  if (bvh.nodeCount === 0) return null;
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = direction;
  const ix = 1 / dx;
  const iy = 1 / dy;
  const iz = 1 / dz;
  let best: RayHit | null = null;
  let far = Infinity;
  const stack: number[] = [0];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (slab(bvh, node, ox, oy, oz, ix, iy, iz, far) === Infinity) continue;
    if (isLeaf(bvh, node)) {
      const start = bvh.links[node * 2];
      const n = bvh.links[node * 2 + 1] & ~LEAF;
      for (let i = start; i < start + n; i++) {
        const tri = bvh.order[i];
        const o = tri * 9;
        // Möller–Trumbore, sans élimination des faces arrière.
        const e1x = positions[o + 3] - positions[o];
        const e1y = positions[o + 4] - positions[o + 1];
        const e1z = positions[o + 5] - positions[o + 2];
        const e2x = positions[o + 6] - positions[o];
        const e2y = positions[o + 7] - positions[o + 1];
        const e2z = positions[o + 8] - positions[o + 2];
        const px = dy * e2z - dz * e2y;
        const py = dz * e2x - dx * e2z;
        const pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det;
        const tx = ox - positions[o];
        const ty = oy - positions[o + 1];
        const tz = oz - positions[o + 2];
        const u = (tx * px + ty * py + tz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y;
        const qy = tz * e1x - tx * e1z;
        const qz = tx * e1y - ty * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t <= 0 || t >= far) continue;
        const x = ox + dx * t;
        const y = oy + dy * t;
        const z = oz + dz * t;
        if (accept && !accept(x, y, z, tri)) continue;
        far = t;
        best = { triangle: tri, t, point: [x, y, z], u, v };
      }
      continue;
    }
    const left = bvh.links[node * 2];
    const right = bvh.links[node * 2 + 1];
    const tl = slab(bvh, left, ox, oy, oz, ix, iy, iz, far);
    const tr = slab(bvh, right, ox, oy, oz, ix, iy, iz, far);
    // Le plus proche en dernier : dépilé en premier.
    if (tl <= tr) {
      if (tr !== Infinity) stack.push(right);
      if (tl !== Infinity) stack.push(left);
    } else {
      if (tl !== Infinity) stack.push(left);
      if (tr !== Infinity) stack.push(right);
    }
  }
  return best;
}

/**
 * Triangles dont la boîte touche la sphère (centre, rayon) : candidats du
 * pinceau, que l'appelant teste ensuite précisément.
 */
export function queryBvhSphere(
  bvh: Bvh,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  visit: (triangle: number) => void,
): void {
  if (bvh.nodeCount === 0) return;
  const r2 = radius * radius;
  const stack: number[] = [0];
  while (stack.length > 0) {
    const node = stack.pop()!;
    const b = node * 6;
    const dx = Math.max(bvh.bounds[b] - cx, 0, cx - bvh.bounds[b + 3]);
    const dy = Math.max(bvh.bounds[b + 1] - cy, 0, cy - bvh.bounds[b + 4]);
    const dz = Math.max(bvh.bounds[b + 2] - cz, 0, cz - bvh.bounds[b + 5]);
    if (dx * dx + dy * dy + dz * dz > r2) continue;
    if (isLeaf(bvh, node)) {
      const start = bvh.links[node * 2];
      const n = bvh.links[node * 2 + 1] & ~LEAF;
      for (let i = start; i < start + n; i++) visit(bvh.order[i]);
      continue;
    }
    stack.push(bvh.links[node * 2], bvh.links[node * 2 + 1]);
  }
}

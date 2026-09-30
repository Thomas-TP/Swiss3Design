// Constructeur de maillage et outils de contrôle (brief « Strates », §6.3.2 :
// `kernel/mesh.ts` — constructeur, normales, fusion de coques, boîte, volume
// signé, aire, test de variété).
//
// Conventions (les mêmes pour tous les objets du Studio) :
//  - millimètres, Z vers le haut ;
//  - triangles dans le sens trigonométrique vu de l'EXTÉRIEUR de la matière
//    (la normale géométrique (b − a) × (c − a) sort du solide) ;
//  - `groups[k].start` et `.count` sont en unités d'INDEX (multiples de 3),
//    comme `BufferGeometry.addGroup` de three : le Stage les recopie tels
//    quels ;
//  - les sommets d'une arête vive (corniche, lèvre, fond) sont DUPLIQUÉS avec
//    leurs propres normales : la topologie se vérifie donc par position
//    (checkManifold soude les sommets de mêmes coordonnées).
import type { MeshData } from "../types";

/** Constructeur à tableaux typés extensibles (pas de tableau JS intermédiaire). */
export class MeshBuilder {
  private pos: Float32Array;
  private nor: Float32Array;
  private sid: Float32Array;
  private idx: Uint32Array;
  private band: Uint8Array;
  private nv = 0;
  private nt = 0;

  constructor(vertexCapacity = 1024, triangleCapacity = 2048) {
    this.pos = new Float32Array(vertexCapacity * 3);
    this.nor = new Float32Array(vertexCapacity * 3);
    this.sid = new Float32Array(vertexCapacity);
    this.idx = new Uint32Array(triangleCapacity * 3);
    this.band = new Uint8Array(triangleCapacity);
  }

  get vertexCount(): number {
    return this.nv;
  }

  get triangleCount(): number {
    return this.nt;
  }

  private growVertices() {
    const cap = this.sid.length * 2;
    const pos = new Float32Array(cap * 3);
    pos.set(this.pos);
    const nor = new Float32Array(cap * 3);
    nor.set(this.nor);
    const sid = new Float32Array(cap);
    sid.set(this.sid);
    this.pos = pos;
    this.nor = nor;
    this.sid = sid;
  }

  private growTriangles() {
    const cap = this.band.length * 2;
    const idx = new Uint32Array(cap * 3);
    idx.set(this.idx);
    const band = new Uint8Array(cap);
    band.set(this.band);
    this.idx = idx;
    this.band = band;
  }

  /** Ajoute un sommet ; renvoie son index. `side` : 0 paroi extérieure, 1 le reste. */
  addVertex(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    side = 0,
  ): number {
    if (this.nv === this.sid.length) this.growVertices();
    const i = this.nv++;
    const o = i * 3;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = z;
    this.nor[o] = nx;
    this.nor[o + 1] = ny;
    this.nor[o + 2] = nz;
    this.sid[i] = side;
    return i;
  }

  /** Ajoute un triangle (sens trigonométrique vu de l'extérieur), dans la bande `band`. */
  addTriangle(a: number, b: number, c: number, band = 0): void {
    if (this.nt === this.band.length) this.growTriangles();
    const o = this.nt * 3;
    this.idx[o] = a;
    this.idx[o + 1] = b;
    this.idx[o + 2] = c;
    this.band[this.nt] = band;
    this.nt++;
  }

  /** Quadrilatère (a, b, c, d) dans le sens trigonométrique : deux triangles. */
  addQuad(a: number, b: number, c: number, d: number, band = 0): void {
    this.addTriangle(a, b, c, band);
    this.addTriangle(a, c, d, band);
  }

  /**
   * Fige le maillage. Les triangles sont regroupés par bande (tri stable par
   * comptage) : un groupe par bande non vide, en ordre croissant.
   * `withSide` : inclut l'attribut `side` (lignes fantômes du matériau).
   */
  build(withSide = true): MeshData {
    const nt = this.nt;
    let maxBand = 0;
    for (let t = 0; t < nt; t++)
      if (this.band[t] > maxBand) maxBand = this.band[t];
    const counts = new Uint32Array(maxBand + 1);
    for (let t = 0; t < nt; t++) counts[this.band[t]]++;
    const offsets = new Uint32Array(maxBand + 1);
    const groups: MeshData["groups"] = [];
    let acc = 0;
    for (let b = 0; b <= maxBand; b++) {
      offsets[b] = acc;
      if (counts[b] > 0)
        groups.push({ start: acc * 3, count: counts[b] * 3, band: b });
      acc += counts[b];
    }
    const indices = new Uint32Array(nt * 3);
    for (let t = 0; t < nt; t++) {
      const dst = offsets[this.band[t]]++ * 3;
      const src = t * 3;
      indices[dst] = this.idx[src];
      indices[dst + 1] = this.idx[src + 1];
      indices[dst + 2] = this.idx[src + 2];
    }
    const positions = this.pos.slice(0, this.nv * 3);
    return {
      positions,
      normals: this.nor.slice(0, this.nv * 3),
      indices,
      ...(withSide ? { side: this.sid.slice(0, this.nv) } : {}),
      groups,
      bbox: bboxOf(positions),
      triangles: nt,
    };
  }
}

export function bboxOf(positions: Float32Array): MeshData["bbox"] {
  if (positions.length === 0) return [0, 0, 0, 0, 0, 0];
  let x0 = Infinity,
    y0 = Infinity,
    z0 = Infinity;
  let x1 = -Infinity,
    y1 = -Infinity,
    z1 = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i],
      y = positions[i + 1],
      z = positions[i + 2];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return [x0, y0, z0, x1, y1, z1];
}

/** Volume signé (mm³) : somme des tétraèdres (0, a, b, c). Positif si orienté vers l'extérieur. */
export function meshVolume(mesh: MeshData): number {
  const p = mesh.positions;
  const ix = mesh.indices;
  let v = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3,
      b = ix[t + 1] * 3,
      c = ix[t + 2] * 3;
    v +=
      (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
        p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
        p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) /
      6;
  }
  return v;
}

/** Aire de surface (mm²). */
export function meshArea(mesh: MeshData): number {
  const p = mesh.positions;
  const ix = mesh.indices;
  let area = 0;
  for (let t = 0; t < ix.length; t += 3)
    area += triangleArea(p, ix[t], ix[t + 1], ix[t + 2]);
  return area;
}

function triangleArea(
  p: Float32Array,
  a: number,
  b: number,
  c: number,
): number {
  a *= 3;
  b *= 3;
  c *= 3;
  const ux = p[b] - p[a],
    uy = p[b + 1] - p[a + 1],
    uz = p[b + 2] - p[a + 2];
  const vx = p[c] - p[a],
    vy = p[c + 1] - p[a + 1],
    vz = p[c + 2] - p[a + 2];
  const cx = uy * vz - uz * vy,
    cy = uz * vx - ux * vz,
    cz = ux * vy - uy * vx;
  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
}

/**
 * Fusion de coques : concatène les maillages (indices décalés). Les groupes
 * sont conservés ; deux coques qui portent la même bande donnent deux groupes
 * (le constructeur de groupes contigus n'est pas nécessaire pour un rendu).
 */
export function mergeMeshes(meshes: readonly MeshData[]): MeshData {
  let nv = 0;
  let ni = 0;
  let withSide = true;
  for (const m of meshes) {
    nv += m.positions.length / 3;
    ni += m.indices.length;
    if (!m.side) withSide = false;
  }
  const positions = new Float32Array(nv * 3);
  const normals = new Float32Array(nv * 3);
  const side = withSide ? new Float32Array(nv) : undefined;
  const indices = new Uint32Array(ni);
  const groups: MeshData["groups"] = [];
  let vo = 0;
  let io = 0;
  for (const m of meshes) {
    positions.set(m.positions, vo * 3);
    normals.set(m.normals, vo * 3);
    if (side && m.side) side.set(m.side, vo);
    for (let i = 0; i < m.indices.length; i++)
      indices[io + i] = m.indices[i] + vo;
    for (const g of m.groups) groups.push({ ...g, start: g.start + io });
    vo += m.positions.length / 3;
    io += m.indices.length;
  }
  return {
    positions,
    normals,
    indices,
    ...(side ? { side } : {}),
    groups,
    bbox: bboxOf(positions),
    triangles: ni / 3,
  };
}

// ── Test de variété ──────────────────────────────────────────────────────────

export interface ManifoldReport {
  /** Vrai si toutes les arêtes sont partagées par exactement 2 triangles d'orientations opposées. */
  closed: boolean;
  /** Arêtes à un seul triangle (trous). */
  openEdges: number;
  /** Arêtes à 3 triangles ou plus. */
  nonManifoldEdges: number;
  /** Arêtes à 2 triangles de MÊME orientation (normales incohérentes). */
  orientationErrors: number;
  /** Triangles d'aire inférieure au seuil. */
  degenerateTriangles: number;
  /** Composantes connexes (coques), après soudure des sommets confondus. */
  components: number;
  /** Volume signé (mm³) de chaque composante, dans l'ordre de première apparition. */
  componentVolumes: number[];
}

const VERTEX_BITS = new Uint32Array(1);
const VERTEX_FLOAT = new Float32Array(VERTEX_BITS.buffer);

/** Indice de sommet soudé : les sommets de mêmes coordonnées Float32 se confondent. */
function weldVertices(positions: Float32Array): Int32Array {
  const n = positions.length / 3;
  let size = 1;
  while (size < n * 2) size <<= 1;
  const table = new Int32Array(size).fill(-1);
  const welded = new Int32Array(n);
  const mask = size - 1;
  const bits = (v: number) => {
    VERTEX_FLOAT[0] = v === 0 ? 0 : v; // -0 et +0 sont le même point
    return VERTEX_BITS[0];
  };
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3],
      y = positions[i * 3 + 1],
      z = positions[i * 3 + 2];
    let h =
      (Math.imul(bits(x), 73856093) ^
        Math.imul(bits(y), 19349663) ^
        Math.imul(bits(z), 83492791)) >>>
      0;
    for (;;) {
      const slot = h & mask;
      const other = table[slot];
      if (other === -1) {
        table[slot] = i;
        welded[i] = i;
        break;
      }
      if (
        positions[other * 3] === x &&
        positions[other * 3 + 1] === y &&
        positions[other * 3 + 2] === z
      ) {
        welded[i] = other;
        break;
      }
      h = slot + 1;
    }
  }
  return welded;
}

/**
 * Test de variété du brief (§6.3.5) : chaque arête partagée par exactement
 * deux triangles d'orientations opposées, par composante connexe ; aucun
 * triangle d'aire < `minArea` ; volume signé de chaque coque.
 */
export function checkManifold(mesh: MeshData, minArea = 1e-6): ManifoldReport {
  const ix = mesh.indices;
  const nTri = ix.length / 3;
  const welded = weldVertices(mesh.positions);

  // Table d'arêtes non orientées (min, max) à adressage ouvert : compte et
  // somme des sens (+1 si a < b, −1 sinon). Fermée et orientée ⇔ compte 2, somme 0.
  let size = 1;
  while (size < nTri * 6) size <<= 1;
  const mask = size - 1;
  const keyA = new Int32Array(size).fill(-1);
  const keyB = new Int32Array(size);
  const count = new Uint8Array(size);
  const dir = new Int8Array(size);

  // Union-find sur les sommets soudés, pour les composantes.
  const parent = new Int32Array(welded.length);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = (x: number) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };

  let degenerate = 0;
  const touch = (a: number, b: number) => {
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    let slot = (Math.imul(lo, 73856093) ^ Math.imul(hi, 19349663)) & mask;
    for (;;) {
      if (keyA[slot] === -1) {
        keyA[slot] = lo;
        keyB[slot] = hi;
        break;
      }
      if (keyA[slot] === lo && keyB[slot] === hi) break;
      slot = (slot + 1) & mask;
    }
    if (count[slot] < 255) count[slot]++;
    dir[slot] += a < b ? 1 : -1;
  };

  for (let t = 0; t < nTri; t++) {
    const a = ix[t * 3],
      b = ix[t * 3 + 1],
      c = ix[t * 3 + 2];
    if (triangleArea(mesh.positions, a, b, c) < minArea) degenerate++;
    const wa = welded[a],
      wb = welded[b],
      wc = welded[c];
    touch(wa, wb);
    touch(wb, wc);
    touch(wc, wa);
    const ra = find(wa);
    const rb = find(wb);
    const rc = find(wc);
    if (ra !== rb) parent[rb] = ra;
    const rb2 = find(wb);
    if (rb2 !== rc) parent[rc] = rb2;
  }

  let open = 0,
    nonManifold = 0,
    orientation = 0;
  for (let s = 0; s < size; s++) {
    if (keyA[s] === -1) continue;
    if (count[s] === 1) open++;
    else if (count[s] > 2) nonManifold++;
    else if (dir[s] !== 0) orientation++;
  }

  // Volume signé par composante.
  const volumeByRoot = new Map<number, number>();
  const p = mesh.positions;
  for (let t = 0; t < nTri; t++) {
    const a = ix[t * 3] * 3,
      b = ix[t * 3 + 1] * 3,
      c = ix[t * 3 + 2] * 3;
    const v =
      (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
        p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
        p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) /
      6;
    const root = find(welded[ix[t * 3]]);
    volumeByRoot.set(root, (volumeByRoot.get(root) ?? 0) + v);
  }

  return {
    closed: open === 0 && nonManifold === 0 && orientation === 0,
    openEdges: open,
    nonManifoldEdges: nonManifold,
    orientationErrors: orientation,
    degenerateTriangles: degenerate,
    components: volumeByRoot.size,
    componentVolumes: [...volumeByRoot.values()],
  };
}

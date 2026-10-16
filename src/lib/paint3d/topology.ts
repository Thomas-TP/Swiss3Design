// Topologie d'un maillage « triangles indépendants » (9 nombres par triangle,
// comme un STL) : sommets soudés (positions identiques au bit près), triangles
// voisins par arête, normales et aires. Sert au remplissage (voisins, angle
// entre faces), à l'ombrage doux de l'atelier (normales par coin) et à
// l'export 3MF (sommets indexés). Pur TypeScript, tableaux typés seulement.

export interface Topology {
  /** Sommet soudé de chaque coin (3 par triangle). */
  vertexOf: Uint32Array;
  vertexCount: number;
  /** Triangles autour de chaque sommet (format CSR : début, puis liste). */
  incidentStart: Uint32Array;
  incident: Uint32Array;
  /** Voisin par l'arête (coin i → coin i + 1) de chaque triangle, −1 sinon. */
  neighbours: Int32Array;
  /** Normale unitaire de chaque triangle (0, 0, 0 pour un triangle plat). */
  faceNormals: Float32Array;
  /** Aire de chaque triangle (unités du fichier²). */
  areas: Float32Array;
}

function hash3(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ (a >>> 15), 0x2c1b3c6d);
  h ^= Math.imul(b ^ (b >>> 13), 0x297a2d39);
  h ^= Math.imul(c ^ (c >>> 16), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Soude les coins de positions identiques (au bit près). */
export function weldCorners(positions: Float32Array): {
  vertexOf: Uint32Array;
  vertexCount: number;
  /** Premier coin de chaque sommet (ses coordonnées). */
  firstCorner: Uint32Array;
} {
  const corners = Math.floor(positions.length / 3);
  const bits = new Uint32Array(
    positions.buffer,
    positions.byteOffset,
    corners * 3,
  );
  let size = 1;
  while (size < corners * 2) size <<= 1;
  const mask = size - 1;
  const table = new Int32Array(size).fill(-1);
  const vertexOf = new Uint32Array(corners);
  const firstCorner = new Uint32Array(corners);
  let vertexCount = 0;
  for (let c = 0; c < corners; c++) {
    const a = bits[c * 3];
    const b = bits[c * 3 + 1];
    const d = bits[c * 3 + 2];
    let slot = hash3(a, b, d) & mask;
    for (;;) {
      const v = table[slot];
      if (v < 0) {
        table[slot] = vertexCount;
        firstCorner[vertexCount] = c;
        vertexOf[c] = vertexCount++;
        break;
      }
      const r = firstCorner[v] * 3;
      if (bits[r] === a && bits[r + 1] === b && bits[r + 2] === d) {
        vertexOf[c] = v;
        break;
      }
      slot = (slot + 1) & mask;
    }
  }
  return {
    vertexOf,
    vertexCount,
    firstCorner: firstCorner.slice(0, vertexCount),
  };
}

export function buildTopology(positions: Float32Array): Topology {
  const triangles = Math.floor(positions.length / 9);
  const { vertexOf, vertexCount } = weldCorners(positions);

  // Triangles autour de chaque sommet.
  const incidentStart = new Uint32Array(vertexCount + 1);
  for (let c = 0; c < triangles * 3; c++) incidentStart[vertexOf[c] + 1]++;
  for (let v = 0; v < vertexCount; v++)
    incidentStart[v + 1] += incidentStart[v];
  const fill = incidentStart.slice(0, vertexCount);
  const incident = new Uint32Array(triangles * 3);
  for (let c = 0; c < triangles * 3; c++)
    incident[fill[vertexOf[c]]++] = Math.floor(c / 3);

  // Voisins par arête : le premier autre triangle qui porte les deux sommets.
  const neighbours = new Int32Array(triangles * 3).fill(-1);
  for (let t = 0; t < triangles; t++) {
    for (let e = 0; e < 3; e++) {
      if (neighbours[t * 3 + e] >= 0) continue;
      const va = vertexOf[t * 3 + e];
      const vb = vertexOf[t * 3 + ((e + 1) % 3)];
      if (va === vb) continue;
      for (let i = incidentStart[va]; i < incidentStart[va + 1]; i++) {
        const u = incident[i];
        if (u === t) continue;
        let edge = -1;
        for (let f = 0; f < 3; f++) {
          const a = vertexOf[u * 3 + f];
          const b = vertexOf[u * 3 + ((f + 1) % 3)];
          if ((a === vb && b === va) || (a === va && b === vb)) {
            edge = f;
            break;
          }
        }
        if (edge < 0) continue;
        neighbours[t * 3 + e] = u;
        if (neighbours[u * 3 + edge] < 0) neighbours[u * 3 + edge] = t;
        break;
      }
    }
  }

  const faceNormals = new Float32Array(triangles * 3);
  const areas = new Float32Array(triangles);
  for (let t = 0; t < triangles; t++) {
    const o = t * 9;
    const ax = positions[o + 3] - positions[o];
    const ay = positions[o + 4] - positions[o + 1];
    const az = positions[o + 5] - positions[o + 2];
    const bx = positions[o + 6] - positions[o];
    const by = positions[o + 7] - positions[o + 1];
    const bz = positions[o + 8] - positions[o + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const length = Math.hypot(nx, ny, nz);
    areas[t] = length / 2;
    if (length > 0) {
      faceNormals[t * 3] = nx / length;
      faceNormals[t * 3 + 1] = ny / length;
      faceNormals[t * 3 + 2] = nz / length;
    }
  }

  return {
    vertexOf,
    vertexCount,
    incidentStart,
    incident,
    neighbours,
    faceNormals,
    areas,
  };
}

/**
 * Normales par coin : moyenne (pondérée par l'aire) des faces autour du sommet
 * qui ne s'écartent pas de plus de `creaseDeg` de la face du coin ; les arêtes
 * vives restent nettes, les courbes s'adoucissent. 9 nombres par triangle.
 */
export function creasedNormals(
  topology: Topology,
  creaseDeg = 40,
): Float32Array {
  const { vertexOf, incidentStart, incident, faceNormals, areas } = topology;
  const triangles = areas.length;
  const cos = Math.cos((creaseDeg * Math.PI) / 180);
  const out = new Float32Array(triangles * 9);
  for (let t = 0; t < triangles; t++) {
    const fx = faceNormals[t * 3];
    const fy = faceNormals[t * 3 + 1];
    const fz = faceNormals[t * 3 + 2];
    for (let i = 0; i < 3; i++) {
      const v = vertexOf[t * 3 + i];
      let x = 0;
      let y = 0;
      let z = 0;
      for (let k = incidentStart[v]; k < incidentStart[v + 1]; k++) {
        const u = incident[k];
        const ux = faceNormals[u * 3];
        const uy = faceNormals[u * 3 + 1];
        const uz = faceNormals[u * 3 + 2];
        if (ux * fx + uy * fy + uz * fz < cos) continue;
        const w = areas[u];
        x += ux * w;
        y += uy * w;
        z += uz * w;
      }
      const length = Math.hypot(x, y, z);
      const o = t * 9 + i * 3;
      if (length > 0) {
        out[o] = x / length;
        out[o + 1] = y / length;
        out[o + 2] = z / length;
      } else {
        out[o] = fx;
        out[o + 1] = fy;
        out[o + 2] = fz;
      }
    }
  }
  return out;
}

/**
 * Parcours en largeur depuis `seed` par les arêtes partagées, tant que `pass`
 * accepte le passage du triangle `from` au voisin `to`. Renvoie les triangles
 * atteints (seed compris).
 */
export function floodTriangles(
  topology: Topology,
  seed: number,
  pass: (from: number, to: number) => boolean,
  limit = Number.POSITIVE_INFINITY,
): Uint32Array {
  const { neighbours } = topology;
  const seen = new Uint8Array(topology.areas.length);
  let queue = new Uint32Array(1024);
  let head = 0;
  let tail = 0;
  const push = (t: number) => {
    if (tail === queue.length) {
      const grown = new Uint32Array(queue.length * 2);
      grown.set(queue);
      queue = grown;
    }
    queue[tail++] = t;
  };
  seen[seed] = 1;
  push(seed);
  while (head < tail && tail < limit) {
    const t = queue[head++];
    for (let e = 0; e < 3; e++) {
      const u = neighbours[t * 3 + e];
      if (u < 0 || seen[u]) continue;
      if (!pass(t, u)) continue;
      seen[u] = 1;
      push(u);
    }
  }
  return queue.slice(0, tail);
}

// Écriture du STL binaire (brief « Strates », §6.9, point 3) :
//  - en-tête de 80 octets ASCII `Swiss3Design Studio v1 lavaux <hash8>`
//    complété d'espaces ; il ne commence JAMAIS par « solid » (un STL binaire
//    dont l'en-tête commence par « solid » est pris pour de l'ASCII par
//    certains lecteurs, et refusé par /api/quote-upload) ;
//  - uint32 du nombre de triangles, puis par triangle : normale et 3 sommets
//    en float32 little-endian, uint16 à 0 ;
//  - mm, Z vers le haut ; 84 + 50 × n octets (assertion) ; cible 1–3 Mo,
//    plafond 200 k triangles.
// Les normales écrites sont celles de la GÉOMÉTRIE (sens trigonométrique),
// unitaires, pas celles des sommets : les trancheurs les recalculent de toute
// façon, mais un lecteur strict les vérifie.
import { hash8 } from "./kernel/hash";
import type { MeshData, StudioConfig, StudioTexts } from "./types";

export const STL_HEADER_BYTES = 80;
export const STL_MAX_TRIANGLES = 200_000;

export interface StlResult {
  buffer: ArrayBuffer;
  triangles: number;
  bytes: number;
}

/** Empreinte courte d'une configuration et de ses textes (clé d'envoi, nom de fichier). */
export function studioHash(config: StudioConfig, texts: StudioTexts = {}): string {
  return hash8({ config, texts });
}

/** Nom du fichier envoyé : `s3d-lavaux-<hash8>.stl`. */
export function stlFileName(config: StudioConfig, hash: string): string {
  return `s3d-${config.object}-${hash}.stl`;
}

/** En-tête de 80 octets ASCII : jamais « solid » en tête. */
export function stlHeader(object: string, hash: string): string {
  const text = `Swiss3Design Studio v1 ${object} ${hash}`;
  return text.padEnd(STL_HEADER_BYTES, " ").slice(0, STL_HEADER_BYTES);
}

/** Écrit un maillage en STL binaire. `header` : texte ASCII (80 octets au plus, complété d'espaces). */
export function writeBinaryStl(mesh: MeshData, header: string): StlResult {
  if (/^\s*solid/i.test(header)) {
    throw new Error("L'en-tête d'un STL binaire ne doit pas commencer par « solid »");
  }
  if (mesh.triangles > STL_MAX_TRIANGLES) {
    throw new Error(
      `STL trop lourd : ${mesh.triangles} triangles (plafond ${STL_MAX_TRIANGLES})`,
    );
  }
  const n = mesh.triangles;
  const bytes = 84 + 50 * n;
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < STL_HEADER_BYTES; i++) {
    const code = i < header.length ? header.charCodeAt(i) : 0x20;
    out[i] = code < 0x20 || code > 0x7e ? 0x20 : code; // ASCII imprimable seulement
  }
  view.setUint32(80, n, true);

  const p = mesh.positions;
  const ix = mesh.indices;
  let o = 84;
  for (let t = 0; t < n; t++) {
    const a = ix[t * 3] * 3;
    const b = ix[t * 3 + 1] * 3;
    const c = ix[t * 3 + 2] * 3;
    const ux = p[b] - p[a];
    const uy = p[b + 1] - p[a + 1];
    const uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a];
    const vy = p[c + 1] - p[a + 1];
    const vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-20) {
      nx /= len;
      ny /= len;
      nz /= len;
    } else {
      nx = 0;
      ny = 0;
      nz = 1; // triangle dégénéré : normale arbitraire mais unitaire
    }
    view.setFloat32(o, nx, true);
    view.setFloat32(o + 4, ny, true);
    view.setFloat32(o + 8, nz, true);
    view.setFloat32(o + 12, p[a], true);
    view.setFloat32(o + 16, p[a + 1], true);
    view.setFloat32(o + 20, p[a + 2], true);
    view.setFloat32(o + 24, p[b], true);
    view.setFloat32(o + 28, p[b + 1], true);
    view.setFloat32(o + 32, p[b + 2], true);
    view.setFloat32(o + 36, p[c], true);
    view.setFloat32(o + 40, p[c + 1], true);
    view.setFloat32(o + 44, p[c + 2], true);
    view.setUint16(o + 48, 0, true);
    o += 50;
  }
  if (o !== bytes) throw new Error("STL : taille incohérente");
  return { buffer, triangles: n, bytes };
}

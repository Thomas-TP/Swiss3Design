// MeshData (pur TS, src/lib/studio/**) → BufferGeometry, et cache partagé
// des géométries (brief « Strates », §4.1, §4.4, §6.11). Le Stage ne calcule
// aucune forme : il enveloppe les Float32Array des générateurs. Chaque vue a sa
// propre instance de scène, mais deux vues du même objet partagent la même
// géométrie GPU grâce au cache à compteur de références.
import { Box3, BufferAttribute, BufferGeometry, Sphere, Vector3 } from "three";
import type { MeshData } from "@/lib/studio/types";

function applyBounds(geometry: BufferGeometry, bbox: MeshData["bbox"]) {
  // Boîte connue du générateur : pas de parcours des sommets.
  const box = new Box3(
    new Vector3(bbox[0], bbox[1], bbox[2]),
    new Vector3(bbox[3], bbox[4], bbox[5]),
  );
  geometry.boundingBox = box;
  geometry.boundingSphere = box.getBoundingSphere(new Sphere());
}

function applyGroups(geometry: BufferGeometry, groups: MeshData["groups"]) {
  geometry.clearGroups();
  // materialIndex = numéro de bande : une scène peut dessiner chaque bande
  // séparément (éclaté) sans recopier les tampons.
  for (const g of groups) geometry.addGroup(g.start, g.count, g.band);
}

/**
 * Géométrie three d'un MeshData : position, normal, index (Uint32), attribut
 * `side` (0 = paroi extérieure, 1 = intérieure) lu par le matériau
 * d'impression. Z vers le haut, en mm : la scène tourne l'objet de −90°
 * autour de X pour passer au Y vers le haut de three.
 */
export function meshToGeometry(mesh: MeshData): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(mesh.positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(mesh.normals, 3));
  if (mesh.side)
    geometry.setAttribute("side", new BufferAttribute(mesh.side, 1));
  geometry.setIndex(new BufferAttribute(mesh.indices, 1));
  applyGroups(geometry, mesh.groups);
  applyBounds(geometry, mesh.bbox);
  return geometry;
}

function sameLength(
  attribute: BufferAttribute | undefined,
  array: ArrayLike<number> | undefined,
): boolean {
  return (
    attribute !== undefined &&
    array !== undefined &&
    attribute.array.length === array.length
  );
}

/**
 * Met à jour une géométrie avec un nouveau maillage. Même taille : copie dans
 * les tampons existants (bufferSubData, aucune réallocation GPU pendant un
 * glissé du Studio). Taille différente : three ne sait pas agrandir un tampon
 * (et un attribut remplacé laisserait fuir l'ancien) : on renvoie une
 * géométrie neuve et on libère l'ancienne. Toujours utiliser la valeur de
 * retour.
 */
export function updateGeometry(
  geometry: BufferGeometry,
  mesh: MeshData,
): BufferGeometry {
  const position = geometry.getAttribute("position") as BufferAttribute;
  const normal = geometry.getAttribute("normal") as BufferAttribute;
  const side = geometry.getAttribute("side") as BufferAttribute | undefined;
  const index = geometry.getIndex();
  const inPlace =
    sameLength(position, mesh.positions) &&
    sameLength(normal, mesh.normals) &&
    index !== null &&
    sameLength(index, mesh.indices) &&
    (mesh.side ? sameLength(side, mesh.side) : side === undefined);
  if (!inPlace) {
    geometry.dispose();
    return meshToGeometry(mesh);
  }
  position.copyArray(mesh.positions);
  position.needsUpdate = true;
  normal.copyArray(mesh.normals);
  normal.needsUpdate = true;
  if (side && mesh.side) {
    side.copyArray(mesh.side);
    side.needsUpdate = true;
  }
  index.copyArray(mesh.indices);
  index.needsUpdate = true;
  applyGroups(geometry, mesh.groups);
  applyBounds(geometry, mesh.bbox);
  return geometry;
}

// ── Cache partagé ─────────────────────────────────────────────────────────────

const cache = new Map<string, { geometry: BufferGeometry; refs: number }>();

/**
 * Géométrie partagée par clé (par exemple le hash de la configuration) :
 * construite au premier appel, comptée ensuite. Chaque acquire appelle un
 * release, qui libère la géométrie GPU au dernier.
 */
export function acquireGeometry(
  key: string,
  build: () => BufferGeometry,
): BufferGeometry {
  const hit = cache.get(key);
  if (hit) {
    hit.refs++;
    return hit.geometry;
  }
  const geometry = build();
  cache.set(key, { geometry, refs: 1 });
  return geometry;
}

export function releaseGeometry(key: string) {
  const hit = cache.get(key);
  if (!hit) return;
  if (--hit.refs > 0) return;
  hit.geometry.dispose();
  cache.delete(key);
}

/** Tout libérer (renderer détruit ou contexte perdu). */
export function clearGeometryCache() {
  for (const { geometry } of cache.values()) geometry.dispose();
  cache.clear();
}

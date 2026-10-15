// Teinte d'une bobine CO-EXTRUDÉE (bi- ou tricolore : 2 ou 3 couleurs côte à côte
// dans le fil, comme les PLA Silk Multi-Color de Bambu Lab ou l'eSilk tricolore de
// R3D) sur une pièce imprimée. Le fil ne tourne pas sur lui-même pendant
// l'impression : la couleur qui se retrouve à l'extérieur d'une paroi dépend de
// l'orientation de cette paroi dans le plan du plateau. La pièce montre donc un
// secteur par couleur autour de son axe vertical, avec un fondu d'un secteur à
// l'autre ; un dessus ou un dessous (normale verticale, lignes dans tous les sens)
// montre le mélange des couleurs. Pur, sans three : testé (coextruded.test.ts).

const TAU = 2 * Math.PI;
/** Largeur du fondu entre deux secteurs voisins, en part de secteur. */
const SOFT = 0.35;

export interface FilamentBlend {
  /** Couleur du secteur courant (indice dans les teintes de la bobine). */
  a: number;
  /** Couleur du secteur voisin vers lequel on fond. */
  b: number;
  /** Part de `b` (0 = tout `a`). */
  t: number;
  /** Part du mélange de toutes les couleurs (0 = paroi, 1 = dessus ou dessous). */
  flat: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const k = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return k * k * (3 - 2 * k);
}

/**
 * Mélange de teintes pour une normale (repère de la pièce posée : Y vers le haut)
 * et une bobine de `count` couleurs. Le secteur k est centré sur l'azimut
 * (k + ½) × 360° / count, compté depuis +X vers +Z.
 */
export function coextrudedBlend(
  nx: number,
  ny: number,
  nz: number,
  count: number,
): FilamentBlend {
  const length = Math.hypot(nx, ny, nz) || 1;
  const flat = smoothstep(0.75, 0.97, Math.abs(ny) / length);
  if (count <= 1) return { a: 0, b: 0, t: 0, flat };
  const azimuth = (Math.atan2(nz, nx) + TAU) % TAU;
  // Centres des secteurs sur les entiers de u : entre deux centres, on fond.
  const u = (azimuth / TAU) * count - 0.5;
  const base = Math.floor(u);
  const a = ((base % count) + count) % count;
  return {
    a,
    b: (a + 1) % count,
    t: smoothstep(0.5 - SOFT / 2, 0.5 + SOFT / 2, u - base),
    flat,
  };
}

// Douglas–Peucker (brief « Strates », §6.3.2 : `kernel/simplify.ts`). Sert à
// alléger les contours de strates (0,15 mm, sous-verre Relief, WP-02) et les
// silhouettes SVG de l'Élévation. Itératif (pile explicite) : aucun risque de
// dépassement de pile sur un contour de plusieurs milliers de points.

export type Vec2 = [number, number];

function distSq(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
    t = Math.min(Math.max(t, 0), 1);
  }
  const ex = a[0] + t * dx - p[0];
  const ey = a[1] + t * dy - p[1];
  return ex * ex + ey * ey;
}

/** Polyligne ouverte : garde les extrémités et les points à plus de `tolerance`. */
export function simplifyPolyline(
  points: readonly Vec2[],
  tolerance: number,
): Vec2[] {
  const n = points.length;
  if (n <= 2) return points.map((p) => [p[0], p[1]]);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const tol2 = tolerance * tolerance;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!;
    let worst = -1;
    let worstD = tol2;
    for (let i = lo + 1; i < hi; i++) {
      const d = distSq(points[i], points[lo], points[hi]);
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([lo, worst], [worst, hi]);
    }
  }
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++)
    if (keep[i]) out.push([points[i][0], points[i][1]]);
  return out;
}

/**
 * Contour fermé (premier point non répété à la fin) : coupé en deux chaînes
 * aux deux points les plus éloignés l'un de l'autre, simplifiées chacune, de
 * sorte que la couture n'est jamais un point arbitraire supprimé.
 */
export function simplifyClosed(
  points: readonly Vec2[],
  tolerance: number,
): Vec2[] {
  const n = points.length;
  if (n <= 3) return points.map((p) => [p[0], p[1]]);
  let far = 0;
  let farD = -1;
  for (let i = 1; i < n; i++) {
    const dx = points[i][0] - points[0][0];
    const dy = points[i][1] - points[0][1];
    const d = dx * dx + dy * dy;
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const first = simplifyPolyline(points.slice(0, far + 1), tolerance);
  const second = simplifyPolyline([...points.slice(far), points[0]], tolerance);
  // first finit sur points[far], second commence sur points[far] et finit sur points[0].
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

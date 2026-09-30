// Interpolation cubique monotone (brief « Strates », §6.3.1 : « Fritsch–
// Carlson, qui ne dépasse jamais (pas de bosse imprévue, donc pas de surplomb
// caché) »).
//
// Tangentes intérieures : moyenne harmonique pondérée de Fritsch–Butland
// (nulle à un extremum local, donc jamais de dépassement entre deux points de
// contrôle) ; tangentes aux extrémités : la sécante du premier et du dernier
// intervalle, choix le plus sobre (pente de départ du pied du vase ≤ celle de
// la sécante, ce qui garde une marge à la règle des 45 °).

export interface MonotoneCurve {
  /** Ordonnée en x (x borné à [xs[0], xs[n]]). */
  value(x: number): number;
  /** Pente dy/dx en x. */
  slope(x: number): number;
}

export function monotoneCubic(
  xs: readonly number[],
  ys: readonly number[],
): MonotoneCurve {
  const n = xs.length;
  if (n < 2 || ys.length !== n) {
    throw new Error("monotoneCubic : au moins deux points, xs et ys alignés");
  }
  const h = new Float64Array(n - 1);
  const d = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    if (!(h[i] > 0))
      throw new Error("monotoneCubic : xs strictement croissants");
    d[i] = (ys[i + 1] - ys[i]) / h[i];
  }
  const m = new Float64Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }

  const locate = (x: number) => {
    let k = n - 2;
    for (let i = 0; i < n - 1; i++) {
      if (x < xs[i + 1]) {
        k = i;
        break;
      }
    }
    return k;
  };

  return {
    value(x) {
      const cx = Math.min(Math.max(x, xs[0]), xs[n - 1]);
      const k = locate(cx);
      const t = (cx - xs[k]) / h[k];
      const t2 = t * t;
      const t3 = t2 * t;
      return (
        (2 * t3 - 3 * t2 + 1) * ys[k] +
        (t3 - 2 * t2 + t) * h[k] * m[k] +
        (-2 * t3 + 3 * t2) * ys[k + 1] +
        (t3 - t2) * h[k] * m[k + 1]
      );
    },
    slope(x) {
      const cx = Math.min(Math.max(x, xs[0]), xs[n - 1]);
      const k = locate(cx);
      const t = (cx - xs[k]) / h[k];
      const t2 = t * t;
      return (
        ((6 * t2 - 6 * t) * ys[k] + (-6 * t2 + 6 * t) * ys[k + 1]) / h[k] +
        (3 * t2 - 4 * t + 1) * m[k] +
        (3 * t2 - 2 * t) * m[k + 1]
      );
    },
  };
}

/** Lissage de Hermite d'ordre 5 (dérivées première et seconde nulles aux bornes). */
export function smootherstep(x: number): number {
  const t = x <= 0 ? 0 : x >= 1 ? 1 : x;
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Dérivée de smootherstep : 30 t² (1 − t)². */
export function smootherstepSlope(x: number): number {
  if (x <= 0 || x >= 1) return 0;
  const u = x * (1 - x);
  return 30 * u * u;
}

/** Lissage de Hermite d'ordre 3 (classique `smoothstep`, sur [edge0, edge1]). */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

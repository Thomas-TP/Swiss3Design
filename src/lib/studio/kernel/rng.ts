// PRNG du Studio (brief « Strates », §6.3 : « PRNG mulberry32 »).
//
// Même graine = même suite, sur tous les moteurs JS : c'est ce qui rend les
// maillages reproductibles « au bit près » (test de déterminisme) et ce qui
// permet à « Surprenez-moi » de rejouer un tirage. Math.random() n'est donc
// jamais utilisé dans src/lib/studio/**.

/** mulberry32 : 32 bits d'état, uniforme dans [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** Réel uniforme dans [lo, hi). */
export function between(rng: Rng, lo: number, hi: number): number {
  return lo + (hi - lo) * rng();
}

/** Entier uniforme dans [lo, hi] (bornes incluses). */
export function intBetween(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Élément uniforme d'un tableau non vide. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** Mélange de Fisher-Yates, sur une copie. */
export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

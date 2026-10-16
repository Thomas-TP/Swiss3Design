// Palette du projet de couleurs : jusqu'à 4 couleurs du stock (l'AMS 2 Pro et le
// CFS chargent quatre bobines), l'emplacement 1 étant la base (surfaces non
// peintes). Ici : correspondance des couleurs d'un fichier déjà peint avec le
// stock (teinte la plus proche, ΔE CIE76 en Lab), et renumérotation des états
// quand la palette change.

/** « #RRGGBB » → Lab (D65). */
export function hexToLab(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? Number.parseInt(m[1], 16) : 0xffffff;
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const r = lin((n >> 16) & 255);
  const g = lin((n >> 8) & 255);
  const b = lin(n & 255);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE(a: string, b: string): number {
  const p = hexToLab(a);
  const q = hexToLab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

export interface PaletteColor {
  id: string;
  /** 1 à 3 teintes (co-extrudé). */
  hexes: readonly string[];
}

/**
 * Écart d'une teinte unie à une couleur du stock. Une bobine multicolore se
 * voit comme le mélange de ses teintes (moyenne en Lab), nettement pénalisé
 * (+20) : une pièce unie du fichier n'est pas un dégradé, un filament uni lui va
 * mieux tant qu'il n'est pas franchement plus loin.
 */
function distance(hex: string, color: PaletteColor): number {
  if (color.hexes.length === 0) return Infinity;
  if (color.hexes.length === 1) return deltaE(hex, color.hexes[0]);
  const labs = color.hexes.map(hexToLab);
  const mean = [0, 1, 2].map(
    (i) => labs.reduce((sum, lab) => sum + lab[i], 0) / labs.length,
  );
  const p = hexToLab(hex);
  return Math.hypot(p[0] - mean[0], p[1] - mean[1], p[2] - mean[2]) + 20;
}

export function nearestColor<T extends PaletteColor>(
  hex: string,
  colors: readonly T[],
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const color of colors) {
    const d = distance(hex, color);
    if (d < bestDistance) {
      best = color;
      bestDistance = d;
    }
  }
  return best;
}

export interface FileFilament {
  /** Numéro du filament dans le fichier (1 = le premier). */
  filament: number;
  /** Aire peinte de ce filament (mm²) : décide qui garde sa place. */
  area: number;
  /** Teinte du fichier, si elle est connue. */
  hex: string | null;
}

export interface FilamentMapping {
  /** Couleurs de la palette, dans l'ordre des emplacements. */
  refs: string[];
  /** État du document pour chaque filament du fichier (index = n° de filament). */
  stateOf: Map<number, number>;
  /** Des filaments ont été fusionnés (plus de `max` couleurs, ou même teinte du stock). */
  merged: boolean;
}

/**
 * Associe les filaments d'un fichier peint aux couleurs du stock : chacun prend
 * la teinte la plus proche ; deux filaments sur la même couleur fusionnent ;
 * au-delà de `max`, les moins présents rejoignent la couleur gardée la plus
 * proche. Les emplacements suivent l'ordre des filaments du fichier (le 1 reste
 * la base quand il est utilisé).
 */
export function mapFileFilaments(
  used: readonly FileFilament[],
  stock: readonly PaletteColor[],
  max = 4,
): FilamentMapping | null {
  if (used.length === 0 || stock.length === 0) return null;
  const byRef = new Map<
    string,
    { area: number; filaments: number[]; first: number }
  >();
  for (const f of [...used].sort((a, b) => a.filament - b.filament)) {
    // Sans teinte connue : une couleur du stock pas encore prise (le visiteur
    // corrigera), pour garder les zones distinctes.
    const color = f.hex
      ? nearestColor(f.hex, stock)
      : (stock.find((c) => !byRef.has(c.id)) ?? stock[0]);
    if (!color) continue;
    const group = byRef.get(color.id) ?? {
      area: 0,
      filaments: [],
      first: f.filament,
    };
    group.area += f.area;
    group.filaments.push(f.filament);
    byRef.set(color.id, group);
  }
  let groups = [...byRef.entries()];
  let merged = groups.length < used.length;
  if (groups.length > max) {
    merged = true;
    const kept = [...groups]
      .sort((a, b) => b[1].area - a[1].area)
      .slice(0, max);
    const keptIds = new Set(kept.map(([id]) => id));
    const hexOf = (id: string) =>
      stock.find((c) => c.id === id)?.hexes[0] ?? "#FFFFFF";
    for (const [id, group] of groups) {
      if (keptIds.has(id)) continue;
      let target = kept[0];
      let best = Infinity;
      for (const candidate of kept) {
        const d = deltaE(hexOf(id), hexOf(candidate[0]));
        if (d < best) {
          best = d;
          target = candidate;
        }
      }
      target[1].filaments.push(...group.filaments);
      target[1].area += group.area;
    }
    groups = kept;
  }
  groups.sort((a, b) => a[1].first - b[1].first);
  const stateOf = new Map<number, number>();
  groups.forEach(([, group], slot) => {
    for (const filament of group.filaments) stateOf.set(filament, slot + 1);
  });
  return { refs: groups.map(([id]) => id), stateOf, merged };
}

/**
 * Table de renumérotation des états quand la palette passe de `before` à
 * `after` (ids dans l'ordre des emplacements) : une couleur retirée redevient
 * la base (0), une couleur déplacée suit sa nouvelle place.
 */
export function paletteRemap(
  before: readonly string[],
  after: readonly string[],
): number[] {
  const map = [0];
  for (let slot = 0; slot < before.length; slot++) {
    const next = after.indexOf(before[slot]);
    map.push(next < 0 ? 0 : next + 1);
  }
  return map;
}

// Palette du projet de couleurs : jusqu'à 4 couleurs du stock (l'AMS 2 Pro et le
// CFS chargent quatre bobines), l'emplacement 1 étant la base (surfaces non
// peintes). Les zones appartiennent aux EMPLACEMENTS (les filaments 1 à 4, comme
// dans Bambu Studio), jamais aux couleurs : changer la couleur d'un emplacement
// ne touche pas à la peinture. Ici : correspondance des filaments d'un fichier
// déjà peint avec le stock (teinte la plus proche, ΔE CIE76 en Lab), couleurs
// réellement imprimées.

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
  /**
   * Couleur du stock de chaque filament gardé, dans l'ordre (filament 1 en
   * tête). Deux filaments peuvent recevoir la même couleur : leurs zones restent
   * distinctes, le visiteur change l'une sans toucher à l'autre.
   */
  refs: string[];
  /** Teinte du fichier de chaque filament gardé (« #RRGGBB »), ou null. */
  origins: (string | null)[];
  /** Emplacement (état du document) de chaque filament du fichier. */
  stateOf: Map<number, number>;
  /** Plus de `max` filaments : les moins présents ont rejoint le plus proche. */
  merged: boolean;
}

/**
 * Filaments d'un fichier peint → emplacements de l'atelier (25.10.2026, comme la
 * liste des filaments de Bambu Studio) : chaque filament utilisé garde SA zone
 * et prend la couleur du stock la plus proche de sa teinte. Rien n'est fusionné
 * pour une couleur identique ; seul un fichier de plus de `max` filaments voit
 * ses moins présents rejoindre le filament gardé de teinte la plus proche.
 */
export function mapFileFilaments(
  used: readonly FileFilament[],
  stock: readonly PaletteColor[],
  max = 4,
): FilamentMapping | null {
  if (used.length === 0 || stock.length === 0) return null;
  const ordered = [...used].sort((a, b) => a.filament - b.filament);
  let kept = ordered;
  let merged = false;
  const into = new Map<number, number>();
  if (ordered.length > max) {
    merged = true;
    const keptSet = new Set(
      [...ordered]
        .sort((a, b) => b.area - a.area)
        .slice(0, max)
        .map((f) => f.filament),
    );
    kept = ordered.filter((f) => keptSet.has(f.filament));
    for (const f of ordered) {
      if (keptSet.has(f.filament)) continue;
      let target = kept[0];
      let best = Infinity;
      for (const candidate of kept) {
        const d =
          f.hex && candidate.hex ? deltaE(f.hex, candidate.hex) : Infinity;
        if (d < best) {
          best = d;
          target = candidate;
        }
      }
      into.set(f.filament, target.filament);
    }
  }
  const refs: string[] = [];
  const origins: (string | null)[] = [];
  const stateOf = new Map<number, number>();
  kept.forEach((f, slot) => {
    origins.push(f.hex);
    // Sans teinte connue : une couleur du stock pas encore prise (le visiteur
    // corrigera), pour que les zones se distinguent à l'écran.
    const color = f.hex
      ? nearestColor(f.hex, stock)
      : (stock.find((c) => !refs.includes(c.id)) ?? stock[0]);
    refs.push(color?.id ?? stock[0].id);
    stateOf.set(f.filament, slot + 1);
  });
  for (const [from, to] of into) stateOf.set(from, stateOf.get(to)!);
  return { refs, origins, stateOf, merged };
}

/**
 * Couleurs réellement imprimées : les emplacements (une couleur du stock
 * chacun, doublons permis) ramenés aux couleurs distinctes, dans l'ordre de
 * première apparition, et la table état du document → filament exporté. Une
 * seule couleur (`several` faux) : tout devient le filament 1, la peinture est
 * gardée dans l'atelier mais pas imprimée.
 */
export function printedPalette(
  slots: readonly string[],
  several: boolean,
): { refs: string[]; states: number[] } {
  const states = Array.from({ length: 256 }, (_, s) => s);
  if (!several || slots.length <= 1) {
    states.fill(0);
    return { refs: slots.slice(0, 1), states };
  }
  const refs: string[] = [];
  slots.forEach((ref, slot) => {
    let index = refs.indexOf(ref);
    if (index < 0) index = refs.push(ref) - 1;
    states[slot + 1] = index + 1;
  });
  // Un état au-delà des emplacements (emplacement retiré) : la base.
  for (let s = slots.length + 1; s < states.length; s++) states[s] = 0;
  return { refs, states };
}

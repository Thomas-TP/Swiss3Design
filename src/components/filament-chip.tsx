import type { CSSProperties } from "react";

// Pastille d'une couleur de filament : une teinte pleine, ou, pour un filament
// tricolore co-extrudé, jusqu'à trois secteurs (la teinte exacte de chacun, sans
// transformation). Décorative : le nom de la couleur est toujours écrit à côté.

/** Fond d'une pastille : l'hex brut, ou des secteurs égaux pour 2 à 3 teintes. */
export function chipBackground(hexes: readonly string[]): CSSProperties {
  const list = hexes.filter(Boolean);
  if (list.length <= 1) return { backgroundColor: list[0] ?? "#000000" };
  const step = 100 / list.length;
  const stops = list
    .map((hex, k) => `${hex} ${k * step}% ${(k + 1) * step}%`)
    .join(", ");
  return { backgroundImage: `conic-gradient(from 0deg, ${stops})` };
}

/** Teinte (0–360°), saturation et luminosité (0–1) d'un hex #rrggbb. */
function hsl(hex: string): { h: number; s: number; l: number } {
  const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16) || 0;
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(
    (v) => v / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === r
      ? ((g - b) / d + 6) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

/**
 * Teintes rangées en roue pour la pastille « palette » d'une carte : les neutres
 * (blanc, gris, noir) d'abord, du clair au foncé, puis les couleurs par teinte.
 * Une roue ordonnée se lit comme « toutes ces couleurs » ; dans l'ordre du stock,
 * des secteurs voisins se heurteraient.
 */
export function wheelOrder(hexes: readonly string[]): string[] {
  const neutral = (hex: string) => hsl(hex).s < 0.15;
  const neutrals = hexes.filter(neutral).sort((a, b) => hsl(b).l - hsl(a).l);
  const tints = hexes
    .filter((hex) => !neutral(hex))
    .sort((a, b) => hsl(a).h - hsl(b).h);
  return [...neutrals, ...tints];
}

export function FilamentChip({
  hexes,
  size = 20,
  className = "",
}: {
  hexes: readonly string[];
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full border border-swatch-ring ${className}`}
      style={{ width: size, height: size, ...chipBackground(hexes) }}
    />
  );
}

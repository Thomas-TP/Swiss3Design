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

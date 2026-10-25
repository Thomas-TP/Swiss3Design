import { FilamentChip } from "@/components/filament-chip";
import { cx } from "@/components/ui/cx";
import type { PublicCustomColor } from "@/lib/filament/public-stock";

// Grille des couleurs du stock « sur mesure » : une pastille par couleur, la
// couleur courante cochée, celles dont le stock ne suffit pas pour la pièce
// grisées. Partagée par le formulaire de devis et l'atelier 3D.

export function FilamentSwatches({
  colors,
  selectable,
  current,
  onPick,
  shortLabel,
  approximateLabel,
  compact = false,
}: {
  colors: readonly PublicCustomColor[];
  selectable: ReadonlySet<string>;
  current: string | null;
  onPick: (id: string) => void;
  /** « Stock insuffisant » (pastille grisée). */
  shortLabel: string;
  /** Teinte approchée (pas de référence exacte). */
  approximateLabel: string;
  /** Deux colonnes, sans la gamme : panneaux étroits. */
  compact?: boolean;
}) {
  if (colors.length === 0) return null;
  return (
    <ul className={cx("grid grid-cols-2 gap-2", !compact && "sm:grid-cols-3")}>
      {colors.map((color) => {
        const on = color.id === current;
        const short = !selectable.has(color.id);
        return (
          <li key={color.id}>
            <button
              type="button"
              aria-pressed={on}
              disabled={short}
              onClick={() => onPick(color.id)}
              title={short ? shortLabel : undefined}
              className={cx(
                "flex w-full items-center gap-2.5 rounded-field border px-2.5 text-left transition-colors",
                compact ? "min-h-10 py-1" : "min-h-12 py-1.5",
                on
                  ? "border-ink bg-surface outline outline-2 outline-ink"
                  : "border-line bg-surface hover:border-ink",
                short && "cursor-not-allowed opacity-45",
              )}
            >
              <FilamentChip hexes={color.hexes} size={compact ? 20 : 24} />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm text-ink">
                  {color.name}
                </span>
                {compact && !short ? null : (
                  <span className="block truncate text-xs text-soft">
                    {short
                      ? shortLabel
                      : color.approximate
                        ? approximateLabel
                        : color.range}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

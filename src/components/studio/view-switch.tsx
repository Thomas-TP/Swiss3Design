"use client";

import { Layers } from "lucide-react";
import { cx } from "@/components/ui/cx";
import type { StudioViewMode } from "./objects";

// Sélecteur de vue (brief « Strates », §6.7) : 3D · Plan · Élévation · Couches,
// et l'interrupteur « Éclater ». Le même dessin que la bascule Grille /
// Registre de la boutique : un bloc à filet d'encre, l'option choisie pleine
// d'encre. Les vues sont des boutons radio natifs dans un `fieldset` légendé
// (flèches, annonce « 2 sur 4 »), jamais des onglets bricolés ; l'éclaté est un
// vrai interrupteur (`aria-pressed`) dont l'état actif reste plein d'encre,
// lisible sur la scène.

/** Bloc commun : filet d'encre, fond du papier un peu transparent (il flotte sur la scène). */
const BLOCK =
  "inline-flex overflow-hidden rounded-field border border-ink bg-paper/90 backdrop-blur-sm";

/** Une option : 36 px sur bureau, 32 px sur mobile (cinq options tiennent sur 344 px). */
const OPTION =
  "inline-flex h-9 items-center gap-2 px-3 text-sm font-medium transition-colors duration-150 ease-strate max-lg:h-8 max-lg:px-2.5 max-lg:text-xs";

const FOCUS =
  "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent-text";

export function ViewSwitch({
  legend,
  views,
  value,
  onChange,
  labelOf,
  exploded,
  onExplode,
  explodeLabel,
  showExplode = true,
  className,
}: {
  legend: string;
  views: readonly StudioViewMode[];
  value: StudioViewMode;
  onChange: (view: StudioViewMode) => void;
  labelOf: (view: StudioViewMode) => string;
  exploded: boolean;
  onExplode: () => void;
  explodeLabel: string;
  /** L'éclaté n'existe qu'en 3D : masqué sans WebGL et sous la vue Élévation. */
  showExplode?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx("flex flex-wrap items-center gap-1.5 sm:gap-2", className)}
    >
      {views.length > 1 ? (
        <fieldset className={cx(BLOCK, "m-0 min-w-0 p-0")}>
          <legend className="sr-only">{legend}</legend>
          {views.map((view) => (
            <label key={view} className="relative inline-flex cursor-pointer">
              <input
                type="radio"
                name="view"
                form="studio-local"
                value={view}
                checked={view === value}
                onChange={() => onChange(view)}
                className="peer sr-only"
              />
              <span
                className={cx(
                  OPTION,
                  FOCUS,
                  "text-ink hover:bg-line/60",
                  "peer-checked:bg-ink peer-checked:text-paper peer-checked:hover:bg-ink",
                  "peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-4 peer-focus-visible:outline-accent-text",
                )}
              >
                {labelOf(view)}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {showExplode ? (
        <div className={BLOCK}>
          <button
            type="button"
            aria-pressed={exploded}
            onClick={onExplode}
            className={cx(
              OPTION,
              FOCUS,
              exploded
                ? "bg-ink text-paper hover:bg-ink/85"
                : "text-ink hover:bg-line/60",
            )}
          >
            <Layers size={16} aria-hidden="true" className="max-lg:size-3.5" />
            {explodeLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

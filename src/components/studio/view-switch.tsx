"use client";

import { Button } from "@/components/ui/button";
import { ChipRadio } from "@/components/ui/chip";
import { cx } from "@/components/ui/cx";
import styles from "./studio.module.css";
import type { StudioViewMode } from "./objects";

// Sélecteur de vue (brief « Strates », §6.7) : 3/4 · Plan · Élévation · Couches,
// et le bouton « Éclater ». Des boutons radio natifs dans un `fieldset` légendé
// (flèches, annonce « 2 sur 4 »), jamais des onglets bricolés ; l'éclaté est un
// bouton à bascule (`aria-pressed`).

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
      className={cx(
        "flex flex-wrap items-center gap-1.5 sm:gap-2",
        styles.viewChips,
        className,
      )}
    >
      {views.length > 1 ? (
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">{legend}</legend>
          <div className="flex flex-wrap gap-1.5">
            {views.map((view) => (
              <ChipRadio
                key={view}
                name="view"
                form="studio-local"
                value={view}
                checked={view === value}
                onChange={() => onChange(view)}
                className="bg-paper/85"
              >
                {labelOf(view)}
              </ChipRadio>
            ))}
          </div>
        </fieldset>
      ) : null}
      {showExplode ? (
        <Button
          variant={exploded ? "ink" : "secondary"}
          size="sm"
          aria-pressed={exploded}
          onClick={onExplode}
          className="rounded-full bg-paper/85"
        >
          {explodeLabel}
        </Button>
      ) : null}
    </div>
  );
}

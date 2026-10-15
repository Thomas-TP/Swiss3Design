"use client";

import { FILAMENT_IDS, filamentHex } from "@/lib/studio/filaments";
import type { FilamentId } from "@/lib/studio/types";
import { cx } from "@/components/ui/cx";

// Choix d'un filament (brief « Strates », §3.5 et §6.10) : huit pastilles, de
// VRAIS boutons radio natifs (flèches dans le groupe, annonce « 3 sur 8 »).
// Une couleur est TOUJOURS nommée : le nom de chaque pastille est son libellé
// (lu par les lecteurs d'écran, info-bulle au survol) et le nom de la pastille
// choisie s'affiche à côté du groupe ; jamais une pastille seule. Le contour
// est le gris « swatch-ring » (≥ 3:1 sur tous les fonds, WCAG 1.4.11), la
// sélection un anneau d'encre. Teintes indicatives : c'est la bobine en stock
// qui décide de la couleur finale (mention dans la fiche).

export function SwatchRadio({
  legend,
  name,
  value,
  onChange,
  nameOf,
  form,
  filaments = FILAMENT_IDS,
  className,
  hideLegend = false,
  unavailable,
  soldOutLabel,
}: {
  legend: string;
  name: string;
  value: FilamentId;
  onChange: (value: FilamentId) => void;
  /** Nom traduit d'un filament (studioCore.filaments.<id>). */
  nameOf: (id: FilamentId) => string;
  form?: string;
  filaments?: readonly FilamentId[];
  className?: string;
  hideLegend?: boolean;
  /** Couleurs dont le stock ne suffit pas pour la pièce : grisées, non choisissables (sauf si déjà choisie). */
  unavailable?: ReadonlySet<FilamentId>;
  /** « épuisée » : annoncé avec le nom de la couleur. */
  soldOutLabel?: string;
}) {
  return (
    <fieldset className={cx("m-0 min-w-0 border-0 p-0", className)}>
      <legend
        className={cx(
          "s3d-label p-0 text-soft",
          hideLegend ? "sr-only" : "mb-1",
        )}
      >
        {legend}
      </legend>
      <div className="-ml-1.5 flex flex-wrap">
        {filaments.map((id) => {
          const out = Boolean(unavailable?.has(id));
          const label =
            out && soldOutLabel
              ? `${nameOf(id)} (${soldOutLabel})`
              : nameOf(id);
          return (
            <label
              key={id}
              title={label}
              className={cx(
                "relative inline-flex size-11 items-center justify-center",
                out && id !== value ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              <input
                type="radio"
                className="peer sr-only"
                name={name}
                form={form}
                value={id}
                checked={id === value}
                disabled={out && id !== value}
                onChange={() => onChange(id)}
              />
              <span
                aria-hidden="true"
                className="size-7 rounded-full border border-swatch-ring outline-offset-2 transition-[outline-color] duration-150 ease-strate peer-checked:outline-2 peer-checked:outline-ink peer-focus-visible:outline-2 peer-focus-visible:outline-ink peer-checked:peer-focus-visible:outline-4"
                style={{ backgroundColor: filamentHex(id) }}
              />
              {out ? (
                // Une barre en travers : la teinte reste EXACTE (ni voile ni transparence).
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-9 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-ink ring-1 ring-paper"
                />
              ) : null}
              <span className="sr-only">{label}</span>
            </label>
          );
        })}
      </div>
      <p aria-hidden="true" className="mt-0.5 text-sm text-ink">
        {nameOf(value)}
        {unavailable?.has(value) && soldOutLabel ? ` (${soldOutLabel})` : ""}
      </p>
    </fieldset>
  );
}

"use client";

import { useEffect, useState } from "react";
import { FilamentChip } from "@/components/filament-chip";
import { cx } from "@/components/ui/cx";
import { CAPACITY_MAX_GRAMS } from "@/lib/filament/constants";
import { quoteNeedGrams } from "@/lib/filament/availability";
import type { PublicCustomColor } from "@/lib/filament/public-stock";

// Couleurs du stock proposées pour un devis (/custom) : une pastille par couleur,
// jusqu'à 4. Avant le fichier, toutes les couleurs en stock s'affichent ; dès que
// le poids est estimé, celles dont le stock ne couvre pas la pièce (poids estimé ×
// quantité, avec la marge × 1,15 + 15 g) sont grisées et ne peuvent plus être
// choisies. Par prudence, UNE couleur doit couvrir le poids TOTAL (on ignore la
// répartition entre couleurs). Le niveau exact du stock n'est jamais affiché ni
// connu ici : l'API ne donne qu'une capacité arrondie. Le serveur revérifie à
// l'envoi avec une lecture fraîche.

export type CustomStock =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; colors: PublicCustomColor[] };

/** Lit les couleurs « sur mesure » en stock (une fois, après l'hydratation). */
export function useCustomStock(enabled: boolean): CustomStock {
  const [stock, setStock] = useState<CustomStock>({ status: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/stock/colors");
        const body = (await res.json()) as {
          v?: number;
          custom?: PublicCustomColor[];
        };
        if (!alive) return;
        setStock(
          res.ok && body.v === 1
            ? { status: "ready", colors: body.custom ?? [] }
            : { status: "error" },
        );
      } catch {
        if (alive) setStock({ status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);
  return stock;
}

/** Les couleurs dont la capacité couvre `gramsPerPiece × quantity` (avec la marge). */
export function eligibleColors(
  colors: readonly PublicCustomColor[],
  gramsPerPiece: number,
  quantity: number,
): PublicCustomColor[] {
  const need = quoteNeedGrams(gramsPerPiece, quantity);
  return colors.filter((c) => c.cap >= CAPACITY_MAX_GRAMS || need <= c.cap);
}

/** Couleurs proposées : toutes avant l'estimation, celles qui suffisent ensuite. */
export function selectableColorIds(
  colors: readonly PublicCustomColor[],
  gramsPerPiece: number | null,
  quantity: number,
): Set<string> {
  return new Set(
    (gramsPerPiece === null
      ? colors
      : eligibleColors(colors, gramsPerPiece, quantity)
    ).map((color) => color.id),
  );
}

export interface ColorPickerLabels {
  legend: string;
  hint: string;
  pending: string;
  none: string;
  loading: string;
  unavailable: string;
  approximate: string;
  limit: string;
  short: string;
}

export function QuoteColorPicker({
  stock,
  /** Poids estimé d'UNE pièce, ou null tant que le fichier n'a pas été lu. */
  gramsPerPiece,
  quantity,
  selected,
  onChange,
  max,
  labels,
}: {
  stock: CustomStock;
  gramsPerPiece: number | null;
  quantity: number;
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  max: number;
  labels: ColorPickerLabels;
}) {
  const colors = stock.status === "ready" ? stock.colors : [];
  const selectable = selectableColorIds(colors, gramsPerPiece, quantity);
  const message =
    stock.status === "loading"
      ? labels.loading
      : stock.status === "error"
        ? labels.unavailable
        : selectable.size === 0
          ? labels.none
          : null;
  const atLimit = selected.length >= max;
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="s3d-label mb-1 p-0 text-soft">{labels.legend}</legend>
      <p className="mb-3 text-sm text-soft">
        {labels.hint}
        {gramsPerPiece === null ? ` ${labels.pending}` : ""}
      </p>
      {message ? <p className="mb-3 text-sm text-soft">{message}</p> : null}
      {colors.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {colors.map((color) => {
            const on = selected.includes(color.id);
            const short = !selectable.has(color.id);
            const blocked = short || (!on && atLimit);
            return (
              <li key={color.id}>
                {/* Une vraie case à cocher (native), le libellé en est la pastille. */}
                <label
                  title={
                    short ? labels.short : blocked ? labels.limit : undefined
                  }
                  className={cx(
                    "relative inline-flex min-h-11 items-center gap-2.5 rounded-field border px-3 py-1.5 text-left text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                    on
                      ? "border-ink bg-surface outline outline-2 outline-ink"
                      : "border-line bg-surface hover:border-ink",
                    blocked
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer",
                  )}
                >
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={on}
                    disabled={blocked}
                    onChange={() =>
                      onChange(
                        on
                          ? selected.filter((id) => id !== color.id)
                          : [...selected, color.id],
                      )
                    }
                  />
                  <FilamentChip hexes={color.hexes} size={22} />
                  <span className="flex flex-col leading-tight">
                    <span className="text-ink">{color.name}</span>
                    <span className="text-xs text-soft">
                      {color.brand} {color.range}
                      {short
                        ? ` · ${labels.short}`
                        : color.approximate
                          ? ` · ${labels.approximate}`
                          : ""}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </fieldset>
  );
}

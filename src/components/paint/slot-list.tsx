"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { FilamentChip } from "@/components/filament-chip";
import { FilamentSwatches } from "@/components/filament-swatches";
import { cx } from "@/components/ui/cx";
import type { PublicCustomColor } from "@/lib/filament/public-stock";
import type { ColorSlot } from "./types";

// Filaments de l'atelier 3D, comme la liste des filaments de Bambu Studio : un
// emplacement par ligne (numéro, couleur, part de la surface). Cliquer une ligne
// la choisit pour peindre ; « Changer » remplace SA couleur sans toucher à ses
// zones ; × retire l'emplacement (ses zones reprennent la couleur principale).

export function SlotList({
  slots,
  stock,
  selectable,
  active,
  shares,
  max,
  onSelect,
  onChangeColor,
  onRemove,
  onAdd,
}: {
  slots: readonly ColorSlot[];
  stock: readonly PublicCustomColor[];
  selectable: ReadonlySet<string>;
  /** Emplacement choisi pour peindre (null : aucun, une seule couleur). */
  active: number | null;
  /** Part de la surface de chaque emplacement (0 à 1), ou null. */
  shares: readonly number[] | null;
  max: number;
  onSelect: (index: number) => void;
  onChangeColor: (index: number, ref: string) => void;
  onRemove: (index: number) => void;
  onAdd: (ref: string) => void;
}) {
  const t = useTranslations("paint.slots");
  const tq = useTranslations("quote.colorsPicker");
  /** Ligne dont la grille de couleurs est ouverte (« add » : la nouvelle). */
  const [editing, setEditing] = useState<number | "add" | null>(null);
  const colorOf = (id: string) => stock.find((c) => c.id === id);
  const percent = (value: number) => Math.round(value * 100);

  const grid = (current: string | null, pick: (id: string) => void) => (
    <div className="mt-2 rounded-field border border-line bg-paper p-2.5">
      <FilamentSwatches
        colors={stock}
        selectable={selectable}
        current={current}
        onPick={(id) => {
          pick(id);
          setEditing(null);
        }}
        shortLabel={tq("short")}
        approximateLabel={tq("approximate")}
        compact
      />
    </div>
  );

  return (
    <div>
      <ol className="space-y-1.5">
        {slots.map((slot, index) => {
          const color = colorOf(slot.ref);
          const on = active === index;
          const short = !selectable.has(slot.ref);
          return (
            <li key={slot.id}>
              <div
                className={cx(
                  "flex items-center gap-1 rounded-field border pr-1 transition-colors",
                  on
                    ? "border-ink bg-paper outline outline-2 outline-ink"
                    : "border-line",
                )}
              >
                <button
                  type="button"
                  aria-pressed={active === null ? undefined : on}
                  onClick={() => onSelect(index)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
                >
                  <span className="relative shrink-0">
                    <FilamentChip hexes={color?.hexes ?? []} size={28} />
                    <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-ink text-[0.625rem] font-semibold text-paper">
                      {index + 1}
                    </span>
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-sm text-ink">
                      {color?.name ?? t("unknown")}
                    </span>
                    <span
                      className={cx(
                        "block truncate text-xs",
                        short ? "font-semibold text-accent-text" : "text-soft",
                      )}
                    >
                      {short
                        ? tq("short")
                        : [
                            index === 0 ? t("main") : null,
                            shares && slots.length > 1
                              ? t("share", {
                                  percent: percent(shares[index] ?? 0),
                                })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-expanded={editing === index}
                  onClick={() => setEditing(editing === index ? null : index)}
                  className="h-9 shrink-0 rounded-field px-2.5 text-xs font-semibold text-ink hover:bg-line/60"
                >
                  {editing === index ? t("close") : t("change")}
                </button>
                {index > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      onRemove(index);
                    }}
                    aria-label={t("remove", { n: index + 1 })}
                    title={t("remove", { n: index + 1 })}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-field text-soft hover:bg-line/60 hover:text-ink"
                  >
                    <X size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              {editing === index
                ? grid(slot.ref, (id) => onChangeColor(index, id))
                : null}
            </li>
          );
        })}
      </ol>
      {slots.length < max ? (
        <div className="mt-2">
          <button
            type="button"
            aria-expanded={editing === "add"}
            onClick={() => setEditing(editing === "add" ? null : "add")}
            className="flex h-9 items-center gap-2 rounded-field px-2 text-sm font-semibold text-ink hover:bg-line/60"
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            {t("add")}
          </button>
          {editing === "add" ? grid(null, onAdd) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-soft">{t("max", { max })}</p>
      )}
    </div>
  );
}

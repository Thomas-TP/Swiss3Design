"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { FilamentChip } from "@/components/filament-chip";
import { FilamentSwatches } from "@/components/filament-swatches";
import type { ColorSetup, PaintNotice } from "@/components/paint/types";
import { cx } from "@/components/ui/cx";
import type { CustomStock } from "./quote-color-picker";

// Couleurs d'une demande « Sur mesure », juste sous l'aperçu 3D (25.10.2026,
// l'atelier 3D est désactivé) :
// - « Une couleur » : la grille des couleurs du stock, l'aperçu prend sa teinte ;
// - « Plusieurs couleurs » : seulement pour un fichier déjà en couleurs (3MF de
//   Bambu Studio, OrcaSlicer, PrusaSlicer, MakerWorld). Chaque couleur du
//   fichier garde ses zones ; on choisit pour elle une couleur du stock (comme
//   le mapping des filaments de Bambu Handy). Ni ajout ni retrait.
// Les deux réglages sont indépendants : changer la couleur unique ne touche
// jamais aux couleurs multiples, et inversement.

interface Props {
  stock: CustomStock;
  /** Couleurs dont le stock suffit pour la pièce (toutes tant que le poids est inconnu). */
  selectable: ReadonlySet<string>;
  setup: ColorSetup;
  onChange: (setup: ColorSetup) => void;
  max: number;
  /** Le poids de la pièce est-il connu (fichier lu) ? */
  weighed: boolean;
  /** Part de la surface de chaque couleur du fichier, ou null. */
  shares: readonly number[] | null;
  notice: PaintNotice | null;
}

export function QuoteColors({
  stock,
  selectable,
  setup,
  onChange,
  max,
  weighed,
  shares,
  notice,
}: Props) {
  const t = useTranslations("paint.colors");
  const tq = useTranslations("quote.colorsPicker");
  const titleId = useId();
  /** Couleur du fichier dont la grille est ouverte. */
  const [editing, setEditing] = useState<number | null>(null);
  const { single, refs } = setup;
  // Plusieurs couleurs : seulement avec un fichier qui en porte plusieurs.
  const fileColors = refs.length > 1;
  const several = setup.several && fileColors;

  const colors = stock.status === "ready" ? stock.colors : [];
  const colorOf = (id: string) => colors.find((c) => c.id === id);
  const stockMessage =
    stock.status === "loading"
      ? tq("loading")
      : stock.status === "error"
        ? tq("unavailable")
        : selectable.size === 0
          ? tq("none")
          : null;
  const merged = notice?.kind === "fileColors" && notice.merged;

  return (
    <section aria-labelledby={titleId} className="space-y-4">
      <h3 id={titleId} className="sr-only">
        {t("legend")}
      </h3>

      {/* Une ou plusieurs couleurs : un interrupteur, rien ne s'efface */}
      <div className="grid grid-cols-2 gap-2">
        {[false, true].map((value) => {
          const disabled = value && !fileColors;
          return (
            <button
              key={String(value)}
              type="button"
              aria-pressed={several === value}
              disabled={disabled}
              onClick={() => {
                setEditing(null);
                if (value !== setup.several)
                  onChange({ ...setup, several: value });
              }}
              className={cx(
                "rounded-field border px-3 py-2.5 text-left transition-colors",
                several === value
                  ? "border-ink bg-surface outline outline-2 outline-ink"
                  : "border-line bg-surface hover:border-ink",
                disabled && "cursor-not-allowed opacity-55 hover:border-line",
              )}
            >
              <span className="block text-sm font-semibold text-ink">
                {value ? t("several") : t("one")}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-soft">
                {value
                  ? fileColors
                    ? t("severalHint", { count: refs.length })
                    : t("severalFileOnly")
                  : t("oneHint")}
              </span>
            </button>
          );
        })}
      </div>

      {stockMessage ? (
        <p className="text-sm text-soft">{stockMessage}</p>
      ) : null}

      {!several ? (
        // ── Une couleur : la grille, directement ──
        <>
          <p
            className={cx(
              "text-sm",
              single && !selectable.has(single)
                ? "font-semibold text-accent-text"
                : "text-soft",
            )}
          >
            {single
              ? !selectable.has(single)
                ? t("short", { name: colorOf(single)?.name ?? "" })
                : t("chosen", { name: colorOf(single)?.name ?? "" })
              : t("pickOne")}
            {weighed ? "" : ` ${tq("pending")}`}
          </p>
          <FilamentSwatches
            colors={colors}
            selectable={selectable}
            current={single}
            onPick={(id) => onChange({ ...setup, single: id })}
            shortLabel={tq("short")}
            approximateLabel={tq("approximate")}
          />
        </>
      ) : (
        // ── Plusieurs couleurs : celles du fichier, à changer une à une ──
        <>
          <p className="text-sm text-ink">
            {t("fromFile", { count: refs.length })}
            {merged ? ` ${t("fromFileMerged", { max })}` : ""}
          </p>
          <ol className="space-y-2">
            {refs.map((id, index) => {
              const color = colorOf(id);
              const open = editing === index;
              const short = !selectable.has(id);
              return (
                <li key={index}>
                  <div
                    className={cx(
                      "flex items-center gap-3 rounded-field border px-3 py-2",
                      open ? "border-ink" : "border-line",
                    )}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">
                      {index + 1}
                    </span>
                    <FilamentChip hexes={color?.hexes ?? []} size={26} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm text-ink">
                        {color?.name ?? id}
                      </span>
                      <span
                        className={cx(
                          "block text-xs",
                          short
                            ? "font-semibold text-accent-text"
                            : "text-soft",
                        )}
                      >
                        {short
                          ? tq("short")
                          : shares
                            ? t("share", {
                                percent: Math.round((shares[index] ?? 0) * 100),
                              })
                            : t("slot", { n: index + 1 })}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setEditing(open ? null : index)}
                      className="h-9 shrink-0 rounded-field border border-line px-3 text-sm font-semibold text-ink hover:border-ink"
                    >
                      {open ? t("cancel") : t("change")}
                    </button>
                  </div>
                  {open ? (
                    <div className="mt-2 rounded-field border border-line bg-paper p-3">
                      <p className="mb-2 text-xs text-soft">
                        {t("choosing", { n: index + 1 })}
                      </p>
                      <FilamentSwatches
                        colors={colors}
                        selectable={selectable}
                        current={id}
                        onPick={(next) => {
                          onChange({
                            ...setup,
                            refs: refs.map((ref, i) =>
                              i === index ? next : ref,
                            ),
                          });
                          setEditing(null);
                        }}
                        shortLabel={tq("short")}
                        approximateLabel={tq("approximate")}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-soft">{t("sameColor")}</p>
        </>
      )}
    </section>
  );
}

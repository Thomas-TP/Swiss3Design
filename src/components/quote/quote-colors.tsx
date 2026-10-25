"use client";

import { useId, useState } from "react";
import { Check, Palette, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { FilamentChip } from "@/components/filament-chip";
import { FilamentSwatches } from "@/components/filament-swatches";
import { newSlot } from "@/components/paint/slots";
import type { ColorSetup, PaintNotice } from "@/components/paint/types";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import type { CustomStock } from "./quote-color-picker";

// Couleurs d'une demande « Sur mesure », juste sous l'aperçu 3D. Un seul endroit,
// deux modes, et RIEN ne se perd en passant de l'un à l'autre (25.10.2026) :
// - « Une couleur » : une pastille à choisir, l'aperçu prend sa teinte ;
// - « Plusieurs couleurs » : des emplacements numérotés (les filaments 1 à 4 ;
//   la couleur 1 couvre toute la pièce sauf les zones d'une autre couleur) et un
//   seul bouton, « Placer les couleurs sur la pièce », qui ouvre l'atelier.
// Les zones appartiennent aux emplacements : changer une couleur ne déplace
// rien. Un 3MF déjà peint arrive avec ses filaments (un emplacement chacun).

interface Props {
  stock: CustomStock;
  /** Couleurs dont le stock suffit pour la pièce (toutes tant que le poids est inconnu). */
  selectable: ReadonlySet<string>;
  setup: ColorSetup;
  onChange: (setup: ColorSetup) => void;
  max: number;
  /** Le poids de la pièce est-il connu (fichier lu) ? */
  weighed: boolean;
  /** Part de la surface de chaque emplacement (atelier), ou null. */
  shares: readonly number[] | null;
  /** Couleurs effectivement placées sur la pièce (0 : aucune peinture). */
  placed: number;
  /** Ajustements de l'atelier à rappeler (échelle, orientation), ou null. */
  adjustments: string | null;
  notice: PaintNotice | null;
  /** L'atelier peut-il s'ouvrir (WebGL, fichier lisible) ? */
  canPlace: boolean;
  onPlace: () => void;
}

export function QuoteColors({
  stock,
  selectable,
  setup,
  onChange,
  max,
  weighed,
  shares,
  placed,
  adjustments,
  notice,
  canPlace,
  onPlace,
}: Props) {
  const t = useTranslations("paint.colors");
  const ts = useTranslations("paint.slots");
  const tq = useTranslations("quote.colorsPicker");
  const titleId = useId();
  /** Emplacement dont la grille est ouverte (au-delà de la liste : un nouveau). */
  const [editing, setEditing] = useState<number | null>(null);
  const { slots, several } = setup;

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

  const setMode = (next: boolean) => {
    setEditing(null);
    if (next !== several) onChange({ ...setup, several: next });
  };

  /** Couleur de l'emplacement `index` (au-delà de la liste : un emplacement de plus). */
  const pickFor = (index: number, id: string) => {
    if (index < slots.length)
      onChange({
        ...setup,
        slots: slots.map((slot, i) =>
          i === index ? { ...slot, ref: id } : slot,
        ),
      });
    else if (slots.length < max)
      onChange({ ...setup, slots: [...slots, newSlot(id)] });
    setEditing(null);
  };

  const remove = (index: number) => {
    if (
      (shares?.[index] ?? 0) > 0 &&
      !window.confirm(ts("removeConfirm", { n: index + 1 }))
    )
      return;
    setEditing(null);
    onChange({ ...setup, slots: slots.filter((_, i) => i !== index) });
  };

  const slotName = (index: number) =>
    index === 0 ? t("slotMain") : t("slot", { n: index + 1 });
  // En plusieurs couleurs : au moins deux lignes (la seconde à choisir).
  const rows = Math.min(max, Math.max(2, slots.length));
  const fromFile = notice?.kind === "fileColors" ? notice : null;

  return (
    <section aria-labelledby={titleId} className="space-y-4">
      <h3 id={titleId} className="sr-only">
        {t("legend")}
      </h3>

      {/* Une ou plusieurs couleurs : un interrupteur, rien ne s'efface */}
      <div className="grid grid-cols-2 gap-2">
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={several === value}
            onClick={() => setMode(value)}
            className={cx(
              "rounded-field border px-3 py-2.5 text-left transition-colors",
              several === value
                ? "border-ink bg-surface outline outline-2 outline-ink"
                : "border-line bg-surface hover:border-ink",
            )}
          >
            <span className="block text-sm font-semibold text-ink">
              {value ? t("several") : t("one")}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-soft">
              {value ? t("severalHint", { max }) : t("oneHint")}
            </span>
          </button>
        ))}
      </div>

      {/* Couleurs d'un fichier déjà peint */}
      {fromFile ? (
        <div className="rounded-field border border-line bg-paper p-3 text-sm">
          {several ? (
            <p className="text-ink">
              {t("fromFile", { count: fromFile.count })}
              {fromFile.merged ? ` ${t("fromFileMerged", { max })}` : ""}
            </p>
          ) : (
            <>
              <p className="text-ink">{t("fileOffer")}</p>
              <Button
                variant="text"
                size="sm"
                className="mt-1"
                onClick={() => setMode(true)}
              >
                {t("useFile", { count: Math.max(2, slots.length) })}
              </Button>
            </>
          )}
        </div>
      ) : null}

      {stockMessage ? (
        <p className="text-sm text-soft">{stockMessage}</p>
      ) : null}

      {!several ? (
        // ── Une couleur : la grille, directement ──
        <>
          <p
            className={cx(
              "text-sm",
              slots[0] && !selectable.has(slots[0].ref)
                ? "font-semibold text-accent-text"
                : "text-soft",
            )}
          >
            {slots[0]
              ? !selectable.has(slots[0].ref)
                ? t("short", { name: colorOf(slots[0].ref)?.name ?? "" })
                : t("chosen", { name: colorOf(slots[0].ref)?.name ?? "" })
              : t("pickOne")}
            {weighed ? "" : ` ${tq("pending")}`}
          </p>
          <FilamentSwatches
            colors={colors}
            selectable={selectable}
            current={slots[0]?.ref ?? null}
            onPick={(id) => pickFor(0, id)}
            shortLabel={tq("short")}
            approximateLabel={tq("approximate")}
          />
        </>
      ) : (
        // ── Plusieurs couleurs : emplacements numérotés ──
        <>
          <ol className="space-y-2">
            {Array.from({ length: rows }, (_, index) => {
              const slot = slots[index];
              const color = slot ? colorOf(slot.ref) : undefined;
              const open = editing === index;
              const short = slot ? !selectable.has(slot.ref) : false;
              return (
                <li key={slot?.id ?? `new-${index}`}>
                  <div
                    className={cx(
                      "flex items-center gap-3 rounded-field border px-3 py-2",
                      open ? "border-ink" : "border-line",
                    )}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">
                      {index + 1}
                    </span>
                    {color ? (
                      <FilamentChip hexes={color.hexes} size={26} />
                    ) : (
                      <span className="h-[26px] w-[26px] shrink-0 rounded-full border border-dashed border-line" />
                    )}
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm text-ink">
                        {color?.name ?? slotName(index)}
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
                          : [
                              color ? slotName(index) : null,
                              index === 0 ? t("slotMainHint") : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                      </span>
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditing(open ? null : index)}
                      aria-expanded={open}
                      disabled={!slot && index > slots.length}
                    >
                      {open ? t("cancel") : slot ? t("change") : t("pick")}
                    </Button>
                    {index > 0 && slot ? (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        aria-label={ts("remove", { n: index + 1 })}
                        title={ts("remove", { n: index + 1 })}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-field text-soft hover:bg-line/60 hover:text-ink"
                      >
                        <X size={16} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {open ? (
                    <div className="mt-2 rounded-field border border-line bg-paper p-3">
                      <p className="mb-2 text-xs text-soft">
                        {t("choosing", { slot: slotName(index) })}
                      </p>
                      <FilamentSwatches
                        colors={colors}
                        selectable={selectable}
                        current={slot?.ref ?? null}
                        onPick={(id) => pickFor(index, id)}
                        shortLabel={tq("short")}
                        approximateLabel={tq("approximate")}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
          {slots.length >= 2 && slots.length < max ? (
            <Button
              variant="text"
              size="sm"
              onClick={() => setEditing(slots.length)}
            >
              <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
              {t("add")}
            </Button>
          ) : null}
          {editing !== null && editing >= rows ? (
            <div className="rounded-field border border-line bg-paper p-3">
              <p className="mb-2 text-xs text-soft">
                {t("choosing", { slot: slotName(editing) })}
              </p>
              <FilamentSwatches
                colors={colors}
                selectable={selectable}
                current={null}
                onPick={(id) => pickFor(editing, id)}
                shortLabel={tq("short")}
                approximateLabel={tq("approximate")}
              />
            </div>
          ) : null}

          {/* Placement sur la pièce */}
          <div className="rounded-field border border-line bg-paper p-3">
            {slots.length < 2 ? (
              <p className="text-sm text-soft">{t("needTwo")}</p>
            ) : placed > 1 ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Check size={16} strokeWidth={2} aria-hidden="true" />
                {t("placed", { count: placed })}
              </p>
            ) : (
              <p className="text-sm text-soft">
                {canPlace ? t("notPlaced") : t("noWebgl")}
              </p>
            )}
            {canPlace && slots.length >= 2 ? (
              <Button
                variant={placed > 1 ? "secondary" : "ink"}
                size="sm"
                className="mt-2"
                onClick={onPlace}
              >
                <Palette size={16} strokeWidth={1.5} aria-hidden="true" />
                {placed > 1 ? t("edit") : t("place")}
              </Button>
            ) : null}
          </div>
        </>
      )}

      {/* Taille et orientation (l'atelier, même en une couleur) */}
      {canPlace ? (
        <p className="text-sm text-soft">
          {adjustments ? `${adjustments} · ` : ""}
          <Button variant="text" size="sm" onClick={onPlace}>
            {t("size")}
          </Button>
        </p>
      ) : null}
    </section>
  );
}

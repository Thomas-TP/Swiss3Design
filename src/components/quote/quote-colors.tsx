"use client";

import { useId, useState } from "react";
import { Check, Palette, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { FilamentChip } from "@/components/filament-chip";
import type { PaintNotice } from "@/components/paint/types";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import type { PublicCustomColor } from "@/lib/filament/public-stock";
import type { CustomStock } from "./quote-color-picker";

// Couleurs d'une demande « Sur mesure », juste sous l'aperçu 3D (25.10.2026 :
// l'ancien choix, une liste de cases à cocher plus bas dans le formulaire et un
// second choix dans l'atelier 3D, n'était pas compréhensible). Un seul endroit :
// - « Une couleur » : une pastille à choisir, l'aperçu prend sa teinte ;
// - « Plusieurs couleurs » : des emplacements nommés (la couleur principale
//   couvre toute la pièce sauf les zones peintes, puis les couleurs 2 à 4) et
//   un seul bouton, « Placer les couleurs sur la pièce », qui ouvre l'atelier.
// L'ordre des emplacements est celui des filaments du 3MF envoyé (1 = principale).

interface Props {
  stock: CustomStock;
  /** Couleurs dont le stock suffit pour la pièce (toutes tant que le poids est inconnu). */
  selectable: ReadonlySet<string>;
  /** Couleurs choisies, dans l'ordre des emplacements. */
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  max: number;
  /** Le poids de la pièce est-il connu (fichier lu) ? */
  weighed: boolean;
  /** Couleurs effectivement placées sur la pièce (0 : aucune peinture). */
  placed: number;
  /** Ajustements de l'atelier à rappeler (échelle, orientation), ou null. */
  adjustments: string | null;
  notice: PaintNotice | null;
  /** L'atelier peut-il s'ouvrir (WebGL, fichier lisible) ? */
  canPlace: boolean;
  onPlace: () => void;
}

type Editing = { slot: number } | null;

export function QuoteColors({
  stock,
  selectable,
  selected,
  onChange,
  max,
  weighed,
  placed,
  adjustments,
  notice,
  canPlace,
  onPlace,
}: Props) {
  const t = useTranslations("paint.colors");
  const tq = useTranslations("quote.colorsPicker");
  const titleId = useId();
  // Plusieurs couleurs : choisi par le visiteur, ou imposé par la sélection
  // (couleurs reprises d'un fichier peint).
  const [wantsSeveral, setWantsSeveral] = useState(false);
  const several = wantsSeveral || selected.length > 1;
  const [editing, setEditing] = useState<Editing>(null);

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
    setWantsSeveral(next);
    // Retour à une couleur : la principale reste, les autres partent (leurs
    // zones redeviennent principales ; l'atelier sait l'annuler).
    if (!next && selected.length > 1) onChange([selected[0]]);
  };

  const pick = (id: string) => {
    if (!several) {
      onChange([id]);
      return;
    }
    if (!editing) return;
    const next = [...selected];
    const existing = next.indexOf(id);
    if (existing >= 0 && existing !== editing.slot) {
      // Couleur déjà dans un autre emplacement : on échange les deux.
      next[existing] = next[editing.slot];
    }
    if (editing.slot < next.length) next[editing.slot] = id;
    else next.push(id);
    onChange(next.filter(Boolean));
    setEditing(null);
  };

  const remove = (slot: number) => {
    setEditing(null);
    onChange(selected.filter((_, i) => i !== slot));
  };

  const slotName = (slot: number) =>
    slot === 0 ? t("slotMain") : t("slot", { n: slot + 1 });

  return (
    <section aria-labelledby={titleId} className="space-y-4">
      <h3 id={titleId} className="sr-only">
        {t("legend")}
      </h3>

      {/* Une ou plusieurs couleurs */}
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
      {notice?.kind === "fileColorsApplied" ? (
        <div className="rounded-field border border-line bg-paper p-3 text-sm">
          <p className="text-ink">
            {t("fromFile")}
            {notice.merged ? ` ${t("fromFileMerged", { max })}` : ""}
          </p>
          <Button
            variant="text"
            size="sm"
            className="mt-1"
            onClick={() => {
              setWantsSeveral(false);
              setEditing(null);
              notice.revert();
            }}
          >
            {t("useOne")}
          </Button>
        </div>
      ) : notice?.kind === "fileColors" ? (
        <div className="rounded-field border border-line bg-paper p-3 text-sm">
          <p className="text-ink">{t("fileOffer", { count: notice.count })}</p>
          <Button
            variant="text"
            size="sm"
            className="mt-1"
            onClick={() => {
              setWantsSeveral(true);
              notice.apply();
            }}
          >
            {t("useFile", { count: notice.count })}
          </Button>
        </div>
      ) : null}

      {stockMessage ? (
        <p className="text-sm text-soft">{stockMessage}</p>
      ) : null}

      {!several ? (
        // ── Une couleur : la grille, directement ──
        <>
          <p className="text-sm text-soft">
            {selected[0]
              ? t("chosen", { name: colorOf(selected[0])?.name ?? "" })
              : t("pickOne")}
            {weighed ? "" : ` ${tq("pending")}`}
          </p>
          <SwatchGrid
            colors={colors}
            selectable={selectable}
            current={selected[0] ?? null}
            onPick={pick}
            shortLabel={tq("short")}
            approximateLabel={tq("approximate")}
          />
        </>
      ) : (
        // ── Plusieurs couleurs : emplacements nommés ──
        <>
          <ol className="space-y-2">
            {Array.from(
              { length: Math.min(max, Math.max(2, selected.length)) },
              (_, slot) => {
                const id = selected[slot];
                const color = id ? colorOf(id) : undefined;
                const open = editing?.slot === slot;
                return (
                  <li key={slot}>
                    <div
                      className={cx(
                        "flex items-center gap-3 rounded-field border px-3 py-2",
                        open ? "border-ink" : "border-line",
                      )}
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">
                        {slot + 1}
                      </span>
                      {color ? (
                        <FilamentChip hexes={color.hexes} size={26} />
                      ) : (
                        <span className="h-[26px] w-[26px] shrink-0 rounded-full border border-dashed border-line" />
                      )}
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-sm text-ink">
                          {color?.name ?? slotName(slot)}
                        </span>
                        <span className="block text-xs text-soft">
                          {color ? slotName(slot) : ""}
                          {slot === 0
                            ? `${color ? " · " : ""}${t("slotMainHint")}`
                            : ""}
                        </span>
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditing(open ? null : { slot })}
                        aria-expanded={open}
                      >
                        {open ? t("cancel") : color ? t("change") : t("pick")}
                      </Button>
                      {slot > 0 && id ? (
                        <button
                          type="button"
                          onClick={() => remove(slot)}
                          aria-label={t("remove", { name: color?.name ?? "" })}
                          title={t("remove", { name: color?.name ?? "" })}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-field text-soft hover:bg-line/60 hover:text-ink"
                        >
                          <X size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                    {open ? (
                      <div className="mt-2 rounded-field border border-line bg-paper p-3">
                        <p className="mb-2 text-xs text-soft">
                          {t("choosing", { slot: slotName(slot) })}
                        </p>
                        <SwatchGrid
                          colors={colors}
                          selectable={selectable}
                          current={id ?? null}
                          onPick={pick}
                          shortLabel={tq("short")}
                          approximateLabel={tq("approximate")}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              },
            )}
          </ol>
          {selected.length >= 2 && selected.length < max ? (
            <Button
              variant="text"
              size="sm"
              onClick={() => setEditing({ slot: selected.length })}
            >
              <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
              {t("add")}
            </Button>
          ) : null}

          {/* Placement sur la pièce */}
          <div className="rounded-field border border-line bg-paper p-3">
            {selected.length < 2 ? (
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
            {canPlace && selected.length >= 2 ? (
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

function SwatchGrid({
  colors,
  selectable,
  current,
  onPick,
  shortLabel,
  approximateLabel,
}: {
  colors: readonly PublicCustomColor[];
  selectable: ReadonlySet<string>;
  current: string | null;
  onPick: (id: string) => void;
  shortLabel: string;
  approximateLabel: string;
}) {
  if (colors.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                "flex min-h-12 w-full items-center gap-2.5 rounded-field border px-2.5 py-1.5 text-left transition-colors",
                on
                  ? "border-ink bg-surface outline outline-2 outline-ink"
                  : "border-line bg-surface hover:border-ink",
                short && "cursor-not-allowed opacity-45",
              )}
            >
              <FilamentChip hexes={color.hexes} size={24} />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm text-ink">
                  {color.name}
                </span>
                <span className="block truncate text-xs text-soft">
                  {short
                    ? shortLabel
                    : color.approximate
                      ? approximateLabel
                      : color.range}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

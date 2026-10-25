"use client";

import { useId } from "react";
import { AlertTriangle, Check, Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import { FilamentChip } from "@/components/filament-chip";
import { FilamentSwatches } from "@/components/filament-swatches";
import type { ColorSetup, PaintNotice } from "@/components/paint/types";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import type { CustomStock } from "./quote-color-picker";

// Couleurs d'une demande « Sur mesure », juste sous l'aperçu 3D (25.10.2026).
// UN SEUL endroit choisit les couleurs d'une pièce multicolore : l'atelier 3D,
// comme la liste des filaments de Bambu Studio ou de Creality Print. La page ne
// fait que deux choses :
// - « Une couleur » : la grille des couleurs du stock, l'aperçu prend sa teinte ;
// - « Plusieurs couleurs » : un résumé (couleurs choisies, part de la surface)
//   et un bouton qui ouvre l'atelier. Un 3MF déjà peint y arrive avec ses zones.
// Passer de l'un à l'autre ne perd rien : c'est un interrupteur.

interface Props {
  stock: CustomStock;
  /** Couleurs dont le stock suffit pour la pièce (toutes tant que le poids est inconnu). */
  selectable: ReadonlySet<string>;
  setup: ColorSetup;
  onChange: (setup: ColorSetup) => void;
  max: number;
  /** Le poids de la pièce est-il connu (fichier lu) ? */
  weighed: boolean;
  /** Un fichier 3D est-il choisi ? */
  hasFile: boolean;
  /** Part de la surface de chaque couleur (emplacement), ou null. */
  shares: readonly number[] | null;
  /** Couleurs effectivement placées sur la pièce (0 : aucune peinture). */
  placed: number;
  /** Ajustements de l'atelier à rappeler (échelle, orientation), ou null. */
  adjustments: string | null;
  notice: PaintNotice | null;
  /** L'atelier peut-il s'ouvrir (WebGL, fichier lisible et lu) ? */
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
  hasFile,
  shares,
  placed,
  adjustments,
  notice,
  canPlace,
  onPlace,
}: Props) {
  const t = useTranslations("paint.colors");
  const tq = useTranslations("quote.colorsPicker");
  const titleId = useId();
  const { refs, several } = setup;

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
  const fromFile = notice?.kind === "fileColors" ? notice : null;
  const main = refs[0] ?? null;
  const visible = several ? refs : refs.slice(0, 1);
  const short = visible.filter((id) => !selectable.has(id));

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
            onClick={() => {
              if (value !== several) onChange({ ...setup, several: value });
            }}
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

      {stockMessage ? (
        <p className="text-sm text-soft">{stockMessage}</p>
      ) : null}

      {!several ? (
        // ── Une couleur : la grille, directement ──
        <>
          {fromFile && refs.length > 1 ? (
            <div className="rounded-field border border-line bg-paper p-3 text-sm">
              <p className="text-ink">{t("fileOffer")}</p>
              <Button
                variant="text"
                size="sm"
                className="mt-1"
                onClick={() => onChange({ ...setup, several: true })}
              >
                {t("useFile", { count: refs.length })}
              </Button>
            </div>
          ) : null}
          <p
            className={cx(
              "text-sm",
              main && short.includes(main)
                ? "font-semibold text-accent-text"
                : "text-soft",
            )}
          >
            {main
              ? short.includes(main)
                ? t("short", { name: colorOf(main)?.name ?? "" })
                : t("chosen", { name: colorOf(main)?.name ?? "" })
              : t("pickOne")}
            {weighed ? "" : ` ${tq("pending")}`}
          </p>
          <FilamentSwatches
            colors={colors}
            selectable={selectable}
            current={main}
            onPick={(id) =>
              onChange({ ...setup, refs: [id, ...refs.slice(1)] })
            }
            shortLabel={tq("short")}
            approximateLabel={tq("approximate")}
          />
        </>
      ) : !hasFile ? (
        // ── Plusieurs couleurs, sans fichier : l'atelier a besoin de la pièce ──
        <p className="rounded-field border border-line bg-paper p-3 text-sm text-soft">
          {t("needFile")}
        </p>
      ) : (
        // ── Plusieurs couleurs : résumé, et l'atelier pour tout le reste ──
        <div className="rounded-field border border-line bg-paper p-4">
          {fromFile ? (
            <p className="mb-3 text-sm text-ink">
              {t("fromFile", { count: fromFile.count })}
              {fromFile.merged ? ` ${t("fromFileMerged", { max })}` : ""}
            </p>
          ) : null}
          {visible.length > 0 ? (
            <ol className="mb-3 flex flex-wrap gap-2">
              {visible.map((id, index) => {
                const color = colorOf(id);
                const isShort = short.includes(id);
                return (
                  <li
                    key={index}
                    className={cx(
                      "flex items-center gap-2 rounded-full border bg-surface py-1 pl-1 pr-3 text-sm",
                      isShort ? "border-accent-text" : "border-line",
                    )}
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-[0.625rem] font-semibold text-paper">
                      {index + 1}
                    </span>
                    <FilamentChip hexes={color?.hexes ?? []} size={18} />
                    <span className="text-ink">{color?.name ?? id}</span>
                    {shares && visible.length > 1 ? (
                      <span className="tabular-nums text-soft">
                        {Math.round((shares[index] ?? 0) * 100)} %
                      </span>
                    ) : null}
                    {isShort ? (
                      <AlertTriangle
                        size={14}
                        strokeWidth={2}
                        className="text-accent-text"
                        aria-label={tq("short")}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : null}
          {short.length > 0 ? (
            <p className="mb-3 text-sm font-semibold text-accent-text">
              {t("shortSeveral")}
            </p>
          ) : null}
          {!canPlace ? (
            <p className="text-sm text-soft">{t("noWebgl")}</p>
          ) : (
            <>
              <p
                className={cx(
                  "mb-3 flex items-center gap-2 text-sm",
                  placed > 1 ? "font-semibold text-ink" : "text-soft",
                )}
              >
                {placed > 1 ? (
                  <Check size={16} strokeWidth={2} aria-hidden="true" />
                ) : null}
                {placed > 1
                  ? t("placed", { count: placed })
                  : visible.length < 2
                    ? t("intro")
                    : t("notPlaced")}
              </p>
              <Button
                variant={placed > 1 ? "secondary" : "ink"}
                size="sm"
                onClick={onPlace}
              >
                <Palette size={16} strokeWidth={1.5} aria-hidden="true" />
                {placed > 1 ? t("edit") : t("place")}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Taille et orientation (l'atelier, même en une couleur) */}
      {canPlace && !several ? (
        <p className="text-sm text-soft">
          {adjustments ? `${adjustments} · ` : ""}
          <Button variant="text" size="sm" onClick={onPlace}>
            {t("size")}
          </Button>
        </p>
      ) : adjustments && several ? (
        <p className="text-sm text-soft">{adjustments}</p>
      ) : null}
    </section>
  );
}

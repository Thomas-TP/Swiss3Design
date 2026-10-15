"use client";

import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { bandStatsFor } from "@/lib/studio/band-stats";
import {
  filamentGramsOf,
  scaleGrams,
  type FilamentGrams,
} from "@/lib/studio/filament-need";
import { useRouter } from "@/i18n/navigation";
import type { StudioCartItem } from "@/lib/cart-data";
import { formatChf } from "@/lib/format";
import { PRICE_LOCALE, STUDIO_QTY_MAX } from "@/lib/studio/price";
import { PRINT } from "@/lib/studio/print-params";
import { computeStats } from "@/lib/studio/stats";
import { writeStudioTexts } from "@/lib/studio/texts-store";
import { configFragment } from "@/lib/studio/url-state";
import { writeEditIntent } from "@/components/studio/edit-intent";
import { lineSummary } from "@/components/studio/line-summary";
import type { SummaryInput, Translate } from "@/components/studio/summary";
import { flatThumbnail } from "@/components/studio/thumbnail";

// Ligne d'un objet du Studio dans le panier : son poster SVG (le dessin 2D exact
// de la configuration, calculé ici, aucun texte dedans : les lignes de texte sont
// des barres), son résumé (dimensions, couleurs avec leur teinte exacte, textes
// à imprimer), la quantité, le prix ferme et « Modifier dans le Studio ».
//
// Chargé à la demande par le panier (next/dynamic) : le moteur de statistiques
// et les posters ne pèsent que si le panier contient une ligne du Studio.
// Stock : la ligne remonte au panier ses grammes par couleur (pièce × quantité,
// même calcul que le paiement, langue canonique) ; le panier additionne toutes
// les lignes et lui renvoie les couleurs épuisées, signalées sous le résumé.
// Les textes saisis sont des données personnelles : `ph-mask` (aucun
// enregistrement de visite ne les garde).

export default function StudioLine({
  item,
  onQuantity,
  onRemove,
  onNeeds,
  shortColors,
}: {
  item: StudioCartItem;
  onQuantity: (id: string, quantity: number) => void;
  onRemove: (item: StudioCartItem) => void;
  onNeeds: (id: string, grams: FilamentGrams) => void;
  shortColors: ReadonlySet<string>;
}) {
  const t = useTranslations("cart");
  const ts = useTranslations("system.cart");
  const studio = useTranslations("studio") as unknown as Translate;
  const core = useTranslations("studioCore") as unknown as Translate;
  const locale = useLocale();
  const router = useRouter();

  const summary = useMemo(() => {
    const stats = computeStats(item.config, item.texts, PRINT, item.locale);
    const bands = bandStatsFor(item.config, item.texts, PRINT, item.locale);
    const input: SummaryInput = {
      config: item.config,
      texts: item.texts,
      stats,
      bands,
      locale,
      t: studio,
      core,
    };
    return lineSummary(input);
  }, [item.config, item.texts, item.locale, locale, studio, core]);

  const needs = useMemo(
    () =>
      scaleGrams(
        filamentGramsOf(item.config, item.texts, PRICE_LOCALE),
        item.quantity,
      ),
    [item.config, item.texts, item.quantity],
  );
  useEffect(() => onNeeds(item.id, needs), [item.id, needs, onNeeds]);
  const shortNames = summary.colors
    .filter((color) => shortColors.has(color.id))
    .map((color) => color.name);

  const posters = useMemo(
    () => ({
      light: flatThumbnail(item.config, item.texts, item.locale, "light"),
      dark: flatThumbnail(item.config, item.texts, item.locale, "dark"),
    }),
    [item.config, item.texts, item.locale],
  );

  function edit() {
    // La configuration voyage dans le fragment de l'URL (jamais un texte) ; les
    // textes, par la session de l'onglet ; l'intention de REMPLACER cette ligne,
    // par sessionStorage (edit-intent.ts).
    writeStudioTexts(item.object, item.texts);
    writeEditIntent({
      id: item.id,
      object: item.object,
      quantity: item.quantity,
    });
    router.push(`/studio/${item.object}${configFragment(item.config)}`);
  }

  return (
    <li className="flex gap-4 rounded-card border border-line bg-surface p-3 sm:p-4">
      <div
        aria-hidden="true"
        className="h-20 w-20 shrink-0 overflow-hidden rounded-field bg-paper sm:h-24 sm:w-24"
      >
        <img
          src={posters.light}
          alt=""
          width={96}
          height={96}
          className="h-full w-full object-contain p-1 dark:hidden"
        />
        <img
          src={posters.dark}
          alt=""
          width={96}
          height={96}
          className="hidden h-full w-full object-contain p-1 dark:block"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words font-semibold leading-snug text-ink">
              {summary.objectName}
            </p>
            <p className="mt-1 text-sm text-soft">{summary.dimensions}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-soft">
              {summary.colors.map((color) => (
                <span
                  key={color.id}
                  className="inline-flex items-center gap-1.5"
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full border border-swatch-ring"
                    style={{ backgroundColor: color.hex }}
                  />
                  {color.name}
                </span>
              ))}
            </p>
            {summary.texts.length > 0 ? (
              <ul className="ph-mask mt-1 text-sm text-soft">
                {summary.texts.map((text) => (
                  <li key={text.label} className="break-words">
                    {text.label} : « {text.value} »
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="s3d-num mt-1 text-sm text-soft">
              {ts("unitPrice", {
                price: formatChf(item.priceCents, locale),
              })}
              {" · "}
              {ts("studioNote")}
            </p>
            {shortNames.length > 0 ? (
              <p className="mt-2 text-sm font-medium text-accent-text">
                {ts("studioShort", { colors: shortNames.join(", ") })}
              </p>
            ) : null}
            <button
              type="button"
              onClick={edit}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink underline decoration-line decoration-1 underline-offset-4 hover:decoration-ink"
            >
              <Pencil size={14} strokeWidth={1.5} aria-hidden="true" />
              {ts("studioEdit")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => onRemove(item)}
            aria-label={t("remove")}
            className="-mr-1 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-field text-soft transition-colors hover:bg-line/60 hover:text-accent-text"
          >
            <Trash2 size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
          <div className="inline-flex items-center rounded-field border border-line bg-elevated">
            <button
              type="button"
              onClick={() => onQuantity(item.id, item.quantity - 1)}
              aria-label={t("decrease")}
              className="grid h-10 w-10 place-items-center rounded-l-field transition-colors hover:bg-line/60"
            >
              <Minus size={16} strokeWidth={1.5} />
            </button>
            <output
              aria-label={t("quantity")}
              className="s3d-num min-w-8 text-center text-sm font-semibold"
            >
              {item.quantity}
            </output>
            <button
              type="button"
              onClick={() => onQuantity(item.id, item.quantity + 1)}
              disabled={item.quantity >= STUDIO_QTY_MAX}
              aria-label={t("increase")}
              className="grid h-10 w-10 place-items-center rounded-r-field transition-colors hover:bg-line/60 disabled:opacity-40"
            >
              <Plus size={16} strokeWidth={1.5} />
            </button>
          </div>
          <p className="s3d-num font-semibold text-ink">
            {formatChf(item.priceCents * item.quantity, locale)}
          </p>
        </div>
      </div>
    </li>
  );
}

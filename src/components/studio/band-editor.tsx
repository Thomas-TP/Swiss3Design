"use client";

import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Ruler } from "@/components/ui/ruler";
import { filamentHex } from "@/lib/studio/filaments";
import type { Band, FilamentId } from "@/lib/studio/types";
import { SwatchRadio } from "./swatch-radio";
import styles from "./studio.module.css";

// Barre altimétrique et liste des bandes (brief « Strates », §6.7). Une
// configuration porte de 1 à 4 bandes contiguës depuis z = 0 : chaque FRONTIÈRE
// est un `input type="range"` natif, vertical à côté de la scène (desktop),
// horizontal dans l'onglet Couleurs (mobile), zone de prise de 44 px,
// `aria-valuetext` « Changement 1 à 42,0 mm, couche 211 ». Les frontières sont
// quantifiées à la couche (0,2 mm), 2 mm d'épaisseur au moins : ces règles
// vivent dans src/lib/studio/bands.ts, cette barre ne fait que les appeler (aucune
// séquence de gestes ne produit une configuration invalide).
//
// Toutes les barres sont superposées sur la même règle (chacune va de 0 à la
// hauteur totale) : la position d'un repère est donc exactement sa hauteur. Seul
// le repère (le « pouce ») reçoit le pointeur, le reste de la piste le laisse
// passer. Au clavier, les flèches déplacent d'un cran (une couche pour le vase,
// une strate pour le sous-verre), Maj + flèche de dix ; la valeur brute d'un
// glissé est ramenée au cran valide par l'appelant.

type Orientation = "vertical" | "horizontal";

export function BandBar({
  bands,
  height,
  orientation,
  stepMm,
  onBoundary,
  onCommit,
  nameOf,
  labelOf,
  valueTextOf,
  className,
}: {
  bands: readonly Band[];
  /** Hauteur totale de la pièce (mm) : la dernière frontière. */
  height: number;
  orientation: Orientation;
  /** Cran d'une flèche (mm). */
  stepMm: number;
  /** Frontière haute de la bande `index` déplacée vers `toMm` (valeur brute). */
  onBoundary: (index: number, toMm: number) => void;
  onCommit: () => void;
  nameOf: (id: FilamentId) => string;
  labelOf: (index: number) => string;
  valueTextOf: (index: number, toMm: number) => string;
  className?: string;
}) {
  const vertical = orientation === "vertical";
  const segments = bands.map((band, index) => ({
    from: index === 0 ? 0 : bands[index - 1].toMm,
    to: band.toMm,
    band,
  }));

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    const direction =
      event.key === "ArrowUp" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowDown" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (direction === 0) return;
    event.preventDefault();
    const factor = event.shiftKey ? 10 : 1;
    onBoundary(index, bands[index].toMm + direction * factor * stepMm);
    onCommit();
  }

  return (
    <div
      className={cx(
        vertical ? "flex h-full min-h-0 gap-1" : "flex flex-col gap-1",
        className,
      )}
    >
      <div
        className={vertical ? "h-full shrink-0" : "w-full"}
        // La règle est calée sur la piste de la barre (0 en bas, comme le plateau).
      >
        <Ruler
          to={height}
          minor={5}
          major={10}
          labelEvery={50}
          orientation={orientation}
          className={vertical ? "h-full" : "w-full"}
        />
      </div>
      <div
        className={cx(
          "relative shrink-0 border border-line",
          vertical ? "h-full w-8" : "h-8 w-full",
        )}
      >
        {segments.map(({ from: a, to: b, band }, index) => {
          const start = (a / height) * 100;
          const size = ((b - a) / height) * 100;
          return (
            <span
              key={index}
              aria-hidden="true"
              className="absolute"
              style={{
                backgroundColor: filamentHex(band.filament),
                ...(vertical
                  ? {
                      left: 0,
                      right: 0,
                      bottom: `${start}%`,
                      height: `${size}%`,
                    }
                  : {
                      top: 0,
                      bottom: 0,
                      left: `${start}%`,
                      width: `${size}%`,
                    }),
              }}
            />
          );
        })}
        {bands.slice(0, -1).map((band, index) => (
          <input
            key={index}
            type="range"
            form="studio-local"
            min={0}
            max={height}
            step={0.2}
            value={band.toMm}
            aria-label={labelOf(index + 1)}
            aria-valuetext={valueTextOf(index + 1, band.toMm)}
            aria-orientation={orientation}
            onChange={(event) =>
              onBoundary(index, Number(event.currentTarget.value))
            }
            onPointerUp={onCommit}
            onKeyUp={onCommit}
            onBlur={onCommit}
            onKeyDown={(event) => onKeyDown(index, event)}
            className={cx(
              vertical ? styles.bandRangeV : styles.bandRangeH,
              "absolute",
              vertical ? "-inset-x-2 inset-y-0" : "-inset-y-2 inset-x-0",
              "invisible group-data-[js]/studio:visible",
            )}
          />
        ))}
      </div>
      {/* Noms des filaments pour les lecteurs d'écran : la barre est graphique. */}
      <ul className="sr-only">
        {segments.map(({ from: a, to: b, band }, index) => (
          <li key={index}>
            {nameOf(band.filament)} {a}–{b} mm
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BandList({
  bands,
  canAdd,
  canRemove,
  onFilament,
  onAdd,
  onRemove,
  nameOf,
  titleOf,
  rangeOf,
  legendOf,
  addLabel,
  removeText,
  removeLabelOf,
  className,
}: {
  bands: readonly Band[];
  canAdd: boolean;
  canRemove: boolean;
  onFilament: (index: number, filament: FilamentId) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  nameOf: (id: FilamentId) => string;
  titleOf: (index: number) => string;
  rangeOf: (index: number) => string;
  legendOf: (index: number) => string;
  addLabel: string;
  /** Texte visible du bouton (« Retirer »), complété pour les lecteurs d'écran. */
  removeText: string;
  removeLabelOf: (index: number) => string;
  className?: string;
}) {
  // Du haut vers le bas, comme la barre : la dernière bande est la plus haute.
  const order = bands.map((_, index) => index).reverse();
  return (
    <div className={cx("flex flex-col gap-5", className)}>
      <ul className="flex flex-col gap-5">
        {order.map((index) => (
          <li key={index} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="s3d-label text-ink">
                {titleOf(index + 1)}
                <span className="ml-2 normal-case text-soft">
                  {rangeOf(index)}
                </span>
              </p>
              {canRemove ? (
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => onRemove(index)}
                  aria-label={removeLabelOf(index + 1)}
                >
                  {removeText}
                </Button>
              ) : null}
            </div>
            <SwatchRadio
              legend={legendOf(index + 1)}
              hideLegend
              name={`band-${index}`}
              form="studio-local"
              value={bands[index].filament}
              onChange={(id) => onFilament(index, id)}
              nameOf={nameOf}
            />
          </li>
        ))}
      </ul>
      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={!canAdd}
          onClick={onAdd}
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

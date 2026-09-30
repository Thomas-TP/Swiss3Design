"use client";

import { useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { SpecTable } from "@/components/ui/spec-table";
import { SchematicDraw } from "@/gates/about";
import { useMotionBridge } from "@/lib/motion-bridge/store";
import {
  PrinterSchematic,
  getHotspots,
  type PrinterVariant,
} from "./printer-schematic";

export interface ShowcaseCallout {
  /** Libellé court, affiché au bout du trait de rappel et dans la légende. */
  label: string;
  /** Une phrase : ce que fait l'organe. */
  text: string;
}

export interface ShowcasePrinter {
  variant: PrinterVariant;
  /** « Bambu Lab P1S » */
  name: string;
  /** « + AMS 2 Pro » */
  sub: string;
  /** Atelier où elle tourne. */
  place: string;
  /** Deux ou trois phrases de présentation. */
  blurb: string;
  callouts: ShowcaseCallout[];
  specs: { label: string; value: string }[];
}

/**
 * Vitrine du parc machine : un onglet par imprimante, un schéma annoté
 * interactif et sa fiche technique.
 *
 * L'interaction est bidirectionnelle — survoler un trait sur le schéma éclaire
 * la ligne correspondante de la légende, et l'inverse. Le survol seul ne suffit
 * pas (rien au clavier, rien au tactile) : chaque ligne de légende est donc un
 * vrai bouton, focusable, qui verrouille la sélection au clic.
 *
 * Tous les panneaux sont dans le HTML serveur, l'inactif étant seulement
 * `hidden` : les deux machines, leurs repères et leurs fiches sont lisibles
 * sans JS par les moteurs et les agents, et `aria-controls` de chaque onglet
 * pointe toujours vers un panneau qui existe.
 *
 * Le tracé du schéma à l'entrée dans l'écran (DrawSVG, mouvement complet) vit
 * côté lourd, derrière le gate : ici on ne monte la chorégraphie que quand le
 * runtime tourne, et elle retrouve le panneau actif dans `rootRef`.
 */
export function PrinterShowcase({
  printers,
  specsTitle,
  legendHint,
}: {
  printers: ShowcasePrinter[];
  specsTitle: string;
  legendHint: string;
}) {
  const t = useTranslations("atelier.showcase");
  const [tab, setTab] = useState(0);
  // Survol : éphémère. Épinglé : verrouillé au clic / à la touche Entrée.
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const runtimeReady = useMotionBridge((s) => s.runtimeReady);

  const current = printers[tab];
  if (!current) return null;
  const active = hover ?? pinned;

  function selectTab(i: number) {
    setTab(i);
    setHover(null);
    setPinned(null);
  }

  return (
    <div ref={rootRef}>
      {/* Onglets : une machine à la fois, pour laisser au schéma toute la
          largeur — c'est lui qui porte l'information. Soulignement rouge =
          machine courante (le rouge est l'état courant, brief §1.2). */}
      <div
        role="tablist"
        aria-label={t("tabs")}
        className="flex flex-wrap gap-x-8 gap-y-1 border-b border-line"
      >
        {printers.map((p, i) => (
          <button
            key={p.variant}
            type="button"
            role="tab"
            id={`${baseId}-tab-${i}`}
            aria-selected={i === tab}
            aria-controls={`${baseId}-panel-${i}`}
            onClick={() => selectTab(i)}
            className={cx(
              "relative -mb-px flex items-baseline gap-2.5 pb-3 pt-2 text-left transition-colors duration-150 ease-strate",
              i === tab ? "text-ink" : "text-soft hover:text-ink",
            )}
          >
            <span className="font-semibold">{p.name}</span>
            <span className="hidden text-sm sm:inline">{p.sub}</span>
            <span
              aria-hidden="true"
              className={cx(
                "absolute inset-x-0 -bottom-px h-0.5 origin-left bg-accent transition-transform duration-280 ease-strate",
                i === tab ? "scale-x-100" : "scale-x-0",
              )}
            />
          </button>
        ))}
      </div>

      {printers.map((printer, index) => {
        const shown = index === tab;
        return (
          <div
            key={printer.variant}
            role="tabpanel"
            id={`${baseId}-panel-${index}`}
            aria-labelledby={`${baseId}-tab-${index}`}
            hidden={!shown}
            className="mt-8 overflow-hidden rounded-card border border-line bg-surface"
          >
            {/* En-tête : machine + atelier */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-4 sm:px-7">
              <h3 className="font-display text-subtitle font-bold text-ink">
                {printer.name}{" "}
                <span className="font-sans font-normal text-soft">
                  {printer.sub}
                </span>
              </h3>
              <p className="s3d-label inline-flex items-center gap-1.5 text-soft">
                <MapPin size={14} strokeWidth={1.5} aria-hidden="true" />
                {printer.place}
              </p>
            </div>

            <div className="grid gap-8 px-5 py-7 sm:px-7 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
              <div>
                {/* Le SVG ne porte aucun gestionnaire : les zones sensibles sont
                    les <button> ci-dessous, posés au pourcentage exact de chaque
                    ancrage. Un vrai bouton se focalise au clavier et s'annonce. */}
                <div className="relative">
                  <PrinterSchematic
                    variant={printer.variant}
                    title={`${printer.name} ${printer.sub}`}
                    callouts={printer.callouts}
                    active={shown ? active : null}
                  />
                  {getHotspots(printer.variant).map((h, i) => {
                    const c = printer.callouts[i];
                    if (!c) return null;
                    return (
                      <button
                        key={c.label}
                        type="button"
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover(i)}
                        onBlur={() => setHover(null)}
                        onClick={() => setPinned(pinned === i ? null : i)}
                        aria-pressed={pinned === i}
                        aria-label={c.label}
                        style={{ left: `${h.left}%`, top: `${h.top}%` }}
                        className="absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      />
                    );
                  })}
                </div>
                <p className="mt-3 text-center text-sm text-soft">
                  {legendHint}
                </p>
              </div>

              <div>
                <p className="text-base text-soft">{printer.blurb}</p>

                {/* Légende interactive : miroir des traits du schéma. */}
                <ul aria-label={t("legend")} className="mt-6 space-y-1">
                  {printer.callouts.map((c, i) => {
                    const on = shown && active === i;
                    return (
                      <li key={c.label}>
                        <button
                          type="button"
                          onMouseEnter={() => setHover(i)}
                          onMouseLeave={() => setHover(null)}
                          onFocus={() => setHover(i)}
                          onBlur={() => setHover(null)}
                          onClick={() => setPinned(pinned === i ? null : i)}
                          aria-pressed={pinned === i}
                          className={cx(
                            "flex w-full items-start gap-3 rounded-field px-3 py-2.5 text-left transition-colors duration-150 ease-strate",
                            on ? "bg-line/70" : "hover:bg-line/40",
                          )}
                        >
                          <span
                            className={cx(
                              "s3d-num mt-px grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.9375rem] font-semibold transition-colors duration-150",
                              on
                                ? "bg-accent text-on-accent"
                                : "text-soft ring-1 ring-swatch-ring",
                            )}
                          >
                            {i + 1}
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-ink">
                              {c.label}
                            </span>
                            <span className="mt-0.5 block text-sm text-soft">
                              {c.text}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {/* Fiche technique : <dl> à filets, unités réelles d'abord. */}
                <h4 className="s3d-label mb-2 mt-8 text-ink">{specsTitle}</h4>
                <SpecTable
                  rows={printer.specs.map((s) => ({
                    term: s.label,
                    value: s.value,
                  }))}
                />
              </div>
            </div>
          </div>
        );
      })}

      {runtimeReady ? (
        <SchematicDraw scope={rootRef} variant={current.variant} />
      ) : null}
    </div>
  );
}

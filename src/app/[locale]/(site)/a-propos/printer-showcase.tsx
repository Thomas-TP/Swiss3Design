"use client";

import { useId, useState } from "react";
import { MapPin } from "lucide-react";
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
  const [tab, setTab] = useState(0);
  // Survol : éphémère. Épinglé : verrouillé au clic / à la touche Entrée.
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const baseId = useId();

  const printer = printers[tab];
  if (!printer) return null;
  const active = hover ?? pinned;

  function selectTab(i: number) {
    setTab(i);
    setHover(null);
    setPinned(null);
  }

  return (
    <div>
      {/* Onglets : une machine à la fois, pour laisser au schéma toute la
          largeur — c'est lui qui porte l'information. */}
      <div
        role="tablist"
        aria-label={specsTitle}
        className="flex flex-wrap gap-2"
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
            className={`flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm transition-colors ${
              i === tab
                ? "border-accent bg-accent/10 text-ink"
                : "border-line bg-surface text-soft hover:border-soft/50 hover:text-ink"
            }`}
          >
            <span className="font-semibold">{p.name}</span>
            <span className="hidden text-xs text-soft sm:inline">{p.sub}</span>
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${tab}`}
        aria-labelledby={`${baseId}-tab-${tab}`}
        className="mt-6 overflow-hidden rounded-card border border-line bg-surface"
      >
        {/* En-tête : machine + atelier */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-4 sm:px-7">
          <p className="text-base font-semibold tracking-tight">
            {printer.name}{" "}
            <span className="font-normal text-soft">{printer.sub}</span>
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-soft">
            <MapPin size={13} strokeWidth={2} />
            {printer.place}
          </p>
        </div>

        <div className="grid gap-8 px-5 py-7 sm:px-7 lg:grid-cols-[1.35fr_1fr] lg:gap-10">
          <div>
            {/* Le SVG ne porte aucun gestionnaire : les zones sensibles sont
                les <button> ci-dessous, posés au pourcentage exact de chaque
                ancrage. Un vrai bouton se focalise au clavier et s'annonce. */}
            <div className="relative">
              <PrinterSchematic
                variant={printer.variant}
                title={`${printer.name} ${printer.sub}`}
                callouts={printer.callouts}
                active={active}
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
            <p className="mt-3 text-center text-xs text-soft">{legendHint}</p>
          </div>

          <div>
            <p className="text-[15px] leading-relaxed text-soft">
              {printer.blurb}
            </p>

            {/* Légende interactive : miroir des traits du schéma. */}
            <ul className="mt-6 space-y-1">
              {printer.callouts.map((c, i) => {
                const on = active === i;
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
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        on ? "bg-accent/[0.08]" : "hover:bg-paper"
                      }`}
                    >
                      <span
                        className={`mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                          on
                            ? "bg-accent text-white"
                            : "bg-paper text-soft ring-1 ring-line"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">
                          {c.label}
                        </span>
                        <span className="mt-0.5 block text-sm leading-snug text-soft">
                          {c.text}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Fiche technique */}
            <div className="mt-7 rounded-card border border-line bg-elevated p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-soft">
                {specsTitle}
              </p>
              <dl className="divide-y divide-line">
                {printer.specs.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-baseline justify-between gap-4 py-2.5"
                  >
                    <dt className="text-sm text-soft">{s.label}</dt>
                    <dd className="text-right text-sm font-medium tabular-nums">
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

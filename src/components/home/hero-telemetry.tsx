"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/cx";
import { MeasureStrip } from "@/components/ui/measure-strip";
import { Ruler } from "@/components/ui/ruler";
import {
  formatDuration,
  formatGrams,
  formatLayerIndex,
  formatMm,
} from "@/lib/studio/format";
import {
  HERO_EVENTS,
  type HeroChangeDetail,
  type HeroLayerDetail,
  type HeroScrubDetail,
} from "./contract";
import { useHomeConfig } from "./home-config-context";
import styles from "./home.module.css";

// Télémétrie du héros (brief « Strates », §5.5, motif M3) : la bande de mesure
// (calculée par computeStats sur le serveur, jamais décorative), la lecture de
// couche en direct, l'étiquette de changement de filament et la réglette Z du
// héros mobile. La chorégraphie parle à ces composants par des événements
// (contract.ts) : des nombres et des identifiants de filament, jamais de texte
// saisi. Tout est `ph-no-capture` : une télémétrie qui change à 10 Hz gonflerait
// les replays (§4.10).

function useWindowEvent<T>(name: string, handler: (detail: T) => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    const on = (event: Event) => latest.current((event as CustomEvent<T>).detail);
    window.addEventListener(name, on);
    return () => window.removeEventListener(name, on);
  }, [name]);
}

/** Dernière lecture de couche émise par la chorégraphie (≤ 10 Hz), ou null. */
function useHeroLayer(): HeroLayerDetail | null {
  const [detail, setDetail] = useState<HeroLayerDetail | null>(null);
  useWindowEvent<HeroLayerDetail>(HERO_EVENTS.layer, setDetail);
  return detail;
}

export function HeroTelemetry() {
  const locale = useLocale();
  const t = useTranslations("landing.hero");
  const tu = useTranslations("studioCore.units");
  const tb = useTranslations("studioCore.bands");
  const tf = useTranslations("studioCore.filaments");
  const { data, config, figures } = useHomeConfig();
  const detail = useHeroLayer();

  const filaments = new Set(config.bands.map((band) => band.filament)).size;
  const items = [
    formatMm(data.heightMm, locale),
    tu("layers", { count: data.layers }),
    tu("filaments", { count: filaments }),
    `≈ ${formatGrams(figures.grams, locale)}`,
    `≈ ${formatDuration(figures.minutes, locale)}`,
  ];

  const filamentOf = (band: number) =>
    config.bands[Math.min(band, config.bands.length - 1)].filament;
  const readout = (
    layer: number,
    total: number,
    z: number,
    filament: Parameters<typeof tf>[0],
  ) =>
    tb("layerReadout", {
      layer: formatLayerIndex(layer),
      total: formatLayerIndex(total),
      z: formatMm(z, locale),
      filament: tf(filament),
    });

  return (
    <div className="mt-4">
      <MeasureStrip items={items} live label={t("measures")} />
      <p
        aria-hidden="true"
        className={cx(
          "s3d-label ph-no-capture mt-1.5 normal-case text-soft",
          styles.readout,
        )}
      >
        {detail ? (
          readout(detail.layer, detail.total, detail.z, filamentOf(detail.band))
        ) : (
          // Avant la première lecture : l'état du poster montré (le dessin
          // avant l'impression, la matière en mouvement réduit).
          <>
            <span className="hidden motion-on:inline">
              {readout(0, data.layers, 0, filamentOf(0))}
            </span>
            <span className="inline motion-on:hidden">
              {readout(
                data.layers,
                data.layers,
                data.heightMm,
                filamentOf(config.bands.length - 1),
              )}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

/** « Changement de filament → Vert Lavaux · couche 0211 », 1,6 s (§5.5). */
export function HeroChange() {
  const tb = useTranslations("studioCore.bands");
  const tf = useTranslations("studioCore.filaments");
  const [change, setChange] = useState<HeroChangeDetail | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef(0);

  useWindowEvent<HeroChangeDetail>(HERO_EVENTS.change, (detail) => {
    setChange(detail);
    setVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), 1600);
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <p
      role="status"
      data-visible={visible}
      className={cx("s3d-label ph-no-capture normal-case", styles.change)}
    >
      {change
        ? tb("change", {
            filament: tf(change.filament as Parameters<typeof tf>[0]),
            layer: formatLayerIndex(change.layer),
          })
        : null}
    </p>
  );
}

/**
 * Réglette Z du héros mobile (C1) : un curseur natif de la couche 0 à la
 * dernière, Z vers le haut, au pouce. Il écrit la hauteur imprimée par un
 * événement ; pendant l'autoplay il suit la couche imprimée.
 */
export function HeroRuler() {
  const locale = useLocale();
  const t = useTranslations("landing.hero");
  const { data } = useHomeConfig();
  const detail = useHeroLayer();
  const [value, setValue] = useState(0);
  const dragging = useRef(false);

  useEffect(() => {
    if (detail && !dragging.current) setValue(detail.layer);
  }, [detail]);

  const scrub = (layer: number) => {
    setValue(layer);
    window.dispatchEvent(
      new CustomEvent<HeroScrubDetail>(HERO_EVENTS.scrub, {
        detail: { progress: layer / data.layers },
      }),
    );
  };

  return (
    <div className={cx(styles.ruler, styles.rulerOn)}>
      <Ruler
        orientation="vertical"
        to={data.heightMm}
        minor={1}
        major={10}
        labelEvery={50}
      />
      <input
        type="range"
        min={0}
        max={data.layers}
        step={1}
        value={value}
        className={styles.rulerInput}
        aria-label={t("ruler")}
        aria-valuetext={t("rulerValue", {
          layer: formatLayerIndex(value),
          total: formatLayerIndex(data.layers),
          height: formatMm((value / data.layers) * data.heightMm, locale),
        })}
        onPointerDown={() => (dragging.current = true)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onChange={(event) => scrub(Number(event.currentTarget.value))}
      />
    </div>
  );
}

"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { filamentHex } from "@/lib/studio/filaments";
import {
  formatDuration,
  formatGrams,
  formatInteger,
  formatMm,
  formatNumber,
} from "@/lib/studio/format";
import { HOME_VIEW_ATTR } from "./contract";
import { studioHref } from "./hero-data";
import { useHomeConfig } from "./home-config-context";
import type { PrintHeroProps } from "./stage-props";
import { useHomeMotion, useHomeView } from "./use-home-motion";
import { useStaticPoster } from "./use-static-poster";
import styles from "./home.module.css";

// Corps du chapitre 01 « Une couleur par altitude. » (brief « Strates », §7.5) :
// le même vase, éclaté (`print-hero` en mode « exploded »), et une étiquette par
// bande, calculée par `bandStats` sur le serveur (jamais écrite à la main), qui
// suit la palette et le motif choisis dans le héros (contexte HomeConfig).
//
// La liste des bandes va du sommet au plateau, comme la figure : couleur,
// couches, altitudes, masse. Puis la ligne de purge, honnête : ce que la
// couleur coûte vraiment. Sans 3D, le poster « éclaté » (SVG) tient lieu de
// figure ; il est recalculé côté client quand le visiteur règle le héros.

export function MapBody({ explodedPoster }: { explodedPoster: ReactNode }) {
  const locale = useLocale();
  const t = useTranslations("landing.map");
  const tb = useTranslations("studioCore.bands");
  const tf = useTranslations("studioCore.filaments");
  const tu = useTranslations("studioCore.units");
  const { data, palette, pattern, config, figures } = useHomeConfig();
  const { reduced, capability, staticPoster } = useHomeMotion();
  const ref = useRef<HTMLDivElement>(null);

  const props = useMemo<PrintHeroProps>(
    () => ({
      mode: "exploded",
      palette,
      pattern,
      config,
      patterns: data.patterns,
      bands3: data.palettes.leman,
    }),
    [data, palette, pattern, config],
  );
  useHomeView(ref, "print-hero", props, {
    enabled: !reduced && capability !== null && capability >= 1,
    bakeWhenIdle: capability === 1,
    priority: 1,
  });
  const { poster: custom, engine } = useStaticPoster("exploded", staticPoster);

  // Du sommet au plateau.
  const bands = [...figures.bands].reverse();

  return (
    <div className="s3d-page s3d-grid relative z-[1] mt-12 items-center gap-y-10 lg:mt-16">
      <div className="col-span-full lg:col-span-5">
        <ol aria-label={t("bands")} className="flex flex-col gap-4 sm:gap-5">
          {bands.map((band) => (
            <li
              key={`${band.filament}-${band.fromLayer}`}
              className={cx("s3d-rise ph-no-capture pl-4", styles.bandItem)}
              style={{ "--band": filamentHex(band.filament) } as CSSProperties}
            >
              <p className={cx("s3d-label normal-case text-ink", styles.halo)}>
                {tb("label", {
                  filament: tf(band.filament),
                  from: formatInteger(band.fromLayer, locale),
                  to: formatInteger(band.toLayer, locale),
                  fromMm: formatNumber(band.fromMm, locale, 1),
                  toMm: formatMm(band.toMm, locale),
                  grams: formatGrams(band.grams, locale),
                })}
              </p>
            </li>
          ))}
        </ol>
        <p
          className={cx(
            "s3d-rise s3d-label ph-no-capture mt-8 max-w-[52ch] normal-case text-soft",
            styles.halo,
          )}
        >
          {figures.changes > 0
            ? t("purgeLine", {
                purge: tb("purge", {
                  changes: tu("changes", { count: figures.changes }),
                  grams: formatGrams(figures.purgeGrams, locale),
                  duration: formatDuration(figures.extraMinutes, locale),
                }),
              })
            : tb("single")}
        </p>
        <ButtonLink href={studioHref(config)} variant="text" className="mt-6">
          {t("cta")}
        </ButtonLink>
      </div>
      <figure className="col-span-full lg:col-span-6 lg:col-start-7">
        <div
          ref={ref}
          data-stage-view="print-hero"
          {...{ [HOME_VIEW_ATTR]: "map" }}
          className={styles.mapFigure}
        >
          <div className="s3d-poster absolute inset-0" aria-hidden="true">
            {custom ?? explodedPoster}
          </div>
        </div>
        <figcaption className="s3d-label mt-3 normal-case text-soft">
          {t("figure")}
        </figcaption>
        {engine}
      </figure>
    </div>
  );
}

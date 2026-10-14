"use client";

import { memo, useDeferredValue, useId, useMemo } from "react";
import { useIsDark } from "@/lib/theme";
import { lavauxElevation, type ElevationData } from "@/lib/studio/poster";
import {
  borneTopView,
  cartoucheTopView,
  type TopViewData,
} from "@/lib/studio/poster-flat";
import { montagneElevation } from "@/lib/studio/poster-montagne";
import type { StudioConfig, StudioTexts } from "@/lib/studio/types";
import type { StudioLocale } from "./scene-props";

// Vue 2D exacte du Studio (brief « Strates », §6.7 : « Élévation (SVG 2D exact,
// seule vue en C0) » et §6.12 : « poster Élévation SSR »). Le vase et la montagne
// montrent leur silhouette latérale au dixième de millimètre, les objets plats
// leur plan : ce
// sont des données calculées par le code (poster.ts, poster-flat.ts), jamais une
// image. Rendu en JSX (pas de HTML injecté), identique côté serveur et côté
// client : c'est le poster du Stage avant le premier rendu WebGL, et l'unique vue
// sans WebGL (capacité C0).
//
// Les lignes de texte des objets plats sont tracées par des barres aux dimensions
// exactes du texte (le Worker seul embarque les contours des glyphes, règle d'or
// 10) ; le texte saisi n'apparaît donc jamais dans ce dessin.

function ElevationSvg({ data, id }: { data: ElevationData; id: string }) {
  const [x, y, w, h] = data.viewBox;
  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      className="block h-full w-full text-ink"
    >
      <defs>
        <clipPath id={`${id}-sil`}>
          <path d={data.outline} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-sil)`}>
        {data.bands.map((band, index) => (
          <rect
            key={index}
            x={x}
            y={band.y}
            width={w}
            height={band.height}
            fill={band.hex}
          />
        ))}
        {data.courses && data.courses.length > 0 ? (
          // Une ligne de couche toutes les 10 couches : le filet des strates.
          <path
            d={data.courses.map((cy) => `M${x} ${cy}H${x + w}`).join("")}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </g>
      <path
        d={data.outline}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.5}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M${x} ${data.baseY}H${x + w}`}
        stroke="currentColor"
        strokeWidth={0.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function TopViewSvg({ data }: { data: TopViewData }) {
  const [x, y, w, h] = data.viewBox;
  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      className="block h-full w-full"
    >
      {data.layers.map((layer, index) => (
        <path
          key={index}
          d={layer.d}
          fill={layer.fill}
          fillOpacity={layer.opacity < 1 ? layer.opacity : undefined}
          fillRule="evenodd"
          stroke={layer.stroke === "none" ? "none" : layer.stroke}
          strokeWidth={layer.stroke === "none" ? undefined : 1}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/** Données de la vue 2D d'une configuration (exportées pour les vignettes). */
export function flatViewData(
  config: StudioConfig,
  texts: StudioTexts,
  locale: StudioLocale,
  theme: "light" | "dark",
):
  | { kind: "elevation"; data: ElevationData }
  | { kind: "top"; data: TopViewData } {
  switch (config.object) {
    case "lavaux":
      return { kind: "elevation", data: lavauxElevation(config) };
    case "cartouche":
      return {
        kind: "top",
        data: cartoucheTopView(config, texts, { theme }),
      };
    case "borne":
      return { kind: "top", data: borneTopView(config, texts, { theme }) };
    case "montagne":
      return { kind: "elevation", data: montagneElevation(config) };
  }
}

export function ElevationView({
  config,
  texts,
  locale,
  className,
}: {
  config: StudioConfig;
  texts: StudioTexts;
  locale: StudioLocale;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const dark = useIsDark();
  const view = useMemo(
    () => flatViewData(config, texts, locale, dark ? "dark" : "light"),
    [config, texts, locale, dark],
  );
  return (
    <div className={className}>
      {view.kind === "elevation" ? (
        <ElevationSvg data={view.data} id={id} />
      ) : (
        <TopViewSvg data={view.data} />
      )}
    </div>
  );
}

/**
 * Le poster du Stage, qui suit la configuration avec un temps de retard. Une fois
 * la scène 3D prête, ce dessin est recouvert : le recalculer à chaque cran d'un
 * curseur (la silhouette du vase, le relief de la carte, jusqu'à quelques
 * dizaines de millisecondes sur un mobile) volait du temps au glissé pour un
 * dessin que personne ne voit. `useDeferredValue` le recalcule dans un rendu de
 * faible priorité, interrompu par le cran suivant : il rattrape dès que la main
 * se pose. Sans WebGL (C0) il est la vue : même dessin, une image plus tard.
 */
export const DeferredElevation = memo(function DeferredElevation({
  config,
  texts,
  locale,
  className,
}: {
  config: StudioConfig;
  texts: StudioTexts;
  locale: StudioLocale;
  className?: string;
}) {
  const lateConfig = useDeferredValue(config);
  const lateTexts = useDeferredValue(texts);
  return (
    <ElevationView
      config={lateConfig}
      texts={lateTexts}
      locale={locale}
      className={className}
    />
  );
});

"use client";

import {
  ChevronLeft,
  ChevronRight,
  Home,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { StageView } from "@/components/ui/stage-view";
import { filamentHex } from "@/lib/studio/filaments";
import type { BandSummary } from "@/lib/studio/band-stats";
import {
  formatClock,
  formatLayerIndex,
  formatMm,
  simulatedSeconds,
  formatDuration,
  formatGrams,
} from "@/lib/studio/format";
import type {
  StudioConfig,
  StudioObjectId,
  StudioStats,
  StudioTexts,
} from "@/lib/studio/types";
import { ElevationView } from "./elevation-view";
import { layerTop, spreadVertically } from "./layers";
import { LayerSlider, SimulationControls } from "./layer-panel";
import {
  defaultView,
  flatViewOf,
  viewsFor,
  type StudioViewMode,
} from "./objects";
import {
  sendViewCommand,
  type StudioBandAnchor,
  type StudioLocale,
  type StudioSceneProps,
  type StudioSceneStatus,
  type StudioSimulation,
  type StudioViewCommand,
} from "./scene-props";
import { mm, num, type Translate } from "./summary";
import { useStageAvailability } from "./use-stage-availability";
import { ViewSwitch } from "./view-switch";

// Colonne de la scène (brief « Strates », §6.7) : la vue (3/4, Plan, Élévation,
// Couches), « Éclater », les boutons de l'orbite, la réglette Z et la
// simulation, les étiquettes de l'éclaté, et les états (préparation, erreur du
// Worker avec « Réessayer », 3D indisponible). L'état de la scène (vue, éclaté,
// couche, simulation) est ici : le reste du Studio n'en dépend pas.
//
// Le dessin 2D exact (ElevationView) est le POSTER de la vue : le serveur le
// rend, c'est lui qu'on voit sans JavaScript, sans WebGL ou avant le premier
// rendu 3D. En vue « Élévation », il recouvre la 3D (la scène ne dessine plus).
// Le canvas est décoratif pour les lecteurs d'écran : le résumé vivant du
// Studio dit la même chose.

export function ScenePanel({
  object,
  config,
  texts,
  locale,
  stats,
  bands,
  reprint,
  bandBar,
  compact = false,
  className,
  t,
  core,
}: {
  object: StudioObjectId;
  config: StudioConfig;
  /** Textes AFFICHÉS (saisis, ou exemples tant que rien n'est saisi). */
  texts: StudioTexts;
  locale: StudioLocale;
  stats: StudioStats;
  bands: BandSummary;
  reprint: number;
  /** Barre altimétrique verticale (bureau), posée au bord droit de la vue. */
  bandBar?: ReactNode;
  /**
   * Mobile : l'aperçu est réduit en bandeau, l'objet seul reste (les vues, les
   * boutons de l'orbite et la simulation reviennent avec l'aperçu entier).
   */
  compact?: boolean;
  className?: string;
  t: Translate;
  core: Translate;
}) {
  const shell = useTranslations("shell.stage");
  const availability = useStageAvailability();
  const stageOn = availability === "on";
  const views = stageOn ? viewsFor(object) : [flatViewOf(object)];

  const [view, setView] = useState<StudioViewMode | null>(null);
  const [exploded, setExploded] = useState(false);
  const [layer, setLayer] = useState<number | null>(null);
  const [simulate, setSimulate] = useState<StudioSceneProps["simulate"]>(null);
  const [anchors, setAnchors] = useState<StudioBandAnchor[]>([]);
  const [status, setStatus] = useState<StudioSceneStatus | null>(null);

  // La vue du bureau est collante : son rectangle change sans que la mise en
  // page bouge (liveRect). Sur mobile elle suit la page, rien à relire. Décidé
  // une fois au montage : ne touche pas au HTML, donc pas d'écart d'hydratation.
  const [liveRect] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches,
  );

  const current: StudioViewMode =
    stageOn && view && views.includes(view)
      ? view
      : defaultView(object, availability !== "off");
  const effective: StudioViewMode = stageOn
    ? current
    : availability === "off"
      ? flatViewOf(object)
      : current;

  const total = stats.layers;
  const layerNow = layer === null ? total : Math.min(layer, total);
  const layersView = effective === "layers";
  const cutZ =
    layersView && layerNow < total ? layerTop(layerNow, stats.heightMm) : null;
  const elevationShown = stageOn && effective === "elevation";

  const onStatus = useCallback(
    (next: StudioSceneStatus) => setStatus(next),
    [setStatus],
  );
  const onAnchors = useCallback(
    (next: StudioBandAnchor[]) => setAnchors(next),
    [setAnchors],
  );
  const onSimulate = useCallback(
    (state: StudioSimulation) => {
      setLayer(state.done ? null : state.layer);
      if (state.done) setSimulate(null);
    },
    [setLayer, setSimulate],
  );

  const sceneProps = useMemo<StudioSceneProps>(
    () => ({
      config,
      texts,
      locale,
      view: effective === "plan" ? "plan" : "orbit",
      cutZ,
      exploded: stageOn && exploded && effective !== "elevation",
      simulate,
      reprint,
      printMinutes: stats.minutes,
      hidden: elevationShown,
      onStatus,
      onSimulate,
      onAnchors,
    }),
    [
      config,
      texts,
      locale,
      effective,
      cutZ,
      exploded,
      stageOn,
      simulate,
      reprint,
      stats.minutes,
      elevationShown,
      onStatus,
      onSimulate,
      onAnchors,
    ],
  );

  const poster = (
    <ElevationView
      config={config}
      texts={texts}
      locale={locale}
      className="absolute inset-0 p-6 sm:p-8"
    />
  );

  const command =
    (cmd: StudioViewCommand) => (event: MouseEvent<HTMLButtonElement>) =>
      sendViewCommand(event.currentTarget, cmd);

  const filamentName = (id: string) => core(`filaments.${id}`);
  const bandNow =
    bands.bands.find((b) => layerNow >= b.fromLayer && layerNow <= b.toLayer) ??
    bands.bands[bands.bands.length - 1];
  const readout = core("bands.layerReadout", {
    layer: formatLayerIndex(layerNow),
    total: formatLayerIndex(total),
    z: formatMm(Math.min(layerNow * 0.2, stats.heightMm), locale, 1),
    filament: filamentName(bandNow.filament),
  });
  const real = formatDuration(stats.minutes, locale);
  const durationText = simulate
    ? core("duration.simulated", {
        duration: real,
        speed: simulate.speed,
        simulated: formatClock(
          simulatedSeconds(stats.minutes, simulate.speed),
          locale,
        ),
      })
    : core("duration.real", { duration: real });

  // 36 px sur mobile (six boutons tiennent sous l'objet), 44 px sur bureau.
  const buttonClass =
    "grid size-9 place-items-center rounded-field border border-ink bg-paper/85 text-ink transition-colors duration-150 ease-strate hover:bg-ink hover:text-paper lg:size-11";
  // Réduit en bandeau (mobile) : seul l'objet reste sur la vue.
  const hideWhenCompact = compact ? "max-lg:hidden" : undefined;

  return (
    <div className={cx("relative", className)}>
      <StageView
        scene="studio-object"
        props={sceneProps}
        clear="transparent"
        interactive={stageOn && !elevationShown}
        liveRect={liveRect}
        poster={poster}
        className="h-full w-full select-none focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ink"
      >
        {elevationShown ? (
          <ElevationView
            config={config}
            texts={texts}
            locale={locale}
            className="absolute inset-0 bg-paper p-6 sm:p-8"
          />
        ) : null}

        {/* Vues et éclaté, en surimpression en haut à gauche. */}
        {views.length > 1 || stageOn ? (
          <div
            data-no-orbit=""
            className={cx(
              "absolute left-3 top-3 z-10 sm:left-4 sm:top-4",
              hideWhenCompact,
            )}
          >
            <ViewSwitch
              legend={t("scene.viewsLegend")}
              views={views}
              value={effective}
              onChange={(next) => {
                setView(next);
                if (next !== "layers") setSimulate(null);
              }}
              labelOf={(v) => t(`scene.view.${v}`)}
              exploded={exploded}
              onExplode={() => setExploded((value) => !value)}
              explodeLabel={t("scene.explode")}
              showExplode={stageOn && !elevationShown}
            />
          </div>
        ) : null}

        {/* Étiquettes de l'éclaté : une colonne à gauche de la barre altimétrique,
            chacune à la hauteur de sa bande (écartées si elles se chevauchent),
            avec la pastille de sa teinte. */}
        {sceneProps.exploded && !elevationShown && anchors.length > 0 ? (
          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-y-0 right-3 z-10 w-[min(15rem,52%)] lg:right-[4.75rem]",
              hideWhenCompact,
            )}
          >
            {spreadVertically(
              anchors.map((anchor) => anchor.y),
              52,
              28,
              Number.POSITIVE_INFINITY,
            ).map((top, index) => {
              const band = bands.bands[index];
              if (!band) return null;
              return (
                <p
                  key={index}
                  className="s3d-label ph-no-capture absolute right-0 flex max-w-full -translate-y-1/2 items-start gap-2 rounded-hair bg-paper/85 px-2 py-1 normal-case text-ink"
                  style={{ top }}
                >
                  <span
                    className="mt-0.5 size-2.5 shrink-0 rounded-full border border-swatch-ring"
                    style={{ backgroundColor: filamentHex(band.filament) }}
                  />
                  <span>
                    {core("bands.label", {
                      filament: filamentName(band.filament),
                      from: band.fromLayer,
                      to: band.toLayer,
                      fromMm: num(band.fromMm, locale),
                      toMm: mm(band.toMm, locale),
                      grams: formatGrams(band.grams, locale),
                    })}
                  </span>
                </p>
              );
            })}
          </div>
        ) : null}

        {/* Réglette Z de la vue « Couches », au bord gauche. */}
        {stageOn && layersView ? (
          <div
            className={cx(
              "absolute inset-y-16 left-3 z-10 w-11 sm:left-4",
              hideWhenCompact,
            )}
          >
            <LayerSlider
              layer={layerNow}
              total={total}
              readout={readout}
              label={t("layers.slider")}
              onChange={(value) => {
                setSimulate(null);
                setLayer(value >= total ? null : value);
              }}
              onCommit={() => undefined}
            />
          </div>
        ) : null}

        {/* Bas de la vue : boutons de l'orbite à gauche, simulation. */}
        {stageOn && !elevationShown ? (
          <div
            data-no-orbit=""
            className={cx(
              "absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-end justify-between gap-2 sm:inset-x-4 sm:bottom-4",
              // La barre altimétrique occupe le bord droit (bureau) : la simulation s'arrête avant elle.
              bandBar ? "lg:pr-[5.75rem]" : null,
              hideWhenCompact,
            )}
          >
            <div className="flex flex-wrap gap-1.5">
              {effective !== "plan" ? (
                <>
                  <button
                    type="button"
                    onClick={command({ type: "turn", step: -1 })}
                    aria-label={shell("rotateLeft")}
                    className={buttonClass}
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={command({ type: "turn", step: 1 })}
                    aria-label={shell("rotateRight")}
                    className={buttonClass}
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={command({ type: "front" })}
                    aria-label={shell("front")}
                    className={buttonClass}
                  >
                    <Home size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={command({ type: "reset" })}
                    aria-label={shell("reset")}
                    className={buttonClass}
                  >
                    <RotateCcw size={18} aria-hidden="true" />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={command({ type: "zoom", step: 1 })}
                aria-label={shell("zoomIn")}
                className={buttonClass}
              >
                <ZoomIn size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={command({ type: "zoom", step: -1 })}
                aria-label={shell("zoomOut")}
                className={buttonClass}
              >
                <ZoomOut size={18} aria-hidden="true" />
              </button>
            </div>
            {layersView ? (
              <SimulationControls
                active={simulate !== null}
                speed={simulate?.speed ?? null}
                disabled={false}
                onStart={(speed) => {
                  setLayer(0);
                  setSimulate({ speed, startedAt: performance.now() });
                }}
                onStop={() => setSimulate(null)}
                startLabel={t("layers.simulate")}
                stopLabel={t("layers.stop")}
                legend={t("layers.simulate")}
                speedLabel={(speed) => t("layers.speed", { speed })}
                durationText={durationText}
              />
            ) : null}
          </div>
        ) : null}

        {/* Barre altimétrique verticale (bureau) : au bord droit, sur toute la hauteur utile. */}
        {bandBar ? (
          <div
            data-no-orbit=""
            className="absolute inset-y-16 right-3 z-10 max-lg:hidden sm:right-4"
          >
            {bandBar}
          </div>
        ) : null}

        {/* États de la scène. */}
        {availability === "pending" ||
        (stageOn && status?.state === "building" && !status.triangles) ? (
          <p
            aria-hidden="true"
            className="s3d-label ph-no-capture absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-hair bg-paper/85 px-3 py-1.5 normal-case text-soft"
          >
            {t("scene.preparing")}
          </p>
        ) : null}
        {stageOn && status?.state === "error" ? (
          <div
            data-no-orbit=""
            role="alert"
            className="absolute left-1/2 top-1/2 z-10 flex w-[min(20rem,90%)] -translate-x-1/2 -translate-y-1/2 flex-col items-start gap-3 rounded-card border border-line bg-elevated p-4"
          >
            <p className="text-sm text-ink">{t("scene.error")}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={(event) =>
                sendViewCommand(event.currentTarget, { type: "retry" })
              }
            >
              {t("scene.retry")}
            </Button>
          </div>
        ) : null}
      </StageView>
      {availability === "off" ? (
        // Bureau : sous la vue. Mobile : sur le bas de la vue (la hauteur est comptée).
        <p
          className={cx(
            "max-w-[60ch] text-sm text-soft lg:mt-3",
            "max-lg:absolute max-lg:inset-x-3 max-lg:bottom-2 max-lg:rounded-hair max-lg:bg-paper/85 max-lg:px-2 max-lg:py-1 max-lg:text-xs",
            hideWhenCompact,
          )}
        >
          {shell("unavailable")}
        </p>
      ) : null}
    </div>
  );
}

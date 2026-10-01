"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Field, fieldClass, fieldIds } from "@/components/ui/field";
import { SpecTable } from "@/components/ui/spec-table";
import { canonicalJson } from "@/lib/studio/kernel/hash";
import {
  HERO_PALETTE_KEYS,
  HERO_PALETTES,
  PRESETS,
  bandsForPalette,
  type HeroPaletteKey,
} from "@/lib/studio/presets";
import {
  addBand,
  canAddBand,
  canRemoveBand,
  moveBoundary,
  removeBand,
  setBandFilament,
} from "@/lib/studio/bands";
import { FILAMENTS_INDICATIVE } from "@/lib/studio/filaments";
import {
  formatChfRange,
  formatDuration,
  formatGrams,
  formatNumber,
} from "@/lib/studio/format";
import {
  BORNE_RANGES,
  CARTOUCHE_RANGES,
  LAVAUX_PROFILES,
  LAVAUX_RANGES,
  LAVAUX_WALLS,
  RELIEF_RANGES,
  cartoucheDepthMax,
  gradinsDepthMax,
  vaguesWavelengthMin,
} from "@/lib/studio/ranges";
import { boundaryLayer } from "@/lib/studio/stats";
import { TEXT_LIMITS, type TextField } from "@/lib/studio/text/fields";
import { codePoints } from "@/lib/studio/text/layout";
import type {
  BorneConfig,
  CartoucheConfig,
  FilamentId,
  LavauxConfig,
  LavauxPattern,
  Printability,
  ReliefConfig,
  StudioConfig,
  StudioObjectId,
  StudioStats,
  StudioTexts,
} from "@/lib/studio/types";
import type { BandSummary } from "@/lib/studio/band-stats";
import {
  addReliefBand,
  canAddReliefBand,
  canRemoveReliefBand,
  moveReliefBoundary,
  reliefStep,
  removeReliefBand,
} from "./band-ops";
import { BandBar, BandList } from "./band-editor";
import { ParamSlider } from "./param-slider";
import { RadioGroup } from "./pattern-radio";
import { PrintableBadge } from "./printable-badge";
import { ProfileIcon } from "./profile-icon";
import { SwatchRadio } from "./swatch-radio";
import { mm, num, type Translate } from "./summary";

// Les contrôles du Studio, une section par regroupement du brief « Strates »
// (§6.2 et §6.7) : 01 Forme, 02 Motif (vase), Couleurs, Texte (objets à texte),
// Fiche. Tous les contrôles sont NATIFS et étiquetés ; chaque section est un
// `fieldset` ou un bloc légendé. Les clés courtes (`h`, `gs`, `m`, `bd`…) sont
// celles de l'URL (url-state.ts) : elles nomment les champs du formulaire GET
// qui fonctionne sans JavaScript.
//
// Les composants reçoivent un objet `Ctl` : l'état présent, les statistiques et
// deux fonctions, `change` (met à jour, éventuellement en terminant le geste et
// en rejouant la « réimpression ») et `commit` (termine le geste en cours).

export interface Ctl {
  object: StudioObjectId;
  config: StudioConfig;
  /** Textes SAISIS par le visiteur (vides tant qu'il n'a rien écrit). */
  texts: StudioTexts;
  /** Textes d'exemple de la langue : placeholders des champs, et aperçu tant que rien n'est saisi. */
  examples: StudioTexts;
  stats: StudioStats;
  bands: BandSummary;
  locale: string;
  t: Translate;
  core: Translate;
  /** Préfixe d'identifiants uniques (useId) pour les `htmlFor`. */
  uid: string;
  change: (
    next: StudioConfig,
    control: string,
    options?: { commit?: boolean; reprint?: boolean },
  ) => void;
  commit: () => void;
  setText: (field: TextField, value: string) => void;
  /** Tire une nouvelle graine (« Surprenez-moi » du voronoï et du massif). */
  newSeed: () => number;
}

const filamentName = (ctl: Ctl) => (id: FilamentId) =>
  ctl.core(`filaments.${id}`);

// ── Vase « Lavaux » ─────────────────────────────────────────────────────────

function defaultPattern(
  kind: LavauxPattern["kind"],
  wall: number,
): LavauxPattern {
  const R = LAVAUX_RANGES;
  switch (kind) {
    case "lisse":
      return { kind };
    case "gradins":
      return {
        kind,
        step: R.gradins.step.default,
        depth: Math.min(
          R.gradins.depth.default,
          gradinsDepthMax(R.gradins.step.default, wall),
        ),
      };
    case "vagues":
      return {
        kind,
        wavelength: R.vagues.wavelength.default,
        amplitude: R.vagues.amplitude.default,
        lobes: R.vagues.lobes.default,
      };
    case "voronoi":
      return {
        kind,
        cells: R.voronoi.cells.default,
        relief: R.voronoi.relief.default,
        seed: R.voronoi.seed.default,
      };
    case "nervures":
      return {
        kind,
        count: R.nervures.count.default,
        depth: R.nervures.depth.default,
        twistDeg: R.nervures.twistDeg.default,
      };
  }
}

export function LavauxShape({
  ctl,
  config,
}: {
  ctl: Ctl;
  config: LavauxConfig;
}) {
  const { t, locale, uid, change, commit } = ctl;
  const R = LAVAUX_RANGES;
  const set = (
    patch: Partial<LavauxConfig>,
    control: string,
    reprint = false,
  ) => change({ ...config, ...patch }, control, { reprint });
  const layers = ctl.stats.layers;
  return (
    <div className="flex flex-col gap-6">
      <ParamSlider
        id={`${uid}-h`}
        name="h"
        label={t("ctl.lavaux.h")}
        value={config.h}
        range={R.h}
        unit="mm"
        valueText={(v) =>
          t("value.height", {
            mm: num(v, locale),
            layers: Math.ceil(v / 0.2 - 1e-6),
          })
        }
        onChange={(v) => set({ h: v }, "h")}
        onCommit={commit}
      />
      <ParamSlider
        id={`${uid}-d`}
        name="d"
        label={t("ctl.lavaux.d")}
        value={config.d}
        range={R.d}
        unit="mm"
        valueText={(v) => t("value.mm", { value: num(v, locale) })}
        onChange={(v) => set({ d: v }, "d")}
        onCommit={commit}
      />
      <RadioGroup
        legend={t("ctl.lavaux.profile")}
        name="p"
        value={config.profile}
        options={LAVAUX_PROFILES.map((profile) => ({
          value: profile,
          label: ctl.core(`profiles.${profile}`),
          icon: <ProfileIcon profile={profile} />,
        }))}
        onChange={(profile) => {
          change({ ...config, profile }, "p", { commit: true, reprint: true });
        }}
      />
      <ParamSlider
        id={`${uid}-b`}
        name="b"
        label={t("ctl.lavaux.belly")}
        value={config.belly}
        range={R.belly}
        valueText={(v) => formatNumber(v, locale, 2)}
        onChange={(v) => set({ belly: v }, "b")}
        onCommit={commit}
      />
      <ParamSlider
        id={`${uid}-n`}
        name="n"
        label={t("ctl.lavaux.neck")}
        hint={t("ctl.lavaux.neckHint")}
        value={config.neck}
        range={R.neck}
        valueText={(v) => formatNumber(v, locale, 2)}
        onChange={(v) => set({ neck: v }, "n")}
        onCommit={commit}
      />
      <ParamSlider
        id={`${uid}-l`}
        name="l"
        label={t("ctl.lavaux.lip")}
        value={config.lip}
        range={R.lip}
        valueText={(v) => formatNumber(v, locale, 2)}
        onChange={(v) => set({ lip: v }, "l")}
        onCommit={commit}
      />
      <RadioGroup
        legend={t("ctl.lavaux.wall")}
        name="w"
        value={config.wall}
        options={LAVAUX_WALLS.map((wall) => ({
          value: wall,
          label: mm(wall, locale),
        }))}
        onChange={(wall) => change({ ...config, wall }, "w", { commit: true })}
      />
      <p className="sr-only">
        {t("value.layersTotal", {
          layers: ctl.core("units.layers", { count: layers }),
        })}
      </p>
    </div>
  );
}

export function LavauxPatternSection({
  ctl,
  config,
}: {
  ctl: Ctl;
  config: LavauxConfig;
}) {
  const { t, locale, uid, change, commit } = ctl;
  const R = LAVAUX_RANGES;
  const p = config.pattern;
  const setPattern = (
    pattern: LavauxPattern,
    control: string,
    commitNow = false,
  ) => change({ ...config, pattern }, control, { commit: commitNow });
  return (
    <div className="flex flex-col gap-6">
      <RadioGroup
        legend={t("ctl.lavaux.pattern")}
        name="m"
        value={p.kind}
        options={R_KINDS.map((kind) => ({
          value: kind,
          label: ctl.core(`patterns.${kind}`),
        }))}
        onChange={(kind) =>
          change(
            { ...config, pattern: defaultPattern(kind, config.wall) },
            "m",
            { commit: true, reprint: true },
          )
        }
      />
      {p.kind === "gradins" ? (
        <>
          <ParamSlider
            id={`${uid}-gs`}
            name="gs"
            label={t("ctl.gradins.step")}
            value={p.step}
            range={R.gradins.step}
            unit="mm"
            valueText={(v) => t("value.mm", { value: num(v, locale) })}
            onChange={(v) => setPattern({ ...p, step: v }, "gs")}
            onCommit={commit}
          />
          <ParamSlider
            id={`${uid}-gd`}
            name="gd"
            label={t("ctl.gradins.depth")}
            hint={t("ctl.gradins.hint")}
            value={p.depth}
            range={{
              min: R.gradins.depth.min,
              max: gradinsDepthMax(p.step, config.wall),
              step: R.gradins.depth.step,
            }}
            unit="mm"
            valueText={(v) => t("value.mm", { value: num(v, locale) })}
            onChange={(v) => setPattern({ ...p, depth: v }, "gd")}
            onCommit={commit}
          />
        </>
      ) : null}
      {p.kind === "vagues" ? (
        <>
          <ParamSlider
            id={`${uid}-wl`}
            name="wl"
            label={t("ctl.vagues.wavelength")}
            hint={t("ctl.vagues.hint")}
            value={p.wavelength}
            range={{
              min: Math.max(
                R.vagues.wavelength.min,
                vaguesWavelengthMin(p.amplitude),
              ),
              max: R.vagues.wavelength.max,
              step: R.vagues.wavelength.step,
            }}
            unit="mm"
            valueText={(v) => t("value.mm", { value: num(v, locale) })}
            onChange={(v) => setPattern({ ...p, wavelength: v }, "wl")}
            onCommit={commit}
          />
          <ParamSlider
            id={`${uid}-wa`}
            name="wa"
            label={t("ctl.vagues.amplitude")}
            value={p.amplitude}
            range={R.vagues.amplitude}
            unit="mm"
            valueText={(v) => t("value.mm", { value: num(v, locale) })}
            onChange={(v) => setPattern({ ...p, amplitude: v }, "wa")}
            onCommit={commit}
          />
          <ParamSlider
            id={`${uid}-wk`}
            name="wk"
            label={t("ctl.vagues.lobes")}
            value={p.lobes}
            range={R.vagues.lobes}
            valueText={(v) => t("value.count", { count: v })}
            onChange={(v) => setPattern({ ...p, lobes: v }, "wk")}
            onCommit={commit}
          />
        </>
      ) : null}
      {p.kind === "voronoi" ? (
        <>
          <ParamSlider
            id={`${uid}-vc`}
            name="vc"
            label={t("ctl.voronoi.cells")}
            value={p.cells}
            range={R.voronoi.cells}
            valueText={(v) => t("value.count", { count: v })}
            onChange={(v) => setPattern({ ...p, cells: v }, "vc")}
            onCommit={commit}
          />
          <ParamSlider
            id={`${uid}-va`}
            name="va"
            label={t("ctl.voronoi.relief")}
            value={p.relief}
            range={R.voronoi.relief}
            unit="mm"
            valueText={(v) => t("value.mm", { value: num(v, locale) })}
            onChange={(v) => setPattern({ ...p, relief: v }, "va")}
            onCommit={commit}
          />
          <div className="flex flex-col gap-3">
            <ParamSlider
              id={`${uid}-vs`}
              name="vs"
              label={t("ctl.voronoi.seed")}
              value={p.seed}
              range={R.voronoi.seed}
              valueText={(v) => t("value.seed", { value: v })}
              onChange={(v) => setPattern({ ...p, seed: v }, "vs")}
              onCommit={commit}
            />
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  change(
                    {
                      ...config,
                      pattern: { ...p, seed: ctl.newSeed() % 10000 },
                    },
                    "vs",
                    { commit: true, reprint: true },
                  )
                }
              >
                {t("ctl.surprise")}
              </Button>
            </div>
          </div>
        </>
      ) : null}
      {p.kind === "nervures" ? (
        <>
          <ParamSlider
            id={`${uid}-rn`}
            name="rn"
            label={t("ctl.nervures.count")}
            value={p.count}
            range={R.nervures.count}
            valueText={(v) => t("value.count", { count: v })}
            onChange={(v) => setPattern({ ...p, count: v }, "rn")}
            onCommit={commit}
          />
          <ParamSlider
            id={`${uid}-ra`}
            name="ra"
            label={t("ctl.nervures.depth")}
            value={p.depth}
            range={R.nervures.depth}
            unit="mm"
            valueText={(v) => t("value.mm", { value: num(v, locale) })}
            onChange={(v) => setPattern({ ...p, depth: v }, "ra")}
            onCommit={commit}
          />
          <ParamSlider
            id={`${uid}-rt`}
            name="rt"
            label={t("ctl.nervures.twist")}
            value={p.twistDeg}
            range={R.nervures.twistDeg}
            unit="°"
            valueText={(v) => t("value.degrees", { value: num(v, locale) })}
            onChange={(v) => setPattern({ ...p, twistDeg: v }, "rt")}
            onCommit={commit}
          />
        </>
      ) : null}
    </div>
  );
}

const R_KINDS = ["lisse", "gradins", "vagues", "voronoi", "nervures"] as const;

// ── Couleurs ────────────────────────────────────────────────────────────────

/** Liste des bandes (filaments, ajouter, retirer) du vase ou du sous-verre. */
export function BandsSection({
  ctl,
  config,
}: {
  ctl: Ctl;
  config: LavauxConfig | ReliefConfig;
}) {
  const { t, core, locale, change } = ctl;
  const relief = config.object === "relief" ? config : null;
  const geometry = relief
    ? { base: relief.base, relief: relief.relief, levels: relief.levels }
    : null;
  const bands = config.bands;
  const apply = (next: typeof bands, control: string, commit = true) =>
    change({ ...config, bands: next } as StudioConfig, control, { commit });
  const summary = ctl.bands.bands;
  const fromTo = (index: number) => {
    const band = summary[index];
    return band ? `${num(band.fromMm, locale)}–${mm(band.toMm, locale)}` : "";
  };
  return (
    <div className="flex flex-col gap-6">
      {config.object === "lavaux" ? (
        <div className="flex flex-col gap-2">
          <p className="s3d-label text-soft">{t("bands.palettes")}</p>
          <div className="flex flex-wrap gap-2">
            {HERO_PALETTE_KEYS.map((key: HeroPaletteKey) => (
              <Button
                key={key}
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() =>
                  change(
                    {
                      ...config,
                      bands: bandsForPalette(HERO_PALETTES[key], config.h),
                    },
                    "palette",
                    { commit: true },
                  )
                }
              >
                {core(`palettes.${key}`)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      <BandList
        bands={bands}
        canAdd={
          geometry ? canAddReliefBand(bands, geometry) : canAddBand(bands)
        }
        canRemove={geometry ? canRemoveReliefBand(bands) : canRemoveBand(bands)}
        onFilament={(index, filament) =>
          apply(setBandFilament(bands, index, filament), "palette")
        }
        onAdd={() =>
          apply(
            geometry ? addReliefBand(bands, geometry) : addBand(bands),
            "bands",
          )
        }
        onRemove={(index) =>
          apply(
            geometry
              ? removeReliefBand(bands, index, geometry)
              : removeBand(bands, index),
            "bands",
          )
        }
        nameOf={filamentName(ctl)}
        titleOf={(index) => t("bands.band", { index })}
        rangeOf={(index) => fromTo(index)}
        legendOf={(index) => t("bands.filamentLegend", { index })}
        addLabel={t("bands.add")}
        removeText={t("bands.remove")}
        removeLabelOf={(index) => t("bands.removeBand", { index })}
      />
      <p className="text-sm text-soft">{t("bands.hint")}</p>
      {/* Sans JavaScript : les bandes se règlent dans ce champ (formulaire GET). */}
      <noscript>
        <p className="text-sm text-soft">{t("bands.noscript")}</p>
      </noscript>
      <input
        type="text"
        name="bd"
        defaultValue={bands.map((b) => `${b.filament}:${b.toMm}`).join(",")}
        aria-label={t("bands.field")}
        className={cx(fieldClass, "s3d-num group-data-[js]/studio:hidden")}
      />
    </div>
  );
}

/** Barre altimétrique (frontières glissables) du vase ou du sous-verre. */
export function AltimetricBar({
  ctl,
  config,
  orientation,
  className,
}: {
  ctl: Ctl;
  config: LavauxConfig | ReliefConfig;
  orientation: "vertical" | "horizontal";
  className?: string;
}) {
  const { t, core, locale, change, commit } = ctl;
  const height =
    config.object === "relief"
      ? config.bands[config.bands.length - 1].toMm
      : config.h;
  const stepMm = config.object === "relief" ? reliefStep(config) : 0.2;
  const onBoundary = (index: number, raw: number) => {
    const bands =
      config.object === "relief"
        ? moveReliefBoundary(config.bands, index, raw, config)
        : moveBoundary(config.bands, index, raw);
    change({ ...config, bands } as StudioConfig, "bd");
  };
  return (
    <BandBar
      bands={config.bands}
      height={height}
      orientation={orientation}
      stepMm={stepMm}
      onBoundary={onBoundary}
      onCommit={commit}
      nameOf={filamentName(ctl)}
      labelOf={(index) => t("bands.boundaryLabel", { index })}
      valueTextOf={(index, z) =>
        core("bands.boundary", {
          index,
          z: mm(z, locale),
          layer: boundaryLayer(z),
        })
      }
      className={className}
    />
  );
}

/** Une paire plaque / encre (Cartouche, Porte-nom) : deux groupes de pastilles nommées. */
export function PlateInkSection({
  ctl,
  plate,
  ink,
  plateName,
  inkName,
  plateLegend,
  inkLegend,
  onPlate,
  onInk,
}: {
  ctl: Ctl;
  plate: FilamentId;
  ink: FilamentId;
  plateName: string;
  inkName: string;
  plateLegend: string;
  inkLegend: string;
  onPlate: (id: FilamentId) => void;
  onInk: (id: FilamentId) => void;
}) {
  const nameOf = filamentName(ctl);
  return (
    <div className="flex flex-col gap-6">
      <SwatchRadio
        legend={plateLegend}
        name={plateName}
        value={plate}
        onChange={onPlate}
        nameOf={nameOf}
      />
      <SwatchRadio
        legend={inkLegend}
        name={inkName}
        value={ink}
        onChange={onInk}
        nameOf={nameOf}
      />
    </div>
  );
}

// ── Carte « Cartouche » ─────────────────────────────────────────────────────

export function CartoucheShape({
  ctl,
  config,
}: {
  ctl: Ctl;
  config: CartoucheConfig;
}) {
  const { t, locale, uid, change, commit } = ctl;
  const R = CARTOUCHE_RANGES;
  const set = (patch: Partial<CartoucheConfig>, control: string) =>
    change({ ...config, ...patch }, control);
  return (
    <div className="flex flex-col gap-6">
      <RadioGroup
        legend={t("ctl.cartouche.mode")}
        name="mo"
        value={config.mode}
        options={(["relief", "gravure"] as const).map((mode) => ({
          value: mode,
          label: ctl.core(`options.mode.${mode}`),
        }))}
        onChange={(mode) =>
          change({ ...config, mode }, "mo", { commit: true, reprint: true })
        }
      />
      <ParamSlider
        id={`${uid}-e`}
        name="e"
        label={t(
          config.mode === "relief"
            ? "ctl.cartouche.heightRelief"
            : "ctl.cartouche.depthGravure",
        )}
        value={config.depth}
        range={{
          min: R.depth.min,
          max: cartoucheDepthMax(config.thickness, config.mode),
          step: R.depth.step,
        }}
        unit="mm"
        valueText={(v) => t("value.mm", { value: num(v, locale) })}
        onChange={(v) => set({ depth: v }, "e")}
        onCommit={commit}
      />
      <ParamSlider
        id={`${uid}-t`}
        name="t"
        label={t("ctl.cartouche.thickness")}
        value={config.thickness}
        range={R.thickness}
        unit="mm"
        valueText={(v) => t("value.mm", { value: num(v, locale) })}
        onChange={(v) => set({ thickness: v }, "t")}
        onCommit={commit}
      />
      <ParamSlider
        id={`${uid}-r`}
        name="r"
        label={t("ctl.cartouche.corner")}
        value={config.corner}
        range={R.corner}
        unit="mm"
        valueText={(v) => t("value.mm", { value: num(v, locale) })}
        onChange={(v) => set({ corner: v }, "r")}
        onCommit={commit}
      />
      <RadioGroup
        legend={t("ctl.cartouche.layout")}
        name="ly"
        value={config.layout}
        options={(
          ["classique", "centree", "cartouche", "monogramme"] as const
        ).map((layout) => ({
          value: layout,
          label: ctl.core(`options.layout.${layout}`),
        }))}
        onChange={(layout) =>
          change({ ...config, layout }, "ly", { commit: true, reprint: true })
        }
      />
    </div>
  );
}

// ── Sous-verre « Relief » ───────────────────────────────────────────────────

export function ReliefShape({
  ctl,
  config,
}: {
  ctl: Ctl;
  config: ReliefConfig;
}) {
  const { t, locale, uid, change, commit } = ctl;
  const R = RELIEF_RANGES;
  const set = (
    patch: Partial<ReliefConfig>,
    control: string,
    reprint = false,
  ) => change({ ...config, ...patch }, control, { reprint });
  return (
    <div className="flex flex-col gap-6">
      <RadioGroup
        legend={t("ctl.relief.shape")}
        name="sh"
        value={config.shape}
        options={(["rond", "carre"] as const).map((shape) => ({
          value: shape,
          label: ctl.core(`options.shape.${shape}`),
        }))}
        onChange={(shape) =>
          change({ ...config, shape }, "sh", { commit: true })
        }
      />
      <ParamSlider
        id={`${uid}-s`}
        name="s"
        label={
          config.shape === "rond"
            ? t("ctl.relief.diameter")
            : t("ctl.relief.side")
        }
        value={config.size}
        range={R.size}
        unit="mm"
        valueText={(v) => t("value.mm", { value: num(v, locale) })}
        onChange={(v) => set({ size: v }, "s")}
        onCommit={commit}
      />
      <ParamSlider
        id={`${uid}-ba`}
        name="ba"
        label={t("ctl.relief.base")}
        value={config.base}
        range={R.base}
        unit="mm"
        valueText={(v) => t("value.mm", { value: num(v, locale) })}
        onChange={(v) => set({ base: v }, "ba")}
        onCommit={commit}
      />
      <ParamSlider
        id={`${uid}-re`}
        name="re"
        label={t("ctl.relief.relief")}
        value={config.relief}
        range={R.relief}
        unit="mm"
        valueText={(v) => t("value.mm", { value: num(v, locale) })}
        onChange={(v) => set({ relief: v }, "re")}
        onCommit={commit}
      />
      <ParamSlider
        id={`${uid}-lv`}
        name="lv"
        label={t("ctl.relief.levels")}
        value={config.levels}
        range={R.levels}
        valueText={(v) => t("value.count", { count: v })}
        onChange={(v) => set({ levels: v }, "lv", true)}
        onCommit={commit}
      />
      <div className="flex flex-col gap-3">
        <ParamSlider
          id={`${uid}-sd`}
          name="sd"
          label={t("ctl.relief.seed")}
          value={config.seed}
          range={R.seed}
          valueText={(v) => t("value.seed", { value: v })}
          onChange={(v) => set({ seed: v }, "sd")}
          onCommit={commit}
        />
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              change({ ...config, seed: ctl.newSeed() % 10000 }, "sd", {
                commit: true,
                reprint: true,
              })
            }
          >
            {t("ctl.surprise")}
          </Button>
        </div>
      </div>
      <ParamSlider
        id={`${uid}-lk`}
        name="lk"
        label={t("ctl.relief.lake")}
        value={config.lake}
        range={R.lake}
        unit="%"
        valueText={(v) => t("value.percent", { value: num(v, locale) })}
        onChange={(v) => set({ lake: v }, "lk")}
        onCommit={commit}
      />
    </div>
  );
}

// ── Porte-nom « Borne » ─────────────────────────────────────────────────────

export function BorneShape({ ctl, config }: { ctl: Ctl; config: BorneConfig }) {
  const { t, locale, uid, change, commit } = ctl;
  const R = BORNE_RANGES;
  const set = (patch: Partial<BorneConfig>, control: string) =>
    change({ ...config, ...patch }, control);
  return (
    <div className="flex flex-col gap-6">
      <RadioGroup
        legend={t("ctl.borne.shape")}
        name="sh"
        value={config.shape}
        options={(["pilule", "etiquette", "goutte", "pic"] as const).map(
          (shape) => ({
            value: shape,
            label: ctl.core(`options.shape.${shape}`),
          }),
        )}
        onChange={(shape) =>
          change({ ...config, shape }, "sh", { commit: true, reprint: true })
        }
      />
      <ParamSlider
        id={`${uid}-c`}
        name="c"
        label={t("ctl.borne.cap")}
        value={config.cap}
        range={R.cap}
        unit="mm"
        valueText={(v) => t("value.mm", { value: num(v, locale) })}
        onChange={(v) => set({ cap: v }, "c")}
        onCommit={commit}
      />
      <ParamSlider
        id={`${uid}-t`}
        name="t"
        label={t("ctl.borne.thickness")}
        value={config.thickness}
        range={R.thickness}
        unit="mm"
        valueText={(v) => t("value.mm", { value: num(v, locale) })}
        onChange={(v) => set({ thickness: v }, "t")}
        onCommit={commit}
      />
      <RadioGroup
        legend={t("ctl.borne.ring")}
        name="rg"
        value={config.ring}
        options={(["gauche", "droite", "aucun"] as const).map((ring) => ({
          value: ring,
          label: ctl.core(`options.ring.${ring}`),
        }))}
        onChange={(ring) => change({ ...config, ring }, "rg", { commit: true })}
      />
      <ParamSlider
        id={`${uid}-rd`}
        name="rd"
        label={t("ctl.borne.ringD")}
        value={config.ringD}
        range={R.ringD}
        unit="mm"
        disabled={config.ring === "aucun"}
        valueText={(v) => t("value.mm", { value: num(v, locale) })}
        onChange={(v) => set({ ringD: v }, "rd")}
        onCommit={commit}
      />
      <RadioGroup
        legend={t("ctl.borne.mode")}
        name="mo"
        value={config.mode}
        options={(["relief", "gravure"] as const).map((mode) => ({
          value: mode,
          label: ctl.core(`options.mode.${mode}`),
        }))}
        onChange={(mode) =>
          change({ ...config, mode }, "mo", { commit: true, reprint: true })
        }
      />
    </div>
  );
}

// ── Textes ──────────────────────────────────────────────────────────────────

type Issue = Extract<Printability, { issues: unknown }>["issues"][number];

/**
 * Champs de texte de l'objet. Le texte saisi n'a PAS de nom de champ (il ne
 * part jamais dans la requête GET) et reste en mémoire puis en sessionStorage ;
 * un champ marqué `ph-mask` est aussi masqué dans les enregistrements de visite.
 */
export function TextSection({
  ctl,
  config,
  fields,
  issueText,
}: {
  ctl: Ctl;
  config: StudioConfig;
  fields: readonly TextField[];
  issueText: (issue: Issue) => string;
}) {
  const { t, uid, texts, examples, stats, commit, setText } = ctl;
  const issues = stats.printable.status === "ok" ? [] : stats.printable.issues;
  const relief = config.object === "relief" ? config : null;
  return (
    <div className="flex flex-col gap-6">
      {relief ? (
        <RadioGroup
          legend={t("ctl.relief.label")}
          name="lb"
          value={relief.label ? 1 : 0}
          options={[
            { value: 1, label: t("ctl.yes") },
            { value: 0, label: t("ctl.no") },
          ]}
          onChange={(value) =>
            ctl.change({ ...relief, label: value === 1 }, "lb", {
              commit: true,
            })
          }
        />
      ) : null}
      {fields.map((field) => {
        const id = `${uid}-text-${field}`;
        const value = texts[field] ?? "";
        const limit = TEXT_LIMITS[field];
        const count = codePoints(value).length;
        const problems = issues.filter((issue) => issue.field === field);
        const ids = fieldIds(id);
        return (
          <Field
            key={field}
            label={t(`ctl.text.${field}`)}
            htmlFor={id}
            hint={t("ctl.text.counter", { count, max: limit })}
            error={
              problems.length > 0
                ? problems.map((issue) => issueText(issue)).join(" ")
                : undefined
            }
          >
            <input
              id={id}
              type="text"
              form="studio-local"
              value={value}
              placeholder={examples[field]}
              maxLength={limit * 2}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={problems.length > 0 ? true : undefined}
              aria-describedby={`${ids.hint}${problems.length > 0 ? ` ${ids.error}` : ""}`}
              onChange={(event) => setText(field, event.currentTarget.value)}
              onBlur={commit}
              className={cx(fieldClass, "ph-mask")}
            />
          </Field>
        );
      })}
      <p className="max-w-[60ch] text-sm text-soft">
        {t("ctl.text.moderation")}
      </p>
    </div>
  );
}

// ── Fiche ───────────────────────────────────────────────────────────────────

export function SheetSection({
  ctl,
  issueText,
  onFix,
  actions,
}: {
  ctl: Ctl;
  issueText: (issue: Issue) => string;
  onFix: (issue: Issue) => void;
  actions: ReactNode;
}) {
  const { t, core, locale, stats } = ctl;
  const rows = [
    {
      term: t("sheet.rows.dimensions"),
      value: core("units.dimensions", {
        width: num(stats.widthMm, locale),
        depth: num(stats.depthMm, locale),
        height: num(stats.heightMm, locale),
      }),
    },
    {
      term: t("sheet.rows.layers"),
      value: core("units.layers", { count: stats.layers }),
    },
    {
      term: t("sheet.rows.volume"),
      value: `${formatNumber(stats.volumeCm3, locale, 1)} cm³`,
    },
    {
      term: t("sheet.rows.weight"),
      value: `≈ ${formatGrams(stats.grams, locale)}`,
    },
    {
      term: t("sheet.rows.time"),
      value: `≈ ${formatDuration(stats.minutes, locale)}`,
    },
    {
      term: t("sheet.rows.changes"),
      value:
        stats.changes > 0
          ? `${core("units.changes", { count: stats.changes })} · ${t("measure.purge")} ≈ ${formatGrams(stats.purgeGrams, locale)}`
          : core("units.changes", { count: 0 }),
    },
    { term: t("sheet.rows.material"), value: t("sheet.materialValue") },
    {
      term: t("sheet.rows.price"),
      value: stats.estimate
        ? `${formatChfRange(stats.estimate.lowCents, stats.estimate.highCents, locale)} · ${t("sheet.estimate")}`
        : core("measure.priceLater"),
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      <PrintableBadge
        printable={stats.printable}
        statusLabel={core(`guard.status.${stats.printable.status}`)}
        messageOf={issueText}
        fixLabel={core("guard.fix")}
        onFix={onFix}
      />
      <SpecTable rows={rows} />
      {FILAMENTS_INDICATIVE ? (
        <p className="text-sm text-soft">{t("sheet.indicative")}</p>
      ) : null}
      {actions}
    </div>
  );
}

// ── Préréglages ─────────────────────────────────────────────────────────────

/**
 * Préréglages de l'objet (presets.ts), en boutons à bascule : celui dont la
 * configuration est exactement la courante est « enfoncé ». Un clic remplace la
 * configuration (les textes saisis ne bougent pas) et rejoue la réimpression.
 */
export function PresetsRow({
  ctl,
  config,
}: {
  ctl: Ctl;
  config: StudioConfig;
}) {
  const presets = PRESETS[ctl.object] as readonly {
    id: string;
    config: StudioConfig;
  }[];
  const current = canonicalJson(config);
  return (
    <div className="flex flex-col gap-2">
      <p className="s3d-label text-soft">{ctl.t("ctl.presets")}</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            variant={
              canonicalJson(preset.config) === current ? "ink" : "secondary"
            }
            size="sm"
            className="rounded-full"
            aria-pressed={canonicalJson(preset.config) === current}
            onClick={() =>
              ctl.change(structuredClone(preset.config), "preset", {
                commit: true,
                reprint: true,
              })
            }
          >
            {ctl.core(`presets.${preset.id}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}

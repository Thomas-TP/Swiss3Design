"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  Box,
  Check,
  Eraser,
  Keyboard,
  Layers,
  Move3d,
  PaintBucket,
  Paintbrush,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Scissors,
  Trash2,
  Triangle,
  Undo2,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { FilamentChip } from "@/components/filament-chip";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { StageView } from "@/components/ui/stage-view";
import type { PublicCustomColor } from "@/lib/filament/public-stock";
import { motionBridge, useMotionBridge } from "@/lib/motion-bridge/store";
import {
  IDENTITY3,
  multiply3,
  quarterTurn,
  type PaintDocument,
} from "@/lib/paint3d/document";
import type {
  HeightMode,
  PaintEditorProps,
  PaintMeasure,
  PaintTool,
  ViewPreset,
} from "@/lib/paint3d/editor-contract";
import { paintStats } from "@/lib/paint3d/stats";
import { paintHeightRange, type FillMode } from "@/lib/paint3d/tools";

// Fenêtre de l'atelier 3D : un <dialog> modal plein écran (top layer : focus
// piégé, Échap, page inerte). Le centre est TRANSPARENT : c'est une vue du Stage
// (scène « paint-editor ») ; pendant que l'atelier est ouvert, le canvas du Stage
// passe au-dessus du contenu de la page (data-stage-front sur <body>, voir
// globals.css), sous le dialog, et se voit à travers cette fenêtre. Les panneaux
// autour sont opaques.
//
// Outils et raccourcis, comme dans les trancheurs : V vue, B pinceau, T
// triangle, F remplissage, H hauteur, E gomme, M mesure, L poser sur une face ;
// 1 à 4 la couleur ; [ et ] la taille du pinceau ; Ctrl+Z, Ctrl+Y.

/** Purge d'un changement de filament (≈ 280 mm³ de PLA, réglage par défaut des AMS). */
const PURGE_GRAMS = 0.35;
/**
 * Durée d'un changement de filament sur une P1S à AMS (s) : déchargement,
 * chargement et purge. Mesuré par Bambu Studio 02.08 sur un cube de 45 mm peint
 * en 3 couleurs (233 changements, 19 057 s de purge) : ≈ 82 s.
 */
const CHANGE_SECONDS = 80;
/** Taille du pinceau (mm) : bornes du curseur logarithmique. */
const BRUSH_MIN = 0.3;
const BRUSH_MAX = 60;

const TOOLS: { id: PaintTool; key: string; icon: typeof Paintbrush }[] = [
  { id: "orbit", key: "v", icon: Move3d },
  { id: "brush", key: "b", icon: Paintbrush },
  { id: "triangle", key: "t", icon: Triangle },
  { id: "fill", key: "f", icon: PaintBucket },
  { id: "height", key: "h", icon: Layers },
  { id: "erase", key: "e", icon: Eraser },
  { id: "measure", key: "m", icon: Ruler },
  { id: "lay", key: "l", icon: ArrowDownToLine },
];

const PRESETS: ViewPreset[] = [
  "iso",
  "front",
  "top",
  "left",
  "right",
  "back",
  "bottom",
];

type Tab = "colors" | "tool" | "object" | "summary";

function useDocVersion(doc: PaintDocument | null): number {
  return useSyncExternalStore(
    useCallback(
      (cb: () => void) => (doc ? doc.subscribe(cb) : () => undefined),
      [doc],
    ),
    () => doc?.version ?? -1,
    () => -1,
  );
}

export function PaintDialog({
  doc,
  failed,
  fileName,
  stock,
  selectable,
  refs,
  palette,
  maxColors,
  gramsPerPiece,
  plate,
  onRefsChange,
  onReplaceRef,
  fileOffer,
  onClose,
}: {
  doc: PaintDocument | null;
  failed: boolean;
  fileName: string;
  stock: readonly PublicCustomColor[];
  selectable: ReadonlySet<string>;
  refs: readonly string[];
  palette: readonly (readonly string[])[];
  maxColors: number;
  gramsPerPiece: number | null;
  plate: number;
  onRefsChange: (refs: string[]) => void;
  onReplaceRef: (slot: number, id: string) => void;
  /** Couleurs du fichier, proposées (reprendre en un clic, annulable). */
  fileOffer: { count: number; apply: () => void } | null;
  onClose: () => void;
}) {
  const t = useTranslations("paint");
  const locale = useLocale();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const stageAvailable = useMotionBridge(
    (s) => s.capability >= 1 && !s.contextLost,
  );
  const version = useDocVersion(doc);

  const [tool, setTool] = useState<PaintTool>(
    refs.length > 1 ? "fill" : "orbit",
  );
  const [slot, setSlot] = useState(Math.min(1, Math.max(0, refs.length - 1)));
  const [brush, setBrush] = useState<number | null>(null);
  const [through, setThrough] = useState(false);
  const [fillMode, setFillMode] = useState<FillMode>("smooth");
  const [fillAngle, setFillAngle] = useState(30);
  const [heightMode, setHeightMode] = useState<HeightMode>("above");
  const [bandHeight, setBandHeight] = useState(5);
  const [clip, setClip] = useState<number | null>(null);
  const [viewCommand, setViewCommand] =
    useState<PaintEditorProps["viewCommand"]>(null);
  const [hoverZ, setHoverZ] = useState<number | null>(null);
  const [measure, setMeasure] = useState<PaintMeasure | null>(null);
  const [tab, setTab] = useState<Tab>("colors");
  const [help, setHelp] = useState(false);
  // Mode simple par défaut (25.10.2026) : couleurs, trois façons de les placer
  // (zone, hauteur, pinceau) et la taille. « Plus d'outils » ouvre l'atelier
  // complet (facette, gomme, mesure, poser, vues, coupe, réglages fins).
  const [advanced, setAdvanced] = useState(false);

  const number = useCallback(
    (value: number, digits = 1) =>
      new Intl.NumberFormat(`${locale}-CH`, {
        maximumFractionDigits: digits,
      }).format(value),
    [locale],
  );

  // Ouverture : dialog modal, Lenis arrêté, canvas du Stage au premier plan.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    motionBridge.get().scroll?.lock(true);
    document.body.setAttribute("data-stage-front", "");
    // Un « close » en retard (démontage du double effet de développement) arrive
    // alors que le dialog est rouvert : on l'ignore.
    const onDialogClose = () => {
      if (!dialog.open) onCloseRef.current();
    };
    dialog.addEventListener("close", onDialogClose);
    return () => {
      dialog.removeEventListener("close", onDialogClose);
      document.body.removeAttribute("data-stage-front");
      motionBridge.get().scroll?.lock(false);
      if (dialog.open) dialog.close();
    };
  }, []);

  const bounds = doc?.worldBounds();
  const diagonal = bounds ? Math.hypot(...bounds.size) : 100;
  const brushRadius =
    brush ??
    Math.min(
      BRUSH_MAX,
      Math.max(BRUSH_MIN, Math.round(diagonal * 0.04 * 10) / 10),
    );
  const slotClamped = Math.min(slot, Math.max(0, refs.length - 1));

  const editorProps = useMemo<PaintEditorProps | null>(
    () =>
      doc
        ? {
            doc,
            version,
            palette,
            tool,
            slot: slotClamped,
            brushRadius,
            throughWalls: through,
            fillMode,
            fillAngle,
            heightMode,
            bandHeight,
            clipZ: clip,
            plate,
            viewCommand,
            onHover: (hover) => setHoverZ(hover ? hover.z : null),
            onMeasure: setMeasure,
          }
        : null,
    [
      doc,
      version,
      palette,
      tool,
      slotClamped,
      brushRadius,
      through,
      fillMode,
      fillAngle,
      heightMode,
      bandHeight,
      clip,
      plate,
      viewCommand,
    ],
  );

  const view = (preset: ViewPreset) =>
    setViewCommand((previous) => ({
      preset,
      nonce: (previous?.nonce ?? 0) + 1,
    }));

  // ── Clavier ──
  // oxlint-disable exhaustive-deps -- raccourcis relus à chaque rendu (état courant)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) doc?.redo();
        else doc?.undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        doc?.redo();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const found = TOOLS.find((entry) => entry.key === key);
      if (found) {
        setTool(found.id);
        return;
      }
      if (/^[1-4]$/.test(key) && Number(key) <= refs.length) {
        setSlot(Number(key) - 1);
        return;
      }
      if (key === "[" || key === "]") {
        const factor = key === "]" ? 1.25 : 0.8;
        setBrush(
          Math.min(
            BRUSH_MAX,
            Math.max(BRUSH_MIN, Math.round(brushRadius * factor * 10) / 10),
          ),
        );
        return;
      }
      if (key === "0" || key === "home") view("fit");
      if (key === "?") setHelp((open) => !open);
    };
    dialog.addEventListener("keydown", onKey);
    return () => dialog.removeEventListener("keydown", onKey);
  });
  // oxlint-enable exhaustive-deps

  const stats = useMemo(
    () =>
      doc && version >= 0 ? paintStats(doc, Math.max(1, refs.length)) : null,
    [doc, version, refs.length],
  );

  // ── Palette ──
  const colorOf = (id: string) => stock.find((c) => c.id === id);
  const addable = stock.filter(
    (c) => selectable.has(c.id) && !refs.includes(c.id),
  );
  const addColor = (id: string) => {
    if (refs.length >= maxColors) return;
    onRefsChange([...refs, id]);
    setSlot(refs.length);
    if (tool === "orbit" && refs.length >= 1) setTool("fill");
  };
  const removeColor = (index: number) => {
    onRefsChange(refs.filter((_, i) => i !== index));
    setSlot((current) => Math.max(0, current >= index ? current - 1 : current));
  };
  const makeBase = (index: number) => {
    const next = [refs[index], ...refs.filter((_, i) => i !== index)];
    onRefsChange(next);
    setSlot(0);
  };
  const [replacing, setReplacing] = useState<number | null>(null);

  // ── Taille et orientation ──
  const setScale = (scale: number) => {
    if (!doc || !Number.isFinite(scale) || scale <= 0) return;
    doc.setTransform(doc.rotation, Math.min(100, Math.max(0.01, scale)));
    view("fit");
  };
  const turn = (axis: "x" | "y" | "z", sign: 1 | -1) => {
    if (!doc) return;
    doc.setTransform(
      multiply3(quarterTurn(axis, sign), doc.rotation),
      doc.scale,
    );
    view("fit");
  };
  const resetTransform = () => {
    if (!doc) return;
    doc.setTransform(IDENTITY3, 1);
    view("fit");
  };
  const baseSize =
    bounds && doc ? bounds.size.map((v) => v / doc.scale) : [0, 0, 0];
  const fits = bounds ? bounds.size.every((v) => v <= plate + 0.01) : true;
  const largest = Math.max(...baseSize);

  const [heightText, setHeightText] = useState("");
  const applyHeight = () => {
    if (!doc) return;
    const z = Number(heightText.replace(",", "."));
    if (!Number.isFinite(z)) return;
    const state = slotClamped + 1;
    const [low, high] =
      heightMode === "above"
        ? [z, Infinity]
        : heightMode === "below"
          ? [-Infinity, z]
          : [z - bandHeight / 2, z + bandHeight / 2];
    doc.beginStep();
    paintHeightRange(doc, low, high, state);
    doc.endStep();
  };

  const clearPaint = () => {
    if (!doc) return;
    if (!window.confirm(t("clearConfirm"))) return;
    doc.clearPaint();
  };

  const toolHint = t(`hints.${tool}`);
  const sectionClass = (id: Tab) =>
    cx("border-b border-line px-4 py-4 lg:block", tab !== id && "hidden");
  const label = "s3d-label mb-2 block text-soft";
  const segment = (on: boolean) =>
    cx(
      "h-9 flex-1 rounded-field border px-2 text-sm transition-colors",
      on
        ? "border-ink bg-ink text-paper"
        : "border-line text-ink hover:border-ink",
    );

  const totalGrams =
    gramsPerPiece !== null && doc ? gramsPerPiece * doc.scale ** 3 : null;
  const changes = stats && refs.length > 1 ? stats.changes : 0;

  // Taille et orientation : panneau du mode complet, repli du mode simple.
  const objectContent =
    doc && bounds ? (
      <>
        <div className="grid grid-cols-3 gap-2">
          {(["x", "y", "z"] as const).map((axis, i) => (
            <SizeField
              key={`${axis}-${doc.transformVersion}`}
              label={axis.toUpperCase()}
              value={bounds.size[i]}
              format={number}
              onCommit={(mm) => baseSize[i] > 0 && setScale(mm / baseSize[i])}
            />
          ))}
        </div>
        <div className="mt-3 flex items-end gap-2">
          <SizeField
            key={`scale-${doc.transformVersion}`}
            label={t("object.scale")}
            value={doc.scale * 100}
            suffix="%"
            format={number}
            onCommit={(percent) => setScale(percent / 100)}
          />
          <div className="flex flex-wrap gap-1 pb-0.5">
            {[50, 100, 150, 200].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setScale(p / 100)}
                className="h-9 rounded-field border border-line px-2 text-xs hover:border-ink"
              >
                {p} %
              </button>
            ))}
          </div>
        </div>
        {largest > 0 && largest < 6 ? (
          <div className="mt-3 rounded-field bg-line/40 p-3 text-xs">
            <p className="mb-2">{t("object.tiny")}</p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setScale(10)}
                className="h-8 rounded-field border border-ink px-2"
              >
                {t("object.fromCm")}
              </button>
              <button
                type="button"
                onClick={() => setScale(25.4)}
                className="h-8 rounded-field border border-ink px-2"
              >
                {t("object.fromInch")}
              </button>
            </div>
          </div>
        ) : null}
        <p
          className={cx(
            "mt-3 text-xs",
            fits ? "text-soft" : "font-semibold text-accent-text",
          )}
        >
          {fits ? t("object.fits", { plate }) : t("object.tooBig", { plate })}
        </p>
        <p className="mt-4 mb-1.5 text-xs text-soft">{t("object.rotate")}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["x", "y", "z"] as const).map((axis) => (
            <div key={axis} className="flex gap-1">
              <button
                type="button"
                onClick={() => turn(axis, -1)}
                className="h-9 flex-1 rounded-field border border-line text-xs hover:border-ink"
                aria-label={t("object.turn", {
                  axis: axis.toUpperCase(),
                  angle: "−90°",
                })}
              >
                {axis.toUpperCase()} ↺
              </button>
              <button
                type="button"
                onClick={() => turn(axis, 1)}
                className="h-9 flex-1 rounded-field border border-line text-xs hover:border-ink"
                aria-label={t("object.turn", {
                  axis: axis.toUpperCase(),
                  angle: "+90°",
                })}
              >
                {axis.toUpperCase()} ↻
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setTool("lay")}>
            <ArrowDownToLine size={15} strokeWidth={1.5} aria-hidden="true" />
            {t("tools.lay")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={resetTransform}
            disabled={!doc.transformed}
          >
            {t("object.reset")}
          </Button>
        </div>
        <p className="mt-3 text-xs text-soft">{t("object.note")}</p>
      </>
    ) : null;

  // Outils du mode simple (le reste est dans « Plus d'outils »).
  const simpleTools = [
    { id: "fill", icon: PaintBucket, name: t("simple.zone") },
    { id: "height", icon: Layers, name: t("simple.height") },
    { id: "brush", icon: Paintbrush, name: t("simple.brush") },
  ] as const;
  const simpleHint =
    tool === "height"
      ? heightMode === "below"
        ? t("simple.heightBelowHint")
        : t("simple.heightAboveHint")
      : tool === "brush"
        ? t("simple.brushHint")
        : t("simple.zoneHint");
  const leaveAdvanced = () => {
    setAdvanced(false);
    if (!["fill", "height", "brush", "orbit"].includes(tool))
      setTool(refs.length > 1 ? "fill" : "orbit");
    if (heightMode === "band") setHeightMode("above");
    if (fillMode !== "smooth") setFillMode("smooth");
  };

  const simplePanel = (
    <div className="space-y-6 px-4 py-4">
      {/* 1 · la couleur */}
      <section aria-labelledby={`${titleId}-pick`}>
        <h3 id={`${titleId}-pick`} className={label}>
          {t("simple.stepColor")}
        </h3>
        {fileOffer ? (
          <div className="mb-3 rounded-field border border-line bg-paper p-3 text-sm">
            <p className="text-soft">
              {t("palette.fileOffer", { count: fileOffer.count })}
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={fileOffer.apply}
            >
              {t("palette.useFile", { count: fileOffer.count })}
            </Button>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {refs.map((id, index) => {
            const color = colorOf(id);
            const active = index === slotClamped;
            const share =
              stats && stats.totalArea > 0
                ? (stats.areaBySlot[index] ?? 0) / stats.totalArea
                : 0;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSlot(index);
                  if (tool === "orbit" && refs.length > 1) setTool("fill");
                }}
                className={cx(
                  "flex min-w-0 items-center gap-2.5 rounded-field border px-2.5 py-2 text-left transition-colors",
                  active
                    ? "border-ink bg-paper outline outline-2 outline-ink"
                    : "border-line hover:border-ink",
                )}
              >
                <span className="relative shrink-0">
                  <FilamentChip hexes={color?.hexes ?? []} size={30} />
                  <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-ink text-[0.625rem] font-semibold text-paper">
                    {index + 1}
                  </span>
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm">
                    {color?.name ?? id}
                  </span>
                  <span className="block text-xs tabular-nums text-soft">
                    {refs.length > 1 ? `${number(share * 100, 0)} %` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {refs.length < 2 ? (
          <p className="mt-3 text-sm text-soft">{t("simple.onlyOne")}</p>
        ) : null}
        {refs.length < maxColors ? (
          <details className="mt-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              {t("palette.add")}
            </summary>
            <ColorList
              colors={addable}
              empty={t("palette.noOther")}
              onPick={addColor}
            />
          </details>
        ) : null}
      </section>

      {/* 2 · comment la placer */}
      {refs.length > 1 ? (
        <section aria-labelledby={`${titleId}-how`}>
          <h3 id={`${titleId}-how`} className={label}>
            {t("simple.stepHow")}
          </h3>
          <div className="grid grid-cols-3 gap-1.5">
            {simpleTools.map(({ id, icon: Icon, name }) => (
              <button
                key={id}
                type="button"
                aria-pressed={tool === id}
                onClick={() => setTool(id)}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-field border px-2 py-2.5 text-sm transition-colors",
                  tool === id
                    ? "border-ink bg-ink text-paper"
                    : "border-line text-ink hover:border-ink",
                )}
              >
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                {name}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-ink">{simpleHint}</p>
          {tool === "height" ? (
            <div className="mt-3 flex gap-1">
              {(["above", "below"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={heightMode === mode}
                  onClick={() => setHeightMode(mode)}
                  className={segment(heightMode === mode)}
                >
                  {t(`height.${mode}`)}
                </button>
              ))}
            </div>
          ) : null}
          {tool === "brush" ? (
            <RangeField
              label={t("brush.size")}
              value={brushRadius}
              display={`${number(brushRadius * 2)} mm`}
              min={Math.log(BRUSH_MIN)}
              max={Math.log(BRUSH_MAX)}
              step={0.01}
              toSlider={Math.log}
              fromSlider={(v) => Math.round(Math.exp(v) * 10) / 10}
              onChange={setBrush}
            />
          ) : null}
          {changes > 0 ? (
            <p className="mt-3 text-xs text-soft">
              {t("summary.changes", { count: changes })}
              {" · "}
              {t("summary.time", {
                minutes: number((changes * CHANGE_SECONDS) / 60, 0),
              })}
            </p>
          ) : null}
        </section>
      ) : null}

      <p className="text-xs text-soft">{t("simple.rotate")}</p>

      {/* Taille et orientation, repliée */}
      <details
        className="rounded-field border border-line"
        open={refs.length < 2 ? true : undefined}
      >
        <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold">
          {t("object.title")}
        </summary>
        <div className="border-t border-line px-3 py-3">{objectContent}</div>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={clearPaint}
          disabled={
            !doc || (stats?.areaBySlot.slice(1).every((a) => a === 0) ?? true)
          }
        >
          <Trash2 size={15} strokeWidth={1.5} aria-hidden="true" />
          {t("clear")}
        </Button>
        <Button size="sm" variant="text" onClick={() => setAdvanced(true)}>
          {t("simple.more")}
        </Button>
      </div>
    </div>
  );

  return (
    // oxlint-disable-next-line no-noninteractive-element-interactions -- Échap natif du dialog
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-hidden bg-transparent p-0 text-ink backdrop:bg-transparent"
    >
      <div
        className={cx(
          "grid h-full lg:grid-rows-[auto_minmax(0,1fr)]",
          advanced
            ? "grid-rows-[auto_minmax(0,1fr)_auto_auto] lg:grid-cols-[4.75rem_minmax(0,1fr)_22.5rem]"
            : "grid-rows-[auto_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_22.5rem]",
        )}
      >
        {/* ── En-tête ── */}
        <header className="col-span-full flex items-center gap-2 border-b border-line bg-elevated px-3 py-2 sm:gap-3 sm:px-4">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="font-display text-base font-semibold leading-tight"
            >
              {advanced ? t("title") : t("simple.title")}
            </h2>
            <p className="ph-no-capture truncate text-xs text-soft">
              {fileName}
              {bounds
                ? ` · ${bounds.size.map((v) => number(v)).join(" × ")} mm`
                : ""}
              {totalGrams !== null ? ` · ≈ ${number(totalGrams, 0)} g` : ""}
            </p>
          </div>
          <IconButton
            label={t("undo")}
            onClick={() => doc?.undo()}
            disabled={!doc?.canUndo()}
          >
            <Undo2 size={18} strokeWidth={1.5} />
          </IconButton>
          <IconButton
            label={t("redo")}
            onClick={() => doc?.redo()}
            disabled={!doc?.canRedo()}
          >
            <Redo2 size={18} strokeWidth={1.5} />
          </IconButton>
          <IconButton
            label={t("shortcuts.title")}
            onClick={() => setHelp((open) => !open)}
            className="hidden sm:inline-flex"
          >
            <Keyboard size={18} strokeWidth={1.5} />
          </IconButton>
          <Button
            variant="ink"
            size="sm"
            onClick={() => dialogRef.current?.close()}
          >
            <Check size={16} strokeWidth={1.75} aria-hidden="true" />
            {t("done")}
          </Button>
        </header>

        {/* ── Outils (mode complet) ── */}
        {advanced ? (
          <div
            role="toolbar"
            aria-label={t("toolsLabel")}
            aria-orientation="vertical"
            className="order-3 flex gap-1 overflow-x-auto border-t border-line bg-elevated px-2 py-1.5 lg:order-none lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:border-t-0 lg:px-1.5 lg:py-3"
          >
            {TOOLS.map(({ id, key, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={tool === id}
                title={`${t(`tools.${id}`)} (${key.toUpperCase()})`}
                onClick={() => {
                  setTool(id);
                  if (id !== "orbit") setTab("tool");
                }}
                className={cx(
                  "flex min-w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-field px-1.5 py-1.5 text-[0.6875rem] leading-tight transition-colors",
                  tool === id
                    ? "bg-ink text-paper"
                    : "text-ink hover:bg-line/60",
                )}
              >
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                <span>{t(`tools.${id}`)}</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* ── Vue 3D (transparente : le canvas du Stage se voit à travers) ── */}
        <div className="relative order-2 min-h-0 lg:order-none">
          {doc && editorProps && stageAvailable ? (
            <StageView
              scene="paint-editor"
              props={editorProps}
              clear="tone"
              interactive
              liveRect
              priority={100}
              label={t("viewport")}
              className={cx(
                "h-full w-full select-none outline-none",
                tool === "orbit"
                  ? "cursor-grab active:cursor-grabbing"
                  : tool === "measure" ||
                      tool === "lay" ||
                      tool === "fill" ||
                      tool === "height"
                    ? "cursor-pointer"
                    : "cursor-crosshair",
              )}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-paper p-6 text-center text-sm text-soft">
              <p>
                {failed
                  ? t("error")
                  : !stageAvailable
                    ? t("unavailable")
                    : t("loading")}
              </p>
            </div>
          )}

          {/* Vues et coupe (mode complet) ; en simple, « Recadrer » seul */}
          {doc && !advanced ? (
            <button
              type="button"
              data-no-orbit=""
              onClick={() => view("fit")}
              className="absolute right-2 top-2 flex h-9 items-center gap-1.5 rounded-field bg-paper/90 px-3 text-xs text-ink backdrop-blur-sm hover:bg-paper"
            >
              <Box size={15} strokeWidth={1.5} aria-hidden="true" />
              {t("simple.fit")}
            </button>
          ) : null}
          {doc && advanced ? (
            <div
              data-no-orbit=""
              className="absolute right-2 top-2 flex flex-col items-end gap-1.5"
            >
              <div className="flex flex-wrap justify-end gap-1 rounded-field bg-paper/90 p-1 backdrop-blur-sm">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => view(preset)}
                    className="h-8 rounded-hair px-2 text-xs text-ink hover:bg-line/70"
                  >
                    {t(`views.${preset}`)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => view("fit")}
                  title={t("views.fitKey")}
                  className="grid h-8 w-8 place-items-center rounded-hair text-ink hover:bg-line/70"
                  aria-label={t("views.fit")}
                >
                  <Box size={15} strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-field bg-paper/90 px-2 py-1 backdrop-blur-sm">
                <button
                  type="button"
                  aria-pressed={clip !== null}
                  onClick={() =>
                    setClip(
                      clip === null && bounds
                        ? Math.round(bounds.size[2] * 0.6 * 10) / 10
                        : null,
                    )
                  }
                  className={cx(
                    "flex h-8 items-center gap-1.5 rounded-hair px-2 text-xs",
                    clip !== null
                      ? "bg-ink text-paper"
                      : "text-ink hover:bg-line/70",
                  )}
                >
                  <Scissors size={14} strokeWidth={1.5} aria-hidden="true" />
                  {t("views.clip")}
                </button>
                {clip !== null && bounds ? (
                  <input
                    type="range"
                    aria-label={t("views.clipHeight")}
                    min={0}
                    max={Math.max(0.1, bounds.size[2])}
                    step={Math.max(0.05, bounds.size[2] / 400)}
                    value={clip}
                    onChange={(e) => setClip(Number(e.target.value))}
                    className="w-28 accent-[var(--ink)] sm:w-40"
                  />
                ) : null}
                {clip !== null ? (
                  <span className="text-xs tabular-nums">
                    {number(clip)} mm
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Mesure, hauteur sous le pointeur, consigne de l'outil */}
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex flex-col items-start gap-1.5">
            {measure ? (
              <p className="rounded-field bg-ink px-2.5 py-1.5 text-xs text-paper">
                {measure.distance === null
                  ? t("measure.second")
                  : t("measure.result", {
                      distance: number(measure.distance, 2),
                    })}
              </p>
            ) : null}
            {hoverZ !== null ? (
              <p className="rounded-hair bg-paper/90 px-2 py-1 text-xs tabular-nums text-ink">
                {t("hoverHeight", { z: number(hoverZ) })}
              </p>
            ) : null}
            <p className="hidden rounded-hair bg-paper/90 px-2 py-1 text-xs text-soft sm:block">
              {toolHint}
            </p>
          </div>

          {help ? (
            <div
              data-no-orbit=""
              className="absolute left-2 top-2 max-w-xs rounded-card border border-line bg-elevated p-4 text-sm shadow-lg"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">{t("shortcuts.title")}</p>
                <IconButton label={t("close")} onClick={() => setHelp(false)}>
                  <X size={16} />
                </IconButton>
              </div>
              <ul className="space-y-1 text-xs text-soft">
                {(
                  [
                    "tools",
                    "colors",
                    "brush",
                    "undo",
                    "view",
                    "mouse",
                    "touch",
                  ] as const
                ).map((k) => (
                  <li key={k}>{t(`shortcuts.${k}`)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* ── Panneaux ── */}
        <aside
          data-lenis-prevent=""
          className="order-4 max-h-[40dvh] overflow-y-auto overscroll-contain border-t border-line bg-elevated lg:order-none lg:max-h-none lg:border-l lg:border-t-0"
        >
          {advanced ? (
            <>
              <div className="flex justify-end border-b border-line px-3 py-1.5">
                <Button variant="text" size="sm" onClick={leaveAdvanced}>
                  {t("simple.less")}
                </Button>
              </div>
              <div
                role="tablist"
                aria-label={t("panelsLabel")}
                className="sticky top-0 z-10 flex border-b border-line bg-elevated lg:hidden"
              >
                {(["colors", "tool", "object", "summary"] as const).map(
                  (id) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={tab === id}
                      onClick={() => setTab(id)}
                      className={cx(
                        "h-10 flex-1 text-xs",
                        tab === id
                          ? "border-b-2 border-ink font-semibold text-ink"
                          : "text-soft",
                      )}
                    >
                      {t(`tabs.${id}`)}
                    </button>
                  ),
                )}
              </div>

              {/* Couleurs */}
              <section
                className={sectionClass("colors")}
                aria-labelledby={`${titleId}-colors`}
              >
                <h3 id={`${titleId}-colors`} className={label}>
                  {t("palette.title")}
                </h3>
                {fileOffer ? (
                  <div className="mb-3 rounded-field border border-line bg-paper p-3 text-sm">
                    <p className="text-soft">
                      {t("palette.fileOffer", { count: fileOffer.count })}
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={fileOffer.apply}
                    >
                      {t("palette.useFile", { count: fileOffer.count })}
                    </Button>
                  </div>
                ) : null}
                {refs.length === 0 ? (
                  <p className="mb-3 text-sm text-soft">{t("palette.empty")}</p>
                ) : null}
                <ul className="space-y-1.5">
                  {refs.map((id, index) => {
                    const color = colorOf(id);
                    const share =
                      stats && stats.totalArea > 0
                        ? (stats.areaBySlot[index] ?? 0) / stats.totalArea
                        : 0;
                    const active = index === slotClamped;
                    return (
                      <li key={id}>
                        <div
                          className={cx(
                            "flex items-center gap-2 rounded-field border px-2 py-1.5",
                            active ? "border-ink" : "border-line",
                          )}
                        >
                          <button
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                              setSlot(index);
                              if (
                                tool === "orbit" ||
                                tool === "measure" ||
                                tool === "lay"
                              )
                                setTool("brush");
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                          >
                            <span className="relative">
                              <FilamentChip
                                hexes={color?.hexes ?? []}
                                size={26}
                              />
                              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-ink text-[0.625rem] font-semibold text-paper">
                                {index + 1}
                              </span>
                            </span>
                            <span className="min-w-0 leading-tight">
                              <span className="block truncate text-sm">
                                {color?.name ?? id}
                              </span>
                              <span className="block text-xs text-soft">
                                {index === 0 ? `${t("palette.base")} · ` : ""}
                                {t("palette.share", {
                                  percent: number(share * 100, 0),
                                })}
                                {totalGrams !== null && refs.length > 1
                                  ? ` · ≈ ${number(totalGrams * share, 0)} g`
                                  : ""}
                              </span>
                            </span>
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {index > 0 ? (
                              <IconButton
                                label={t("palette.makeBase")}
                                onClick={() => makeBase(index)}
                                size="sm"
                              >
                                <ArrowDownToLine
                                  size={14}
                                  strokeWidth={1.5}
                                  className="rotate-180"
                                />
                              </IconButton>
                            ) : null}
                            <IconButton
                              label={t("palette.replace")}
                              onClick={() =>
                                setReplacing(replacing === index ? null : index)
                              }
                              size="sm"
                            >
                              <RotateCcw size={14} strokeWidth={1.5} />
                            </IconButton>
                            <IconButton
                              label={t("palette.remove")}
                              onClick={() => removeColor(index)}
                              size="sm"
                            >
                              <Trash2 size={14} strokeWidth={1.5} />
                            </IconButton>
                          </div>
                        </div>
                        {replacing === index ? (
                          <ColorList
                            colors={addable}
                            empty={t("palette.noOther")}
                            onPick={(next) => {
                              onReplaceRef(index, next);
                              setReplacing(null);
                            }}
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {refs.length < maxColors ? (
                  <details className="mt-3">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                      <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                      {t("palette.add")}
                    </summary>
                    <ColorList
                      colors={addable}
                      empty={t("palette.noOther")}
                      onPick={addColor}
                    />
                  </details>
                ) : (
                  <p className="mt-3 text-xs text-soft">
                    {t("palette.max", { max: maxColors })}
                  </p>
                )}
                <p className="mt-3 text-xs text-soft">{t("palette.hint")}</p>
              </section>

              {/* Réglages de l'outil */}
              <section
                className={sectionClass("tool")}
                aria-labelledby={`${titleId}-tool`}
              >
                <h3 id={`${titleId}-tool`} className={label}>
                  {t(`tools.${tool}`)}
                </h3>
                <p className="mb-3 text-sm text-soft">{toolHint}</p>
                {tool === "brush" || tool === "erase" ? (
                  <>
                    <RangeField
                      label={t("brush.size")}
                      value={brushRadius}
                      display={`${number(brushRadius * 2)} mm`}
                      min={Math.log(BRUSH_MIN)}
                      max={Math.log(BRUSH_MAX)}
                      step={0.01}
                      toSlider={Math.log}
                      fromSlider={(v) => Math.round(Math.exp(v) * 10) / 10}
                      onChange={setBrush}
                    />
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={through}
                        onChange={(e) => setThrough(e.target.checked)}
                        className="h-4 w-4 accent-[var(--ink)]"
                      />
                      {t("brush.through")}
                    </label>
                  </>
                ) : null}
                {tool === "fill" ? (
                  <>
                    <div className="flex gap-1">
                      {(["smooth", "color", "part"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={fillMode === mode}
                          onClick={() => setFillMode(mode)}
                          className={segment(fillMode === mode)}
                        >
                          {t(`fill.${mode}`)}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-soft">
                      {t(`fill.${fillMode}Hint`)}
                    </p>
                    {fillMode !== "part" ? (
                      <RangeField
                        label={t("fill.angle")}
                        value={fillAngle}
                        display={`${fillAngle}°`}
                        min={1}
                        max={fillMode === "color" ? 180 : 90}
                        step={1}
                        onChange={setFillAngle}
                      />
                    ) : null}
                  </>
                ) : null}
                {tool === "height" ? (
                  <>
                    <div className="flex gap-1">
                      {(["above", "below", "band"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={heightMode === mode}
                          onClick={() => setHeightMode(mode)}
                          className={segment(heightMode === mode)}
                        >
                          {t(`height.${mode}`)}
                        </button>
                      ))}
                    </div>
                    {heightMode === "band" ? (
                      <RangeField
                        label={t("height.thickness")}
                        value={bandHeight}
                        display={`${number(bandHeight)} mm`}
                        min={0.2}
                        max={Math.max(
                          1,
                          Math.round((bounds?.size[2] ?? 50) * 10) / 10,
                        )}
                        step={0.2}
                        onChange={setBandHeight}
                      />
                    ) : null}
                    <div className="mt-3 flex items-end gap-2">
                      <label className="flex-1 text-sm">
                        <span className={label}>{t("height.at")}</span>
                        <input
                          inputMode="decimal"
                          value={heightText}
                          placeholder={hoverZ !== null ? number(hoverZ) : "0"}
                          onChange={(e) => setHeightText(e.target.value)}
                          className="h-10 w-full rounded-field border border-line bg-paper px-3"
                        />
                      </label>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={applyHeight}
                        disabled={!heightText.trim()}
                      >
                        {t("height.apply")}
                      </Button>
                    </div>
                  </>
                ) : null}
                {tool === "measure" && measure ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1"
                    onClick={() => setMeasure(null)}
                  >
                    {t("measure.clear")}
                  </Button>
                ) : null}
                {tool !== "orbit" &&
                tool !== "measure" &&
                tool !== "lay" &&
                refs.length > 0 ? (
                  <p className="mt-3 flex items-center gap-2 text-sm">
                    {tool === "erase" ? (
                      <>
                        <FilamentChip
                          hexes={colorOf(refs[0])?.hexes ?? []}
                          size={18}
                        />
                        {t("erase.paints", {
                          name: colorOf(refs[0])?.name ?? "",
                        })}
                      </>
                    ) : (
                      <>
                        <FilamentChip
                          hexes={colorOf(refs[slotClamped])?.hexes ?? []}
                          size={18}
                        />
                        {t("brush.paints", {
                          name: colorOf(refs[slotClamped])?.name ?? "",
                        })}
                      </>
                    )}
                  </p>
                ) : null}
              </section>

              {/* Taille et orientation */}
              <section
                className={sectionClass("object")}
                aria-labelledby={`${titleId}-object`}
              >
                <h3 id={`${titleId}-object`} className={label}>
                  {t("object.title")}
                </h3>
                {objectContent}
              </section>

              {/* Bilan */}
              <section
                className={sectionClass("summary")}
                aria-labelledby={`${titleId}-summary`}
              >
                <h3 id={`${titleId}-summary`} className={label}>
                  {t("summary.title")}
                </h3>
                {stats && refs.length > 0 ? (
                  <>
                    <ul className="space-y-1 text-sm">
                      {refs.map((id, index) => {
                        const share =
                          stats.totalArea > 0
                            ? (stats.areaBySlot[index] ?? 0) / stats.totalArea
                            : 0;
                        return (
                          <li key={id} className="flex items-center gap-2">
                            <FilamentChip
                              hexes={colorOf(id)?.hexes ?? []}
                              size={14}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {colorOf(id)?.name ?? id}
                            </span>
                            <span className="tabular-nums text-soft">
                              {number(share * 100, 0)} %
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {refs.length > 1 ? (
                      <p className="mt-3 text-sm">
                        {t("summary.changes", { count: changes })}
                        {changes > 0 ? (
                          <span className="text-soft">
                            {" · "}
                            {t("summary.purge", {
                              grams: number(changes * PURGE_GRAMS, 0),
                            })}
                            {" · "}
                            {t("summary.time", {
                              minutes: number(
                                (changes * CHANGE_SECONDS) / 60,
                                0,
                              ),
                            })}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-soft">
                      {t("summary.note")}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-soft">{t("palette.empty")}</p>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-3"
                  onClick={clearPaint}
                  disabled={
                    !doc ||
                    (stats?.areaBySlot.slice(1).every((a) => a === 0) ?? true)
                  }
                >
                  <Trash2 size={15} strokeWidth={1.5} aria-hidden="true" />
                  {t("clear")}
                </Button>
              </section>
            </>
          ) : (
            simplePanel
          )}
        </aside>
      </div>
    </dialog>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
  className,
  size = "md",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center rounded-field text-ink transition-colors hover:bg-line/60 disabled:opacity-40",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        className,
      )}
    >
      {children}
    </button>
  );
}

function ColorList({
  colors,
  empty,
  onPick,
}: {
  colors: readonly PublicCustomColor[];
  empty: string;
  onPick: (id: string) => void;
}) {
  if (colors.length === 0)
    return <p className="mt-2 text-xs text-soft">{empty}</p>;
  return (
    <ul className="mt-2 grid grid-cols-2 gap-1.5">
      {colors.map((color) => (
        <li key={color.id}>
          <button
            type="button"
            onClick={() => onPick(color.id)}
            className="flex w-full items-center gap-2 rounded-field border border-line px-2 py-1.5 text-left text-xs hover:border-ink"
          >
            <FilamentChip hexes={color.hexes} size={18} />
            <span className="truncate">{color.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function RangeField({
  label,
  value,
  display,
  min,
  max,
  step,
  toSlider = (v) => v,
  fromSlider = (v) => v,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  toSlider?: (value: number) => number;
  fromSlider?: (slider: number) => number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="mt-3 text-sm">
      <span className="mb-1 flex justify-between">
        <label htmlFor={id}>{label}</label>
        <span className="tabular-nums text-soft">{display}</span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={toSlider(value)}
        onChange={(e) => onChange(fromSlider(Number(e.target.value)))}
        className="w-full accent-[var(--ink)]"
      />
    </div>
  );
}

/** Champ numérique validé à Entrée ou en quittant le champ (pas à chaque frappe). */
function SizeField({
  label,
  value,
  suffix = "mm",
  format,
  onCommit,
}: {
  label: string;
  value: number;
  suffix?: string;
  format: (value: number, digits?: number) => string;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(format(value, 2));
  const commit = () => {
    const next = Number(text.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(next) && next > 0 && Math.abs(next - value) > 1e-6)
      onCommit(next);
    else setText(format(value, 2));
  };
  return (
    <label className="block min-w-0 flex-1 text-sm">
      <span className="s3d-label mb-1 block text-soft">{label}</span>
      <span className="flex h-10 items-center rounded-field border border-line bg-paper px-2 focus-within:border-ink">
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          className="ph-no-capture min-w-0 flex-1 bg-transparent tabular-nums outline-none"
        />
        <span className="text-xs text-soft">{suffix}</span>
      </span>
    </label>
  );
}

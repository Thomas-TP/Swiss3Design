"use client";

import { Pause, Play } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import styles from "./studio.module.css";

// Vue « Couches » (brief « Strates », §6.7) : la réglette Z verticale, de la
// couche 0 à la dernière, le libellé « Couche 0412 / 0750 · z 82,4 mm · Vert
// Lavaux » et « Simuler » ×1 / ×10 / ×100, qui annonce la durée réelle (« Durée
// réelle ≈ 2 h 45 · à ×100 : 1 min 39 »). La réglette est un `input range`
// natif (flèches, Maj + flèche = dix couches, Début / Fin) ; le libellé est
// sa valeur accessible (`aria-valuetext`). Les boutons de simulation sont
// désactivés en mouvement réduit : la 3D s'y met à jour sans animation, la
// réglette reste le seul moyen de monter dans la pièce.

type Speed = 1 | 10 | 100;
const SPEEDS: readonly Speed[] = [1, 10, 100];

export function LayerSlider({
  layer,
  total,
  readout,
  label,
  onChange,
  onCommit,
  className,
}: {
  layer: number;
  total: number;
  /** « Couche 0412 / 0750 · z 82,4 mm · Vert Lavaux ». */
  readout: string;
  label: string;
  onChange: (layer: number) => void;
  onCommit: () => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div
      data-no-orbit=""
      className={cx("flex h-full flex-col items-center gap-2", className)}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="range"
        form="studio-local"
        min={0}
        max={total}
        step={1}
        value={layer}
        aria-valuetext={readout}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onKeyDown={(event) => {
          if (!event.shiftKey) return;
          const direction =
            event.key === "ArrowUp" || event.key === "ArrowRight"
              ? 1
              : event.key === "ArrowDown" || event.key === "ArrowLeft"
                ? -1
                : 0;
          if (direction === 0) return;
          // Maj + flèche : dix couches d'un coup.
          event.preventDefault();
          onChange(Math.min(total, Math.max(0, layer + direction * 10)));
        }}
        className={cx(styles.zRange, "min-h-0 flex-1")}
      />
    </div>
  );
}

export function SimulationControls({
  active,
  speed,
  disabled,
  onStart,
  onStop,
  startLabel,
  stopLabel,
  legend,
  speedLabel,
  durationText,
  className,
}: {
  active: boolean;
  speed: Speed | null;
  disabled: boolean;
  onStart: (speed: Speed) => void;
  onStop: () => void;
  startLabel: string;
  stopLabel: string;
  legend: string;
  speedLabel: (speed: Speed) => string;
  /** « Durée réelle ≈ 2 h 45 · à ×100 : 1 min 39 ». */
  durationText: string;
  className?: string;
}) {
  return (
    <div
      data-no-orbit=""
      className={cx(
        "flex flex-col gap-2 rounded-card bg-paper/85 p-2.5 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="s3d-label text-soft">{legend}</span>
        {SPEEDS.map((value) => (
          <Button
            key={value}
            variant={active && speed === value ? "ink" : "secondary"}
            size="sm"
            disabled={disabled}
            aria-pressed={active && speed === value}
            aria-label={`${startLabel} ${speedLabel(value)}`}
            onClick={() => onStart(value)}
          >
            <Play size={14} strokeWidth={1.5} aria-hidden="true" />
            {speedLabel(value)}
          </Button>
        ))}
        {active ? (
          <Button variant="ghost" size="sm" onClick={onStop}>
            <Pause size={14} strokeWidth={1.5} aria-hidden="true" />
            {stopLabel}
          </Button>
        ) : null}
      </div>
      <p className="s3d-label ph-no-capture normal-case text-ink">
        {durationText}
      </p>
    </div>
  );
}

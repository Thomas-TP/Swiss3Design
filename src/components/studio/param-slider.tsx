"use client";

import { useState } from "react";
import { clampRange, type Range } from "@/lib/studio/ranges";
import { cx } from "@/components/ui/cx";
import { fieldClass } from "@/components/ui/field";
import styles from "./studio.module.css";

// Curseur natif couplé à un champ numérique avec unité (brief « Strates », §6.2 :
// « `range` couplé à un `number` avec unité », « Maj + flèche = ×10 »). Les deux
// contrôles sont de VRAIS éléments natifs : le clavier, les lecteurs d'écran
// (`aria-valuetext` en unités) et le formulaire GET sans JavaScript en héritent.
//
//  - Le champ numérique porte le nom court de la clé (`h`, `gs`…) : c'est lui
//    qui part dans la requête GET sans JavaScript, et lui qui permet la saisie
//    exacte. Le curseur n'a pas de nom (un doublon fausserait la requête) et
//    reste masqué tant que JavaScript n'a pas pris la main (sans JS, un curseur
//    qui bouge sans rien changer tromperait).
//  - Pendant un glissé, `onChange` met à jour l'état ; `onCommit` (relâchement,
//    sortie de champ, touche levée) termine le geste : un état d'historique par
//    geste (history.ts).
//  - La saisie au clavier garde un brouillon : « 1 » tapé vers « 150 » ne doit
//    pas être ramené tout de suite à la borne basse (80).

export interface ParamSliderProps {
  id: string;
  /** Clé courte de l'URL (`h`, `d`, `gs`…) : nom du champ numérique. */
  name: string;
  label: string;
  value: number;
  range: Pick<Range, "min" | "max" | "step">;
  /** Unité affichée après le nombre (« mm », « % », « ° ») ; vide : sans unité. */
  unit?: string;
  /** Texte lu par les lecteurs d'écran pour la valeur courante. */
  valueText?: (value: number) => string;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
  className?: string;
}

export function decimalsOf(step: number): number {
  return Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
}

const fixed = (value: number, decimals: number) =>
  String(Number(value.toFixed(decimals)));

export function ParamSlider({
  id,
  name,
  label,
  value,
  range,
  unit,
  valueText,
  hint,
  disabled,
  onChange,
  onCommit,
  className,
}: ParamSliderProps) {
  const decimals = decimalsOf(range.step);
  const [draft, setDraft] = useState<string | null>(null);
  const hintId = hint ? `${id}-hint` : undefined;
  const clamp = (v: number) => clampRange(v, { ...range, default: value });
  const shown = Math.min(Math.max(value, range.min), range.max);

  function applyDraft() {
    if (draft === null) return;
    const parsed = Number(draft.replace(",", "."));
    setDraft(null);
    if (!Number.isFinite(parsed) || draft.trim() === "") return;
    const next = clamp(parsed);
    if (next !== value) onChange(next);
    onCommit();
  }

  function onRangeKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!event.shiftKey) return;
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -1
          : 0;
    if (direction === 0) return;
    // Maj + flèche : dix pas d'un coup (le navigateur n'en fait qu'un).
    event.preventDefault();
    const next = clamp(value + direction * 10 * range.step);
    if (next !== value) onChange(next);
    onCommit();
  }

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="s3d-label text-soft">
        {label}
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4">
        <input
          type="range"
          // UI seulement : jamais dans la requête GET (le champ numérique part).
          form="studio-local"
          id={`${id}-range`}
          // Même nom accessible que le champ numérique (htmlFor) : un seul
          // libellé visible, répété ici pour les lecteurs d'écran.
          aria-label={label}
          aria-valuetext={valueText?.(shown)}
          aria-describedby={hintId}
          min={range.min}
          max={range.max}
          step={range.step}
          value={shown}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
          onBlur={onCommit}
          onKeyDown={onRangeKeyDown}
          className={cx(
            styles.range,
            // Masqué sans JavaScript : place gardée, aucun saut de mise en page.
            "invisible group-data-[js]/studio:visible",
          )}
        />
        <span className="flex items-center gap-2">
          <input
            id={id}
            name={name}
            type="number"
            inputMode="decimal"
            min={range.min}
            max={range.max}
            step={range.step}
            value={draft ?? fixed(value, decimals)}
            disabled={disabled}
            aria-describedby={hintId}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={applyDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                // Entrée valide la valeur sans envoyer le formulaire GET.
                event.preventDefault();
                applyDraft();
              } else if (event.key === "Escape") setDraft(null);
            }}
            className={cx(fieldClass, "s3d-num w-[6.75rem] py-2 text-right")}
          />
          {unit ? (
            <span className="s3d-label w-6 normal-case text-soft" aria-hidden>
              {unit}
            </span>
          ) : null}
        </span>
      </div>
      {hint ? (
        <p id={hintId} className="text-sm text-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

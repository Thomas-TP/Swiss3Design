"use client";

import { useRef, useState } from "react";
import { FilamentChip } from "@/components/filament-chip";
import { ActionForm, SubmitButton } from "./action-form";
import { weighMany } from "./actions";

// Pesée rapide : le poids brut lu sur la balance, la page calcule le restant
// (brut − tare). Entrée passe à la bobine suivante ; « Enregistrer » écrit toutes
// les pesées saisies, chacune comme un mouvement daté. La tare n'est envoyée que
// si elle a été modifiée ici (et elle devient alors « vérifiée »).

export interface WeighRow {
  id: string;
  label: string;
  hexes: string[];
  typeLabel: string;
  location: string;
  tare: number;
  remaining: number;
  initial: number;
}

export function QuickWeigh({ rows }: { rows: WeighRow[] }) {
  const [gross, setGross] = useState<Record<string, string>>({});
  const [tare, setTare] = useState<Record<string, string>>({});
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  if (rows.length === 0)
    return <p className="text-sm text-soft">Aucune bobine en stock à peser.</p>;

  return (
    <ActionForm action={weighMany} className="space-y-4">
      <ul className="overflow-hidden rounded-card border border-line bg-surface">
        {rows.map((row, index) => {
          const g = gross[row.id];
          const t = tare[row.id] ?? String(row.tare);
          const tareChanged = t !== String(row.tare) && t !== "";
          const grossNumber = Number(String(g ?? "").replace(",", "."));
          const known =
            g !== undefined && g !== "" && Number.isFinite(grossNumber);
          const remaining = known
            ? Math.max(0, Math.round(grossNumber) - Math.round(Number(t) || 0))
            : null;
          const delta = remaining === null ? null : remaining - row.remaining;
          return (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-sm first:border-t-0"
            >
              <FilamentChip hexes={row.hexes} size={22} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{row.label}</p>
                <p className="text-xs text-soft">
                  {row.typeLabel} · {row.location} · actuel {row.remaining} g
                </p>
              </div>
              <label className="text-xs text-soft">
                Tare
                <input
                  inputMode="numeric"
                  value={t}
                  onChange={(e) =>
                    setTare((s) => ({ ...s, [row.id]: e.target.value }))
                  }
                  className="ml-1.5 w-16 rounded-lg border border-line bg-surface px-2 py-1 text-sm tabular-nums"
                />
              </label>
              {tareChanged ? (
                <input type="hidden" name={`tare:${row.id}`} value={t} />
              ) : null}
              <label className="text-xs text-soft">
                Brut (g)
                <input
                  ref={(el) => {
                    inputs.current[index] = el;
                  }}
                  name={`gross:${row.id}`}
                  inputMode="decimal"
                  value={g ?? ""}
                  onChange={(e) =>
                    setGross((s) => ({ ...s, [row.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    inputs.current[index + 1]?.focus();
                  }}
                  className="ml-1.5 w-24 rounded-lg border border-line bg-surface px-2 py-1 text-sm tabular-nums"
                />
              </label>
              <p
                className="w-32 text-right text-sm tabular-nums"
                aria-live="polite"
              >
                {remaining === null ? (
                  <span className="text-soft">—</span>
                ) : (
                  <>
                    <strong>{remaining} g</strong>{" "}
                    <span
                      className={delta! < 0 ? "text-accent-text" : "text-soft"}
                    >
                      ({delta! > 0 ? "+" : ""}
                      {delta})
                    </span>
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ul>
      <SubmitButton>Enregistrer les pesées</SubmitButton>
    </ActionForm>
  );
}

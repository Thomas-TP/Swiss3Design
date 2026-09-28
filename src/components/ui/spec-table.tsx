import type { ReactNode } from "react";
import { cx } from "./cx";

// Fiche technique (brief « Strates », §7.9 chapitre 03, Studio, Atelier) :
// un <dl> SSR à filets, terme en étiquette mono, valeur en chiffres
// tabulaires. L'unité réelle d'abord (« Hauteur 209 mm »), jamais une valeur
// décorative (§1.2, principe 3). Filets `line` : un tableau de specs est l'un
// des rares endroits où ils sont permis (§2.3).

export interface SpecRow {
  term: ReactNode;
  value: ReactNode;
}

export function SpecTable({
  rows,
  className,
}: {
  rows: SpecRow[];
  className?: string;
}) {
  return (
    <dl className={cx("divide-y divide-line border-y border-line", className)}>
      {rows.map((row, index) => (
        <div
          // Lignes statiques d'une fiche : l'ordre ne change jamais.
          key={index}
          className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-baseline gap-4 py-3"
        >
          <dt className="s3d-label text-soft">{row.term}</dt>
          <dd className="s3d-num text-sm text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

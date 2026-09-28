import { useLocale } from "next-intl";
import { cx } from "./cx";

// Réglette graduée en SVG (brief « Strates », §6.7 barre altimétrique et
// réglette Z du Studio, héros mobile) : repère tous les `minor` mm, trait
// majeur tous les `major`, cote tous les `labelEvery` (« tous les 10 mm, cote
// tous les 50 mm »). Z vers le haut : en vertical, 0 est EN BAS, comme sur le
// plateau. Positions en pourcentages du SVG (sans viewBox) : la réglette
// s'étire à la taille de son parent sans déformer ni les traits ni les cotes.
// Décorative (aria-hidden) : la valeur accessible vit dans le curseur natif
// qu'elle accompagne (aria-valuetext en unités, §6.10). Couleurs par jetons :
// juste dans les deux thèmes et dans un chapitre « encre ».

const MAX_TICKS = 400;

type Orientation = "horizontal" | "vertical";

function ticks(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  // Pas entiers pour éviter l'accumulation d'erreurs flottantes (0,1 + 0,2…).
  const count = Math.floor((to - from) / step + 1e-9);
  for (let i = 0; i <= count; i++) out.push(from + i * step);
  return out;
}

const isMultiple = (value: number, step: number) =>
  Math.abs(value / step - Math.round(value / step)) < 1e-6;

export function Ruler({
  from = 0,
  to,
  minor = 1,
  major = 10,
  labelEvery = 50,
  orientation = "horizontal",
  className,
}: {
  from?: number;
  to: number;
  minor?: number;
  major?: number;
  labelEvery?: number;
  orientation?: Orientation;
  className?: string;
}) {
  const locale = useLocale();
  const span = to - from;
  if (!(span > 0) || !(minor > 0)) return null;
  // Trop de repères pour la place : on garde les majeurs seulement.
  const step = span / minor > MAX_TICKS ? major : minor;
  const format = new Intl.NumberFormat(`${locale}-CH`, {
    maximumFractionDigits: 1,
  });
  const vertical = orientation === "vertical";
  const values = ticks(from, to, step);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={vertical ? 44 : "100%"}
      height={vertical ? "100%" : 30}
      className={cx("block overflow-visible", className)}
      shapeRendering="crispEdges"
    >
      {values.map((value) => {
        const pct = ((value - from) / span) * 100;
        const labelled = isMultiple(value, labelEvery);
        const isMajor = labelled || isMultiple(value, major);
        const length = labelled ? 12 : isMajor ? 8 : 4;
        const stroke = isMajor ? "var(--color-iso-index)" : "var(--color-iso)";
        const at = vertical ? `${100 - pct}%` : `${pct}%`;
        return vertical ? (
          <line
            key={value}
            x1={0}
            x2={length}
            y1={at}
            y2={at}
            stroke={stroke}
            strokeWidth={1}
          />
        ) : (
          <line
            key={value}
            x1={at}
            x2={at}
            y1={0}
            y2={length}
            stroke={stroke}
            strokeWidth={1}
          />
        );
      })}
      {values
        .filter((value) => isMultiple(value, labelEvery))
        .map((value) => {
          const pct = ((value - from) / span) * 100;
          const anchor = pct <= 0 ? "start" : pct >= 100 ? "end" : "middle";
          return (
            <text
              key={`t${value}`}
              x={vertical ? 16 : `${pct}%`}
              y={vertical ? `${100 - pct}%` : 27}
              textAnchor={vertical ? "start" : anchor}
              dominantBaseline={vertical ? "middle" : "auto"}
              fill="var(--color-soft)"
              fontFamily="var(--font-mono)"
              fontSize={12}
              style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
            >
              {format.format(value)}
            </text>
          );
        })}
    </svg>
  );
}

import { formatDuration, formatGrams, formatNumber } from "@/lib/studio/format";

// Les chiffres d'un objet du Studio sous forme d'éléments de bande de mesure
// (brief « Strates », motif M3) : dimensions, masse, durée, changements. Module
// léger (aucune bibliothèque du Studio, seulement des types) : le serveur
// l'utilise pour les cartes du chapitre 03, le client pour le chapitre 02 quand
// le visiteur tape son sommet. Les mots viennent de `studioCore.units`, traduits
// par l'appelant.
import type { StudioStats } from "@/lib/studio/types";

export type StatsFigures = Pick<
  StudioStats,
  "widthMm" | "depthMm" | "heightMm" | "grams" | "minutes" | "changes"
>;

export type UnitsTranslator = (
  key: "dimensions" | "changes",
  values: Record<string, string | number>,
) => string;

export function statsItems(
  stats: StatsFigures,
  locale: string,
  units: UnitsTranslator,
): string[] {
  // Une décimale seulement quand elle compte (« 100 », « 6,2 »).
  const mm = (value: number) =>
    formatNumber(value, locale, Number.isInteger(value) ? 0 : 1);
  return [
    units("dimensions", {
      width: mm(stats.widthMm),
      depth: mm(stats.depthMm),
      height: mm(stats.heightMm),
    }),
    `≈ ${formatGrams(stats.grams, locale)}`,
    `≈ ${formatDuration(stats.minutes, locale)}`,
    units("changes", { count: stats.changes }),
  ];
}

// Résumé d'une ligne du Studio (panier, récapitulatif, commande, admin) : le
// nom de l'objet, ses dimensions, ses couleurs (le filament et sa teinte exacte)
// et les textes à imprimer. Pur et testé : les mots viennent des messages par
// les fonctions de traduction passées en argument (`studio`, `studioCore`), les
// chiffres de `computeStats` (jamais recopiés).
//
// `name` (« Vase Lavaux · H 180 mm · Ø 90 mm ») ne contient JAMAIS un texte
// saisi : c'est le libellé qui part dans `order_items.name_snapshot`, donc dans
// les e-mails, le suivi, les agents et les mesures d'audience. Les textes
// saisis ne sont que dans `texts`, que l'écran masque (`ph-mask`).
import { filamentHex } from "@/lib/studio/filaments";
import type { FilamentId } from "@/lib/studio/types";
import {
  mm,
  num,
  objectName,
  plain,
  type SummaryInput,
  type Translate,
} from "./summary";
import { printedTexts } from "./objects";

export interface LineSummary {
  /** « Vase Lavaux », « Carte de visite Cartouche »… */
  objectName: string;
  /** « H 180 mm · Ø 90 mm » ou « 85 × 55 × 2,2 mm ». */
  dimensions: string;
  /** Libellé sans texte saisi : objet et dimensions. */
  name: string;
  /** Filaments du bas vers le haut, sans doublon, avec leur teinte exacte. */
  colors: { id: FilamentId; name: string; hex: string }[];
  /** Textes à imprimer, avec le nom de leur champ. */
  texts: { label: string; value: string }[];
}

const FIELD_KEYS = {
  name: "quote.field.name",
  role: "quote.field.role",
  line1: "quote.field.line1",
  line2: "quote.field.line2",
  peak: "quote.field.peak",
  text: "quote.field.text",
} as const;

export function lineDimensions(input: SummaryInput): string {
  const { config, stats, core, locale } = input;
  if (config.object === "lavaux")
    return `H ${mm(stats.heightMm, locale)} · Ø ${mm(stats.widthMm, locale)}`;
  return plain(
    core("units.dimensions", {
      width: num(stats.widthMm, locale),
      depth: num(stats.depthMm, locale),
      height: num(stats.heightMm, locale),
    }),
  );
}

/**
 * Libellé d'une ligne SANS texte saisi (« Vase Lavaux · H 180 mm · Ø 90 mm ») : c'est
 * ce qui part dans `order_items.name_snapshot`. Ne lit que la configuration, les
 * chiffres et les messages d'objet : le serveur peut l'appeler sans calculer les bandes.
 */
export function lineName(
  input: Pick<SummaryInput, "config" | "stats" | "core" | "locale">,
): string {
  return `${input.core(`objects.${input.config.object}.name`)} · ${lineDimensions(input as SummaryInput)}`;
}

export function lineSummary(input: SummaryInput): LineSummary {
  const { core, t, config, texts, bands } = input;
  const colors: LineSummary["colors"] = [];
  for (const band of bands.bands) {
    if (colors.some((c) => c.id === band.filament)) continue;
    colors.push({
      id: band.filament,
      name: core(`filaments.${band.filament}`),
      hex: filamentHex(band.filament),
    });
  }
  const dimensions = lineDimensions(input);
  const object = objectName(input);
  return {
    objectName: object,
    dimensions,
    name: `${object} · ${dimensions}`,
    colors,
    texts: printedTexts(config, texts).map((item) => ({
      label: (t as Translate)(FIELD_KEYS[item.field]),
      value: item.value,
    })),
  };
}

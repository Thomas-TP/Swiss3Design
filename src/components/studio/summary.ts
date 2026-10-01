// Textes calculés du Studio (brief « Strates », §6.9, §6.10) : le résumé vivant
// lu par les lecteurs d'écran, et la demande de devis (description, couleurs,
// dimensions) écrite dans la langue du client. Fonctions pures et testées
// (summary.test.ts) : les mots viennent des messages (`studio`, `studioCore`)
// par les fonctions de traduction passées en argument, les chiffres des
// formats de la Suisse (`format.ts`), jamais d'un nombre collé à la main.
//
// La demande de devis est la SEULE sortie qui porte le texte saisi (nom,
// fonction, contact, sommet) : elle part dans la Server Action de devis
// (finalité déclarée), jamais dans une URL ni un événement.
import type { BandSummary } from "@/lib/studio/band-stats";
import {
  formatChfRange,
  formatDuration,
  formatGrams,
  formatMm,
  formatNumber,
} from "@/lib/studio/format";
import { machineLine } from "@/lib/studio/url-state";
import type {
  LavauxPattern,
  StudioConfig,
  StudioStats,
  StudioTexts,
} from "@/lib/studio/types";
import { printedTexts } from "./objects";

export type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

const SPACES = /[  ]/g;

/** Espaces insécables → espaces ordinaires (texte brut d'un e-mail). */
export const plain = (text: string) => text.replace(SPACES, " ");

/** Entier si la valeur est ronde, sinon une décimale : « 42 », « 42,4 ». */
export function num(value: number, locale: string): string {
  const whole = Math.abs(value - Math.round(value)) < 1e-9;
  return formatNumber(value, locale, whole ? 0 : 1);
}

/** « 42 mm » / « 42,4 mm ». */
export function mm(value: number, locale: string): string {
  const whole = Math.abs(value - Math.round(value)) < 1e-9;
  return formatMm(value, locale, whole ? 0 : 1);
}

export interface SummaryInput {
  config: StudioConfig;
  texts: StudioTexts;
  stats: StudioStats;
  bands: BandSummary;
  locale: string;
  /** Messages du namespace `studio`. */
  t: Translate;
  /** Messages du namespace `studioCore`. */
  core: Translate;
}

export function objectName({ core, config }: SummaryInput): string {
  return core(`objects.${config.object}.name`);
}

function filamentName(core: Translate, id: string): string {
  return core(`filaments.${id}`);
}

/** « Bleu Léman, Vert Lavaux, Blanc névé » (noms seulement, sans doublon, du bas vers le haut). */
export function colorNames(input: SummaryInput): string[] {
  const names: string[] = [];
  for (const band of input.bands.bands) {
    const name = filamentName(input.core, band.filament);
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/** `colors` du devis : « Bleu Léman 0–42 mm · Vert Lavaux 42–108 mm · … » (≤ 200 caractères). */
export function quoteColors(input: SummaryInput): string {
  const { core, locale, bands } = input;
  return plain(
    bands.bands
      .map((band) =>
        core("bands.range", {
          filament: filamentName(core, band.filament),
          from: num(band.fromMm, locale),
          to: mm(band.toMm, locale),
        }),
      )
      .join(" · "),
  ).slice(0, 200);
}

/** `dimensions` du devis : « 96 × 96 × 150 mm ». */
export function quoteDimensions(input: SummaryInput): string {
  const { core, locale, stats } = input;
  return plain(
    core("units.dimensions", {
      width: num(stats.widthMm, locale),
      depth: num(stats.depthMm, locale),
      height: num(stats.heightMm, locale),
    }),
  ).slice(0, 200);
}

// ── Bande de mesure (§6.7) ───────────────────────────────────────────────────

/**
 * « H 150,0 mm · Ø 96,0 mm · 750 couches · ≈ 92 g · ≈ 3 h 01 · 2 changements ·
 * purge ≈ 1,6 g · Prix confirmé sous 48 h » : chaque élément est calculé par
 * `computeStats` (jamais recopié), le prix n'apparaît que si le barème est
 * validé (`stats.estimate`), sinon la mention « Prix confirmé sous 48 h ».
 */
export function measureItems({
  config,
  stats,
  locale,
  core,
  t,
}: Pick<SummaryInput, "config" | "stats" | "locale" | "core" | "t">): string[] {
  const items: string[] = [];
  if (config.object === "lavaux") {
    items.push(`H ${formatMm(stats.heightMm, locale, 1)}`);
    items.push(`Ø ${formatMm(stats.widthMm, locale, 1)}`);
  } else {
    items.push(
      core("units.dimensions", {
        width: num(stats.widthMm, locale),
        depth: num(stats.depthMm, locale),
        height: num(stats.heightMm, locale),
      }),
    );
  }
  items.push(core("units.layers", { count: stats.layers }));
  items.push(`≈ ${formatGrams(stats.grams, locale)}`);
  items.push(`≈ ${formatDuration(stats.minutes, locale)}`);
  items.push(core("units.changes", { count: stats.changes }));
  if (stats.changes > 0)
    items.push(
      `${t("measure.purge")} ≈ ${formatGrams(stats.purgeGrams, locale)}`,
    );
  items.push(
    stats.estimate
      ? formatChfRange(stats.estimate.lowCents, stats.estimate.highCents, locale)
      : core("measure.priceLater"),
  );
  return items;
}

// ── Résumé des réglages (une phrase par objet) ───────────────────────────────

function patternText(input: SummaryInput, pattern: LavauxPattern): string {
  const { t, core, locale } = input;
  const name = core(`patterns.${pattern.kind}`);
  switch (pattern.kind) {
    case "lisse":
      return t("quote.pattern.lisse", { name });
    case "gradins":
      return t("quote.pattern.gradins", {
        name,
        step: mm(pattern.step, locale),
        depth: mm(pattern.depth, locale),
      });
    case "vagues":
      return t("quote.pattern.vagues", {
        name,
        wavelength: mm(pattern.wavelength, locale),
        amplitude: mm(pattern.amplitude, locale),
        lobes: pattern.lobes,
      });
    case "voronoi":
      return t("quote.pattern.voronoi", {
        name,
        cells: pattern.cells,
        relief: mm(pattern.relief, locale),
        seed: pattern.seed,
      });
    case "nervures":
      return t("quote.pattern.nervures", {
        name,
        count: pattern.count,
        depth: mm(pattern.depth, locale),
        twist: num(pattern.twistDeg, locale),
      });
  }
}

/** Phrase de réglages propre à l'objet (sans texte saisi) : motif du vase, mode de la carte… */
export function settingsLine(input: SummaryInput): string {
  const { config, t, core, locale } = input;
  switch (config.object) {
    case "lavaux":
      return t("quote.settings.lavaux", {
        pattern: patternText(input, config.pattern),
      });
    case "cartouche":
      return t("quote.settings.cartouche", {
        mode: core(`options.mode.${config.mode}`),
        depth: mm(config.depth, locale),
        layout: core(`options.layout.${config.layout}`),
        corner: mm(config.corner, locale),
      });
    case "relief":
      return t("quote.settings.relief", {
        levels: config.levels,
        lake: num(config.lake, locale),
        seed: config.seed,
        label: t(config.label ? "quote.yes" : "quote.no"),
      });
    case "borne":
      return t("quote.settings.borne", {
        shape: core(`options.shape.${config.shape}`),
        cap: mm(config.cap, locale),
        ring: core(`options.ring.${config.ring}`),
        mode: core(`options.mode.${config.mode}`),
      });
  }
}

/** Fragment de la ligne « Dimensions » propre à l'objet (paroi et profil, épaisseur…). */
export function detailLine(input: SummaryInput): string {
  const { config, t, core, locale } = input;
  switch (config.object) {
    case "lavaux":
      return t("quote.detail.lavaux", {
        wall: mm(config.wall, locale),
        profile: core(`profiles.${config.profile}`),
      });
    case "cartouche":
      return t("quote.detail.cartouche", {
        thickness: mm(config.thickness, locale),
      });
    case "relief":
      return t("quote.detail.relief", {
        base: mm(config.base, locale),
        relief: mm(config.relief, locale),
        shape: core(`options.shape.${config.shape}`),
      });
    case "borne":
      return t("quote.detail.borne", {
        thickness: mm(config.thickness, locale),
      });
  }
}

// ── Résumé vivant (aria-live) ────────────────────────────────────────────────

/**
 * « Vase Lavaux, 150 mm, gradins, 3 couleurs : Bleu Léman, Vert Lavaux,
 * Blanc névé ; imprimable » (§6.10). Pour les objets à texte, le texte saisi y
 * figure : l'élément qui l'affiche porte `.ph-mask` (voir `summaryHasText`).
 */
export function liveSummary(input: SummaryInput): string {
  const { config, t, core, locale, stats, texts } = input;
  const names = colorNames(input);
  const status = core(`guard.status.${stats.printable.status}`);
  const common = {
    name: objectName(input),
    count: names.length,
    colors: names.join(", "),
    status,
  };
  if (config.object === "lavaux") {
    return t("summary.lavaux", {
      ...common,
      height: mm(stats.heightMm, locale),
      pattern: core(`patterns.${config.pattern.kind}`),
    });
  }
  const printed = printedTexts(config, texts)
    .map((item) => `« ${item.value} »`)
    .join(" ");
  return t("summary.flat", {
    ...common,
    dimensions: core("units.dimensions", {
      width: num(stats.widthMm, locale),
      depth: num(stats.depthMm, locale),
      height: num(stats.heightMm, locale),
    }),
    text: printed || t("quote.none"),
  });
}

/** Vrai si le résumé vivant contient un texte saisi (il porte alors `.ph-mask`). */
export function summaryHasText(config: StudioConfig, texts: StudioTexts) {
  return config.object !== "lavaux" && printedTexts(config, texts).length > 0;
}

// ── Demande de devis (§6.9, point 4) ─────────────────────────────────────────

const TEXT_FIELD_KEYS = {
  name: "quote.field.name",
  role: "quote.field.role",
  line1: "quote.field.line1",
  line2: "quote.field.line2",
  peak: "quote.field.peak",
  text: "quote.field.text",
} as const;

/** Ligne de la demande avec les textes à imprimer, ou « — ». */
export function textsLine(input: SummaryInput): string {
  const { t, config, texts } = input;
  const items = printedTexts(config, texts);
  return items.length > 0
    ? items
        .map((item) =>
          t("quote.textItem", {
            label: t(TEXT_FIELD_KEYS[item.field]),
            value: item.value,
          }),
        )
        .join(" · ")
    : t("quote.none");
}

export interface QuoteExtras {
  /** Lien de configuration, SANS texte personnel (fragment #c= seulement). */
  link: string;
  quantity: number;
  remark: string;
}

/**
 * Description de la demande (≤ 4000 caractères) : résumé lisible dans la
 * langue du client, puis la ligne « machine » exacte de la configuration.
 */
export function quoteDescription(
  input: SummaryInput,
  extras: QuoteExtras,
): string {
  const { t, core, locale, stats, bands, config } = input;
  const detail = plain(detailLine(input));
  const bandLines = bands.bands
    .map((band) =>
      plain(
        t("quote.bandItem", {
          filament: filamentName(core, band.filament),
          from: num(band.fromMm, locale),
          to: mm(band.toMm, locale),
          firstLayer: band.fromLayer,
          lastLayer: band.toLayer,
        }),
      ),
    )
    .join(" · ");
  const price = stats.estimate
    ? ` · ${formatChfRange(stats.estimate.lowCents, stats.estimate.highCents, locale)} (${t("quote.indicative")})`
    : "";
  const shown = plain(
    [
      `≈ ${formatGrams(stats.grams, locale)}`,
      `≈ ${formatDuration(stats.minutes, locale)}`,
      core("units.changes", { count: stats.changes }),
    ].join(" · "),
  );
  const lines = [
    plain(t("quote.title", { object: objectName(input) })),
    plain(t("quote.link", { link: extras.link })),
    plain(
      t("quote.dimensions", {
        dimensions: quoteDimensions(input),
        layers: core("units.layers", { count: stats.layers }),
        detail,
      }),
    ),
    plain(settingsLine(input)),
    plain(t("quote.colors", { colors: bandLines })),
    plain(t("quote.estimate", { figures: shown })) + price,
    plain(t("quote.texts", { texts: textsLine(input) })),
    plain(t("quote.quantity", { count: extras.quantity })),
    plain(
      t("quote.remark", {
        remark: extras.remark.trim() ? extras.remark.trim() : t("quote.none"),
      }),
    ),
    machineLine(config),
  ];
  return lines.join("\n").slice(0, 4000);
}

// Outil WebMCP `studio_configure` (brief « Strates », §6.13) : construit un
// lien de Studio partageable pour l'un des quatre objets de l'atelier et rend
// ses chiffres. Logique pure et testée (configure-tool.test.ts) ; le
// composant WebMcpTools ne fait que l'enregistrer.
//
// Les textes personnels (noms, contacts) ne sont JAMAIS acceptés ici : une
// clé de texte est refusée, pas ignorée ; l'humain les saisit sur la page. Le
// lien ne porte que la configuration (fragment #c=…), exactement ce que fait
// « Copier le lien ».
import { FILAMENT_IDS, isFilamentId } from "@/lib/studio/filaments";
import { PRICING } from "@/lib/studio/pricing-params";
import { bandsForPalette, defaultConfig } from "@/lib/studio/presets";
import {
  BORNE_RANGES,
  CARTOUCHE_RANGES,
  LAVAUX_RANGES,
  MAX_BANDS,
  RELIEF_RANGES,
  clampConfig,
  clampRange,
  snapReliefBands,
  type Range,
} from "@/lib/studio/ranges";
import { computeStats } from "@/lib/studio/stats";
import { DEFAULT_TEXTS } from "@/lib/studio/text/fields";
import {
  isStudioObjectId,
  type FilamentId,
  type StudioConfig,
  type StudioObjectId,
} from "@/lib/studio/types";
import {
  TEXT_KEYS,
  configFragment,
  decodeSearchParams,
} from "@/lib/studio/url-state";

export const STUDIO_TOOL_OBJECTS: readonly StudioObjectId[] = [
  "lavaux",
  "cartouche",
  "relief",
  "borne",
];

export type ConfigureResult =
  | { ok: true; config: StudioConfig; ignored: string[] }
  | { ok: false; error: string };

/**
 * Plage de chaque clé numérique du lien, par objet : une valeur hors plage est
 * ramenée à la plage (« clamped to valid ranges », §6.13) au lieu d'être
 * refusée par le schéma de lecture du fragment.
 */
const L = LAVAUX_RANGES;
const NUMERIC_RANGES: Record<StudioObjectId, Record<string, Range>> = {
  lavaux: {
    h: L.h,
    d: L.d,
    b: L.belly,
    n: L.neck,
    l: L.lip,
    gs: L.gradins.step,
    gd: L.gradins.depth,
    wl: L.vagues.wavelength,
    wa: L.vagues.amplitude,
    wk: L.vagues.lobes,
    vc: L.voronoi.cells,
    va: L.voronoi.relief,
    vs: L.voronoi.seed,
    rn: L.nervures.count,
    ra: L.nervures.depth,
    rt: L.nervures.twistDeg,
  },
  cartouche: {
    t: CARTOUCHE_RANGES.thickness,
    r: CARTOUCHE_RANGES.corner,
    e: CARTOUCHE_RANGES.depth,
  },
  relief: {
    s: RELIEF_RANGES.size,
    ba: RELIEF_RANGES.base,
    re: RELIEF_RANGES.relief,
    lv: RELIEF_RANGES.levels,
    sd: RELIEF_RANGES.seed,
    lk: RELIEF_RANGES.lake,
  },
  borne: {
    c: BORNE_RANGES.cap,
    t: BORNE_RANGES.thickness,
    rd: BORNE_RANGES.ringD,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Valeur d'un paramètre en chaîne GET (nombres, énumérations, booléens du formulaire). */
function asParam(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "string" && value.length <= 200) return value;
  return null;
}

/** Applique la palette (1 à 4 filaments) à l'objet ; refuse un identifiant inconnu. */
function withPalette(
  config: StudioConfig,
  palette: readonly FilamentId[],
): StudioConfig {
  if (palette.length === 0) return config;
  switch (config.object) {
    case "lavaux":
      return { ...config, bands: bandsForPalette(palette, config.h) };
    case "relief": {
      const spread = palette.slice(0, MAX_BANDS).map((filament, k, list) => ({
        filament,
        toMm:
          config.base + (config.relief * (k + 1)) / Math.max(1, list.length),
      }));
      return {
        ...config,
        bands: snapReliefBands(
          spread,
          config.base,
          config.relief,
          config.levels,
        ),
      };
    }
    case "cartouche":
      return {
        ...config,
        plate: palette[0],
        ink: palette[1] ?? config.ink,
      };
    case "borne":
      return {
        ...config,
        base: palette[0],
        ink: palette[1] ?? config.ink,
      };
  }
}

/** Construit la configuration demandée par un agent : bornée, canonique, sans texte. */
export function configureFromTool(
  input: Record<string, unknown>,
): ConfigureResult {
  const object = input.object;
  if (!isStudioObjectId(object))
    return {
      ok: false,
      error: `object must be one of ${STUDIO_TOOL_OBJECTS.join(", ")}`,
    };
  const defaults = defaultConfig(object);

  const raw = input.params;
  if (raw !== undefined && !isRecord(raw))
    return { ok: false, error: "params must be an object" };
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (TEXT_KEYS.includes(key))
      return {
        ok: false,
        error: `"${key}" is personal text: it is never accepted here, the human types it on the page`,
      };
    const param = asParam(value);
    if (param === null)
      return { ok: false, error: `params.${key} must be a number or a string` };
    const range = NUMERIC_RANGES[object][key];
    if (range && /^-?\d+(\.\d+)?$/.test(param))
      query[key] = String(clampRange(Number(param), range));
    else query[key] = param;
  }
  // Les bandes se donnent en liste de filaments (`palette`), jamais en `bd` brut :
  // une clé `bd` est tout de même acceptée si elle est bien formée (« filament:mm,… »).
  const decoded = decodeSearchParams(object, query, defaults);
  if (!decoded.ok)
    return {
      ok: false,
      error: `invalid params (${decoded.error}${decoded.detail ? `: ${decoded.detail}` : ""})`,
    };

  let config = decoded.config;
  if (input.palette !== undefined) {
    if (!Array.isArray(input.palette) || input.palette.length > MAX_BANDS)
      return {
        ok: false,
        error: `palette must list at most ${MAX_BANDS} filament ids`,
      };
    const palette: FilamentId[] = [];
    for (const id of input.palette) {
      if (!isFilamentId(id))
        return {
          ok: false,
          error: `unknown filament "${String(id)}" (${FILAMENT_IDS.join(", ")})`,
        };
      palette.push(id);
    }
    config = withPalette(config, palette);
  }
  return { ok: true, config: clampConfig(config), ignored: decoded.ignored };
}

export interface ConfigureAnswer {
  link: string;
  stats: {
    height_mm: number;
    layers: number;
    grams: number;
    minutes: number;
    changes: number;
    estimate_chf?: { low: number; high: number };
  };
  printable: "ok" | "warn" | "error";
  issues: string[];
  note: string;
}

/**
 * Réponse de l'outil : lien (avec la langue), chiffres de `computeStats`
 * calculés avec les textes d'EXEMPLE (l'agent n'en connaît aucun), imprimabilité.
 */
export function describeConfiguration(
  config: StudioConfig,
  origin: string,
  locale: string,
): ConfigureAnswer {
  const stats = computeStats(
    config,
    DEFAULT_TEXTS[config.object],
    PRICING,
    locale as "fr" | "de" | "it" | "en",
  );
  const issues =
    stats.printable.status === "ok"
      ? []
      : stats.printable.issues.map((issue) => issue.code);
  return {
    link: `${origin}/${locale}/studio/${config.object}${configFragment(config)}`,
    stats: {
      height_mm: stats.heightMm,
      layers: stats.layers,
      grams: stats.grams,
      minutes: stats.minutes,
      changes: stats.changes,
      ...(stats.estimate
        ? {
            estimate_chf: {
              low: stats.estimate.lowCents / 100,
              high: stats.estimate.highCents / 100,
            },
          }
        : {}),
    },
    printable: stats.printable.status,
    issues,
    note: "Open the link to customise the object in 3D and add any text yourself; the workshop reviews every request and answers within 48 hours with a firm price. Texts are never part of the link.",
  };
}

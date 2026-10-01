// Paramètres GET du formulaire sans JavaScript (brief « Strates », §6.8 et §6.12).
//
// Sans JavaScript, le visiteur change UN champ (la hauteur du vase, l'épaisseur
// des strates du sous-verre) et valide : les bandes, elles, restent celles de
// la page précédente (`bd`), et ne tombent plus sur la nouvelle hauteur. Le
// décodeur strict refuserait la requête et la page repartirait des réglages
// par défaut, en silence : le changement demandé serait perdu. Avec JavaScript,
// `clampConfig` fait ce travail à chaque geste ; ici, les mêmes fonctions du
// noyau (`normalizeBands`, `snapReliefBands`) ramènent les bandes à la forme
// annoncée avant le décodage. Une requête qui reste illisible donne toujours
// les réglages par défaut et un mot (« Ce lien n'est pas lisible »).
import {
  LAVAUX_RANGES,
  RELIEF_RANGES,
  clampRange,
  normalizeBands,
  snapReliefBands,
} from "@/lib/studio/ranges";
import type { Band, FilamentId, StudioObjectId } from "@/lib/studio/types";

type Query = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function numberOf(value: string | string[] | undefined): number | null {
  const raw = first(value);
  if (raw === undefined || !/^-?\d+(\.\d+)?$/.test(raw)) return null;
  return Number(raw);
}

/** « filament:hauteur,… » en liste de bandes ; null si la liste est illisible. */
function parseBands(raw: string): Band[] | null {
  const out: Band[] = [];
  for (const part of raw.split(",")) {
    const [filament, z, ...rest] = part.split(":");
    const toMm = Number(z);
    if (!filament || rest.length > 0 || !z || !Number.isFinite(toMm))
      return null;
    out.push({ filament: filament as FilamentId, toMm });
  }
  return out.length > 0 ? out : null;
}

function formatBands(bands: readonly Band[]): string {
  return bands
    .map((band) => `${band.filament}:${Number(band.toMm.toFixed(1))}`)
    .join(",");
}

/**
 * Ramène `bd` à la géométrie annoncée par le reste de la requête (hauteur du
 * vase, strates du sous-verre). Sans `bd`, ou avec une valeur illisible, ou
 * pour les objets sans bandes : la requête est rendue telle quelle.
 */
export function adaptBandsParam(object: StudioObjectId, query: Query): Query {
  const raw = first(query.bd);
  if (raw === undefined) return query;
  const bands = parseBands(raw);
  if (!bands) return query;
  if (object === "lavaux") {
    const h = numberOf(query.h);
    if (h === null) return query;
    const next = normalizeBands(bands, clampRange(h, LAVAUX_RANGES.h));
    return { ...query, bd: formatBands(next) };
  }
  if (object === "relief") {
    const base = numberOf(query.ba);
    const relief = numberOf(query.re);
    const levels = numberOf(query.lv);
    if (base === null || relief === null || levels === null) return query;
    const R = RELIEF_RANGES;
    const next = snapReliefBands(
      bands,
      clampRange(base, R.base),
      clampRange(relief, R.relief),
      Math.round(clampRange(levels, R.levels)),
    );
    return { ...query, bd: formatBands(next) };
  }
  return query;
}

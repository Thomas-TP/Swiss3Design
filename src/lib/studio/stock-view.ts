// Quelles couleurs le stock permet-il pour la pièce configurée ? (pur, testé)
// La capacité de chaque couleur vient de `GET /api/stock/colors` : grammes que
// l'atelier peut engager, arrondis à 10 g et plafonnés à 1500 g, jamais le niveau
// exact. Une couleur absente de la réponse n'est pas suivie : elle est disponible.
// Le paiement revérifie toujours côté serveur, avec une lecture fraîche.
import { isShort, type Capacity } from "@/lib/filament/capacity";
import type { BandSummary } from "./band-stats";
import {
  filamentGramsFromSummary,
  needIfAssigned,
  scaleGrams,
} from "./filament-need";
import { FILAMENT_IDS } from "./filaments";
import type { FilamentId, StudioConfig } from "./types";

export { isShort, type Capacity };

export interface StockView {
  /** Couleurs de la pièce actuelle dont le stock ne suffit pas (× quantité). */
  short: ReadonlySet<FilamentId>;
  /** Pastilles à griser pour la bande `index` (vase, Montagne). */
  forBand: (index: number) => ReadonlySet<FilamentId>;
  /** Pastilles à griser pour plaque / encre (Cartouche) ou base / encre (Porte-nom). */
  forRole: (role: "plate" | "ink") => ReadonlySet<FilamentId>;
}

const NONE: ReadonlySet<FilamentId> = new Set();
export const EMPTY_STOCK_VIEW: StockView = {
  short: NONE,
  forBand: () => NONE,
  forRole: () => NONE,
};

/** Indice de la bande d'un rôle dans une pièce plate : relief = plaque puis encre, gravure = encre puis plaque. */
function roleIndex(config: StudioConfig, role: "plate" | "ink"): number | null {
  if (config.object !== "cartouche" && config.object !== "borne") return null;
  const relief = config.mode === "relief";
  return role === "plate" ? (relief ? 0 : 1) : relief ? 1 : 0;
}

export function makeStockView(
  capacity: Capacity | null,
  summary: BandSummary,
  config: StudioConfig,
  quantity: number,
): StockView {
  if (!capacity) return EMPTY_STOCK_VIEW;
  const now = scaleGrams(filamentGramsFromSummary(summary), quantity);
  const short = new Set<FilamentId>();
  for (const [id, grams] of Object.entries(now))
    if (isShort(capacity, id as FilamentId, grams ?? 0))
      short.add(id as FilamentId);

  const cache = new Map<number, ReadonlySet<FilamentId>>();
  const forBand = (index: number): ReadonlySet<FilamentId> => {
    const hit = cache.get(index);
    if (hit) return hit;
    const out = new Set<FilamentId>();
    // Une bande qui n'existe pas (encre sans texte) ne consomme rien : rien à griser.
    if (index >= 0 && index < summary.bands.length)
      for (const id of FILAMENT_IDS)
        if (isShort(capacity, id, needIfAssigned(summary, index, id, quantity)))
          out.add(id);
    cache.set(index, out);
    return out;
  };
  return {
    short,
    forBand,
    forRole: (role) => {
      const index = roleIndex(config, role);
      return index === null ? NONE : forBand(index);
    },
  };
}

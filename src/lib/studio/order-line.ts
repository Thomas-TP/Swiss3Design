// Ce que la commande garde d'une ligne du Studio (`order_items.studio`, jsonb) :
// le type et sa relecture défensive. Sans dépendance (ni zod ni géométrie) : lu
// par les e-mails, l'admin, le compte et le schéma de la base.
import type { StudioConfig, StudioObjectId, StudioTexts } from "./types";
import { STUDIO_OBJECT_IDS } from "./types";
import type { LineLocale } from "./line-id";

/** Ce que la commande garde d'une ligne du Studio : `order_items.studio` (jsonb). */
export interface StudioOrderLine {
  /** Version du modèle de ligne. */
  v: 1;
  object: StudioObjectId;
  /** Configuration validée et bornée (schéma v1 du Studio). */
  config: StudioConfig;
  /** Textes saisis, nettoyés : DONNÉES PERSONNELLES possibles, conservées avec la commande. */
  texts: StudioTexts;
  /** Langue de l'étiquette de la Montagne (le STL l'imprime à cette langue). */
  locale: LineLocale;
  /** Chiffres d'UNE pièce au moment de l'achat. */
  stats: {
    heightMm: number;
    widthMm: number;
    depthMm: number;
    layers: number;
    volumeCm3: number;
    grams: number;
    minutes: number;
    changes: number;
    printable: "ok" | "warn";
  };
  /** Barème appliqué (traçabilité : les commandes gardent leur prix si le barème change). */
  price: { v: number; unitCents: number; grams: number; changes: number };
  /** Empreinte (`studioHash`) : nom du fichier STL de l'atelier. */
  hash: string;
  /** Relecture humaine des textes : posée par l'admin ; `in_production` l'exige. */
  reviewedAt?: string;
  reviewedBy?: string;
}

/** Relue défensivement depuis la base : `order_items.studio` est un jsonb libre. */
export function readStudioOrderLine(value: unknown): StudioOrderLine | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const line = value as Partial<StudioOrderLine>;
  if (line.v !== 1 || typeof line.object !== "string") return null;
  if (!(STUDIO_OBJECT_IDS as readonly string[]).includes(line.object))
    return null;
  if (typeof line.config !== "object" || line.config === null) return null;
  if (typeof line.texts !== "object" || line.texts === null) return null;
  if (typeof line.hash !== "string") return null;
  return line as StudioOrderLine;
}

// Fabrique la ligne de panier d'une configuration du Studio (« Ajouter au
// panier »). Côté navigateur seulement : elle calcule les chiffres d'une pièce
// (`computeStats`, moteur du Studio, déjà chargé sur les pages du Studio) ; le
// panier lui-même (cart.tsx) n'en a pas besoin, il recalcule le prix d'une
// quantité à partir des grammes et des changements gardés dans la ligne.
import type { StudioCartItem } from "../cart-data";
import { studioLineId, type LineLocale } from "./line-id";
import { clampQuantity, studioUnitCents } from "./price";
import { figuresOf, priceStats } from "./price-figures";
import { purchaseTexts } from "./text/rules";
import type { StudioConfig, StudioTexts } from "./types";

export function buildStudioCartLine(input: {
  config: StudioConfig;
  /** Textes SAISIS (jamais les exemples d'aperçu). */
  texts: StudioTexts;
  locale: LineLocale;
  quantity: number;
  now?: number;
}): StudioCartItem {
  const { config, locale } = input;
  const texts = purchaseTexts(config, input.texts);
  const quantity = clampQuantity(input.quantity);
  const figures = figuresOf(priceStats(config, texts));
  return {
    kind: "studio",
    id: studioLineId(config, texts, locale),
    v: 1,
    object: config.object,
    config,
    texts,
    locale,
    quantity,
    grams: figures.grams,
    changes: figures.changes,
    priceCents: studioUnitCents(config.object, figures, quantity),
    addedAt: input.now ?? Date.now(),
  };
}

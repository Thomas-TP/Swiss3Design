"use client";

import { createContext, useContext } from "react";
import { EMPTY_STOCK_VIEW, type StockView } from "@/lib/studio/stock-view";

// Stock de filament côté Studio. La capacité vient du hook léger partagé avec le
// panier (`components/use-filament-capacity.ts`) ; ce fichier ajoute la vue par
// pastille, qui dépend de la pièce configurée (moteur du Studio).

export { useFilamentCapacity } from "@/components/use-filament-capacity";

const FilamentStockContext = createContext<StockView>(EMPTY_STOCK_VIEW);
export const FilamentStockProvider = FilamentStockContext.Provider;

/** Les couleurs que le stock permet, pour la pièce et la quantité en cours. */
export function useStockView(): StockView {
  return useContext(FilamentStockContext);
}

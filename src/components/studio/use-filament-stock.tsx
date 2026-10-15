"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  EMPTY_STOCK_VIEW,
  type Capacity,
  type StockView,
} from "@/lib/studio/stock-view";

// Stock de filament côté Studio : la capacité de chaque couleur (jamais le niveau
// exact), lue après l'hydratation sur `GET /api/stock/colors` (cache serveur de
// 60 s) et rafraîchie chaque minute et au retour sur l'onglet. Tant qu'elle n'est
// pas là, ou si elle échoue, aucune couleur n'est grisée : le paiement revérifie
// toujours côté serveur (409 out_of_stock). Rien de lourd dans le Worker : un
// simple fetch.

const REFRESH_MS = 60_000;

export function useFilamentCapacity(): Capacity | null {
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/stock/colors", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { v?: number; studio?: Capacity };
        if (alive && body.v === 1) setCapacity(body.studio ?? {});
      } catch {
        /* Hors ligne : aucune couleur n'est grisée. */
      }
    };
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return capacity;
}

const FilamentStockContext = createContext<StockView>(EMPTY_STOCK_VIEW);
export const FilamentStockProvider = FilamentStockContext.Provider;

/** Les couleurs que le stock permet, pour la pièce et la quantité en cours. */
export function useStockView(): StockView {
  return useContext(FilamentStockContext);
}

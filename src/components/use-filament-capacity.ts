"use client";

import { useEffect, useState } from "react";
import type { Capacity } from "@/lib/filament/capacity";

// Stock de filament côté navigateur (Studio, panier) : la capacité de chaque
// couleur (jamais le niveau exact), lue après l'hydratation sur
// `GET /api/stock/colors` (cache serveur de 60 s) et rafraîchie chaque minute et
// au retour sur l'onglet. Tant qu'elle n'est pas là, ou si elle échoue, aucune
// couleur n'est épuisée : le paiement revérifie toujours côté serveur (409
// out_of_stock). Rien de lourd : un simple fetch. `enabled` à faux (panier sans
// objet du Studio) : aucune requête.

const REFRESH_MS = 60_000;

export function useFilamentCapacity(enabled = true): Capacity | null {
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/stock/colors", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { v?: number; studio?: Capacity };
        if (alive && body.v === 1) setCapacity(body.studio ?? {});
      } catch {
        /* Hors ligne : aucune couleur n'est épuisée. */
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
  }, [enabled]);
  return enabled ? capacity : null;
}

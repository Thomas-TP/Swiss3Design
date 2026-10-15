"use client";

import { useEffect, useState } from "react";
import type { Capacity } from "@/lib/filament/capacity";
import type { ClientStock } from "@/lib/filament/shop";

// Stock de filament côté navigateur (Studio, boutique, panier) : la capacité de
// chaque couleur (jamais le niveau exact), lue après l'hydratation sur
// `GET /api/stock/colors` (cache serveur de 60 s) et rafraîchie chaque minute et
// au retour sur l'onglet. Tant qu'elle n'est pas là, ou si elle échoue, aucune
// couleur n'est épuisée : le paiement revérifie toujours côté serveur (409
// out_of_stock). Rien de lourd : un simple fetch. `enabled` à faux (panier sans
// objet du Studio ni article imprimé à la demande, fiche d'un article en stock) :
// aucune requête.

const REFRESH_MS = 60_000;

interface StockBody {
  v?: number;
  studio?: Capacity;
  refs?: Record<string, { cap: number; studio?: string }>;
}

function toClientStock(body: StockBody): ClientStock {
  const refs: Record<string, number> = {};
  const studioOfRef: Record<string, string> = {};
  for (const [id, entry] of Object.entries(body.refs ?? {})) {
    refs[id] = entry.cap;
    if (entry.studio) studioOfRef[id] = entry.studio;
  }
  return { studio: body.studio ?? {}, refs, studioOfRef };
}

/** La capacité par couleur du Studio ET par référence (couleurs de la boutique). */
export function useFilamentStock(enabled = true): ClientStock | null {
  const [stock, setStock] = useState<ClientStock | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/stock/colors", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as StockBody;
        if (alive && body.v === 1) setStock(toClientStock(body));
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
  return enabled ? stock : null;
}

/** Capacité des couleurs du Studio seulement (le Studio ne lit pas les références). */
export function useFilamentCapacity(enabled = true): Capacity | null {
  return useFilamentStock(enabled)?.studio ?? null;
}

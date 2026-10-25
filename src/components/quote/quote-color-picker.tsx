"use client";

import { useEffect, useState } from "react";
import { CAPACITY_MAX_GRAMS } from "@/lib/filament/constants";
import { quoteNeedGrams } from "@/lib/filament/availability";
import type { PublicCustomColor } from "@/lib/filament/public-stock";

// Couleurs du stock proposées pour un devis (/custom), lues pour le choix des
// couleurs (quote-colors.tsx) et l'atelier 3D. Avant le fichier, toutes les couleurs en stock s'affichent ; dès que
// le poids est estimé, celles dont le stock ne couvre pas la pièce (poids estimé ×
// quantité, avec la marge × 1,15 + 15 g) sont grisées et ne peuvent plus être
// choisies. Par prudence, UNE couleur doit couvrir le poids TOTAL (on ignore la
// répartition entre couleurs). Le niveau exact du stock n'est jamais affiché ni
// connu ici : l'API ne donne qu'une capacité arrondie. Le serveur revérifie à
// l'envoi avec une lecture fraîche.

export type CustomStock =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; colors: PublicCustomColor[] };

/** Lit les couleurs « sur mesure » en stock (une fois, après l'hydratation). */
export function useCustomStock(enabled: boolean): CustomStock {
  const [stock, setStock] = useState<CustomStock>({ status: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/stock/colors");
        const body = (await res.json()) as {
          v?: number;
          custom?: PublicCustomColor[];
        };
        if (!alive) return;
        setStock(
          res.ok && body.v === 1
            ? { status: "ready", colors: body.custom ?? [] }
            : { status: "error" },
        );
      } catch {
        if (alive) setStock({ status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);
  return stock;
}

/** Les couleurs dont la capacité couvre `gramsPerPiece × quantity` (avec la marge). */
export function eligibleColors(
  colors: readonly PublicCustomColor[],
  gramsPerPiece: number,
  quantity: number,
): PublicCustomColor[] {
  const need = quoteNeedGrams(gramsPerPiece, quantity);
  return colors.filter((c) => c.cap >= CAPACITY_MAX_GRAMS || need <= c.cap);
}

/** Couleurs proposées : toutes avant l'estimation, celles qui suffisent ensuite. */
export function selectableColorIds(
  colors: readonly PublicCustomColor[],
  gramsPerPiece: number | null,
  quantity: number,
): Set<string> {
  return new Set(
    (gramsPerPiece === null
      ? colors
      : eligibleColors(colors, gramsPerPiece, quantity)
    ).map((color) => color.id),
  );
}

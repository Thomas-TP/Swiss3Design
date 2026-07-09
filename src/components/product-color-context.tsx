"use client";

import { createContext, useContext, useMemo, useState } from "react";

export interface ProductColor {
  id: string;
  name: string;
  hex: string;
}

interface ProductColorValue {
  colors: ProductColor[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  selected: ProductColor | null;
}

// Couleur choisie partagée sur toute la fiche produit : le sélecteur de couleur
// du bloc d'achat (ProductPurchase) est l'unique source, et le viewer 3D s'y
// abonne — un seul sélecteur, pas de doublon. Provider posé autour des DEUX
// colonnes de la page produit pour relier galerie (gauche) et achat (droite).
const ProductColorContext = createContext<ProductColorValue | null>(null);

export function ProductColorProvider({
  colors,
  children,
}: {
  colors: ProductColor[];
  children: React.ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    colors[0]?.id ?? null,
  );
  const value = useMemo<ProductColorValue>(
    () => ({
      colors,
      selectedId,
      setSelectedId,
      selected: colors.find((c) => c.id === selectedId) ?? null,
    }),
    [colors, selectedId],
  );
  return (
    <ProductColorContext.Provider value={value}>
      {children}
    </ProductColorContext.Provider>
  );
}

export function useProductColor(): ProductColorValue {
  const ctx = useContext(ProductColorContext);
  if (!ctx) {
    throw new Error(
      "useProductColor doit être utilisé dans ProductColorProvider",
    );
  }
  return ctx;
}

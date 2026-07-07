"use client";

import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";

// Miroir de src/lib/favorites.tsx côté app Next.js racine, adapté : le type
// n'est plus dérivé de CartItem (panier local D1) puisque le panier vient
// désormais du serveur Medusa (pas d'objet CartItem construit côté client).
export interface FavoriteItem {
  productId: string;
  name: string;
  slug: string;
  priceAmount: number;
  imageUrl: string | null;
}

type FavoritesAction =
  | { type: "hydrate"; items: FavoriteItem[] }
  | { type: "toggle"; item: FavoriteItem }
  | { type: "remove"; productId: string };

const STORAGE_KEY = "s3d-favorites-v1";

function reducer(state: FavoriteItem[], action: FavoritesAction): FavoriteItem[] {
  switch (action.type) {
    case "hydrate":
      return action.items;
    case "toggle":
      return state.some((i) => i.productId === action.item.productId)
        ? state.filter((i) => i.productId !== action.item.productId)
        : [...state, action.item];
    case "remove":
      return state.filter((i) => i.productId !== action.productId);
  }
}

interface FavoritesContextValue {
  items: FavoriteItem[];
  count: number;
  has: (productId: string) => boolean;
  toggle: (item: FavoriteItem) => void;
  remove: (productId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(reducer, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", items: JSON.parse(raw) });
    } catch {
      // liste corrompue → on repart à vide
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value: FavoritesContextValue = {
    items,
    count: items.length,
    has: (productId) => items.some((i) => i.productId === productId),
    toggle: (item) => dispatch({ type: "toggle", item }),
    remove: (productId) => dispatch({ type: "remove", productId }),
  };

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}

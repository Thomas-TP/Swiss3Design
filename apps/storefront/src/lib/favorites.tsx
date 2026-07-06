import { createContext, useContext, onMount, createEffect, type JSX } from "solid-js";
import { createStore } from "solid-js/store";

// Miroir de src/lib/favorites.tsx côté app Next.js : liste client-only,
// persistée en localStorage, jamais synchronisée serveur.
export interface FavoriteItem {
  productId: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl: string | null;
}

interface FavoritesState {
  items: FavoriteItem[];
}

interface FavoritesContextValue {
  items: () => FavoriteItem[];
  count: () => number;
  has: (productId: string) => boolean;
  toggle: (item: FavoriteItem) => void;
  remove: (productId: string) => void;
}

const STORAGE_KEY = "s3d-favorites-v1";
const FavoritesContext = createContext<FavoritesContextValue>();

export function FavoritesProvider(props: { children: JSX.Element }) {
  const [state, setState] = createStore<FavoritesState>({ items: [] });

  onMount(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState("items", JSON.parse(raw));
    } catch {
      // liste corrompue — on repart à vide
    }
  });

  createEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  });

  const value: FavoritesContextValue = {
    items: () => state.items,
    count: () => state.items.length,
    has: (productId) => state.items.some((i) => i.productId === productId),
    toggle: (item) => {
      const exists = state.items.some((i) => i.productId === item.productId);
      setState("items", exists ? state.items.filter((i) => i.productId !== item.productId) : [...state.items, item]);
    },
    remove: (productId) => setState("items", state.items.filter((i) => i.productId !== productId)),
  };

  return <FavoritesContext.Provider value={value}>{props.children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}

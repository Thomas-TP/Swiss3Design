"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import type { CartItem } from "./cart";
import { productProperties, track } from "./analytics";

// Même snapshot que le panier (sans quantité) : la liste reste affichable
// même si le produit change côté serveur.
export type FavoriteItem = Omit<CartItem, "quantity">;

type FavoritesAction =
  | { type: "hydrate"; items: FavoriteItem[] }
  | { type: "toggle"; item: FavoriteItem }
  | { type: "remove"; productId: string };

export const FAVORITES_STORAGE_KEY = "s3d-favorites-v1";
// Borne défensive : la liste vit dans le navigateur du visiteur, un stockage
// trafiqué ne doit pas gonfler le rendu.
const MAX_FAVORITES = 200;

function reducer(
  state: FavoriteItem[],
  action: FavoritesAction,
): FavoriteItem[] {
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

/**
 * Relit la liste stockée. Tout ce qui n'a pas la forme d'un favori est écarté
 * (liste corrompue, ancienne version, valeur trafiquée) : le provider ne doit
 * jamais recevoir autre chose qu'un tableau de favoris valides, sans doublon.
 */
export function parseFavorites(raw: string | null): FavoriteItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    const items: FavoriteItem[] = [];
    for (const entry of data) {
      if (!entry || typeof entry !== "object") continue;
      const i = entry as Record<string, unknown>;
      if (
        typeof i.productId !== "string" ||
        !i.productId ||
        seen.has(i.productId) ||
        typeof i.name !== "string" ||
        typeof i.slug !== "string" ||
        typeof i.priceCents !== "number" ||
        !Number.isSafeInteger(i.priceCents) ||
        i.priceCents < 0 ||
        (i.saleType !== "stock" && i.saleType !== "on_demand") ||
        ![
          i.variantId,
          i.variantName,
          i.colorName,
          i.colorHex,
          i.imageUrl,
        ].every((v) => v == null || typeof v === "string")
      )
        continue;
      seen.add(i.productId);
      items.push({
        productId: i.productId,
        variantId: (i.variantId as string | null | undefined) ?? null,
        variantName: (i.variantName as string | null | undefined) ?? null,
        colorName: (i.colorName as string | null | undefined) ?? null,
        colorHex: (i.colorHex as string | null | undefined) ?? null,
        slug: i.slug,
        name: i.name,
        priceCents: i.priceCents,
        imageUrl: (i.imageUrl as string | null | undefined) ?? null,
        saleType: i.saleType,
      });
    }
    return items.slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

/**
 * Hash (#c=v1.…) qui rouvre une création dans le Studio. Le fragment gardé
 * peut arriver avec ou sans son « # » et son « c= » : on normalise, et on
 * n'en garde que les caractères d'un jeton base64url (jamais de balise, ni
 * d'espace, ni de second fragment) pour que rien d'autre ne parte dans l'URL.
 */
export function creationHash(fragment: string): string {
  const body = fragment.replace(/^#/, "").replace(/^c=/, "");
  return /^[A-Za-z0-9._~-]{1,2048}$/.test(body) ? `#c=${body}` : "";
}

interface FavoritesContextValue {
  items: FavoriteItem[];
  /** Faux jusqu'à la relecture du stockage : évite d'afficher « vide » un instant. */
  ready: boolean;
  count: number;
  has: (productId: string) => boolean;
  toggle: (item: FavoriteItem) => void;
  remove: (productId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(reducer, []);
  // Faux jusqu'à la relecture du stockage : l'écriture attend, sinon la liste
  // vide du premier rendu écraserait les favoris enregistrés avant même
  // qu'ils soient lus (même schéma que le panier, lib/cart.tsx).
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", items: parseFavorites(raw) });
    } catch {
      // stockage bloqué (navigation privée) → on repart à vide
    } finally {
      setHydrated(true);
    }
  }, []);

  // Une autre fenêtre du site a modifié la liste : le compteur du header et
  // la page restent d'accord.
  useEffect(() => {
    const synchronize = (event: StorageEvent) => {
      if (event.key === FAVORITES_STORAGE_KEY || event.key === null)
        dispatch({
          type: "hydrate",
          items: parseFavorites(event.newValue),
        });
    };
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* Stockage privé ou plein : la liste en mémoire reste utilisable. */
    }
  }, [items, hydrated]);

  const value: FavoritesContextValue = {
    items,
    ready: hydrated,
    count: items.length,
    has: (productId) => items.some((i) => i.productId === productId),
    toggle: (item) => {
      const removing = items.some((i) => i.productId === item.productId);
      dispatch({ type: "toggle", item });
      track(
        removing
          ? "Product Removed from Wishlist"
          : "Product Added to Wishlist",
        productProperties(item),
      );
    },
    remove: (productId) => {
      const item = items.find((i) => i.productId === productId);
      dispatch({ type: "remove", productId });
      if (item) track("Product Removed from Wishlist", productProperties(item));
    },
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx)
    throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}

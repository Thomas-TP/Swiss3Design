"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";

import {
  isStudioLine,
  parseCartLines,
  type CartItem,
  type CartLine,
  type StudioCartItem,
} from "./cart-data";
import { isProduct, reducer } from "./cart-reducer";
export {
  sameLine,
  lineColorKey,
  parseCart,
  parseCartLines,
  isStudioLine,
  type CartItem,
  type CartLine,
  type StudioCartItem,
} from "./cart-data";

const STORAGE_KEY = "s3d-cart-v1";

interface CartContextValue {
  /** Toutes les lignes, dans l'ordre d'ajout (produits et objets du Studio). */
  lines: CartLine[];
  /** Les lignes PRODUIT seulement. */
  items: CartItem[];
  /** Les lignes du Studio seulement. */
  studioItems: StudioCartItem[];
  /** Nombre d'exemplaires, tout compris. */
  count: number;
  /** Total des lignes (centimes), tout compris. */
  subtotalCents: number;
  /** Part boutique : seule elle compte pour le port (une ligne du Studio n'en porte jamais). */
  shopSubtotalCents: number;
  studioSubtotalCents: number;
  add: (item: Omit<CartItem, "quantity">) => void;
  /** `colorKey` : la clé de couleur de la ligne (`lineColorKey(item)`). */
  setQuantity: (
    productId: string,
    variantId: string | null,
    colorKey: string | null,
    quantity: number,
  ) => void;
  remove: (
    productId: string,
    variantId: string | null,
    colorKey: string | null,
  ) => void;
  addStudio: (item: StudioCartItem) => void;
  setStudioQuantity: (id: string, quantity: number) => void;
  removeStudio: (id: string) => void;
  /** Remplace une ligne du Studio par sa version modifiée (« Mettre à jour le panier »). */
  replaceStudio: (id: string, item: StudioCartItem) => void;
  /** Aligne les prix unitaires sur ceux que le serveur a recalculés (409 `price_changed`). */
  syncStudioPrices: (prices: { id: string; unitCents: number }[]) => void;
  restore: (items: CartItem[]) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, dispatch] = useReducer(reducer, []);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", lines: parseCartLines(raw) });
    } catch {
      // panier corrompu → on repart à vide
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    const synchronize = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null)
        dispatch({
          type: "hydrate",
          lines: parseCartLines(event.newValue ?? "[]"),
        });
    };
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* Stockage privé ou plein : le panier en mémoire reste utilisable. */
    }
  }, [lines, hydrated]);

  const value: CartContextValue = useMemo(() => {
    const items = lines.filter(isProduct);
    const studioItems = lines.filter(isStudioLine);
    const sum = (list: CartLine[]) =>
      list.reduce((total, i) => total + i.priceCents * i.quantity, 0);
    return {
      lines,
      items,
      studioItems,
      count: lines.reduce((total, i) => total + i.quantity, 0),
      subtotalCents: sum(lines),
      shopSubtotalCents: sum(items),
      studioSubtotalCents: sum(studioItems),
      add: (item) => dispatch({ type: "add", item }),
      setQuantity: (productId, variantId, colorKey, quantity) =>
        dispatch({
          type: "setQuantity",
          productId,
          variantId,
          colorKey,
          quantity,
        }),
      remove: (productId, variantId, colorKey) =>
        dispatch({ type: "remove", productId, variantId, colorKey }),
      addStudio: (item) => dispatch({ type: "addStudio", item }),
      setStudioQuantity: (id, quantity) =>
        dispatch({ type: "setStudioQuantity", id, quantity }),
      removeStudio: (id) => dispatch({ type: "removeStudio", id }),
      replaceStudio: (id, item) =>
        dispatch({ type: "replaceStudio", id, item }),
      syncStudioPrices: (prices) =>
        dispatch({ type: "syncStudioPrices", prices }),
      restore: (items) => dispatch({ type: "restore", items }),
      clear: () => {
        dispatch({ type: "clear" });
        // Supprime aussi la copie persistée. Sur /checkout/success, chargée via
        // la redirection plein écran de Stripe, le provider se re-monte : son
        // effet d'hydratation lit le localStorage APRÈS ce clear (effet enfant
        // avant effet parent). Sans cette suppression, il re-remplirait le
        // panier qu'on vient de vider.
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // stockage indisponible — sans gravité
        }
      },
    };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

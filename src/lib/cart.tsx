"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";

import { sameLine, parseCart, type CartItem } from "./cart-data";
export { sameLine, parseCart, type CartItem } from "./cart-data";
type CartAction =
  | { type: "hydrate"; items: CartItem[] }
  | { type: "restore"; items: CartItem[] }
  | { type: "add"; item: Omit<CartItem, "quantity"> }
  | {
      type: "setQuantity";
      productId: string;
      variantId: string | null;
      colorName: string | null;
      quantity: number;
    }
  | {
      type: "remove";
      productId: string;
      variantId: string | null;
      colorName: string | null;
    }
  | { type: "clear" };

const STORAGE_KEY = "s3d-cart-v1";

function reducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case "hydrate":
      return action.items;
    case "restore": {
      const next = [...state];
      for (const item of action.items) {
        const index = next.findIndex((i) => sameLine(i, item));
        if (index < 0) next.push(item);
        else
          next[index] = {
            ...item,
            quantity: Math.max(next[index].quantity, item.quantity),
          };
      }
      return next.slice(0, 50);
    }
    case "add": {
      const existing = state.find((i) => sameLine(i, action.item));
      if (existing) {
        return state.map((i) =>
          sameLine(i, action.item)
            ? { ...i, quantity: Math.min(99, i.quantity + 1) }
            : i,
        );
      }
      return state.length >= 50
        ? state
        : [...state, { ...action.item, quantity: 1 }];
    }
    case "setQuantity":
      if (action.quantity <= 0) {
        return state.filter((i) => !sameLine(i, action));
      }
      return state.map((i) =>
        sameLine(i, action)
          ? {
              ...i,
              quantity: Math.min(
                99,
                Math.max(1, Math.trunc(action.quantity) || 1),
              ),
            }
          : i,
      );
    case "remove":
      return state.filter((i) => !sameLine(i, action));
    case "clear":
      return [];
  }
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  add: (item: Omit<CartItem, "quantity">) => void;
  setQuantity: (
    productId: string,
    variantId: string | null,
    colorName: string | null,
    quantity: number,
  ) => void;
  remove: (
    productId: string,
    variantId: string | null,
    colorName: string | null,
  ) => void;
  restore: (items: CartItem[]) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(reducer, []);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", items: parseCart(raw) });
    } catch {
      // panier corrompu → on repart à vide
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    const synchronize = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null)
        dispatch({ type: "hydrate", items: parseCart(event.newValue ?? "[]") });
    };
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* Stockage privé ou plein : le panier en mémoire reste utilisable. */
    }
  }, [items, hydrated]);

  const value: CartContextValue = {
    items,
    count: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotalCents: items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
    add: (item) => dispatch({ type: "add", item }),
    setQuantity: (productId, variantId, colorName, quantity) =>
      dispatch({
        type: "setQuantity",
        productId,
        variantId,
        colorName,
        quantity,
      }),
    remove: (productId, variantId, colorName) =>
      dispatch({ type: "remove", productId, variantId, colorName }),
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

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

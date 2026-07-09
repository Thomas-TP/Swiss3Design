"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";

export interface CartItem {
  productId: string;
  // Variante choisie (taille/finition). null = produit sans variante.
  variantId?: string | null;
  variantName?: string | null;
  // Couleur choisie (palette du filament). null = produit sans couleur.
  colorName?: string | null;
  colorHex?: string | null;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  saleType: "stock" | "on_demand";
  quantity: number;
}

// Une ligne de panier est identifiée par le triplet produit + variante + couleur
type LineRef = {
  productId: string;
  variantId?: string | null;
  colorName?: string | null;
};
const sameLine = (a: LineRef, b: LineRef) =>
  a.productId === b.productId &&
  (a.variantId ?? null) === (b.variantId ?? null) &&
  (a.colorName ?? null) === (b.colorName ?? null);

type CartAction =
  | { type: "hydrate"; items: CartItem[] }
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
    case "add": {
      const existing = state.find((i) => sameLine(i, action.item));
      if (existing) {
        return state.map((i) =>
          sameLine(i, action.item) ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...state, { ...action.item, quantity: 1 }];
    }
    case "setQuantity":
      if (action.quantity <= 0) {
        return state.filter((i) => !sameLine(i, action));
      }
      return state.map((i) =>
        sameLine(i, action) ? { ...i, quantity: action.quantity } : i,
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
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(reducer, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", items: JSON.parse(raw) });
    } catch {
      // panier corrompu → on repart à vide
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

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

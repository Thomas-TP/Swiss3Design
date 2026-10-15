import {
  CART_MAX_LINES,
  isStudioLine,
  sameLine,
  STUDIO_CART_MAX_LINES,
  type CartItem,
  type CartLine,
  type StudioCartItem,
} from "./cart-data";
import { clampQuantity, studioUnitCents } from "./studio/price";

// Réducteur du panier du navigateur (cart.tsx), sans React : testable seul.

export type CartAction =
  | { type: "hydrate"; lines: CartLine[] }
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
  | { type: "addStudio"; item: StudioCartItem }
  | { type: "setStudioQuantity"; id: string; quantity: number }
  | { type: "removeStudio"; id: string }
  | { type: "syncStudioPrices"; prices: { id: string; unitCents: number }[] }
  | { type: "replaceStudio"; id: string; item: StudioCartItem }
  | { type: "clear" };

export const isProduct = (line: CartLine): line is CartItem =>
  !isStudioLine(line);

/** Le même objet à une autre quantité : le prix unitaire suit (F est partagé par la ligne). */
function requantified(item: StudioCartItem, quantity: number): StudioCartItem {
  const q = clampQuantity(quantity);
  return {
    ...item,
    quantity: q,
    priceCents: studioUnitCents(
      item.object,
      { grams: item.grams, changes: item.changes },
      q,
    ),
  };
}

export function reducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case "hydrate":
      return action.lines;
    case "restore": {
      const next = [...state];
      for (const item of action.items) {
        const index = next.findIndex((i) => isProduct(i) && sameLine(i, item));
        if (index < 0) next.push(item);
        else {
          const current = next[index] as CartItem;
          next[index] = {
            ...item,
            quantity: Math.max(current.quantity, item.quantity),
          };
        }
      }
      return next.slice(0, CART_MAX_LINES);
    }
    case "add": {
      const existing = state.find(
        (i) => isProduct(i) && sameLine(i, action.item),
      );
      if (existing) {
        return state.map((i) =>
          isProduct(i) && sameLine(i, action.item)
            ? { ...i, quantity: Math.min(99, i.quantity + 1) }
            : i,
        );
      }
      return state.length >= CART_MAX_LINES
        ? state
        : [...state, { ...action.item, quantity: 1 }];
    }
    case "setQuantity":
      if (action.quantity <= 0) {
        return state.filter((i) => !(isProduct(i) && sameLine(i, action)));
      }
      return state.map((i) =>
        isProduct(i) && sameLine(i, action)
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
      return state.filter((i) => !(isProduct(i) && sameLine(i, action)));
    case "addStudio": {
      const existing = state.find(
        (i) => isStudioLine(i) && i.id === action.item.id,
      ) as StudioCartItem | undefined;
      if (existing) {
        return state.map((i) =>
          isStudioLine(i) && i.id === action.item.id
            ? requantified(i, i.quantity + action.item.quantity)
            : i,
        );
      }
      if (
        state.length >= CART_MAX_LINES ||
        state.filter(isStudioLine).length >= STUDIO_CART_MAX_LINES
      )
        return state;
      return [...state, requantified(action.item, action.item.quantity)];
    }
    case "setStudioQuantity":
      if (action.quantity <= 0)
        return state.filter((i) => !(isStudioLine(i) && i.id === action.id));
      return state.map((i) =>
        isStudioLine(i) && i.id === action.id
          ? requantified(i, Math.trunc(action.quantity) || 1)
          : i,
      );
    case "removeStudio":
      return state.filter((i) => !(isStudioLine(i) && i.id === action.id));
    case "syncStudioPrices":
      // Le serveur fait foi : le prix recalculé au paiement remplace celui de l'affichage.
      return state.map((i) => {
        if (!isStudioLine(i)) return i;
        const server = action.prices.find((p) => p.id === i.id);
        return server && server.unitCents !== i.priceCents
          ? { ...i, priceCents: server.unitCents }
          : i;
      });
    case "replaceStudio": {
      // « Mettre à jour le panier » : la ligne modifiée prend la place de l'ancienne.
      const index = state.findIndex(
        (i) => isStudioLine(i) && i.id === action.id,
      );
      if (index < 0)
        return reducer(state, { type: "addStudio", item: action.item });
      const next = [...state];
      next[index] = requantified(action.item, action.item.quantity);
      // La nouvelle configuration peut déjà être dans le panier : on fusionne.
      const twin = next.findIndex(
        (i, k) => k !== index && isStudioLine(i) && i.id === action.item.id,
      );
      if (twin >= 0) {
        const other = next[twin] as StudioCartItem;
        next[index] = requantified(
          other,
          other.quantity + (next[index] as StudioCartItem).quantity,
        );
        next.splice(twin, 1);
      }
      return next;
    }
    case "clear":
      return [];
  }
}

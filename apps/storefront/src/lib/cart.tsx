import { createContext, useContext, createSignal, onMount, type JSX } from "solid-js";
import { medusa } from "./medusa";

// Panier réel Medusa (remplace le panier D1 de l'app Next.js) : l'id de
// panier est persisté en localStorage, le panier lui-même vit côté Medusa.
// Une seule région (Suisse, CHF) existe pour ce store — pas de sélecteur de
// région côté client.
// Type dérivé du SDK plutôt qu'importé de @medusajs/types : ce paquet tire des
// dépendances propres au backend (jsonwebtoken, awilix, mikro-orm) inutiles
// (et non installées) côté storefront.
type StoreCart = Awaited<ReturnType<typeof medusa.store.cart.retrieve>>["cart"];
const STORAGE_KEY = "s3d-cart-id";

interface CartContextValue {
  cart: () => StoreCart | null;
  count: () => number;
  loading: () => boolean;
  addItem: (variantId: string, quantity?: number, metadata?: Record<string, unknown>) => Promise<void>;
  updateItem: (lineItemId: string, quantity: number) => Promise<void>;
  removeItem: (lineItemId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue>();

async function findSwissRegionId(): Promise<string> {
  const { regions } = await medusa.store.region.list();
  const swiss = regions.find((r: { currency_code: string }) => r.currency_code === "chf") ?? regions[0];
  if (!swiss) throw new Error("Aucune région Medusa configurée");
  return swiss.id;
}

export function CartProvider(props: { children: JSX.Element }) {
  const [cart, setCart] = createSignal<StoreCart | null>(null);
  const [loading, setLoading] = createSignal(false);

  onMount(async () => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) return;
    try {
      const { cart: existing } = await medusa.store.cart.retrieve(id);
      setCart(existing);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  });

  async function ensureCart(): Promise<string> {
    const current = cart();
    if (current) return current.id;
    const region_id = await findSwissRegionId();
    const { cart: created } = await medusa.store.cart.create({ region_id });
    localStorage.setItem(STORAGE_KEY, created.id);
    setCart(created);
    return created.id;
  }

  async function refresh() {
    const current = cart();
    if (!current) return;
    const { cart: fresh } = await medusa.store.cart.retrieve(current.id);
    setCart(fresh);
  }

  return (
    <CartContext.Provider
      value={{
        cart,
        count: () =>
          cart()?.items?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) ?? 0,
        loading,
        addItem: async (variantId, quantity = 1, metadata) => {
          setLoading(true);
          try {
            const id = await ensureCart();
            const { cart: updated } = await medusa.store.cart.createLineItem(id, {
              variant_id: variantId,
              quantity,
              metadata,
            });
            setCart(updated);
          } finally {
            setLoading(false);
          }
        },
        updateItem: async (lineItemId, quantity) => {
          const current = cart();
          if (!current) return;
          setLoading(true);
          try {
            const { cart: updated } = await medusa.store.cart.updateLineItem(current.id, lineItemId, {
              quantity,
            });
            setCart(updated);
          } finally {
            setLoading(false);
          }
        },
        removeItem: async (lineItemId) => {
          const current = cart();
          if (!current) return;
          setLoading(true);
          try {
            await medusa.store.cart.deleteLineItem(current.id, lineItemId);
            await refresh();
          } finally {
            setLoading(false);
          }
        },
        refresh,
      }}
    >
      {props.children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

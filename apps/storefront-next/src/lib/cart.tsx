"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { medusa } from "./medusa";

// Panier réel Medusa (remplace le panier D1 de l'ancienne app) : l'id de
// panier est persisté en localStorage, le panier lui-même vit côté Medusa.
// Une seule région (Suisse, CHF) existe pour ce store — pas de sélecteur de
// région côté client. Miroir de apps/storefront/src/lib/cart.tsx
// (storefront SolidStart), port React direct — mêmes deux bugs déjà
// corrigés côté Solid reproduits ici dès le départ (pas re-découverts) :
// 1. le SDK Medusa lève une erreur sur toute réponse HTTP >= 300, y compris
//    304 Not Modified (le navigateur répond bien un 304 réel sur des GET
//    identiques répétés vers la même URL de panier) — store.cart.retrieve()
//    n'expose pas `cache`, on repasse par client.fetch(..., {cache:
//    "no-store"}) pour ce seul appel.
// 2. la valeur initiale de `loading` doit être déterministe (jamais
//    dépendante de `window`/localStorage) pour ne pas désynchroniser le
//    rendu serveur et l'hydratation client.
type StoreCart = Awaited<ReturnType<typeof medusa.store.cart.retrieve>>["cart"];
const STORAGE_KEY = "s3d-cart-id";

async function retrieveCart(id: string): Promise<StoreCart> {
  const { cart } = await medusa.client.fetch<{ cart: StoreCart }>(`/store/carts/${id}`, {
    cache: "no-store",
  });
  return cart;
}

interface CartContextValue {
  cart: StoreCart | null;
  count: number;
  loading: boolean;
  addItem: (variantId: string, quantity?: number, metadata?: Record<string, unknown>) => Promise<void>;
  updateItem: (lineItemId: string, quantity: number) => Promise<void>;
  removeItem: (lineItemId: string) => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

async function findSwissRegionId(): Promise<string> {
  const { regions } = await medusa.store.region.list();
  const swiss = regions.find((r: { currency_code: string }) => r.currency_code === "chf") ?? regions[0];
  if (!swiss) throw new Error("Aucune région Medusa configurée");
  return swiss.id;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<StoreCart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // `await` avant tout setState : une règle ESLint (react-hooks/
      // set-state-in-effect) interdit d'appeler setState de façon
      // synchrone dans le corps d'un effet (cascade de rendus) — même le
      // cas "pas de panier stocké" doit passer par un tour de micro-tâche.
      await Promise.resolve();
      const id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const fresh = await retrieveCart(id);
        if (!cancelled) setCart(fresh);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function ensureCart(): Promise<string> {
    if (cart) return cart.id;
    const region_id = await findSwissRegionId();
    const { cart: created } = await medusa.store.cart.create({ region_id });
    localStorage.setItem(STORAGE_KEY, created.id);
    setCart(created);
    return created.id;
  }

  async function refresh() {
    if (!cart) return;
    setCart(await retrieveCart(cart.id));
  }

  const value: CartContextValue = {
    cart,
    count: cart?.items?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) ?? 0,
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
      if (!cart) return;
      setLoading(true);
      try {
        const { cart: updated } = await medusa.store.cart.updateLineItem(cart.id, lineItemId, { quantity });
        setCart(updated);
      } finally {
        setLoading(false);
      }
    },
    removeItem: async (lineItemId) => {
      if (!cart) return;
      setLoading(true);
      try {
        await medusa.store.cart.deleteLineItem(cart.id, lineItemId);
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    refresh,
    // Le panier Medusa est marqué complété côté serveur par cart.complete()
    // (checkout/success) - on ne le réutilise jamais, un prochain ajout au
    // panier en créera un nouveau (ensureCart).
    clear: () => {
      localStorage.removeItem(STORAGE_KEY);
      setCart(null);
    },
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

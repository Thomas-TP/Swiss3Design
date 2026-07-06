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

// Le SDK Medusa (client.js::normalizeResponse) traite tout statut >= 300
// comme une erreur, y compris 304 Not Modified - or le navigateur répond
// bien un 304 réel (revalidation HTTP transparente) sur des GET identiques
// répétés (ex. rechargement de page). `store.cart.retrieve()` ne permet pas
// de forcer `cache: "no-store"` (seul `headers` est exposé) : on repasse par
// `client.fetch()` (l'échappatoire générique du SDK) pour ce seul appel afin
// que le panier ne disparaisse jamais après un simple F5.
async function retrieveCart(id: string): Promise<StoreCart> {
  const { cart } = await medusa.client.fetch<{ cart: StoreCart }>(`/store/carts/${id}`, {
    cache: "no-store",
  });
  return cart;
}

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
  // true jusqu'à ce qu'onMount ait tranché (pas de localStorage côté SSR) -
  // valeur initiale déterministe (jamais dépendante de `window`) pour ne pas
  // désynchroniser le rendu serveur et l'hydratation client. Sans ça, la
  // page panier affichait un flash "panier vide" avant que le vrai panier
  // Medusa (fetch asynchrone) n'arrive.
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      setCart(await retrieveCart(id));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
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
    setCart(await retrieveCart(current.id));
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

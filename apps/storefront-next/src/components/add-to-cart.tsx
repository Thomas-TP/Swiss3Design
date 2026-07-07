"use client";

import { useState } from "react";
import { Check, CreditCard, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";

// Miroir de src/components/add-to-cart.tsx côté app Next.js racine, adapté
// au panier Medusa : `item` porte l'id de variante Medusa (pas un CartItem
// D1 construit côté client) + les métadonnées de couleur à figer sur la
// ligne de panier.
export interface CartAddition {
  variantId: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

export function AddToCart({ item, disabled = false }: { item: CartAddition; disabled?: boolean }) {
  const t = useTranslations("product");
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  if (disabled) {
    return (
      <button disabled className="flex w-full items-center justify-center gap-2 rounded-full bg-line px-6 py-3.5 text-sm font-semibold text-soft">
        {t("outOfStock")}
      </button>
    );
  }

  return (
    <button
      onClick={async () => {
        await addItem(item.variantId, item.quantity ?? 1, item.metadata);
        setAdded(true);
        setTimeout(() => setAdded(false), 1600);
      }}
      className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-all active:scale-[0.98] ${
        added ? "bg-ink text-paper" : "bg-accent text-white shadow-lg shadow-accent/25 hover:bg-accent-dark"
      }`}
    >
      {added ? <Check size={18} /> : <ShoppingBag size={18} />}
      {added ? t("added") : t("addToCart")}
    </button>
  );
}

export function BuyNow({ item, disabled = false }: { item: CartAddition; disabled?: boolean }) {
  const t = useTranslations("product");
  const router = useRouter();
  const { addItem } = useCart();
  const [pending, setPending] = useState(false);

  if (disabled) return null;

  return (
    <button
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await addItem(item.variantId, item.quantity ?? 1, item.metadata);
        router.push("/checkout");
      }}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-paper transition-all hover:bg-ink/85 active:scale-[0.98] disabled:opacity-60"
    >
      <CreditCard size={18} />
      {t("buyNow")}
    </button>
  );
}

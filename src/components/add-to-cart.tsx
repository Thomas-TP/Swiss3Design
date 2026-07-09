"use client";

import { useState } from "react";
import { Check, CreditCard, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCart, type CartItem } from "@/lib/cart";

export function AddToCart({
  item,
  disabled = false,
}: {
  item: Omit<CartItem, "quantity">;
  disabled?: boolean;
}) {
  const t = useTranslations("product");
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-full bg-line px-6 py-3.5 text-sm font-semibold text-soft"
      >
        {t("outOfStock")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        add(item);
        setAdded(true);
        setTimeout(() => setAdded(false), 1600);
      }}
      className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-all active:scale-[0.98] ${
        added
          ? "bg-ink text-paper"
          : "bg-accent text-white shadow-lg shadow-accent/25 hover:bg-accent-dark"
      }`}
    >
      {added ? <Check size={18} /> : <ShoppingBag size={18} />}
      {added ? t("added") : t("addToCart")}
    </button>
  );
}

// Variante compacte pour les cartes du catalogue (vit dans une carte-lien)
export function AddToCartMini({
  item,
  disabled = false,
}: {
  item: Omit<CartItem, "quantity">;
  disabled?: boolean;
}) {
  const t = useTranslations("product");
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-1.5 rounded-full bg-line px-3 py-2 text-xs font-semibold text-soft"
      >
        {t("outOfStock")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        add(item);
        setAdded(true);
        setTimeout(() => setAdded(false), 1600);
      }}
      className={`flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98] ${
        added
          ? "bg-ink text-paper"
          : "bg-accent text-white hover:bg-accent-dark"
      }`}
    >
      {added ? <Check size={14} /> : <ShoppingBag size={14} />}
      {added ? t("added") : t("addToCart")}
    </button>
  );
}

// « Acheter » : ajoute l'article si besoin puis file directement au paiement
export function BuyNow({
  item,
  disabled = false,
}: {
  item: Omit<CartItem, "quantity">;
  disabled?: boolean;
}) {
  const t = useTranslations("product");
  const router = useRouter();
  const { items, add } = useCart();

  if (disabled) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (!items.some((i) => i.productId === item.productId)) add(item);
        router.push("/checkout");
      }}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-paper transition-all hover:bg-ink/85 active:scale-[0.98]"
    >
      <CreditCard size={18} />
      {t("buyNow")}
    </button>
  );
}

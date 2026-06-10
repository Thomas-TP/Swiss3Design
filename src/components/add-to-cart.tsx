"use client";

import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCart, type CartItem } from "@/lib/cart";

export function AddToCart({ item }: { item: Omit<CartItem, "quantity"> }) {
  const t = useTranslations("product");
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <button
      onClick={() => {
        add(item);
        setAdded(true);
        setTimeout(() => setAdded(false), 1600);
      }}
      className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-all active:scale-[0.98] ${
        added ? "bg-ink" : "bg-accent hover:bg-accent-dark"
      }`}
    >
      {added ? <Check size={18} /> : <ShoppingBag size={18} />}
      {added ? t("added") : t("addToCart")}
    </button>
  );
}

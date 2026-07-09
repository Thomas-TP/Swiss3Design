"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";

export function ClearCart() {
  const { clear } = useCart();
  // biome-ignore lint/correctness/useExhaustiveDependencies: vide le panier une seule fois au montage
  useEffect(() => {
    clear();
  }, []);
  return null;
}

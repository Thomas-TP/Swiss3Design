"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";

export function ClearCart() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, []); // oxlint-disable-line exhaustive-deps -- vide le panier une seule fois au montage
  return null;
}

"use client";

import { useState } from "react";
import { Check, CreditCard, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCart, sameLine, type CartItem } from "@/lib/cart";
import { productProperties, track } from "@/lib/analytics";
import { Button, type ButtonVariant } from "@/components/ui/button";

function trackAdded(item: Omit<CartItem, "quantity">, source: string) {
  track("Product Added", { ...productProperties(item), source });
}

// Retour tactile de l'ajout au panier (brief « Strates », §3.5) : un battement
// de 5 ms là où le navigateur sait vibrer (Android), rien ailleurs.
function feel() {
  try {
    navigator.vibrate?.(5);
  } catch {
    // Politique du navigateur ou appareil sans vibreur : sans conséquence.
  }
}

// « Un seul bouton rouge par écran » (brief §2.1) : la fiche produit porte le
// rouge (`primary`) ; partout ailleurs (cartes, planches) l'ajout rapide est en
// contour, et la planche éditoriale de tête peut prendre le rouge (`primary`).
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
      <Button variant="secondary" size="lg" full disabled>
        {t("outOfStock")}
      </Button>
    );
  }

  return (
    <Button
      variant={added ? "ink" : "primary"}
      size="lg"
      full
      aria-live="polite"
      onClick={() => {
        add(item);
        trackAdded(item, "product_page");
        feel();
        setAdded(true);
        setTimeout(() => setAdded(false), 1600);
      }}
    >
      {added ? <Check size={18} /> : <ShoppingBag size={18} />}
      {added ? t("added") : t("addToCart")}
    </Button>
  );
}

// Variante compacte pour les cartes du catalogue (vit dans une carte-lien) et
// pour les planches de la boutique (`variant="primary"` pour la première).
export function AddToCartMini({
  item,
  disabled = false,
  variant = "secondary",
  size = "sm",
}: {
  item: Omit<CartItem, "quantity">;
  disabled?: boolean;
  variant?: Extract<ButtonVariant, "primary" | "secondary">;
  /** `md` (44 px, cible tactile) pour une planche ; `sm` dans une carte dense. */
  size?: "sm" | "md";
}) {
  const t = useTranslations("product");
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  if (disabled) {
    return (
      <Button variant="secondary" size={size} full disabled>
        {t("outOfStock")}
      </Button>
    );
  }

  return (
    <Button
      variant={added ? "ink" : variant}
      size={size}
      full
      aria-live="polite"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        add(item);
        trackAdded(item, "catalog");
        feel();
        setAdded(true);
        setTimeout(() => setAdded(false), 1600);
      }}
    >
      {added ? <Check size={14} /> : <ShoppingBag size={14} />}
      {added ? t("added") : t("addToCart")}
    </Button>
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
    <Button
      variant="ink"
      size="lg"
      full
      aria-live="polite"
      onClick={() => {
        if (!items.some((i) => sameLine(i, item))) {
          add(item);
          trackAdded(item, "buy_now");
        }
        router.push("/checkout");
      }}
    >
      <CreditCard size={18} />
      {t("buyNow")}
    </Button>
  );
}

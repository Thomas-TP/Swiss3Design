"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFavorites, type FavoriteItem } from "@/lib/favorites";

export function FavoriteButton({
  item,
  size = 18,
  className = "",
}: {
  item: FavoriteItem;
  size?: number;
  className?: string;
}) {
  const t = useTranslations("favorites");
  const { has, toggle } = useFavorites();
  const active = has(item.productId);

  return (
    <button
      type="button"
      onClick={(e) => {
        // Le bouton vit parfois dans une carte-lien : on bloque la navigation
        e.preventDefault();
        e.stopPropagation();
        toggle(item);
      }}
      aria-label={active ? t("remove") : t("add")}
      aria-pressed={active}
      className={`transition-all active:scale-90 ${className}`}
    >
      <Heart
        size={size}
        strokeWidth={1.8}
        className={`transition-colors ${
          active ? "fill-accent text-accent" : "text-soft hover:text-ink"
        }`}
      />
    </button>
  );
}

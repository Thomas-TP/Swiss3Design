"use client";

import { ArrowRight, Heart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useFavorites } from "@/lib/favorites";
import { formatChfAmount } from "@/lib/format";
import { FavoriteButton } from "@/components/favorite-button";

// Contrairement à l'ancien modèle D1 (favoriteItem incluait de quoi ajouter
// directement au panier), les produits Medusa multicolores exigent un choix
// de teinte (variant_id) avant tout ajout — impossible depuis la grille de
// favoris (voir favoriteItem dans product-purchase.tsx, sans variantId). Le
// bouton « tout ajouter » de l'app racine est donc volontairement absent ;
// chaque carte renvoie vers la fiche produit pour choisir une couleur.
export default function FavoritesPage() {
  const t = useTranslations("favorites");
  const locale = useLocale();
  const { items } = useFavorites();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-surface ring-1 ring-line">
          <Heart size={26} strokeWidth={1.6} className="text-soft" />
        </span>
        <h1 className="mt-6 text-2xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-soft">{t("empty")}</p>
        <Link
          href="/shop"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
        >
          {t("browse")}
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
        {items.map((item) => (
          <Link
            key={item.productId}
            href={`/products/${item.slug}`}
            className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-ink/5"
          >
            <div className="relative aspect-square overflow-hidden bg-line/30">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              )}
              <FavoriteButton item={item} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-surface/90 backdrop-blur" />
            </div>
            <div className="flex flex-1 flex-col gap-1 p-4">
              <h3 className="font-semibold leading-snug">{item.name}</h3>
              <p className="mt-2 font-semibold tabular-nums">{formatChfAmount(item.priceAmount, locale)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

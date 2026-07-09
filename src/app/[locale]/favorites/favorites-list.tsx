"use client";

import { useState } from "react";
import { ArrowRight, Check, Heart, ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useFavorites } from "@/lib/favorites";
import { useCart } from "@/lib/cart";
import { formatChf } from "@/lib/format";
import { AddToCartMini } from "@/components/add-to-cart";
import { FavoriteButton } from "@/components/favorite-button";
import { PageHeader } from "@/components/page-header";

export function FavoritesList() {
  const t = useTranslations("favorites");
  const locale = useLocale();
  const { items } = useFavorites();
  const { add } = useCart();
  const [addedAll, setAddedAll] = useState(false);

  // Ajoute tous les favoris au panier d'un coup. add() fusionne les lignes
  // identiques, donc relancer ne crée pas de doublons (incrémente la quantité).
  // On conserve la liste des favoris : « ajouter » n'est pas « retirer ».
  function addAllToCart() {
    items.forEach((item) => add(item));
    setAddedAll(true);
    setTimeout(() => setAddedAll(false), 1800);
  }

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
      <PageHeader
        title={t("title")}
        actions={
          <button
            type="button"
            onClick={addAllToCart}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] ${
              addedAll
                ? "bg-ink text-paper"
                : "bg-accent text-white shadow-lg shadow-accent/25 hover:bg-accent-dark"
            }`}
          >
            {addedAll ? <Check size={16} /> : <ShoppingBag size={16} />}
            {addedAll ? t("addedAll") : t("addAll")}
          </button>
        }
      />

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
              <FavoriteButton
                item={item}
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-surface/90 backdrop-blur"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1 p-4">
              <h3 className="font-semibold leading-snug">{item.name}</h3>
              <p className="mt-2 font-semibold tabular-nums">
                {formatChf(item.priceCents, locale)}
              </p>
              <div className="mt-3">
                <AddToCartMini item={item} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

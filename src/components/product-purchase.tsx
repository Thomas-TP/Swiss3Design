"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatChf } from "@/lib/format";
import { AddToCart, BuyNow } from "@/components/add-to-cart";
import { FavoriteButton } from "@/components/favorite-button";

interface Variant {
  id: string;
  name: string;
  priceCents: number | null;
  stock: number | null;
}

// Bloc d'achat de la fiche produit : prix, disponibilité, sélection de
// variante (couleur/taille) et boutons — le tout réactif à la variante choisie.
export function ProductPurchase({
  productId,
  slug,
  name,
  basePriceCents,
  saleType,
  productionDays,
  productStock,
  imageUrl,
  variants,
}: {
  productId: string;
  slug: string;
  name: string;
  basePriceCents: number;
  saleType: "stock" | "on_demand";
  productionDays: number | null;
  productStock: number | null;
  imageUrl: string | null;
  variants: Variant[];
}) {
  const t = useTranslations("product");
  const locale = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(
    variants[0]?.id ?? null,
  );
  const selected = variants.find((v) => v.id === selectedId) ?? null;

  const priceCents = selected?.priceCents ?? basePriceCents;
  const stock = variants.length > 0 ? (selected?.stock ?? null) : productStock;
  const soldOut = saleType === "stock" && stock === 0;

  const item = {
    productId,
    slug,
    name,
    priceCents,
    imageUrl,
    saleType,
    variantId: selected?.id ?? null,
    variantName: selected?.name ?? null,
  };
  // Le favori reste au niveau produit (prix de base, sans variante)
  const favoriteItem = { productId, slug, name, priceCents: basePriceCents, imageUrl, saleType };

  const badgeClass =
    saleType === "stock"
      ? stock === 0
        ? "bg-red-500/15 text-red-600 dark:text-red-300"
        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : "bg-amber-500/15 text-amber-700 dark:text-amber-300";

  return (
    <div className="mt-5">
      <span
        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}
      >
        {saleType === "stock"
          ? stock === 0
            ? t("outOfStock")
            : t("inStock")
          : t("onDemand", { days: productionDays ?? 3 })}
      </span>

      <p className="mt-3 text-2xl font-semibold tabular-nums">
        {formatChf(priceCents, locale)}
      </p>

      {variants.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">{t("variant")}</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const vSoldOut = saleType === "stock" && v.stock === 0;
              const active = v.id === selectedId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  aria-pressed={active}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-surface hover:border-ink"
                  } ${vSoldOut ? "opacity-50" : ""}`}
                >
                  {v.name}
                  {vSoldOut ? ` · ${t("outOfStock")}` : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-3">
        <div className="flex items-stretch gap-3">
          <div className="flex-1">
            <AddToCart disabled={soldOut} item={item} />
          </div>
          <FavoriteButton
            item={favoriteItem}
            size={20}
            className="grid w-[50px] shrink-0 place-items-center rounded-full border border-line bg-surface hover:border-ink/30"
          />
        </div>
        <BuyNow disabled={soldOut} item={item} />
      </div>
    </div>
  );
}

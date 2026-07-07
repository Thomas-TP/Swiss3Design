"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatChfAmount } from "@/lib/format";
import { AddToCart, BuyNow } from "@/components/add-to-cart";
import { FavoriteButton } from "@/components/favorite-button";
import { useProductColor } from "@/components/product-color-context";

interface Variant {
  id: string;
  title: string;
  priceAmount: number;
  outOfStock: boolean;
}

// Miroir de src/components/product-purchase.tsx côté app Next.js racine,
// adapté au panier/variantes Medusa. Le sélecteur de variante est masqué
// si un seul variant existe : Medusa synthétise toujours au moins un
// "Default variant" par produit (contrairement à l'ancien modèle D1 où
// `variants.length > 0` distinguait un vrai choix).
export function ProductPurchase({
  productId,
  name,
  imageUrl,
  saleType,
  productionDays,
  variants,
}: {
  productId: string;
  name: string;
  imageUrl: string | null;
  saleType: "stock" | "on_demand";
  productionDays: number | null;
  variants: Variant[];
}) {
  const t = useTranslations("product");
  const locale = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(variants[0]?.id ?? null);
  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const showVariantPicker = variants.length > 1;

  const { colors, selectedId: colorId, setSelectedId: setColorId, selected: selectedColor } = useProductColor();

  const priceAmount = selected?.priceAmount ?? variants[0]?.priceAmount ?? 0;
  const soldOut = saleType === "stock" && (selected?.outOfStock ?? false);

  const cartItem = {
    variantId: selected?.id ?? variants[0]?.id ?? "",
    metadata: selectedColor ? { color_name: selectedColor.name, color_hex: selectedColor.hex } : undefined,
  };
  const favoriteItem = {
    productId,
    name,
    slug: productId,
    priceAmount: variants[0]?.priceAmount ?? 0,
    imageUrl,
  };

  const badgeClass =
    saleType === "stock"
      ? soldOut
        ? "bg-red-500/15 text-red-600 dark:text-red-300"
        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : "bg-amber-500/15 text-amber-700 dark:text-amber-300";

  return (
    <div className="mt-5">
      <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
        {saleType === "stock" ? (soldOut ? t("outOfStock") : t("inStock")) : t("onDemand", { days: productionDays ?? 3 })}
      </span>

      <p className="mt-3 text-2xl font-semibold tabular-nums">{formatChfAmount(priceAmount, locale)}</p>

      {colors.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">
            {t("color")}
            {selectedColor && <span className="ml-1.5 font-normal text-soft">· {selectedColor.name}</span>}
          </p>
          <div className="flex flex-wrap gap-2.5">
            {colors.map((c) => {
              const active = c.id === colorId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColorId(c.id)}
                  aria-pressed={active}
                  aria-label={c.name}
                  title={c.name}
                  className={`h-9 w-9 rounded-full border transition-transform ${
                    active ? "border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper" : "border-swatch-ring hover:scale-110"
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              );
            })}
          </div>
        </div>
      )}

      {showVariantPicker && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">{t("variant")}</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const vSoldOut = saleType === "stock" && v.outOfStock;
              const active = v.id === selectedId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  aria-pressed={active}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    active ? "border-ink bg-ink text-paper" : "border-line bg-surface hover:border-ink"
                  } ${vSoldOut ? "opacity-50" : ""}`}
                >
                  {v.title}
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
            <AddToCart disabled={soldOut} item={cartItem} />
          </div>
          <FavoriteButton
            item={favoriteItem}
            size={20}
            className="grid w-[50px] shrink-0 place-items-center rounded-full border border-line bg-surface hover:border-ink/30"
          />
        </div>
        <BuyNow disabled={soldOut} item={cartItem} />
      </div>
    </div>
  );
}

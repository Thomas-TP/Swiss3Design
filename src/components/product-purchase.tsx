"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatChf } from "@/lib/format";
import { AddToCart, BuyNow } from "@/components/add-to-cart";
import { FavoriteButton } from "@/components/favorite-button";
import { useProductColor } from "@/components/product-color-context";
import { chipClass } from "@/components/ui/chip";
import { cx } from "@/components/ui/cx";

interface Variant {
  id: string;
  name: string;
  priceCents: number | null;
  stock: number | null;
}

// Bloc d'achat de la fiche produit (brief « Strates », §7.9) : disponibilité,
// prix, sélection de couleur (pastilles `aria-pressed`, palette du filament) et
// de variante (taille/finition), puis les boutons. Le bouton d'ajout est LE
// rouge de l'écran ; « Acheter » est en encre. Colonne collante dès le premier
// écran : tout ce qui décide de l'achat reste sous les yeux.
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

  // Couleur : source unique partagée avec le viewer 3D (contexte). Le sélecteur
  // ci-dessous est donc le seul de la fiche — il pilote aussi la teinte 3D.
  const {
    colors,
    selectedId: colorId,
    setSelectedId: setColorId,
    selected: selectedColor,
  } = useProductColor();

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
    colorName: selectedColor?.name ?? null,
    colorHex: selectedColor?.hex ?? null,
  };
  // Le favori reste au niveau produit (prix de base, sans variante ni couleur)
  const favoriteItem = {
    productId,
    slug,
    name,
    priceCents: basePriceCents,
    imageUrl,
    saleType,
  };

  // Point d'état + libellé : l'information est dans le texte, la couleur du
  // point n'est qu'un renfort (vert = en stock, rouge = rupture, sépia = sur
  // commande).
  const status =
    saleType === "stock"
      ? stock === 0
        ? { label: t("outOfStock"), dot: "bg-accent" }
        : { label: t("inStock"), dot: "bg-emerald-600" }
      : {
          label: t("onDemand", { days: productionDays ?? 3 }),
          dot: "bg-iso-index",
        };

  return (
    <div className="mt-6">
      <p className="s3d-label flex items-center gap-2 normal-case text-ink">
        <span
          aria-hidden="true"
          className={cx("h-2 w-2 rounded-full", status.dot)}
        />
        {status.label}
      </p>

      <p className="s3d-num mt-3 font-display text-title text-ink">
        {formatChf(priceCents, locale)}
      </p>

      {colors.length > 0 && (
        <div className="mt-6">
          <p className="s3d-label mb-3 text-soft">
            {t("color")}
            {selectedColor && (
              <span className="ml-1.5 normal-case text-ink">
                · {selectedColor.name}
              </span>
            )}
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
                  className={cx(
                    "h-9 w-9 rounded-full border transition-transform duration-300 ease-purge",
                    active
                      ? "scale-105 border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper"
                      : "border-swatch-ring hover:scale-105",
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              );
            })}
          </div>
        </div>
      )}

      {variants.length > 0 && (
        <div className="mt-6">
          <p className="s3d-label mb-3 text-soft">{t("variant")}</p>
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
                  className={cx(
                    chipClass(active),
                    "cursor-pointer",
                    vSoldOut && "opacity-50",
                  )}
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
            className="grid w-[52px] shrink-0 place-items-center rounded-field border border-line bg-surface hover:border-ink"
          />
        </div>
        <BuyNow disabled={soldOut} item={item} />
      </div>
    </div>
  );
}

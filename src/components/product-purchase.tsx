"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatChf } from "@/lib/format";
import { isShort } from "@/lib/filament/capacity";
import { shopNeedGrams } from "@/lib/filament/shop";
import { AddToCart, BuyNow } from "@/components/add-to-cart";
import { chipBackground } from "@/components/filament-chip";
import { FavoriteButton } from "@/components/favorite-button";
import { useProductColor } from "@/components/product-color-context";
import { useFilamentStock } from "@/components/use-filament-capacity";
import { chipClass } from "@/components/ui/chip";
import { cx } from "@/components/ui/cx";

interface Variant {
  id: string;
  name: string;
  priceCents: number | null;
  stock: number | null;
}

// Bloc d'achat de la fiche produit (brief « Strates », §7.9) : disponibilité,
// prix, sélection de couleur (pastilles `aria-pressed` : les couleurs du stock,
// les mêmes que « Sur mesure », moins les exclusions de l'article) et de variante
// (taille/finition), puis les boutons. Le bouton d'ajout est LE rouge de l'écran ;
// « Acheter » est en encre. Colonne collante dès le premier écran : tout ce qui
// décide de l'achat reste sous les yeux.
//
// Stock de filament (article imprimé à la demande, avec un poids) : comme au
// Studio, une couleur dont la capacité ne couvre pas UNE pièce (poids + 10 % de
// perte) est grisée, barrée et annoncée « épuisée » ; choisie quand même (elle
// l'était par défaut), elle bloque l'ajout. La capacité arrive après
// l'hydratation (`/api/stock/colors`) ; sans elle rien n'est grisé, et le
// paiement revérifie toujours côté serveur (409 out_of_stock).
export function ProductPurchase({
  productId,
  slug,
  name,
  basePriceCents,
  saleType,
  productionDays,
  productStock,
  weightGrams,
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
  /** Poids d'une pièce (g) : fonde le contrôle du filament des articles à la demande. */
  weightGrams: number | null;
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

  // Filament d'UNE pièce ; null = rien à contrôler (article en stock, sans poids).
  const needGrams = useMemo(
    () => (saleType === "on_demand" ? shopNeedGrams(weightGrams, 1) : null),
    [saleType, weightGrams],
  );
  const filament = useFilamentStock(needGrams !== null);
  const shortIds = useMemo(
    () =>
      new Set(
        needGrams === null || !filament
          ? []
          : colors
              .filter((c) => isShort(filament.refs, c.id, needGrams))
              .map((c) => c.id),
      ),
    [needGrams, filament, colors],
  );
  // La couleur proposée d'office (la première) peut être épuisée : dès que la
  // capacité arrive, on passe à la première disponible, tant que le visiteur n'a
  // rien choisi lui-même.
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current || !colorId || !shortIds.has(colorId)) return;
    const free = colors.find((c) => !shortIds.has(c.id));
    if (free) setColorId(free.id);
  }, [shortIds, colorId, colors, setColorId]);
  const colorShort = Boolean(selectedColor && shortIds.has(selectedColor.id));

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
    colorRef: selectedColor?.id ?? null,
    colorName: selectedColor?.name ?? null,
    colorHex: selectedColor?.hex ?? null,
    weightGrams,
  };
  // Le favori reste au niveau produit (prix de base, sans variante) ; il garde la
  // couleur proposée d'office : un produit à couleurs exige une couleur au paiement,
  // et « Ajouter au panier » depuis les favoris n'en choisit pas.
  const defaultColor = colors[0] ?? null;
  const favoriteItem = {
    productId,
    slug,
    name,
    priceCents: basePriceCents,
    imageUrl,
    saleType,
    colorRef: defaultColor?.id ?? null,
    colorName: defaultColor?.name ?? null,
    colorHex: defaultColor?.hex ?? null,
    weightGrams,
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
                {colorShort ? ` (${t("colorSoldOut")})` : ""}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2.5">
            {colors.map((c) => {
              const active = c.id === colorId;
              const out = shortIds.has(c.id);
              const label = out ? `${c.name} (${t("colorSoldOut")})` : c.name;
              return (
                <span key={c.id} className="relative inline-flex">
                  <button
                    type="button"
                    onClick={() => {
                      picked.current = true;
                      setColorId(c.id);
                    }}
                    aria-pressed={active}
                    aria-label={label}
                    title={label}
                    // Épuisée : non choisissable, sauf si c'est déjà la couleur choisie.
                    disabled={out && !active}
                    className={cx(
                      "h-9 w-9 rounded-full border transition-transform duration-300 ease-purge",
                      active
                        ? "scale-105 border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper"
                        : "border-swatch-ring hover:scale-105",
                      out && !active && "cursor-not-allowed hover:scale-100",
                    )}
                    style={chipBackground(c.hexes.length ? c.hexes : [c.hex])}
                  />
                  {out ? (
                    // Une barre en travers (comme au Studio) : la teinte reste EXACTE.
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-11 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-ink ring-1 ring-paper"
                    />
                  ) : null}
                </span>
              );
            })}
          </div>
          {colorShort ? (
            <output className="mt-3 block text-sm font-medium text-accent-text">
              {t("colorShort")}
            </output>
          ) : null}
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
            <AddToCart
              disabled={soldOut || colorShort}
              disabledLabel={
                colorShort && !soldOut ? t("colorSoldOut") : undefined
              }
              item={item}
            />
          </div>
          <FavoriteButton
            item={favoriteItem}
            size={20}
            className="grid w-[52px] shrink-0 place-items-center rounded-field border border-line bg-surface hover:border-ink"
          />
        </div>
        <BuyNow disabled={soldOut || colorShort} item={item} />
      </div>
    </div>
  );
}

import { ViewTransition } from "react";
import { Palette } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatChf } from "@/lib/format";
import { cfImage } from "@/lib/cf-image";
import { attributionFor } from "@/lib/attribution";
import { AddToCartMini } from "@/components/add-to-cart";
import { FilamentChip, wheelOrder } from "@/components/filament-chip";
import { FavoriteButton } from "@/components/favorite-button";
import { MulticolorDots } from "@/components/multicolor-dots";
import type { ProductCardItem } from "@/components/product-card";
import { ButtonLink } from "@/components/ui/button";
import { SiteLink } from "@/components/ui/site-link";
import { SpecTable, type SpecRow } from "@/components/ui/spec-table";
import { registryRef } from "./specs";
import "./morph.css";

// « Planche » éditoriale d'un produit (brief « Strates », §7.8) : quand le
// catalogue ne compte qu'un ou deux articles et qu'aucun filtre n'est actif,
// une grille de cartes aurait l'air vide. Chaque produit occupe donc une
// planche de cartographe : grande photo, fiche d'identité `<dl>` (matière,
// dimensions, poids, délai, provenance), prix, roue des couleurs vendues,
// action, et la ligne d'attribution du design quand le modèle n'est pas de nous.
// Même logique d'achat que ProductCard : un article à couleurs mène à la fiche
// (« Choisir la couleur ») ; sans couleur, ajout rapide (`Product Added` source
// `catalog`) et lien vers la fiche.
export function ProductPlate({
  product,
  index,
  primary = false,
  weightGrams = null,
}: {
  product: ProductCardItem;
  /** Rang dans la liste : la référence « N° 001 » et le rouge de la première. */
  index: number;
  /** Rouge seulement sur la première planche (un seul bouton rouge par écran). */
  primary?: boolean;
  weightGrams?: number | null;
}) {
  const t = useTranslations("product");
  const tc = useTranslations("catalog.card");
  const tp = useTranslations("catalog.plate");
  const ta = useTranslations("catalog.attribution");
  const locale = useLocale();

  const firstColor = product.colors[0];
  const item = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    priceCents: product.priceCents,
    imageUrl: product.imageUrl,
    saleType: product.saleType,
    colorRef: firstColor?.id ?? null,
    colorName: firstColor?.name ?? null,
    colorHex: firstColor?.hex ?? null,
    weightGrams: product.weightGrams,
  };
  const soldOut = product.saleType === "stock" && product.stock === 0;
  const chooseColor = product.colors.length > 0 && !soldOut;
  const attribution = attributionFor(product.slug);
  // Premier paragraphe = le résumé (celui de la meta description).
  const summary = product.description.split(/\n\s*\n/)[0]?.trim();

  const candidates: (SpecRow | null)[] = [
    { term: t("material"), value: product.material },
    product.dimensionsMm
      ? { term: t("dimensions"), value: product.dimensionsMm }
      : null,
    weightGrams ? { term: t("weight"), value: `${weightGrams} g` } : null,
    product.saleType === "on_demand"
      ? {
          term: t("productionTime"),
          value: t("productionDays", { days: product.productionDays ?? 3 }),
        }
      : null,
    { term: t("origin"), value: t("originValue") },
  ];
  const rows = candidates.filter((row): row is SpecRow => row !== null);

  return (
    <article className="s3d-grid items-start gap-y-8 border-t border-line pt-10 first:border-t-0 first:pt-0">
      <div className="relative col-span-full md:col-span-4 lg:col-span-7">
        <ViewTransition
          name={`product-${product.slug}`}
          share="morph"
          default="none"
        >
          <div className="relative aspect-square overflow-hidden rounded-card border border-line bg-surface">
            <div className="s3d-print absolute inset-0">
              {product.imageUrl && (
                <img
                  src={cfImage(product.imageUrl, { width: 1200 })}
                  alt={product.imageAlt ?? product.name}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : undefined}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            {product.multicolor && (
              <span className="s3d-label absolute left-4 top-4 flex items-center gap-1.5 rounded-hair bg-paper/90 px-2 py-1 normal-case text-ink">
                <MulticolorDots size={6} />
                {t("multicolorBadge")}
              </span>
            )}
          </div>
        </ViewTransition>
      </div>

      <div className="col-span-full md:col-span-4 lg:col-span-5">
        <p className="s3d-label text-soft">
          {tp("ref", { n: registryRef(index) })}
        </p>
        <h2 className="mt-3 font-display text-title text-ink">
          <SiteLink
            href={`/products/${product.slug}`}
            coupe={false}
            className="hover:underline hover:decoration-iso-index hover:decoration-1 hover:underline-offset-4"
          >
            {product.name}
          </SiteLink>
        </h2>
        {summary && <p className="mt-4 max-w-[65ch] text-soft">{summary}</p>}

        <SpecTable className="mt-6" rows={rows} />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="s3d-num font-display text-title text-ink">
            {formatChf(product.priceCents, locale)}
          </p>
          {product.colors.length > 0 && (
            // Tous les articles proposent les couleurs du stock : la roue de
            // leurs teintes et leur nombre, comme sur les cartes (le détail, avec
            // les couleurs épuisées, est sur la fiche).
            <p className="s3d-label flex items-center gap-2 normal-case text-soft">
              <FilamentChip
                hexes={wheelOrder(product.colors.map((c) => c.hex))}
                size={18}
              />
              {tc("colors", { count: product.colors.length })}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-stretch gap-3">
          <div className="min-w-40 flex-1">
            {chooseColor ? (
              <ButtonLink
                href={`/products/${product.slug}`}
                coupe={false}
                variant={primary ? "primary" : "secondary"}
                size="md"
                full
              >
                <Palette size={16} aria-hidden="true" />
                {tc("chooseColor")}
              </ButtonLink>
            ) : (
              <AddToCartMini
                item={item}
                disabled={soldOut}
                variant={primary ? "primary" : "secondary"}
                size="md"
              />
            )}
          </div>
          <FavoriteButton
            item={item}
            size={18}
            className="grid w-11 shrink-0 place-items-center rounded-field border border-line bg-surface hover:border-ink"
          />
          {/* « Choisir la couleur » mène déjà à la fiche : pas de second lien. */}
          {!chooseColor && (
            <ButtonLink
              href={`/products/${product.slug}`}
              variant="ink"
              size="md"
              className="shrink-0"
            >
              {tp("view")}
            </ButtonLink>
          )}
        </div>

        {attribution && (
          <p className="s3d-label mt-5 normal-case text-soft">
            {ta("short", {
              author: attribution.author,
              license: attribution.license,
            })}
            {" · "}
            <SiteLink
              href={`/products/${product.slug}#credit`}
              className="underline decoration-iso-index decoration-1 underline-offset-4 hover:decoration-ink"
            >
              {ta("seeCredit")}
            </SiteLink>
          </p>
        )}
      </div>
    </article>
  );
}

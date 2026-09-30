import { ViewTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatChf } from "@/lib/format";
import { cfImage } from "@/lib/cf-image";
import type { ProductListItem } from "@/db/queries";
import { cx } from "@/components/ui/cx";
import { SiteLink } from "@/components/ui/site-link";
import { heightMmOf } from "@/components/catalog/specs";
import "@/components/catalog/morph.css";
import { MulticolorDots } from "./multicolor-dots";
import { AddToCartMini } from "./add-to-cart";
import { FavoriteButton } from "./favorite-button";
import styles from "./product-card.module.css";

// `ProductListItem` (src/db/queries.ts) ne porte ni le texte de dimensions ni
// la 2ᵉ photo : la boutique les ajoute (catalog/card-extras.ts). L'accueil et
// les produits liés passent un `ProductListItem` nu, la carte s'en contente.
export interface ProductCardItem extends ProductListItem {
  dimensionsMm?: string | null;
  secondImage?: { url: string; alt: string | null } | null;
}

// Carte produit (brief « Strates », §7.8) : image, nom (h2 + lien étiré), prix,
// une ligne mono où l'unité réelle passe d'abord (« Hauteur 209 mm · PLA · 3 j »),
// pastilles, favori, ajout rapide en contour (un seul rouge par écran). L'image
// porte le nom de transition `product-<slug>` : elle glisse jusqu'à la galerie
// de la fiche (« morph », classe posée par share="morph").
export function ProductCard({
  product,
  priority = false,
  heading: Heading = "h2",
}: {
  product: ProductCardItem;
  /** Première rangée de l'écran : image chargée tout de suite (LCP). */
  priority?: boolean;
  /** Niveau du titre : h3 quand la carte vit sous un chapitre (h2). */
  heading?: "h2" | "h3";
}) {
  const t = useTranslations("product");
  const tc = useTranslations("catalog.card");
  const locale = useLocale();

  // Ajout rapide depuis la carte : si le produit a des couleurs, on prend la
  // première par défaut (le choix fin se fait sur la fiche produit).
  const firstColor = product.colors[0];
  const item = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    priceCents: product.priceCents,
    imageUrl: product.imageUrl,
    saleType: product.saleType,
    colorName: firstColor?.name ?? null,
    colorHex: firstColor?.hex ?? null,
  };

  const soldOut = product.saleType === "stock" && product.stock === 0;
  const height = heightMmOf(product.dimensionsMm);
  const facts = [
    height === null
      ? null
      : tc("height", {
          height: new Intl.NumberFormat(`${locale}-CH`, {
            maximumFractionDigits: 1,
          }).format(height),
        }),
    product.material,
    product.saleType === "stock"
      ? soldOut
        ? t("outOfStock")
        : t("inStock")
      : tc("days", { days: product.productionDays ?? 3 }),
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <article className={cx("group relative flex flex-col", styles.card)}>
      <ViewTransition
        name={`product-${product.slug}`}
        share="morph"
        default="none"
      >
        <div className="relative aspect-square overflow-hidden rounded-card border border-line bg-surface">
          <div className="s3d-print absolute inset-0">
            {product.imageUrl && (
              <img
                src={cfImage(product.imageUrl, { width: 600 })}
                alt={product.imageAlt ?? product.name}
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : undefined}
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}
            {product.secondImage && (
              <img
                src={cfImage(product.secondImage.url, { width: 600 })}
                alt=""
                loading="lazy"
                decoding="async"
                className={styles.second}
              />
            )}
          </div>
          {product.multicolor && (
            <span className="s3d-label absolute left-3 top-3 flex items-center gap-1.5 rounded-hair bg-paper/90 px-2 py-1 normal-case text-ink">
              <MulticolorDots size={6} />
              {t("multicolorBadge")}
            </span>
          )}
          <FavoriteButton
            item={item}
            className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-paper/90"
          />
        </div>
      </ViewTransition>

      <div className="flex flex-1 flex-col pt-3">
        <Heading className="font-display text-[1.0625rem] font-bold leading-snug tracking-tight text-ink">
          {/* Le morph fait le travail de transition : pas de « Coupe » sur un
            clic de carte, mais la buse d'attente du header (page dynamique). */}
          <SiteLink
            href={`/products/${product.slug}`}
            coupe={false}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ink"
          >
            {product.name}
          </SiteLink>
        </Heading>
        <p
          className={cx(
            "s3d-label mt-1.5 normal-case",
            soldOut ? "text-accent-text" : "text-soft",
          )}
        >
          {facts.join(" · ")}
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="s3d-num font-semibold text-ink">
            {formatChf(product.priceCents, locale)}
          </p>
          {product.colors.length > 0 && (
            <div className="flex items-center gap-1.5">
              {product.colors.slice(0, 5).map((c) => (
                <span
                  key={c.name}
                  title={c.name}
                  className="h-3.5 w-3.5 rounded-full border border-swatch-ring"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              {product.colors.length > 5 && (
                <span className="s3d-label normal-case text-soft">
                  +{product.colors.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="relative z-10 mt-3">
          <AddToCartMini item={item} disabled={soldOut} />
        </div>
      </div>
    </article>
  );
}

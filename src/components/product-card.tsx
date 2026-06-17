import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatChf } from "@/lib/format";
import { cfImage } from "@/lib/cf-image";
import type { ProductListItem } from "@/db/queries";
import { MulticolorDots } from "./multicolor-dots";
import { AddToCartMini } from "./add-to-cart";
import { FavoriteButton } from "./favorite-button";

export function ProductCard({ product }: { product: ProductListItem }) {
  const t = useTranslations("product");
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

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-soft/30 hover:shadow-xl hover:shadow-ink/[0.07] dark:hover:shadow-black/40"
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-paper to-line/40">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cfImage(product.imageUrl, { width: 600 })}
            alt={product.imageAlt ?? product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
        {product.multicolor && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
            <MulticolorDots size={6} />
            {t("multicolorBadge")}
          </span>
        )}
        <FavoriteButton
          item={item}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-surface/90 backdrop-blur"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-semibold leading-snug">{product.name}</h3>
        <p
          className={`text-xs ${
            product.saleType === "stock" && product.stock === 0
              ? "font-semibold text-accent"
              : "text-soft"
          }`}
        >
          {product.saleType === "stock"
            ? product.stock === 0
              ? t("outOfStock")
              : t("inStock")
            : t("onDemand", { days: product.productionDays ?? 3 })}
        </p>
        <p className="mt-2 font-semibold tabular-nums">
          {formatChf(product.priceCents, locale)}
        </p>
        {product.colors.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            {product.colors.slice(0, 5).map((c) => (
              <span
                key={c.name}
                title={c.name}
                className="h-3.5 w-3.5 rounded-full border border-black/10"
                style={{ backgroundColor: c.hex }}
              />
            ))}
            {product.colors.length > 5 && (
              <span className="text-[11px] font-medium text-soft">
                +{product.colors.length - 5}
              </span>
            )}
          </div>
        )}
        <div className="mt-3">
          <AddToCartMini
            item={item}
            disabled={product.saleType === "stock" && product.stock === 0}
          />
        </div>
      </div>
    </Link>
  );
}

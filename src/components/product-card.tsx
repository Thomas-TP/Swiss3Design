import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatChf } from "@/lib/format";
import type { ProductListItem } from "@/db/queries";
import { MulticolorDots } from "./multicolor-dots";

export function ProductCard({ product }: { product: ProductListItem }) {
  const t = useTranslations("product");
  const locale = useLocale();

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-ink/5"
    >
      <div className="relative aspect-square overflow-hidden bg-line/30">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.imageAlt ?? product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
        {product.multicolor && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
            <MulticolorDots size={6} />
            {t("multicolorBadge")}
          </span>
        )}
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
      </div>
    </Link>
  );
}

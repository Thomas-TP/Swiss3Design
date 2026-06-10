import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getProductBySlug } from "@/db/queries";
import { formatChf } from "@/lib/format";
import { AddToCart } from "@/components/add-to-cart";
import { MulticolorDots } from "@/components/multicolor-dots";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  const [t, product] = await Promise.all([
    getTranslations("product"),
    getProductBySlug(slug, locale),
  ]);
  if (!product) notFound();

  const image = product.images[0];
  const specs = [
    { label: t("material"), value: product.material },
    { label: t("dimensions"), value: product.dimensionsMm },
    {
      label: t("weight"),
      value: product.weightGrams ? `${product.weightGrams} g` : null,
    },
  ].filter((s) => s.value);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-16">
      <Link
        href="/shop"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        {t("backToShop")}
      </Link>

      <div className="grid gap-8 md:grid-cols-2 md:gap-14">
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt={image.alt ?? product.name}
              className="aspect-square w-full object-cover"
            />
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            {product.multicolor && (
              <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold">
                <MulticolorDots size={6} />
                {t("multicolorBadge")}
              </span>
            )}
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                product.saleType === "stock"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {product.saleType === "stock"
                ? t("inStock")
                : t("onDemand", { days: product.productionDays ?? 3 })}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            {product.name}
          </h1>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {formatChf(product.priceCents, locale)}
          </p>
          <p className="mt-5 leading-relaxed text-soft">
            {product.description}
          </p>

          <div className="mt-8">
            <AddToCart
              item={{
                productId: product.id,
                slug: product.slug,
                name: product.name,
                priceCents: product.priceCents,
                imageUrl: image?.url ?? null,
                saleType: product.saleType,
              }}
            />
          </div>

          {specs.length > 0 && (
            <dl className="mt-10 divide-y divide-line border-t border-line text-sm">
              <p className="pt-4 font-semibold">{t("details")}</p>
              {specs.map((s) => (
                <div key={s.label} className="flex justify-between py-3">
                  <dt className="text-soft">{s.label}</dt>
                  <dd className="font-medium">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

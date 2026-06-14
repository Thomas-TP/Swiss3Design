import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getProductBySlug } from "@/db/queries";
import { MulticolorDots } from "@/components/multicolor-dots";
import { ProductGallery } from "@/components/product-gallery";
import { ProductPurchase } from "@/components/product-purchase";

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
        <ProductGallery images={product.images} name={product.name} />

        <div className="flex flex-col">
          {product.multicolor && (
            <span className="flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold">
              <MulticolorDots size={6} />
              {t("multicolorBadge")}
            </span>
          )}

          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            {product.name}
          </h1>
          <p className="mt-4 leading-relaxed text-soft">
            {product.description}
          </p>

          <ProductPurchase
            productId={product.id}
            slug={product.slug}
            name={product.name}
            basePriceCents={product.priceCents}
            saleType={product.saleType}
            productionDays={product.productionDays}
            productStock={product.stock}
            imageUrl={image?.url ?? null}
            variants={product.variants.map((v) => ({
              id: v.id,
              name: v.name,
              priceCents: v.priceCents,
              stock: v.stock,
            }))}
          />

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

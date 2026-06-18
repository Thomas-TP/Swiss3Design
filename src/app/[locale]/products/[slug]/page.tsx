import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  getProductBySlug,
  getRelatedProducts,
  getPublishedReviews,
  getRatingSummary,
} from "@/db/queries";
import { alternatesFor, productJsonLd } from "@/lib/seo";
import { MulticolorDots } from "@/components/multicolor-dots";
import { ProductGallery } from "@/components/product-gallery";
import { ProductColorProvider } from "@/components/product-color-context";
import { ProductPurchase } from "@/components/product-purchase";
import { ProductCard } from "@/components/product-card";
import { StarRating } from "@/components/star-rating";

export const dynamic = "force-dynamic";

// Mémoïse la lecture produit le temps de la requête : generateMetadata et le
// rendu de la page partagent ainsi UNE seule lecture D1 au lieu de deux.
const getProduct = cache(getProductBySlug);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getProduct(slug, locale);
  if (!product) return {};
  const description = product.description.slice(0, 160);
  const images = product.images.map((i) => i.url);
  return {
    title: product.name,
    description,
    alternates: alternatesFor(locale, `/products/${slug}`),
    openGraph: {
      type: "website",
      title: product.name,
      description,
      images: images.length > 0 ? images : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  const [t, product, nonce] = await Promise.all([
    getTranslations("product"),
    getProduct(slug, locale),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);
  if (!product) notFound();

  const [related, productReviews, ratingSummary, tReviews] = await Promise.all([
    getRelatedProducts(product.id, locale),
    getPublishedReviews(product.id),
    getRatingSummary(product.id),
    getTranslations("reviews"),
  ]);

  // Données structurées Product (prix/dispo CHF) → résultats enrichis Google.
  // Le nonce est requis en prod (CSP sans 'unsafe-inline'), cf. golden rule #4.
  const jsonLd = productJsonLd(
    {
      slug: product.slug,
      name: product.name,
      description: product.description,
      priceCents: product.priceCents,
      saleType: product.saleType,
      stock: product.stock,
      material: product.material,
      imageUrls: product.images.map((i) => i.url),
    },
    locale,
    ratingSummary,
  );

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
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link
        href="/shop"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        {t("backToShop")}
      </Link>

      <ProductColorProvider colors={product.colors}>
       <div className="grid gap-8 md:grid-cols-2 md:gap-14">
        <div>
          <ProductGallery
            images={product.images}
            name={product.name}
            model3dUrl={product.model3dUrl}
          />
        </div>

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

          {ratingSummary.count > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <StarRating value={ratingSummary.average} size={15} />
              <span className="text-sm text-soft">
                {tReviews("count", { count: ratingSummary.count })}
              </span>
            </div>
          )}

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
      </ProductColorProvider>

      {productReviews.length > 0 && (
        <section className="mt-16 md:mt-24">
          <h2 className="text-2xl font-bold tracking-tight">
            {tReviews("title")}
          </h2>
          <ul className="mt-6 space-y-4">
            {productReviews.map((r) => (
              <li
                key={r.id}
                className="rounded-card border border-line bg-surface p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{r.authorName}</span>
                  <StarRating value={r.rating} size={14} />
                </div>
                <p className="mt-1 text-xs text-soft">
                  {r.createdAt.toLocaleDateString(`${locale}-CH`)}
                </p>
                {r.body && (
                  <p className="mt-3 leading-relaxed text-soft">{r.body}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-16 md:mt-24">
          <h2 className="text-2xl font-bold tracking-tight">
            {t("relatedTitle")}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

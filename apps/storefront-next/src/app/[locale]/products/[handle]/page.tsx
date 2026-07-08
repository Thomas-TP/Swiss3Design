import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, Truck, Factory, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { medusa } from "@/lib/medusa";
import { getProductColors } from "@/lib/materials";
import { alternatesFor, productJsonLd } from "@/lib/seo";
import { MulticolorDots } from "@/components/multicolor-dots";
import { ProductGallery } from "@/components/product-gallery";
import { ProductColorProvider } from "@/components/product-color-context";
import { ProductPurchase } from "@/components/product-purchase";
import { ProductCard, type StoreProductSummary } from "@/components/product-card";
import { StarRating } from "@/components/star-rating";

export const dynamic = "force-dynamic";

interface RawImage {
  url: string;
}
interface RawVariant {
  id: string;
  title: string;
  weight?: number | null;
  manage_inventory?: boolean;
  inventory_quantity?: number | null;
  calculated_price?: { calculated_amount?: number } | null;
}
interface RawProduct {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  material: string | null;
  thumbnail: string | null;
  metadata: Record<string, unknown> | null;
  images?: RawImage[];
  variants?: RawVariant[];
  categories?: { id: string }[];
}
interface StoreReview {
  id: string;
  author_name: string;
  rating: number;
  body: string | null;
  created_at: string;
}

async function getProduct(handle: string) {
  const { regions } = await medusa.store.region.list();
  const swiss = regions.find((r: { currency_code: string }) => r.currency_code === "chf") ?? regions[0];

  const { products } = (await medusa.store.product.list({
    handle: [handle],
    region_id: swiss?.id,
    fields:
      "id,title,handle,description,material,thumbnail,metadata,*images,*variants,*variants.calculated_price,variants.inventory_quantity,variants.manage_inventory,*categories",
  })) as { products: RawProduct[] };

  const product = products[0];
  if (!product) return null;

  const [colors, { reviews, summary }] = await Promise.all([
    getProductColors(product.id),
    medusa.client.fetch<{ reviews: StoreReview[]; summary: { average: number; count: number } }>("/store/reviews", {
      query: { product_id: product.id },
    }),
  ]);

  const categoryId = product.categories?.[0]?.id;
  let related: StoreProductSummary[] = [];
  if (categoryId) {
    const { products: relatedRaw } = (await medusa.store.product.list({
      category_id: [categoryId],
      region_id: swiss?.id,
      fields: "id,title,handle,thumbnail,metadata,*variants.calculated_price",
    })) as { products: RawProduct[] };
    related = relatedRaw
      .filter((p) => p.id !== product.id)
      .slice(0, 4)
      .map((p) => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        thumbnail: p.thumbnail,
        priceAmount: p.variants?.[0]?.calculated_price?.calculated_amount ?? null,
        multicolor: Boolean(p.metadata?.multicolor),
      }));
  }

  return { product, colors, reviews, summary, related };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; handle: string }>;
}): Promise<Metadata> {
  const { locale, handle } = await params;
  const data = await getProduct(handle);
  if (!data) return {};
  const description = (data.product.description ?? "").slice(0, 160);
  return {
    title: data.product.title,
    description,
    alternates: alternatesFor(locale, `/products/${handle}`),
    openGraph: {
      type: "website",
      title: data.product.title,
      description,
      images: data.product.images?.map((i) => i.url),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; handle: string }>;
}) {
  const { locale, handle } = await params;
  const [t, tReviews, tHome, data, nonce] = await Promise.all([
    getTranslations("product"),
    getTranslations("reviews"),
    getTranslations("home"),
    getProduct(handle),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);
  if (!data) notFound();

  const { product, colors, reviews, summary, related } = data;
  const metadata = product.metadata ?? {};
  const multicolor = Boolean(metadata.multicolor);
  const saleType = (metadata.sale_type === "stock" ? "stock" : "on_demand") as "stock" | "on_demand";
  const productionDays = typeof metadata.production_days === "number" ? metadata.production_days : null;
  const dimensionsMm = typeof metadata.dimensions_mm === "string" ? metadata.dimensions_mm : null;
  const weightGrams = product.variants?.[0]?.weight ?? null;

  const images =
    product.images && product.images.length > 0
      ? product.images.map((img) => ({ url: img.url, alt: null }))
      : product.thumbnail
        ? [{ url: product.thumbnail, alt: product.title }]
        : [];

  const variants = (product.variants ?? []).map((v) => ({
    id: v.id,
    title: v.title,
    priceAmount: v.calculated_price?.calculated_amount ?? 0,
    outOfStock: v.manage_inventory ? (v.inventory_quantity ?? 0) <= 0 : false,
  }));

  const specs = [
    { label: t("material"), value: product.material },
    { label: t("dimensions"), value: dimensionsMm },
    { label: t("weight"), value: weightGrams ? `${weightGrams} g` : null },
  ].filter((s): s is { label: string; value: string } => Boolean(s.value));

  const jsonLd = productJsonLd(
    {
      handle: product.handle,
      name: product.title,
      description: product.description ?? "",
      priceAmount: variants[0]?.priceAmount ?? 0,
      saleType,
      outOfStock: saleType === "stock" && (variants[0]?.outOfStock ?? false),
      material: product.material,
      imageUrls: images.map((i) => i.url),
    },
    locale,
    summary,
  );

  const model3dUrl = typeof metadata.model_3d_url === "string" ? metadata.model_3d_url : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-16">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/shop" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink">
        <ArrowLeft size={15} />
        {t("backToShop")}
      </Link>

      <ProductColorProvider colors={colors}>
        <div className="grid gap-8 md:grid-cols-2 md:gap-14">
          <div>
            <ProductGallery images={images} name={product.title} model3dUrl={model3dUrl} />
          </div>

          <div className="flex flex-col md:sticky md:top-24 md:self-start">
            {multicolor && (
              <span className="flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold">
                <MulticolorDots size={6} />
                {t("multicolorBadge")}
              </span>
            )}

            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">{product.title}</h1>
            {product.description && <p className="mt-4 leading-relaxed text-soft">{product.description}</p>}

            {summary.count > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <StarRating value={summary.average} size={15} />
                <span className="text-sm text-soft">{tReviews("count", { count: summary.count })}</span>
              </div>
            )}

            <ProductPurchase
              productId={product.id}
              name={product.title}
              imageUrl={product.thumbnail}
              saleType={saleType}
              productionDays={productionDays}
              variants={variants}
            />

            <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-3">
              {[
                { Icon: Truck, label: tHome("trustShippingTitle") },
                { Icon: Factory, label: tHome("trustMadeTitle") },
                { Icon: ShieldCheck, label: tHome("trustPaymentTitle") },
              ].map(({ Icon, label }) => (
                <li key={label} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
                  <Icon size={16} strokeWidth={1.8} className="shrink-0 text-accent" />
                  <span className="text-xs font-semibold leading-tight">{label}</span>
                </li>
              ))}
            </ul>

            {specs.length > 0 && (
              <dl className="mt-8 divide-y divide-line border-t border-line text-sm">
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

      {reviews.length > 0 && (
        <section className="mt-16 md:mt-24">
          <span className="flex h-1 w-10 rounded-full bg-accent" />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-2xl font-bold tracking-tight">{tReviews("title")}</h2>
            <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1">
              <StarRating value={summary.average} size={14} />
              <span className="text-sm font-semibold tabular-nums">{summary.average.toFixed(1)}</span>
              <span className="text-xs text-soft">{tReviews("count", { count: summary.count })}</span>
            </span>
          </div>
          <ul className="mt-6 space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-card border border-line bg-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{r.author_name}</span>
                  <StarRating value={r.rating} size={14} />
                </div>
                <p className="mt-1 text-xs text-soft">{new Date(r.created_at).toLocaleDateString(`${locale}-CH`)}</p>
                {r.body && <p className="mt-3 leading-relaxed text-soft">{r.body}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-16 md:mt-24">
          <span className="flex h-1 w-10 rounded-full bg-accent" />
          <h2 className="mt-3 text-2xl font-bold tracking-tight">{t("relatedTitle")}</h2>
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

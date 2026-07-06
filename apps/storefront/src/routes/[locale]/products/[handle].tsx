import { For, Show, Suspense, createResource } from "solid-js";
import { A, type RouteSectionProps } from "@solidjs/router";
import { ArrowLeft, Truck, Factory, ShieldCheck } from "lucide-solid";
import { useI18n } from "../../../i18n/context";
import { medusa } from "../../../lib/medusa";
import { MulticolorDots } from "../../../components/multicolor-dots";
import { ProductGallery } from "../../../components/product-gallery";
import { ProductColorProvider } from "../../../components/product-color-context";
import { ProductPurchase } from "../../../components/product-purchase";
import { ProductCard, type StoreProductSummary } from "../../../components/product-card";
import { StarRating } from "../../../components/star-rating";

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
interface StoreColor {
  id: string;
  name: string;
  hex: string;
}
interface StoreReview {
  id: string;
  author_name: string;
  rating: number;
  body: string | null;
  created_at: string;
}

async function fetchProductData(handle: string) {
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

  const [{ colors }, { reviews, summary }] = await Promise.all([
    medusa.client.fetch<{ colors: StoreColor[] }>(`/store/products/${product.id}/colors`),
    medusa.client.fetch<{ reviews: StoreReview[]; summary: { average: number; count: number } }>(
      "/store/reviews",
      { query: { product_id: product.id } },
    ),
  ]);

  const categoryId = product.categories?.[0]?.id;
  let related: StoreProductSummary[] = [];
  if (categoryId) {
    const { products: relatedRaw } = (await medusa.store.product.list({
      category_id: [categoryId],
      region_id: swiss?.id,
      fields: "id,title,handle,thumbnail,*variants.calculated_price",
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
      }));
  }

  return { product, colors, reviews, summary, related };
}

export default function ProductPage(props: RouteSectionProps) {
  const { t, locale } = useI18n();
  const [data] = createResource(() => props.params.handle, fetchProductData);

  return (
    <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-16">
      <A
        href={`/${locale()}/shop`}
        class="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        {t("product.backToShop")}
      </A>

      <Suspense fallback={<p class="text-center text-sm text-soft">{t("common.loading")}</p>}>
        <Show
          when={data()}
          fallback={
            <Show when={!data.loading}>
              <p class="text-center text-soft">{t("product.notFound")}</p>
            </Show>
          }
        >
          {(d) => {
            const product = () => d().product;
            const metadata = () => product().metadata ?? {};
            const multicolor = () => Boolean(metadata().multicolor);
            const saleType = () => (metadata().sale_type === "stock" ? "stock" : "on_demand") as "stock" | "on_demand";
            const productionDays = () => (typeof metadata().production_days === "number" ? (metadata().production_days as number) : null);
            const dimensionsMm = () => (typeof metadata().dimensions_mm === "string" ? (metadata().dimensions_mm as string) : null);
            const weightGrams = () => product().variants?.[0]?.weight ?? null;
            const images = () =>
              product().images && product().images!.length > 0
                ? product().images!.map((img) => ({ url: img.url, alt: null }))
                : product().thumbnail
                  ? [{ url: product().thumbnail as string, alt: product().title }]
                  : [];
            const variants = () =>
              (product().variants ?? []).map((v) => ({
                id: v.id,
                title: v.title,
                priceAmount: v.calculated_price?.calculated_amount ?? 0,
                outOfStock: v.manage_inventory ? (v.inventory_quantity ?? 0) <= 0 : false,
              }));
            const specs = () =>
              [
                { label: t("product.material"), value: product().material },
                { label: t("product.dimensions"), value: dimensionsMm() },
                { label: t("product.weight"), value: weightGrams() ? `${weightGrams()} g` : null },
              ].filter((s): s is { label: string; value: string } => Boolean(s.value));

            return (
              <>
                <ProductColorProvider colors={d().colors}>
                  <div class="grid gap-8 md:grid-cols-2 md:gap-14">
                    <div>
                      <ProductGallery images={images()} name={product().title} />
                    </div>

                    <div class="flex flex-col md:sticky md:top-24 md:self-start">
                      <Show when={multicolor()}>
                        <span class="flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold">
                          <MulticolorDots size={6} />
                          {t("product.multicolorBadge")}
                        </span>
                      </Show>

                      <h1 class="mt-4 text-3xl font-bold tracking-tight md:text-4xl">{product().title}</h1>
                      <Show when={product().description}>
                        <p class="mt-4 leading-relaxed text-soft">{product().description}</p>
                      </Show>

                      <Show when={d().summary.count > 0}>
                        <div class="mt-3 flex items-center gap-2">
                          <StarRating value={d().summary.average} size={15} />
                          <span class="text-sm text-soft">{t("reviews.count", { count: d().summary.count })}</span>
                        </div>
                      </Show>

                      <ProductPurchase
                        productId={product().id}
                        handle={product().handle}
                        name={product().title}
                        imageUrl={product().thumbnail}
                        saleType={saleType()}
                        productionDays={productionDays()}
                        variants={variants()}
                      />

                      <ul class="mt-6 grid gap-2 text-sm sm:grid-cols-3">
                        <For
                          each={[
                            { Icon: Truck, label: t("home.trustShippingTitle") },
                            { Icon: Factory, label: t("home.trustMadeTitle") },
                            { Icon: ShieldCheck, label: t("home.trustPaymentTitle") },
                          ]}
                        >
                          {({ Icon, label }) => (
                            <li class="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
                              <Icon size={16} stroke-width={1.8} class="shrink-0 text-accent" />
                              <span class="text-xs font-semibold leading-tight">{label}</span>
                            </li>
                          )}
                        </For>
                      </ul>

                      <Show when={specs().length > 0}>
                        <dl class="mt-8 divide-y divide-line border-t border-line text-sm">
                          <p class="pt-4 font-semibold">{t("product.details")}</p>
                          <For each={specs()}>
                            {(s) => (
                              <div class="flex justify-between py-3">
                                <dt class="text-soft">{s.label}</dt>
                                <dd class="font-medium">{s.value}</dd>
                              </div>
                            )}
                          </For>
                        </dl>
                      </Show>
                    </div>
                  </div>
                </ProductColorProvider>

                <Show when={d().reviews.length > 0}>
                  <section class="mt-16 md:mt-24">
                    <span class="flex h-1 w-10 rounded-full bg-accent" />
                    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <h2 class="text-2xl font-bold tracking-tight">{t("reviews.title")}</h2>
                      <span class="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1">
                        <StarRating value={d().summary.average} size={14} />
                        <span class="text-sm font-semibold tabular-nums">{d().summary.average.toFixed(1)}</span>
                        <span class="text-xs text-soft">{t("reviews.count", { count: d().summary.count })}</span>
                      </span>
                    </div>
                    <ul class="mt-6 space-y-4">
                      <For each={d().reviews}>
                        {(r) => (
                          <li class="rounded-card border border-line bg-surface p-5">
                            <div class="flex items-center justify-between gap-3">
                              <span class="font-semibold">{r.author_name}</span>
                              <StarRating value={r.rating} size={14} />
                            </div>
                            <p class="mt-1 text-xs text-soft">
                              {new Date(r.created_at).toLocaleDateString(`${locale()}-CH`)}
                            </p>
                            <Show when={r.body}>
                              <p class="mt-3 leading-relaxed text-soft">{r.body}</p>
                            </Show>
                          </li>
                        )}
                      </For>
                    </ul>
                  </section>
                </Show>

                <Show when={d().related.length > 0}>
                  <section class="mt-16 md:mt-24">
                    <span class="flex h-1 w-10 rounded-full bg-accent" />
                    <h2 class="mt-3 text-2xl font-bold tracking-tight">{t("product.relatedTitle")}</h2>
                    <div class="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                      <For each={d().related}>{(p) => <ProductCard product={p} />}</For>
                    </div>
                  </section>
                </Show>
              </>
            );
          }}
        </Show>
      </Suspense>
    </div>
  );
}

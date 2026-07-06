import { For, Show, Suspense, createResource, createMemo } from "solid-js";
import { A, useSearchParams } from "@solidjs/router";
import { Search } from "lucide-solid";
import { useI18n } from "../../i18n/context";
import { medusa } from "../../lib/medusa";
import { PageHeader } from "../../components/page-header";
import { ProductCard, type StoreProductSummary } from "../../components/product-card";

type Sort = "new" | "price_asc" | "price_desc";
const SORTS: Sort[] = ["new", "price_asc", "price_desc"];

interface RawCategory {
  id: string;
  name: string;
  handle: string;
}

interface RawProduct {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  created_at?: string;
  variants?: { calculated_price?: { calculated_amount?: number } | null }[];
}

async function fetchShopData(params: {
  category?: string;
  q?: string;
  sort: Sort;
}) {
  const { regions } = await medusa.store.region.list();
  const swiss = regions.find((r: { currency_code: string }) => r.currency_code === "chf") ?? regions[0];

  const { product_categories } = (await medusa.store.category.list({
    fields: "id,name,handle",
  })) as { product_categories: RawCategory[] };

  const category = product_categories.find((c) => c.handle === params.category);

  const order = params.sort === "price_asc" ? "variants.prices.amount" : params.sort === "price_desc" ? "-variants.prices.amount" : "-created_at";

  const { products } = (await medusa.store.product.list({
    region_id: swiss?.id,
    category_id: category ? [category.id] : undefined,
    q: params.q || undefined,
    order,
    fields: "id,title,handle,thumbnail,created_at,*variants.calculated_price",
  })) as { products: RawProduct[] };

  return {
    categories: product_categories,
    products: products.map(
      (p): StoreProductSummary => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        thumbnail: p.thumbnail,
        priceAmount: p.variants?.[0]?.calculated_price?.calculated_amount ?? null,
      }),
    ),
  };
}

export default function ShopPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();

  const category = () => (typeof searchParams.category === "string" ? searchParams.category : undefined);
  const q = () => (typeof searchParams.q === "string" ? searchParams.q : "");
  const sort = createMemo<Sort>(() => {
    const raw = searchParams.sort;
    return typeof raw === "string" && SORTS.includes(raw as Sort) ? (raw as Sort) : "new";
  });

  const [data] = createResource(
    () => ({ category: category(), q: q(), sort: sort() }),
    fetchShopData,
  );

  function chipClass(active: boolean) {
    return `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active ? "bg-ink text-paper" : "border border-line bg-surface text-soft hover:border-soft/40 hover:text-ink"
    }`;
  }
  function sortChipClass(active: boolean) {
    return `rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
      active ? "bg-ink text-paper shadow-sm" : "text-soft hover:text-ink"
    }`;
  }

  function handleSearch(e: SubmitEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const value = (new FormData(form).get("q") as string) ?? "";
    setSearchParams({ q: value || undefined });
  }

  return (
    <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16">
      <PageHeader title={t("shop.title")} intro={t("shop.subtitle")} />

      <div class="mt-8 rounded-card border border-line bg-surface/60 p-3 backdrop-blur-sm sm:p-4">
        <form onSubmit={handleSearch} class="relative mb-3">
          <Search size={16} class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-soft" />
          <input
            type="search"
            name="q"
            value={q()}
            placeholder={t("shop.searchPlaceholder")}
            aria-label={t("shop.searchPlaceholder")}
            class="w-full rounded-full border border-line bg-paper py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-soft/50"
          />
        </form>

        <div class="flex flex-wrap gap-2">
          <A href="?" class={chipClass(!category())}>
            {t("shop.all")}
          </A>
          <Show when={data()}>
            <For each={data()!.categories}>
              {(c) => (
                <A
                  href={`?${new URLSearchParams({ ...(q() ? { q: q() } : {}), category: c.handle }).toString()}`}
                  class={chipClass(category() === c.handle)}
                >
                  {c.name}
                </A>
              )}
            </For>
          </Show>
        </div>

        <div class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <p class="text-sm text-soft">{t("shop.results", { count: data()?.products.length ?? 0 })}</p>
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-soft">{t("shop.sortLabel")}</span>
            <div class="inline-flex items-center rounded-full border border-line bg-paper p-1">
              <For each={SORTS}>
                {(s) => (
                  <A
                    href={`?${new URLSearchParams({ ...(q() ? { q: q() } : {}), ...(category() ? { category: category()! } : {}), ...(s !== "new" ? { sort: s } : {}) }).toString()}`}
                    class={sortChipClass(sort() === s)}
                  >
                    {t(s === "new" ? "shop.sortNew" : s === "price_asc" ? "shop.sortPriceAsc" : "shop.sortPriceDesc")}
                  </A>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <p class="mt-8 text-center text-sm text-soft">{t("common.loading")}</p>
        }
      >
        <Show
          when={data() && data()!.products.length > 0}
          fallback={
            <Show when={data()}>
              <div class="mt-8 rounded-card border border-line bg-surface p-12 text-center">
                <span class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-paper ring-1 ring-line">
                  <Search size={22} stroke-width={1.6} class="text-soft" />
                </span>
                <p class="mt-4 text-soft">{t("shop.empty")}</p>
                <A
                  href="?"
                  class="mt-5 inline-flex items-center rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-semibold transition-colors hover:border-ink"
                >
                  {t("shop.all")}
                </A>
              </div>
            </Show>
          }
        >
          <div class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
            <For each={data()!.products}>{(product) => <ProductCard product={product} />}</For>
          </div>
        </Show>
      </Suspense>
    </div>
  );
}

import type { Metadata } from "next";
import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { medusa } from "@/lib/medusa";
import { getUsedFilters, getProductColors } from "@/lib/materials";
import { alternatesFor } from "@/lib/seo";
import { ProductCard, type StoreProductSummary } from "@/components/product-card";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shop" });
  return { title: t("title"), alternates: alternatesFor(locale, "/shop") };
}

type Sort = "new" | "price_asc" | "price_desc";
const SORTS: Sort[] = ["new", "price_asc", "price_desc"];

function hrefFor(query: Record<string, string | undefined>) {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) if (v) clean[k] = v;
  return { pathname: "/shop" as const, query: clean };
}

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
  material: string | null;
  metadata: Record<string, unknown> | null;
  variants?: { calculated_price?: { calculated_amount?: number } | null }[];
}

async function getShopData(params: {
  categorySlug?: string;
  material?: string;
  color?: string;
  multicolor: boolean;
  sort: Sort;
  q?: string;
}) {
  const { regions } = await medusa.store.region.list();
  const swiss = regions.find((r: { currency_code: string }) => r.currency_code === "chf") ?? regions[0];

  const { product_categories } = (await medusa.store.category.list({
    fields: "id,name,handle",
  })) as { product_categories: RawCategory[] };
  const category = product_categories.find((c) => c.handle === params.categorySlug);

  const order =
    params.sort === "price_asc" ? "variants.prices.amount" : params.sort === "price_desc" ? "-variants.prices.amount" : "-created_at";

  const { products: rawProducts } = (await medusa.store.product.list({
    region_id: swiss?.id,
    category_id: category ? [category.id] : undefined,
    q: params.q || undefined,
    order,
    fields: "id,title,handle,thumbnail,material,metadata,*variants.calculated_price",
  })) as { products: RawProduct[] };

  let filtered = rawProducts;
  if (params.material) {
    filtered = filtered.filter((p) => p.material === params.material);
  }
  if (params.multicolor) {
    filtered = filtered.filter((p) => Boolean(p.metadata?.multicolor));
  }
  if (params.color) {
    // Catalogue de taille réduite : un appel par produit candidat reste
    // largement raisonnable plutôt qu'une route batch dédiée.
    const withColor = await Promise.all(
      filtered.map(async (p) => ({
        product: p,
        colors: await getProductColors(p.id),
      })),
    );
    filtered = withColor.filter((x) => x.colors.some((c) => c.name === params.color)).map((x) => x.product);
  }

  const products: StoreProductSummary[] = filtered.map((p) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    thumbnail: p.thumbnail,
    priceAmount: p.variants?.[0]?.calculated_price?.calculated_amount ?? null,
    multicolor: Boolean(p.metadata?.multicolor),
  }));

  return { categories: product_categories, products };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{
    category?: string;
    material?: string;
    color?: string;
    multicolor?: string;
    sort?: string;
    q?: string;
  }>;
}) {
  const { locale } = await params;
  const { category, material, color, multicolor, sort, q } = await searchParams;
  const searchParam = q?.trim() || undefined;
  const multicolorOn = multicolor === "1";
  const activeSort: Sort = SORTS.includes(sort as Sort) ? (sort as Sort) : "new";
  const sortParam = activeSort === "new" ? undefined : activeSort;
  const multicolorParam = multicolorOn ? "1" : undefined;

  const linkFor = (query: Parameters<typeof hrefFor>[0]) => hrefFor({ ...query, q: searchParam });

  const [t, filters, { categories, products }] = await Promise.all([
    getTranslations("shop"),
    getUsedFilters(),
    getShopData({
      categorySlug: category,
      material,
      color,
      multicolor: multicolorOn,
      sort: activeSort,
      q: searchParam,
    }),
  ]);

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active ? "bg-ink text-paper" : "border border-line bg-surface text-soft hover:border-soft/40 hover:text-ink"
    }`;
  const sortChip = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
      active ? "bg-ink text-paper shadow-sm" : "text-soft hover:text-ink"
    }`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16">
      <PageHeader title={t("title")} intro={t("subtitle")} />

      <div className="mt-8 rounded-card border border-line bg-surface/60 p-3 backdrop-blur-sm sm:p-4">
        <form action={`/${locale}/shop`} className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-soft" />
          <input
            type="search"
            name="q"
            defaultValue={searchParam ?? ""}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="w-full rounded-full border border-line bg-paper py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-soft/50"
          />
          {category && <input type="hidden" name="category" value={category} />}
          {material && <input type="hidden" name="material" value={material} />}
          {color && <input type="hidden" name="color" value={color} />}
          {multicolorParam && <input type="hidden" name="multicolor" value={multicolorParam} />}
          {sortParam && <input type="hidden" name="sort" value={sortParam} />}
        </form>
        <div className="flex flex-wrap gap-2">
          <Link href={linkFor({ material, color, multicolor: multicolorParam, sort: sortParam })} className={chip(!category)}>
            {t("all")}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={linkFor({ category: c.handle, material, color, multicolor: multicolorParam, sort: sortParam })}
              className={chip(category === c.handle)}
            >
              {c.name}
            </Link>
          ))}
          {(filters.materials.length > 0 || filters.multicolor || multicolorOn) && (
            <span className="mx-1 hidden w-px self-stretch bg-line sm:block" />
          )}
          {filters.materials.map((m) => (
            <Link
              key={m}
              href={linkFor({ category, material: material === m ? undefined : m, color, multicolor: multicolorParam, sort: sortParam })}
              className={chip(material === m)}
            >
              {m}
            </Link>
          ))}
          {(filters.multicolor || multicolorOn) && (
            <Link
              href={linkFor({ category, material, color, multicolor: multicolorOn ? undefined : "1", sort: sortParam })}
              className={chip(multicolorOn)}
            >
              {t("filterMulticolor")}
            </Link>
          )}
        </div>

        {(filters.colors.length > 0 || color) && (
          <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-line pt-3">
            <span className="text-xs font-medium text-soft">{t("filterColor")}</span>
            {filters.colors.map((c) => {
              const active = color === c.name;
              return (
                <Link
                  key={c.name}
                  href={linkFor({ category, material, color: active ? undefined : c.name, multicolor: multicolorParam, sort: sortParam })}
                  title={c.name}
                  aria-label={c.name}
                  className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 ${
                    active ? "border-ink ring-2 ring-ink ring-offset-2 ring-offset-surface" : "border-swatch-ring"
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              );
            })}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-sm text-soft">{t("results", { count: products.length })}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-soft">{t("sortLabel")}</span>
            <div className="inline-flex items-center rounded-full border border-line bg-paper p-1">
              {SORTS.map((s) => (
                <Link
                  key={s}
                  href={linkFor({ category, material, color, multicolor: multicolorParam, sort: s === "new" ? undefined : s })}
                  className={sortChip(activeSort === s)}
                >
                  {t(s === "new" ? "sortNew" : s === "price_asc" ? "sortPriceAsc" : "sortPriceDesc")}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="mt-8 rounded-card border border-line bg-surface p-12 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-paper ring-1 ring-line">
            <Search size={22} strokeWidth={1.6} className="text-soft" />
          </span>
          <p className="mt-4 text-soft">{t("empty")}</p>
          <Link href="/shop" className="mt-5 inline-flex items-center rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-semibold transition-colors hover:border-ink">
            {t("all")}
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

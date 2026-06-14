import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getUsedFilters, getProducts, type ProductSort } from "@/db/queries";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

const SORTS: ProductSort[] = ["new", "price_asc", "price_desc"];

function hrefFor(query: Record<string, string | undefined>) {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) if (v) clean[k] = v;
  return { pathname: "/shop" as const, query: clean };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{
    category?: string;
    material?: string;
    multicolor?: string;
    sort?: string;
  }>;
}) {
  const { locale } = await params;
  const { category, material, multicolor, sort } = await searchParams;
  const multicolorOn = multicolor === "1";
  const activeSort: ProductSort = SORTS.includes(sort as ProductSort)
    ? (sort as ProductSort)
    : "new";
  const sortParam = activeSort === "new" ? undefined : activeSort;
  const multicolorParam = multicolorOn ? "1" : undefined;

  const [t, filters, products] = await Promise.all([
    getTranslations("shop"),
    getUsedFilters(locale),
    getProducts(locale, {
      categorySlug: category,
      material,
      multicolor: multicolorOn,
      sort: activeSort,
    }),
  ]);

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-ink text-paper"
        : "border border-line bg-surface text-soft hover:text-ink"
    }`;
  const sortChip = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? "bg-ink text-paper"
        : "border border-line bg-surface text-soft hover:text-ink"
    }`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-2 text-soft">{t("subtitle")}</p>

      <div className="mt-7 flex flex-wrap gap-2">
        <Link
          href={hrefFor({ material, multicolor: multicolorParam, sort: sortParam })}
          className={chip(!category)}
        >
          {t("all")}
        </Link>
        {filters.categories.map((c) => (
          <Link
            key={c.id}
            href={hrefFor({
              category: c.slug,
              material,
              multicolor: multicolorParam,
              sort: sortParam,
            })}
            className={chip(category === c.slug)}
          >
            {c.name}
          </Link>
        ))}
        {(filters.materials.length > 0 || multicolorOn) && (
          <span className="mx-1 hidden w-px bg-line sm:block" />
        )}
        {filters.materials.map((m) => (
          <Link
            key={m}
            href={hrefFor({
              category,
              material: material === m ? undefined : m,
              multicolor: multicolorParam,
              sort: sortParam,
            })}
            className={chip(material === m)}
          >
            {m}
          </Link>
        ))}
        <Link
          href={hrefFor({
            category,
            material,
            multicolor: multicolorOn ? undefined : "1",
            sort: sortParam,
          })}
          className={chip(multicolorOn)}
        >
          {t("filterMulticolor")}
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-soft">
          {t("results", { count: products.length })}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-soft">{t("sortLabel")}</span>
          {SORTS.map((s) => (
            <Link
              key={s}
              href={hrefFor({
                category,
                material,
                multicolor: multicolorParam,
                sort: s === "new" ? undefined : s,
              })}
              className={sortChip(activeSort === s)}
            >
              {t(
                s === "new"
                  ? "sortNew"
                  : s === "price_asc"
                    ? "sortPriceAsc"
                    : "sortPriceDesc",
              )}
            </Link>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <p className="mt-10 rounded-card border border-line bg-surface p-10 text-center text-soft">
          {t("empty")}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

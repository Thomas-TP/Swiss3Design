import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCategories, getProducts } from "@/db/queries";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

const MATERIALS = ["PLA", "PETG"];

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ category?: string; material?: string }>;
}) {
  const { locale } = await params;
  const { category, material } = await searchParams;
  const [t, categories, products] = await Promise.all([
    getTranslations("shop"),
    getCategories(locale),
    getProducts(locale, { categorySlug: category, material }),
  ]);

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
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
          href={{ pathname: "/shop", query: material ? { material } : undefined }}
          className={chip(!category)}
        >
          {t("all")}
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={{
              pathname: "/shop",
              query: { category: c.slug, ...(material ? { material } : {}) },
            }}
            className={chip(category === c.slug)}
          >
            {c.name}
          </Link>
        ))}
        <span className="mx-1 hidden w-px bg-line sm:block" />
        {MATERIALS.map((m) => (
          <Link
            key={m}
            href={{
              pathname: "/shop",
              query: {
                ...(category ? { category } : {}),
                ...(material === m ? {} : { material: m }),
              },
            }}
            className={chip(material === m)}
          >
            {m}
          </Link>
        ))}
      </div>

      <p className="mt-6 text-sm text-soft">
        {t("results", { count: products.length })}
      </p>

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

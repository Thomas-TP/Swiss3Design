import { asc, desc, eq, and, inArray } from "drizzle-orm";
import { Plus, Pencil, Eye, EyeOff, Check, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { products, productTranslations, productImages } from "@/db/schema";
import { formatChf } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { toggleProductActive, updateProductStock } from "./actions";
import { BTN_PRIMARY, FIELD } from "../ui";

const FILTERS = ["published", "hidden", "featured", "low"] as const;
type ProductFilter = (typeof FILTERS)[number];

const FILTER_LABELS: Record<ProductFilter, string> = {
  published: "Publiés",
  hidden: "Masqués",
  featured: "Vedette",
  low: "Stock bas",
};

const isLowStock = (saleType: string, stock: number | null) =>
  saleType === "stock" && stock !== null && stock <= 2;

export default async function AdminProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string; f?: string }>;
}) {
  await requireAdmin();
  const { locale } = await params;
  const { q, f } = await searchParams;
  const query = (q ?? "").trim().slice(0, 100);
  const filter = (FILTERS as readonly string[]).includes(f ?? "")
    ? (f as ProductFilter)
    : null;

  const db = await getDb();

  const allRows = await db
    .select({
      id: products.id,
      slug: products.slug,
      priceCents: products.priceCents,
      saleType: products.saleType,
      stock: products.stock,
      multicolor: products.multicolor,
      featured: products.featured,
      active: products.active,
      name: productTranslations.name,
    })
    .from(products)
    .innerJoin(
      productTranslations,
      and(
        eq(productTranslations.productId, products.id),
        eq(productTranslations.locale, "fr"),
      ),
    )
    .orderBy(desc(products.createdAt));

  const counts: Record<ProductFilter, number> = {
    published: allRows.filter((r) => r.active).length,
    hidden: allRows.filter((r) => !r.active).length,
    featured: allRows.filter((r) => r.featured).length,
    low: allRows.filter((r) => isLowStock(r.saleType, r.stock)).length,
  };

  const rows = allRows.filter((r) => {
    if (filter === "published" && !r.active) return false;
    if (filter === "hidden" && r.active) return false;
    if (filter === "featured" && !r.featured) return false;
    if (filter === "low" && !isLowStock(r.saleType, r.stock)) return false;
    if (query && !r.name.toLowerCase().includes(query.toLowerCase()))
      return false;
    return true;
  });

  const chips: { value: string | null; label: string; count: number }[] = [
    { value: null, label: "Tous", count: allRows.length },
    ...FILTERS.map((key) => ({
      value: key as string,
      label: FILTER_LABELS[key],
      count: counts[key],
    })).filter((c) => c.count > 0),
  ];

  const images =
    rows.length > 0
      ? await db
          .select()
          .from(productImages)
          .where(
            inArray(
              productImages.productId,
              rows.map((r) => r.id),
            ),
          )
          .orderBy(asc(productImages.sortOrder))
      : [];
  const firstImage = new Map<string, string>();
  for (const img of images) {
    if (!firstImage.has(img.productId)) firstImage.set(img.productId, img.url);
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold tracking-tight">Produits</h2>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Link
              key={c.label}
              href={{
                pathname: "/admin/products",
                query: {
                  ...(c.value ? { f: c.value } : {}),
                  ...(query ? { q: query } : {}),
                },
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === c.value
                  ? "bg-ink text-paper"
                  : "border border-line bg-surface text-soft hover:text-ink"
              }`}
            >
              {c.label}
              <span className="ml-1.5 opacity-60 tabular-nums">{c.count}</span>
            </Link>
          ))}
        </div>
        <Link href="/admin/products/new" className={BTN_PRIMARY}>
          <Plus size={16} />
          Nouveau produit
        </Link>
      </div>

      <form className="relative mb-4" action="">
        {filter && <input type="hidden" name="f" value={filter} />}
        <Search
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-soft"
        />
        <input
          name="q"
          defaultValue={query}
          placeholder="Rechercher un produit…"
          className={`${FIELD} pl-9`}
        />
      </form>

      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-10 text-center text-soft">
          <p className="font-medium">
            {query || filter
              ? "Aucun produit ne correspond à ces critères."
              : "Aucun produit pour l'instant."}
          </p>
          {!query && !filter && (
            <p className="mt-1 text-sm">
              Créez votre premier produit pour remplir la boutique.
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface px-4">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-4 py-3.5">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-line/30">
                {firstImage.get(p.id) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={firstImage.get(p.id)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {p.name}
                  {!p.active && (
                    <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[10px] font-bold uppercase text-soft">
                      Masqué
                    </span>
                  )}
                  {p.featured && (
                    <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                      Vedette
                    </span>
                  )}
                </p>
                <p className="text-xs text-soft">
                  {formatChf(p.priceCents, locale)} ·{" "}
                  {p.saleType === "on_demand"
                    ? "À la demande"
                    : p.stock === null
                      ? "Stock non suivi"
                      : p.stock === 0
                        ? "⚠ Rupture"
                        : `Stock : ${p.stock}`}
                  {p.multicolor && " · Multicolore"}
                </p>
              </div>
              {p.saleType === "stock" && (
                <form
                  action={updateProductStock}
                  className="hidden items-center gap-1 sm:flex"
                  title="Modifier le stock"
                >
                  <input type="hidden" name="id" value={p.id} />
                  <input
                    name="stock"
                    inputMode="numeric"
                    defaultValue={p.stock ?? ""}
                    placeholder="Stock"
                    className={`w-16 rounded-xl border px-2.5 py-1.5 text-center text-xs transition-colors focus:border-ink focus:outline-none ${
                      p.stock !== null && p.stock <= 2
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-line bg-surface"
                    }`}
                  />
                  <button
                    title="Enregistrer le stock"
                    className="rounded-full p-1.5 text-soft transition-colors hover:bg-line/60 hover:text-ink"
                  >
                    <Check size={15} />
                  </button>
                </form>
              )}
              <form action={toggleProductActive}>
                <input type="hidden" name="id" value={p.id} />
                <button
                  title={p.active ? "Masquer" : "Publier"}
                  className="rounded-full p-2 text-soft transition-colors hover:bg-line/60 hover:text-ink"
                >
                  {p.active ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
              </form>
              <Link
                href={`/admin/products/${p.id}`}
                title="Modifier"
                className="rounded-full p-2 text-soft transition-colors hover:bg-line/60 hover:text-ink"
              >
                <Pencil size={17} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

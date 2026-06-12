import { asc, desc, eq, and, inArray } from "drizzle-orm";
import { Plus, Pencil, Eye, EyeOff, Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { products, productTranslations, productImages } from "@/db/schema";
import { formatChf } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { toggleProductActive, updateProductStock } from "./actions";
import { BTN_PRIMARY } from "../ui";

export default async function AdminProductsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  await requireAdmin();
  const { locale } = await params;
  const db = await getDb();

  const rows = await db
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

  const images =
    rows.length > 0
      ? await db
          .select()
          .from(productImages)
          .where(inArray(productImages.productId, rows.map((r) => r.id)))
          .orderBy(asc(productImages.sortOrder))
      : [];
  const firstImage = new Map<string, string>();
  for (const img of images) {
    if (!firstImage.has(img.productId)) firstImage.set(img.productId, img.url);
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-soft">
          {rows.length} produit{rows.length > 1 ? "s" : ""}
        </p>
        <Link href="/admin/products/new" className={BTN_PRIMARY}>
          <Plus size={16} />
          Nouveau produit
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-10 text-center text-soft">
          <p className="font-medium">Aucun produit pour l&apos;instant.</p>
          <p className="mt-1 text-sm">
            Créez votre premier produit pour remplir la boutique.
          </p>
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
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
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
                        ? "border-amber-300 bg-amber-50"
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

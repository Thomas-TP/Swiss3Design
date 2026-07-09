import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { products, productTranslations, productImages } from "@/db/schema";
import { formatChf } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { FeaturedManager, type FeaturedProduct } from "./featured-manager";

export const dynamic = "force-dynamic";

export default async function AdminFeaturedPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  await requireAdmin();
  const { locale } = await params;
  const db = await getDb();

  // Catalogue publié uniquement : on ne met en avant que ce qui est achetable.
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      priceCents: products.priceCents,
      featured: products.featured,
      featuredOrder: products.featuredOrder,
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
    .where(eq(products.active, true))
    .orderBy(desc(products.createdAt));

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

  const all: FeaturedProduct[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    priceLabel: formatChf(r.priceCents, locale),
    imageUrl: firstImage.get(r.id) ?? null,
  }));

  // Sélection courante, dans l'ordre curé (featuredOrder croissant).
  const selectedIds = rows
    .filter((r) => r.featured)
    .sort((a, b) => a.featuredOrder - b.featuredOrder)
    .map((r) => r.id);

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">Sélection du moment</h2>
      <p className="mt-1 max-w-2xl text-sm text-soft">
        Choisissez les produits mis en avant sur la page d&apos;accueil et
        glissez-les pour régler leur ordre. Les changements sont enregistrés
        automatiquement.
      </p>
      <div className="mt-6">
        <FeaturedManager all={all} initialSelectedIds={selectedIds} />
      </div>
    </div>
  );
}

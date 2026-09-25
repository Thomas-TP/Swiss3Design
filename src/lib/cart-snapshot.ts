import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  products,
  productTranslations,
  productVariants,
  productImages,
  productColors,
  filamentColors,
} from "@/db/schema";
import { parseCart, type CartItem } from "./cart-data";
import type { Locale } from "@/i18n/routing";
// Les champs commerciaux et les URL viennent exclusivement du catalogue actuel.
export async function currentCartSnapshot(
  raw: unknown,
  locale: Locale,
): Promise<CartItem[]> {
  const incoming = parseCart(JSON.stringify(raw));
  if (!incoming.length) return [];
  const ids = [...new Set(incoming.map((i) => i.productId))];
  const db = await getDb();
  const [catalog, variants, translations, images, colors] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(inArray(products.id, ids), eq(products.active, true))),
    db
      .select()
      .from(productVariants)
      .where(inArray(productVariants.productId, ids)),
    db
      .select()
      .from(productTranslations)
      .where(
        and(
          inArray(productTranslations.productId, ids),
          inArray(productTranslations.locale, [locale, "fr"]),
        ),
      ),
    db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, ids))
      .orderBy(productImages.sortOrder),
    db
      .select({
        productId: productColors.productId,
        name: filamentColors.name,
        hex: filamentColors.hex,
      })
      .from(productColors)
      .innerJoin(filamentColors, eq(productColors.colorId, filamentColors.id))
      .where(inArray(productColors.productId, ids)),
  ]);
  return incoming.flatMap((item) => {
    const product = catalog.find((p) => p.id === item.productId);
    if (!product) return [];
    const options = variants.filter((v) => v.productId === product.id);
    const variant = options.find((v) => v.id === item.variantId);
    if ((options.length && !variant) || (!options.length && item.variantId))
      return [];
    const palette = colors.filter((c) => c.productId === product.id);
    const color = palette.find((c) => c.name === item.colorName);
    if ((palette.length && !color) || (!palette.length && item.colorName))
      return [];
    const stock = variant ? variant.stock : product.stock;
    if (stock !== null && stock < 1) return [];
    const name =
      translations.find(
        (t) => t.productId === product.id && t.locale === locale,
      )?.name ??
      translations.find((t) => t.productId === product.id && t.locale === "fr")
        ?.name ??
      product.slug;
    return [
      {
        productId: product.id,
        slug: product.slug,
        name,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
        colorName: color?.name ?? null,
        colorHex: color?.hex ?? null,
        priceCents: variant?.priceCents ?? product.priceCents,
        imageUrl: images.find((i) => i.productId === product.id)?.url ?? null,
        saleType: product.saleType,
        quantity: Math.min(item.quantity, stock ?? 99),
      },
    ];
  });
}

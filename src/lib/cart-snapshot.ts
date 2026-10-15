import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  products,
  productTranslations,
  productVariants,
  productImages,
} from "@/db/schema";
import { findColorOption, requestedColorRef } from "@/lib/filament/shop";
import { loadProductColors } from "@/lib/filament/shop-db";
import { parseCart, type CartItem } from "./cart-data";
import type { Locale } from "@/i18n/routing";
// Les champs commerciaux et les URL viennent exclusivement du catalogue actuel,
// couleurs comprises (les références du stock proposées par l'article, dans la
// langue du client) : un ancien panier (nom de couleur seul) retrouve sa référence.
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
    loadProductColors(db, ids, locale),
  ]);
  return incoming.flatMap((item) => {
    const product = catalog.find((p) => p.id === item.productId);
    if (!product) return [];
    const options = variants.filter((v) => v.productId === product.id);
    const variant = options.find((v) => v.id === item.variantId);
    if ((options.length && !variant) || (!options.length && item.variantId))
      return [];
    const palette = colors.get(product.id) ?? [];
    const color = findColorOption(
      palette,
      requestedColorRef({ colorRef: item.colorRef, color: item.colorName }) ??
        item.colorName,
    );
    // Un article à couleurs exige la couleur du client ; sans palette (stock non
    // suivi), la couleur d'un ancien panier est simplement abandonnée.
    if (palette.length && !color) return [];
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
        colorRef: color?.id ?? null,
        colorName: color?.name ?? null,
        colorHex: color?.hex ?? null,
        weightGrams: product.weightGrams,
        priceCents: variant?.priceCents ?? product.priceCents,
        imageUrl: images.find((i) => i.productId === product.id)?.url ?? null,
        saleType: product.saleType,
        quantity: Math.min(item.quantity, stock ?? 99),
      },
    ];
  });
}

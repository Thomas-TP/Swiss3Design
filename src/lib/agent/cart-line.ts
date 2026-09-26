import type { CartItem } from "@/lib/cart-data";

// Côté navigateur : transforme un produit de l'API publique en ligne de
// panier, avec les mêmes exigences que le checkout (variante obligatoire si
// le produit en a, couleur obligatoire s'il en propose). Partagé par l'import
// des liens panier (build_cart_link) et l'outil WebMCP add_to_cart. Les prix
// portés ici ne sont qu'indicatifs : le checkout re-tarife tout en base.

interface ApiProduct {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  saleType: "stock" | "on_demand";
  availability: "in_stock" | "made_to_order" | "out_of_stock";
  price: { cents: number };
  variants: { id: string; name: string; price: { cents: number } }[];
  colorOptions: { name: string; hex: string }[];
}

export interface LineRequest {
  slug: string;
  quantity?: number;
  variant?: string;
  color?: string;
}

export async function fetchCartLine(
  request: LineRequest,
  locale: string,
): Promise<CartItem> {
  const response = await fetch(
    `/api/v1/products/${encodeURIComponent(request.slug)}?language=${locale}`,
  );
  if (!response.ok) throw new Error(`Unknown product: ${request.slug}`);
  const product = (await response.json()) as ApiProduct;
  if (product.availability === "out_of_stock")
    throw new Error(`${product.name} is out of stock`);
  const variant = request.variant
    ? product.variants.find(
        (v) =>
          v.id === request.variant ||
          v.name.toLowerCase() === request.variant!.toLowerCase(),
      )
    : undefined;
  if (product.variants.length > 0 && !variant)
    throw new Error(
      `${product.name} requires a variant: ${product.variants.map((v) => v.name).join(", ")}`,
    );
  const color = request.color
    ? product.colorOptions.find(
        (c) => c.name.toLowerCase() === request.color!.toLowerCase(),
      )
    : undefined;
  if (product.colorOptions.length > 0 && !color)
    throw new Error(
      `${product.name} requires a colour: ${product.colorOptions.map((c) => c.name).join(", ")}`,
    );
  return {
    productId: product.id,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    colorName: color?.name ?? null,
    colorHex: color?.hex ?? null,
    slug: product.slug,
    name: product.name,
    priceCents: variant?.price.cents ?? product.price.cents,
    imageUrl: product.imageUrl,
    saleType: product.saleType,
    quantity: Math.min(Math.max(Math.trunc(request.quantity ?? 1), 1), 99),
  };
}

// Paramètre `item` des liens panier : slug|quantité|variante|couleur.
export function parseItemParam(value: string): LineRequest | null {
  const [slug, quantity, variant, color] = value.split("|");
  if (!slug) return null;
  return {
    slug,
    quantity: Number(quantity) || 1,
    variant: variant || undefined,
    color: color || undefined,
  };
}

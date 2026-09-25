export interface CartItem {
  productId: string;
  // Variante choisie (taille/finition). null = produit sans variante.
  variantId?: string | null;
  variantName?: string | null;
  // Couleur choisie (palette du filament). null = produit sans couleur.
  colorName?: string | null;
  colorHex?: string | null;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  saleType: "stock" | "on_demand";
  quantity: number;
}

// Une ligne de panier est identifiée par le triplet produit + variante + couleur
type LineRef = {
  productId: string;
  variantId?: string | null;
  colorName?: string | null;
};
export const sameLine = (a: LineRef, b: LineRef) =>
  a.productId === b.productId &&
  (a.variantId ?? null) === (b.variantId ?? null) &&
  (a.colorName ?? null) === (b.colorName ?? null);

export function parseCart(raw: string): CartItem[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (i): i is CartItem =>
          i &&
          typeof i === "object" &&
          typeof i.productId === "string" &&
          typeof i.name === "string" &&
          typeof i.slug === "string" &&
          Number.isSafeInteger(i.priceCents) &&
          i.priceCents >= 0 &&
          Number.isInteger(i.quantity) &&
          i.quantity > 0 &&
          (i.saleType === "stock" || i.saleType === "on_demand") &&
          [
            i.variantId,
            i.variantName,
            i.colorName,
            i.colorHex,
            i.imageUrl,
          ].every((v) => v == null || typeof v === "string"),
      )
      .slice(0, 50)
      .map((i) => ({ ...i, quantity: Math.min(i.quantity, 99) }));
  } catch {
    return [];
  }
}

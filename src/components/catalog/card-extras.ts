import { asc, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { productImages, products } from "@/db/schema";

// Compléments de carte que `ProductListItem` (src/db/queries.ts, non attribué à
// ce package) ne porte pas : le texte de dimensions, le poids et la 2ᵉ photo
// (celle qui « s'imprime » au survol de la carte, brief « Strates », §7.8).
// Une seule lecture groupée pour toute la liste (deux requêtes, jamais une par
// produit : le catalogue passe de 1 à 50 articles). Demande hors périmètre :
// le jour où `ProductListItem` porte ces champs, ce fichier disparaît et les
// cartes lisent directement le produit.

export interface CardExtras {
  dimensionsMm: string | null;
  weightGrams: number | null;
  secondImage: { url: string; alt: string | null } | null;
}

export async function getCardExtras(
  ids: string[],
): Promise<Map<string, CardExtras>> {
  const extras = new Map<string, CardExtras>();
  if (ids.length === 0) return extras;
  const db = await getDb();
  const [specRows, imageRows] = await Promise.all([
    db
      .select({
        id: products.id,
        dimensionsMm: products.dimensionsMm,
        weightGrams: products.weightGrams,
      })
      .from(products)
      .where(inArray(products.id, ids)),
    db
      .select({
        productId: productImages.productId,
        url: productImages.url,
        alt: productImages.alt,
      })
      .from(productImages)
      .where(inArray(productImages.productId, ids))
      .orderBy(asc(productImages.sortOrder)),
  ]);

  for (const row of specRows)
    extras.set(row.id, {
      dimensionsMm: row.dimensionsMm,
      weightGrams: row.weightGrams,
      secondImage: null,
    });

  // La première photo est celle de la carte ; la suivante, la 2ᵉ.
  const seen = new Map<string, number>();
  for (const image of imageRows) {
    const count = (seen.get(image.productId) ?? 0) + 1;
    seen.set(image.productId, count);
    const entry = extras.get(image.productId);
    if (count === 2 && entry)
      entry.secondImage = { url: image.url, alt: image.alt };
  }
  return extras;
}

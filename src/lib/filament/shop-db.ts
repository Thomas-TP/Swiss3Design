// Couleurs de la BOUTIQUE (Postgres, serveur). Tous les articles proposent les
// références du stock actives avec `custom_ok` (les mêmes que « Sur mesure »),
// moins les exclusions de l'article (`product_filament_exclusions`). Les anciennes
// tables de la palette de la boutique (`materials`, `filament_colors`,
// `product_colors`) restent en base comme filet de retour arrière, mais plus aucun
// code ne les lit.
//
// Lectures : la fiche et les listes tolèrent le cache Hyperdrive (60 s) ; le
// paiement demande `fresh` (règle d'or 6c). Les migrations 0010 (`filament_refs`) et
// 0011 (exclusions, réservations) sont tolérées absentes : aucune couleur / aucune
// exclusion, rien de réservé, la vente continue. Ne PAS appeler `loadShopRefs` ni
// `loadExclusions` dans une transaction (une erreur 42P01 la fermerait) : lire avant
// d'ouvrir la transaction.
import { and, asc, eq, inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import type { getDb } from "@/db";
import { uncached } from "@/db/fresh";
import { filamentRefs, productFilamentExclusions } from "@/db/schema";
import { FILAMENT_IDS, isFilamentId } from "@/lib/studio/filaments";
import { allowedColors, sortShopColors, type ShopColor } from "./shop";
import { isMissingTable } from "./stock-db";

type Db = Awaited<ReturnType<typeof getDb>>;
type Queryable = Pick<Db, "select">;
export type ShopRef = typeof filamentRefs.$inferSelect;

/**
 * Les références proposées par la boutique : actives et `custom_ok`, dans l'ordre
 * d'affichage. Tables du stock absentes (42P01) : aucune couleur, la boutique reste
 * affichable et la vente n'exige alors aucune couleur. Hors transaction seulement.
 */
export async function loadShopRefs(
  db: Queryable,
  options: { fresh?: boolean } = {},
): Promise<ShopRef[]> {
  try {
    const rows = await db
      .select()
      .from(filamentRefs)
      .where(
        and(
          eq(filamentRefs.active, true),
          eq(filamentRefs.customOk, true),
          options.fresh ? uncached : undefined,
        ),
      )
      .orderBy(asc(filamentRefs.brand), asc(filamentRefs.officialName));
    return sortShopColors(rows, FILAMENT_IDS);
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    console.warn("[shop] table filament_refs absente : aucune couleur");
    return [];
  }
}

/**
 * Exclusions par article (id de produit → ids de références décochées). Migration
 * 0011 absente : aucune exclusion. Hors transaction seulement.
 */
export async function loadExclusions(
  db: Queryable,
  productIds: readonly string[],
  options: { fresh?: boolean } = {},
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (productIds.length === 0) return out;
  try {
    const rows = await db
      .select({
        productId: productFilamentExclusions.productId,
        refId: productFilamentExclusions.refId,
      })
      .from(productFilamentExclusions)
      .where(
        and(
          inArray(productFilamentExclusions.productId, [...productIds]),
          options.fresh ? uncached : undefined,
        ),
      );
    for (const row of rows) {
      const set = out.get(row.productId) ?? new Set<string>();
      set.add(row.refId);
      out.set(row.productId, set);
    }
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    console.warn(
      "[shop] table product_filament_exclusions absente : aucune exclusion",
    );
  }
  return out;
}

/** Nom affiché d'une référence : palette du Studio dans la langue, sinon nom officiel. */
export type ColorLabeler = (ref: {
  studioId: string | null;
  officialName: string;
}) => string;

export async function getColorLabeler(locale: string): Promise<ColorLabeler> {
  const core = await getTranslations({ locale, namespace: "studioCore" });
  return (ref) =>
    ref.studioId && isFilamentId(ref.studioId)
      ? core(`filaments.${ref.studioId}`)
      : ref.officialName;
}

export function toShopColor(ref: ShopRef, label: ColorLabeler): ShopColor {
  const hexes = [ref.hex, ref.hex2, ref.hex3].filter(
    (hex): hex is string => typeof hex === "string",
  );
  return {
    id: ref.id,
    name: label(ref),
    officialName: ref.officialName,
    brand: ref.brand,
    range: ref.rangeName,
    studioId: ref.studioId,
    hex: ref.hex,
    hexes,
    approximate: !ref.hexConfirmed,
  };
}

/** Les couleurs proposées par la boutique (avant exclusions), dans la langue demandée. */
export async function loadShopColors(
  db: Queryable,
  locale: string,
  options: { fresh?: boolean } = {},
): Promise<ShopColor[]> {
  const [refs, label] = await Promise.all([
    loadShopRefs(db, options),
    getColorLabeler(locale),
  ]);
  return refs.map((ref) => toShopColor(ref, label));
}

/** Les couleurs proposées par chacun de ces articles, dans la langue demandée. */
export async function loadProductColors(
  db: Queryable,
  productIds: readonly string[],
  locale: string,
  options: { fresh?: boolean } = {},
): Promise<Map<string, ShopColor[]>> {
  const out = new Map<string, ShopColor[]>();
  if (productIds.length === 0) return out;
  const [refs, exclusions, label] = await Promise.all([
    loadShopRefs(db, options),
    loadExclusions(db, productIds, options),
    getColorLabeler(locale),
  ]);
  const colors = refs.map((ref) => toShopColor(ref, label));
  for (const id of productIds)
    out.set(id, allowedColors(colors, exclusions.get(id)));
  return out;
}

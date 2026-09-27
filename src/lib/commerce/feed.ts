import { deliveryDays } from "@/lib/shipping";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { feedImageUrl, productPageUrl, type SellableSku } from "./catalog";

// Flux catalogue Stripe (Agentic Commerce Suite), format CSV RFC 4180 :
// https://docs.stripe.com/agentic-commerce/product-feed — une ligne par SKU.
// Trois flux : produits (complet, une fois par jour et à chaque modification
// de fiche), stock et prix (légers, à chaque passage du cron et après une
// vente). Montants en CHF avec un point décimal, comme l'exige la spec.

export type FeedType = "product" | "inventory" | "pricing";

type Cell = string | number | boolean | null | undefined;

function csvCell(value: Cell): string {
  if (value == null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  columns: readonly string[],
  rows: Record<string, Cell>[],
): string {
  const lines = [columns.join(",")];
  for (const row of rows)
    lines.push(columns.map((c) => csvCell(row[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}

export const money = (cents: number) => `${(cents / 100).toFixed(2)} CHF`;

// Nom du service de livraison : sans deux-points ni virgule (séparateurs du
// champ `shipping`), identique dans `free_shipping_threshold`.
export const SHIPPING_SERVICE = "Poste suisse";

// Avertissement repris des CGV (responsabilité) : affiché à l'acheteur dans
// l'interface de l'agent. Ni virgule ni deux-points (séparateurs du champ).
const PRODUCT_WARNING =
  "legal_disclaimer:Objet imprimé en 3D - pas un jouet pour enfant de moins de 3 ans ni un objet destiné au contact alimentaire prolongé sauf mention contraire";

export interface ShippingRule {
  shippingCents: number;
  freeOverCents: number;
}

export function availabilityOf(sku: Pick<SellableSku, "stock">) {
  return sku.stock != null && sku.stock <= 0 ? "out_of_stock" : "in_stock";
}

// « 120 x 80 x 45 » (mm, séparateurs x ou ×) → longueur/largeur/hauteur en cm.
export function dimensionsCm(value: string | null) {
  const match = value?.match(
    /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i,
  );
  if (!match) return null;
  const cm = (v: string) =>
    `${Number((Number(v.replace(",", ".")) / 10).toFixed(1))} cm`;
  return { length: cm(match[1]), width: cm(match[2]), height: cm(match[3]) };
}

export const PRODUCT_COLUMNS = [
  "id",
  "title",
  "description",
  "link",
  "brand",
  "mpn",
  "condition",
  "product_category",
  "image_link",
  "additional_image_link",
  "model_3d_link",
  "item_group_id",
  "item_group_title",
  "color",
  "material",
  "weight",
  "length",
  "width",
  "height",
  "custom_variant_option_name_1",
  "custom_variant_option_value_1",
  "availability",
  "inventory_not_tracked",
  "inventory_quantity",
  "price",
  "stripe_product_tax_code",
  "tax_behavior",
  "shipping",
  "shipping_cost_basis",
  "shipping_tax_behavior",
  "free_shipping_threshold",
  "product_review_count",
  "product_review_rating",
  "product_warning",
] as const;

// Stripe n'accepte que du JPEG ou du PNG : un SVG (visuel d'attente) ne se
// convertit pas (415 de /cdn-cgi/image), on l'écarte.
export const rasterImages = (urls: string[]) =>
  urls.filter((u) => !/\.svg(\?|$)/i.test(u)).map(feedImageUrl);

export function productFeedRow(sku: SellableSku, rule: ShippingRule) {
  const days = deliveryDays(sku);
  const [image, ...more] = rasterImages(sku.imageUrls);
  const dims = dimensionsCm(sku.dimensionsMm);
  const tracked = sku.stock != null;
  return {
    id: sku.sku,
    title: sku.title,
    description: sku.description,
    link: productPageUrl(sku.slug),
    brand: SITE_NAME,
    // Fabricant = nous : le SKU sert de référence fabricant (pas de GTIN).
    mpn: sku.sku,
    condition: "new",
    product_category: sku.category
      ? `Impression 3D > ${sku.category}`
      : "Impression 3D > Objets",
    image_link: image ?? `${SITE_URL}/brand/social/og-image.png`,
    // Virgules encodées dans chaque URL : la virgule sépare les images.
    additional_image_link: more
      .slice(0, 10)
      .map((u) => u.replace(/,/g, "%2C"))
      .join(","),
    model_3d_link:
      sku.model3dUrl && /\.(glb|gltf)(\?|$)/i.test(sku.model3dUrl)
        ? sku.model3dUrl.startsWith("/")
          ? SITE_URL + sku.model3dUrl
          : sku.model3dUrl
        : null,
    item_group_id: sku.groupId,
    item_group_title: sku.groupId ? sku.productName : null,
    color: sku.colorName,
    material: sku.material,
    weight: sku.weightGrams ? `${sku.weightGrams} g` : null,
    length: dims?.length,
    width: dims?.width,
    height: dims?.height,
    custom_variant_option_name_1: sku.variantName ? "Variante" : null,
    custom_variant_option_value_1: sku.variantName,
    availability: availabilityOf(sku),
    inventory_not_tracked: tracked ? "false" : "true",
    inventory_quantity: tracked ? Math.max(0, sku.stock!) : null,
    price: money(sku.priceCents),
    // Stripe Tax sans immatriculation (exploitant non assujetti à la TVA,
    // art. 10 LTVA) : aucune taxe n'est calculée, le code reste obligatoire.
    stripe_product_tax_code: "txcd_99999999",
    tax_behavior: "inclusive",
    shipping: `CH:ALL:${SHIPPING_SERVICE}:${days.min}-${days.max}:${money(rule.shippingCents)}`,
    shipping_cost_basis: "per_order",
    shipping_tax_behavior: "inclusive",
    free_shipping_threshold: `CH:ALL:${SHIPPING_SERVICE}:${money(rule.freeOverCents)}`,
    product_review_count: sku.reviewCount,
    product_review_rating:
      sku.reviewCount > 0 && sku.reviewAverage != null
        ? sku.reviewAverage.toFixed(1)
        : null,
    product_warning: PRODUCT_WARNING,
  };
}

export const INVENTORY_COLUMNS = [
  "id",
  "availability",
  "inventory_quantity",
] as const;

// Le flux stock ne porte que les SKU suivis : les impressions à la demande
// sont déclarées `inventory_not_tracked` dans le flux produits.
export function inventoryFeedRows(skus: SellableSku[]) {
  return skus
    .filter((s) => s.stock != null)
    .map((s) => ({
      id: s.sku,
      availability: availabilityOf(s),
      inventory_quantity: Math.max(0, s.stock!),
    }));
}

export const PRICING_COLUMNS = ["id", "price"] as const;

export function pricingFeedRows(skus: SellableSku[]) {
  return skus.map((s) => ({ id: s.sku, price: money(s.priceCents) }));
}

export function buildFeed(
  type: FeedType,
  skus: SellableSku[],
  rule: ShippingRule,
): { csv: string; rows: number } {
  if (type === "product") {
    const rows = skus.map((s) => productFeedRow(s, rule));
    return { csv: toCsv(PRODUCT_COLUMNS, rows), rows: rows.length };
  }
  if (type === "inventory") {
    const rows = inventoryFeedRows(skus);
    return { csv: toCsv(INVENTORY_COLUMNS, rows), rows: rows.length };
  }
  const rows = pricingFeedRows(skus);
  return { csv: toCsv(PRICING_COLUMNS, rows), rows: rows.length };
}

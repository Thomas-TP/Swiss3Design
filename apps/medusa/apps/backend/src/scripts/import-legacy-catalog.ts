import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { MATERIALS_MODULE } from "../modules/materials"
import MaterialsModuleService from "../modules/materials/service"

/**
 * One-off import of the real (small) swiss3design.ch catalogue read from the
 * live D1 database on 2026-07-05 (read-only, explicit user authorization).
 * Data is inlined rather than fetched live from D1 at run time: the current
 * production catalogue is tiny (1 product, 3 categories, 1 material), so a
 * generic/reusable D1-fetching pipeline would be premature scope for Phase 1.
 * The real cutover ETL (Phase 6, larger catalogue) should generalize this
 * exact shape rather than rebuild it from scratch.
 *
 * Run with: npx medusa exec ./src/scripts/import-legacy-catalog.ts
 */

const LOCALES = [
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "it", name: "Italiano" },
  { code: "en", name: "English" },
] as const

// D1 categories (categories + category_translations, id/slug/sortOrder + fr/de/it/en names)
const D1_CATEGORIES = [
  {
    id: "c_deco",
    slug: "deco",
    names: { fr: "Décoration", de: "Dekoration", it: "Decorazione", en: "Home decor" },
  },
  {
    id: "c_bureau",
    slug: "bureau",
    names: { fr: "Bureau", de: "Büro", it: "Ufficio", en: "Desk" },
  },
  {
    id: "c_accessoires",
    slug: "accessoires",
    names: { fr: "Accessoires", de: "Accessoires", it: "Accessori", en: "Accessories" },
  },
] as const

// D1 materials (materials + filament_colors)
const D1_MATERIAL = {
  id: "04166f02efabe6b404e4ced39bf0e506",
  name: "PLA",
  colors: [
    { id: "c1c2479761a02018ff904f45739f5bdc", name: "Noir", hex: "#1C1917", sortOrder: 0 },
    { id: "79960c4fed264c7e9fd27965c1fa090f", name: "Blanc", hex: "#F5F5F4", sortOrder: 1 },
    { id: "cdb717fe-293d-4419-9b3a-fd780232cd40", name: "Bleu", hex: "#1A0CE4", sortOrder: 2 },
  ],
} as const

// D1 product "Vase spirale" (products + product_translations + product_images
// + product_colors, category = c_deco). Image URLs reconstructed against the
// live production domain (still the real file, just not yet copied into R2 —
// physically migrating file bytes is Phase 6 cutover work, not Phase 1).
const D1_PRODUCT = {
  id: "85c459c5-cbcd-4535-ae61-770b8e7ff753",
  slug: "vase-spirale",
  priceCents: 2400,
  saleType: "on_demand",
  productionDays: 3,
  material: "PLA",
  dimensionsMm: "80 x 80 x 120 mm",
  weightGrams: 120,
  model3dUrl: "https://swiss3design.ch/api/files/products/abfb9f86-041a-405a-8642-5ae9d558f803.stl",
  multicolor: false,
  featured: true,
  featuredOrder: 0,
  active: true,
  categoryId: "c_deco",
  translations: {
    fr: { name: "Vase spirale", description: "Vase spirale" },
    de: { name: "Vase spirale", description: "Vase spirale" },
    it: { name: "Vase spirale", description: "Vase spirale" },
    en: { name: "Vase spirale", description: "Vase spirale" },
  },
  images: [
    "https://swiss3design.ch/api/files/products/b20511bf-9b8c-46f9-9731-5d0a2d32ab50.webp",
    "https://swiss3design.ch/api/files/products/576697d9-c19b-49d6-91a5-c42bfe630e0a.webp",
    "https://swiss3design.ch/api/files/products/28115f06-4201-48bb-8c98-24ddb701f906.webp",
  ],
  // filament color ids from product_colors
  colorIds: ["79960c4fed264c7e9fd27965c1fa090f", "c1c2479761a02018ff904f45739f5bdc"],
} as const

export default async function importLegacyCatalog({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const translationService = container.resolve(Modules.TRANSLATION)
  const materialsService: MaterialsModuleService = container.resolve(MATERIALS_MODULE)

  logger.info("Creating locales (fr/de/it/en)...")
  await translationService.createLocales(LOCALES as unknown as { code: string; name: string }[])

  logger.info("Creating categories with translations...")
  const { result: categories } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: D1_CATEGORIES.map((c) => ({
        name: c.names.fr,
        handle: c.slug,
        is_active: true,
      })),
    },
  })
  const categoryIdByD1Id = new Map<string, string>()
  for (const d1Cat of D1_CATEGORIES) {
    const created = categories.find((c) => c.handle === d1Cat.slug)!
    categoryIdByD1Id.set(d1Cat.id, created.id)
    await translationService.createTranslations(
      (["de", "it", "en"] as const).map((locale) => ({
        reference: "product_category",
        reference_id: created.id,
        locale_code: locale,
        translations: { name: d1Cat.names[locale] },
      }))
    )
  }
  logger.info(`Created ${categories.length} categories.`)

  logger.info("Creating material + filament colors...")
  const material = await materialsService.createMaterials({ name: D1_MATERIAL.name })
  const colorIdByD1Id = new Map<string, string>()
  for (const c of D1_MATERIAL.colors) {
    const created = await materialsService.createFilamentColors({
      name: c.name,
      hex: c.hex,
      sort_order: c.sortOrder,
      material_id: material.id,
    })
    colorIdByD1Id.set(c.id, created.id)
  }
  logger.info(`Created material "${material.name}" with ${D1_MATERIAL.colors.length} colors.`)

  logger.info("Creating product...")
  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
  })
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })

  const skuBase = D1_PRODUCT.slug.toUpperCase()
  const { result: products } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: D1_PRODUCT.translations.fr.name,
          description: D1_PRODUCT.translations.fr.description,
          material: D1_PRODUCT.material,
          handle: D1_PRODUCT.slug,
          status: D1_PRODUCT.active ? ProductStatus.PUBLISHED : ProductStatus.DRAFT,
          category_ids: [categoryIdByD1Id.get(D1_PRODUCT.categoryId)!],
          shipping_profile_id: shippingProfiles[0]?.id,
          images: D1_PRODUCT.images.map((url) => ({ url })),
          options: [{ title: "Title", values: ["Default variant"] }],
          variants: [
            {
              title: "Default variant",
              sku: `${skuBase}-DEFAULT`,
              weight: D1_PRODUCT.weightGrams,
              options: { Title: "Default variant" },
              prices: [{ amount: D1_PRODUCT.priceCents / 100, currency_code: "chf" }],
            },
          ],
          sales_channels: salesChannels.map((sc) => ({ id: sc.id })),
          metadata: {
            legacy_d1_id: D1_PRODUCT.id,
            sale_type: D1_PRODUCT.saleType,
            production_days: D1_PRODUCT.productionDays,
            model_3d_url: D1_PRODUCT.model3dUrl,
            dimensions_mm: D1_PRODUCT.dimensionsMm,
            multicolor: D1_PRODUCT.multicolor,
            featured: D1_PRODUCT.featured,
            featured_order: D1_PRODUCT.featuredOrder,
          },
        },
      ],
    },
  })
  const product = products[0]

  await translationService.createTranslations(
    (["de", "it", "en"] as const).map((locale) => ({
      reference: "product",
      reference_id: product.id,
      locale_code: locale,
      translations: {
        title: D1_PRODUCT.translations[locale].name,
        description: D1_PRODUCT.translations[locale].description,
      },
    }))
  )

  logger.info("Linking available colors to product...")
  for (const d1ColorId of D1_PRODUCT.colorIds) {
    await materialsService.createProductColors({
      product_id: product.id,
      color_id: colorIdByD1Id.get(d1ColorId)!,
      sort_order: 0,
    })
  }

  logger.info(`Done. Product "${product.title}" created with id ${product.id}.`)
}

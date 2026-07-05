import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
  createStockLocationsWorkflow,
  createShippingOptionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Sets up Switzerland-only checkout to match the current app's real business
 * rules (see src/lib/shipping.ts, orders.ts in the Next.js app):
 * - Region "Suisse": CHF, country CH, automatic_taxes: false (the current app
 *   has no separate tax field on orders — prices are already VAT-inclusive,
 *   this preserves that instead of inventing a new tax computation).
 * - One flat shipping option (8.90 CHF), free from 60 CHF via a price rule on
 *   `item_total` (matches shippingFor(): SHIPPING_CENTS=890, FREE_SHIPPING_OVER_CENTS=6000).
 * - Stripe registered as a region payment provider alongside the system default.
 *
 * Run with: npx medusa exec ./src/scripts/setup-switzerland-checkout.ts
 */
export default async function setupSwitzerlandCheckout({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const storeModuleService = container.resolve(Modules.STORE)

  logger.info("Creating region Suisse (CHF, CH, tax-inclusive pricing)...")
  const {
    result: [region],
  } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Suisse",
          currency_code: "chf",
          countries: ["ch"],
          automatic_taxes: false,
          payment_providers: ["pp_system_default", "pp_stripe_stripe"],
        },
      ],
    },
  })

  const [store] = await storeModuleService.listStores()
  await updateStoresWorkflow(container).run({
    input: { selector: { id: store.id }, update: { default_region_id: region.id } },
  })

  logger.info("Creating stock location + CH-only fulfillment set...")
  const {
    result: [stockLocation],
  } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [
        {
          name: "Atelier Suisse",
          address: { city: "Genève", country_code: "CH", address_1: "" },
        },
      ],
    },
  })

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  })

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  const shippingProfile = shippingProfiles[0]

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Livraison Suisse",
    type: "shipping",
    service_zones: [
      {
        name: "Suisse",
        geo_zones: [{ country_code: "ch", type: "country" }],
      },
    ],
  })

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  })

  logger.info("Creating shipping option (8.90 CHF, gratuit des 60 CHF)...")
  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Livraison standard",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Livraison en Suisse",
          code: "standard",
        },
        prices: [
          { currency_code: "chf", amount: 8.9 },
          {
            currency_code: "chf",
            amount: 0,
            rules: [{ attribute: "item_total", operator: "gte", value: 60 }],
          },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  })

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
  })
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: salesChannels.map((sc) => sc.id) },
  })

  logger.info(`Done. Region "${region.name}" (${region.id}) ready.`)
}

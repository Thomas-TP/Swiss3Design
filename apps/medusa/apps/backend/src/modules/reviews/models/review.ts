import { model } from "@medusajs/framework/utils"

// Avis client sur un produit, laissé après livraison de la commande — aucun
// équivalent Medusa natif. Miroir de reviews dans D1. product_id/order_id
// sont des références brutes vers Product/Order (core, autres modules, cf.
// materials/product-color pour le même choix). Créés côté storefront
// (Phase 5, après livraison) ; cette extension admin ne fait que modérer.
const Review = model
  .define("Review", {
    id: model.id({ prefix: "review" }).primaryKey(),
    product_id: model.text(),
    order_id: model.text(),
    customer_id: model.text().nullable(),
    author_name: model.text(),
    rating: model.number(),
    body: model.text().nullable(),
    status: model.enum(["pending", "published", "rejected"]).default("pending"),
  })
  .indexes([
    { on: ["product_id"] },
    { on: ["status"] },
    // Un seul avis par (commande, produit) : empêche les doublons.
    { on: ["order_id", "product_id"], unique: true },
  ])

export default Review

import { model } from "@medusajs/framework/utils"

// Couleurs proposees par un produit, choisies dans la palette de son
// filament. product_id est une reference brute vers Product (core, autre
// module) - pas de relation DML cross-module, cf. product_colors dans D1.
// La couleur retenue a l'achat est figee en metadata de ligne de commande
// (Phase 2), pas ici.
const ProductColor = model
  .define("ProductColor", {
    id: model.id({ prefix: "prodcol" }).primaryKey(),
    product_id: model.text(),
    color_id: model.text(),
    sort_order: model.number().default(0),
  })
  .indexes([
    { on: ["product_id", "color_id"], unique: true },
    { on: ["product_id"] },
  ])

export default ProductColor

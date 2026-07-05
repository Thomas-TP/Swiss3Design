import { model } from "@medusajs/framework/utils"
import FilamentColor from "./filament-color"

// Palette de filaments proposee a la creation d'un produit (editable en
// admin). Le produit garde le nom retenu dans Product.material (deja
// .translatable() dans le core Medusa) - miroir de materials/filament_colors
// dans le schema D1 d'origine.
const Material = model
  .define("Material", {
    id: model.id({ prefix: "mat" }).primaryKey(),
    name: model.text().searchable(),
    colors: model.hasMany(() => FilamentColor, { mappedBy: "material" }),
  })
  .indexes([{ on: ["name"], unique: true }])
  .cascades({ delete: ["colors"] })

export default Material

import { model } from "@medusajs/framework/utils"
import Material from "./material"

// Couleur disponible pour un filament (palette editable en admin) : nom +
// code hex affiche en pastille. Miroir de filament_colors dans D1.
const FilamentColor = model
  .define("FilamentColor", {
    id: model.id({ prefix: "filcol" }).primaryKey(),
    name: model.text(),
    hex: model.text(),
    sort_order: model.number().default(0),
    material: model.belongsTo(() => Material, { mappedBy: "colors" }),
  })
  .indexes([{ on: ["material_id", "name"], unique: true }])

export default FilamentColor

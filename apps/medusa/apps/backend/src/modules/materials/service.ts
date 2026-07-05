import { MedusaService } from "@medusajs/framework/utils"
import Material from "./models/material"
import FilamentColor from "./models/filament-color"
import ProductColor from "./models/product-color"

class MaterialsModuleService extends MedusaService({
  Material,
  FilamentColor,
  ProductColor,
}) {}

export default MaterialsModuleService

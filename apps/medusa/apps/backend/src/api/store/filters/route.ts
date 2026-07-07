import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { MATERIALS_MODULE } from "../../../modules/materials"
import MaterialsModuleService from "../../../modules/materials/service"

// Filtres du catalogue (matières/couleurs/multicolore réellement utilisés
// par des produits publiés) - lecture publique, miroir de getUsedFilters()
// côté ancienne app D1. Les catégories sont déjà couvertes nativement par
// GET /store/product-categories, pas besoin de les dupliquer ici.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const materialsService: MaterialsModuleService = req.scope.resolve(MATERIALS_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)

  const products = await productService.listProducts(
    { status: ["published"] },
    { select: ["id", "material", "metadata"] },
  )

  const usedMaterialNames = new Set(products.map((p) => p.material).filter((m): m is string => Boolean(m)))
  const multicolor = products.some((p) => Boolean(p.metadata?.multicolor))
  const productIds = products.map((p) => p.id)

  const productColors = productIds.length
    ? await materialsService.listProductColors({ product_id: productIds })
    : []
  const usedColorIds = new Set(productColors.map((pc) => pc.color_id))

  const allColors = usedColorIds.size
    ? await materialsService.listFilamentColors({ id: [...usedColorIds] }, { order: { name: "ASC" } })
    : []
  // Dédoublonne par nom (deux filaments peuvent partager "Rouge"), garde le
  // premier hex rencontré - même règle que getUsedFilters() côté D1.
  const seen = new Set<string>()
  const colors: { name: string; hex: string }[] = []
  for (const c of allColors) {
    if (seen.has(c.name)) continue
    seen.add(c.name)
    colors.push({ name: c.name, hex: c.hex })
  }

  res.json({
    materials: [...usedMaterialNames].sort(),
    colors,
    multicolor,
  })
}

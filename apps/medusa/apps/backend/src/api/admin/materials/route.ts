import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { MATERIALS_MODULE } from "../../../modules/materials"
import MaterialsModuleService from "../../../modules/materials/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const materialsService: MaterialsModuleService = req.scope.resolve(MATERIALS_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)

  const materials = await materialsService.listMaterials(
    {},
    { relations: ["colors"], order: { name: "ASC" } },
  )

  // Product.material n'est pas un champ filtrable côté module Produit (pas
  // dans FilterableProductProps) : on compte en une seule passe côté code
  // plutôt qu'une requête filtrée par filament (catalogue de taille réduite).
  const allProducts = await productService.listProducts({}, { select: ["id", "material"] })
  const countByName = new Map<string, number>()
  for (const p of allProducts) {
    if (!p.material) continue
    countByName.set(p.material, (countByName.get(p.material) ?? 0) + 1)
  }

  res.json({
    materials: materials.map((m) => ({
      id: m.id,
      name: m.name,
      count: countByName.get(m.name) ?? 0,
      colors: [...m.colors]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({ id: c.id, name: c.name, hex: c.hex })),
    })),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const materialsService: MaterialsModuleService = req.scope.resolve(MATERIALS_MODULE)
  const { name } = req.body as { name?: string }

  const trimmed = (name ?? "").trim().slice(0, 60)
  if (trimmed.length < 1) {
    res.status(400).json({ message: "Le nom du filament est obligatoire." })
    return
  }

  try {
    const material = await materialsService.createMaterials({ name: trimmed })
    res.json({ material })
  } catch (e) {
    if (String(e).includes("unique")) {
      res.status(400).json({ message: `Le filament « ${trimmed} » existe déjà.` })
      return
    }
    throw e
  }
}

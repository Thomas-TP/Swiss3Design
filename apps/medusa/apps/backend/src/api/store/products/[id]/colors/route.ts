import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MATERIALS_MODULE } from "../../../../../modules/materials"
import MaterialsModuleService from "../../../../../modules/materials/service"

// Palette de couleurs d'un produit (fiche produit storefront) - lecture
// publique, pas d'authentification. Miroir de la palette affichée dans
// l'extension admin "Filaments & couleurs" (Phase 4), mais filtrée pour un
// seul produit et triée pour l'affichage client.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const materialsService: MaterialsModuleService = req.scope.resolve(MATERIALS_MODULE)
  const { id } = req.params as { id: string }

  const productColors = await materialsService.listProductColors(
    { product_id: id },
    { order: { sort_order: "ASC" } },
  )

  // color_id est une référence brute (pas de relation DML avec FilamentColor,
  // même choix que product_id vers Product) - on résout par lot, même pattern
  // que l'extension admin "Filaments & couleurs".
  const colorIds = productColors.map((pc) => pc.color_id)
  const filamentColors = colorIds.length
    ? await materialsService.listFilamentColors({ id: colorIds })
    : []
  const colorById = new Map(filamentColors.map((c) => [c.id, c]))

  res.json({
    colors: productColors
      .map((pc) => colorById.get(pc.color_id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({ id: c.id, name: c.name, hex: c.hex })),
  })
}

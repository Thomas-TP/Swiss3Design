import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MATERIALS_MODULE } from "../../../../modules/materials"
import MaterialsModuleService from "../../../../modules/materials/service"

// Retire le filament de la palette (les couleurs partent en cascade — voir
// Material.cascades). Les produits qui l'utilisent gardent leur matière
// (texte core Medusa Product.material) : rien à recalculer côté produit.
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const materialsService: MaterialsModuleService = req.scope.resolve(MATERIALS_MODULE)
  const { id } = req.params
  await materialsService.deleteMaterials(id)
  res.status(200).json({ id, deleted: true })
}

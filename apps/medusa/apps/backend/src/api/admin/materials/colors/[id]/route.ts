import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MATERIALS_MODULE } from "../../../../../modules/materials"
import MaterialsModuleService from "../../../../../modules/materials/service"

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const materialsService: MaterialsModuleService = req.scope.resolve(MATERIALS_MODULE)
  const { id } = req.params
  await materialsService.deleteFilamentColors(id)
  res.status(200).json({ id, deleted: true })
}

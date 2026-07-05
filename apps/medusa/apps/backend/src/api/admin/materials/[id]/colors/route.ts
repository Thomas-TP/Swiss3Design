import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MATERIALS_MODULE } from "../../../../../modules/materials"
import MaterialsModuleService from "../../../../../modules/materials/service"

const HEX_RE = /^#[0-9a-fA-F]{6}$/

// Ajoute une couleur (nom + hex) a la palette d'un filament, en fin de liste.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const materialsService: MaterialsModuleService = req.scope.resolve(MATERIALS_MODULE)
  const { id: materialId } = req.params
  const { name, hex } = req.body as { name?: string; hex?: string }

  const trimmedName = (name ?? "").trim().slice(0, 40)
  const upperHex = (hex ?? "").trim().toUpperCase()

  if (trimmedName.length < 1) {
    res.status(400).json({ message: "Le nom de la couleur est obligatoire." })
    return
  }
  if (!HEX_RE.test(upperHex)) {
    res.status(400).json({ message: "Code couleur invalide (ex. #E5231C)." })
    return
  }

  const existing = await materialsService.listFilamentColors({ material_id: materialId })
  const nextOrder = existing.reduce((max, c) => Math.max(max, c.sort_order + 1), 0)

  try {
    const color = await materialsService.createFilamentColors({
      material_id: materialId,
      name: trimmedName,
      hex: upperHex,
      sort_order: nextOrder,
    })
    res.json({ color })
  } catch (e) {
    if (String(e).includes("unique")) {
      res.status(400).json({ message: `La couleur « ${trimmedName} » existe déjà pour ce filament.` })
      return
    }
    throw e
  }
}

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

// Suivi de commande invité (numéro de commande + e-mail, sans compte) -
// miroir de /api/track-order côté ancienne app D1, mais interroge
// directement Medusa (source de vérité des commandes depuis la migration).
// Lecture publique volontairement restreinte : la correspondance exacte
// display_id + email agit comme preuve de possession, comme avant.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { orderNumber, email } = req.body as { orderNumber?: string; email?: string }

  const displayId = Number(orderNumber)
  if (!orderNumber || !Number.isInteger(displayId) || !email) {
    return res.status(400).json({ message: "orderNumber and email are required" })
  }

  const orderService = req.scope.resolve(Modules.ORDER)
  // display_id n'est pas déclaré dans FilterableOrderProps (limitation du
  // typage Medusa) mais reste filtrable côté requête réelle (colonne native).
  const [order] = await orderService.listOrders(
    { display_id: displayId, email: email.toLowerCase() } as Record<string, unknown>,
    {
      select: [
        "id",
        "display_id",
        "email",
        "created_at",
        "fulfillment_status",
        "currency_code",
        "subtotal",
        "discount_total",
        "shipping_total",
        "total",
      ],
      relations: ["items", "shipping_address", "fulfillments", "fulfillments.labels", "promotions"],
    },
  )

  if (!order) {
    return res.status(404).json({ message: "not_found" })
  }

  res.json({ order })
}

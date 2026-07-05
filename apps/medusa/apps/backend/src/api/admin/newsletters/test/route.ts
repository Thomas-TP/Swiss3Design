import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { sendTestAnnouncement, type NewsletterComposeInput } from "../../../../lib/newsletter-bridge"

export async function POST(
  req: AuthenticatedMedusaRequest<NewsletterComposeInput>,
  res: MedusaResponse,
) {
  const actorId = req.auth_context.actor_id
  const userService = req.scope.resolve(Modules.USER)
  const adminUser = await userService.retrieveUser(actorId)

  const result = await sendTestAnnouncement(req.body, adminUser.email)
  if (result.error) {
    res.status(result.status).json({ message: result.error })
    return
  }
  res.json(result.data)
}

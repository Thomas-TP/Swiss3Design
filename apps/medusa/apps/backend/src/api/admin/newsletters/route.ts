import { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { NEWSLETTERS_MODULE } from "../../../modules/newsletters"
import NewslettersModuleService from "../../../modules/newsletters/service"
import { sendAnnouncement, type NewsletterComposeInput } from "../../../lib/newsletter-bridge"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const newslettersService: NewslettersModuleService = req.scope.resolve(NEWSLETTERS_MODULE)
  const sends = await newslettersService.listNewsletterSends(
    {},
    { order: { created_at: "DESC" }, take: 20 },
  )
  res.json({ sends })
}

export async function POST(
  req: AuthenticatedMedusaRequest<NewsletterComposeInput>,
  res: MedusaResponse,
) {
  const newslettersService: NewslettersModuleService = req.scope.resolve(NEWSLETTERS_MODULE)
  const input = req.body

  const result = await sendAnnouncement(input)
  if (result.error) {
    res.status(result.status).json({ message: result.error })
    return
  }

  const { count } = result.data as { count: number }
  const send = await newslettersService.createNewsletterSends({
    subject: input.subject,
    audience: input.audience,
    product_ids: input.productIds.length ? JSON.stringify(input.productIds) : null,
    recipient_count: count,
    sent_by: req.auth_context.actor_id,
  })

  res.json({ send, count })
}

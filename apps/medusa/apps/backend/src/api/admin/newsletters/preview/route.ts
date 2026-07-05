import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { previewAnnouncement, type NewsletterComposeInput } from "../../../../lib/newsletter-bridge"

export async function POST(req: MedusaRequest<NewsletterComposeInput>, res: MedusaResponse) {
  const result = await previewAnnouncement(req.body)
  if (result.error) {
    res.status(result.status).json({ message: result.error })
    return
  }
  res.json(result.data)
}

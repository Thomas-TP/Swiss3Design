import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUOTES_MODULE } from "../../../../modules/quotes"
import QuotesModuleService from "../../../../modules/quotes/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const quotesService: QuotesModuleService = req.scope.resolve(QUOTES_MODULE)
  const quote = await quotesService.retrieveQuoteRequest(req.params.id, {
    relations: ["messages"],
  })
  res.json({ quote })
}

type UpdateQuoteBody = {
  status?: string
  quoted_price?: number
  admin_message?: string
  admin_note?: string
}

export async function POST(req: MedusaRequest<UpdateQuoteBody>, res: MedusaResponse) {
  const quotesService: QuotesModuleService = req.scope.resolve(QUOTES_MODULE)
  const current = await quotesService.retrieveQuoteRequest(req.params.id)
  const { status, quoted_price, admin_message, admin_note } = req.body ?? {}

  const update: Record<string, unknown> = { id: current.id }
  if (status !== undefined) update.status = status
  if (admin_message !== undefined) update.admin_message = admin_message
  if (admin_note !== undefined) update.admin_note = admin_note

  // Quoting (or re-quoting after a revision request) resets the 30-day
  // validity window - matches the current app's behaviour exactly.
  if (quoted_price !== undefined) {
    update.quoted_price = quoted_price
    update.valid_until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    if (status === undefined) {
      update.status = "quoted"
    }
  }

  const quote = await quotesService.updateQuoteRequests(update as { id: string })
  res.json({ quote })
}

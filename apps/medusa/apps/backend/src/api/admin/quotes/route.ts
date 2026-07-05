import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUOTES_MODULE } from "../../../modules/quotes"
import QuotesModuleService from "../../../modules/quotes/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const quotesService: QuotesModuleService = req.scope.resolve(QUOTES_MODULE)
  const { status, q } = req.query as { status?: string; q?: string }

  const filters: Record<string, unknown> = {}
  if (status) {
    filters.status = status
  }
  if (q) {
    filters.$or = [{ email: { $ilike: `%${q}%` } }, { description: { $ilike: `%${q}%` } }]
  }

  const quotes = await quotesService.listQuoteRequests(filters, {
    order: { created_at: "DESC" },
  })
  res.json({ quotes })
}

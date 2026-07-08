import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUOTES_MODULE } from "../../../../../modules/quotes"
import QuotesModuleService from "../../../../../modules/quotes/service"

const DECLINABLE_STATUSES = new Set(["quoted", "accepted", "revision_requested"])

// Le client refuse le devis (motif facultatif) - miroir de declineQuote()
// côté ancienne app D1. Couvert par le middleware générique
// /store/quotes/:id* (authentification client requise), aucune entrée
// supplémentaire nécessaire dans middlewares.ts.
export async function POST(
  req: AuthenticatedMedusaRequest<{ reason?: string }>,
  res: MedusaResponse
) {
  const quotesService: QuotesModuleService = req.scope.resolve(QUOTES_MODULE)
  const quote = await quotesService.retrieveQuoteRequest(req.params.id)

  if (quote.customer_id !== req.auth_context.actor_id) {
    return res.status(404).json({ message: "Quote not found" })
  }
  if (!DECLINABLE_STATUSES.has(quote.status)) {
    return res.status(400).json({ message: `Quote cannot be declined in status "${quote.status}"` })
  }

  const reason = req.body?.reason?.trim()
  if (reason) {
    await quotesService.createQuoteMessages({
      quote_id: quote.id,
      sender: "customer",
      body: reason,
    })
  }

  const updated = await quotesService.updateQuoteRequests({
    id: quote.id,
    status: "declined",
  })

  res.json({ quote: updated })
}

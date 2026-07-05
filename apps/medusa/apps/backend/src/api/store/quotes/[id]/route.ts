import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUOTES_MODULE } from "../../../../modules/quotes"
import QuotesModuleService from "../../../../modules/quotes/service"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const quotesService: QuotesModuleService = req.scope.resolve(QUOTES_MODULE)
  const quote = await quotesService.retrieveQuoteRequest(req.params.id, {
    relations: ["messages"],
  })

  if (quote.customer_id !== req.auth_context.actor_id) {
    return res.status(404).json({ message: "Quote not found" })
  }

  res.json({ quote })
}

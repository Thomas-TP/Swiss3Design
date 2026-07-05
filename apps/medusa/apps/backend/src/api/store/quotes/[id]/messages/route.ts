import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUOTES_MODULE } from "../../../../../modules/quotes"
import QuotesModuleService from "../../../../../modules/quotes/service"

export async function POST(
  req: AuthenticatedMedusaRequest<{ body: string; file_url?: string; file_name?: string }>,
  res: MedusaResponse
) {
  const quotesService: QuotesModuleService = req.scope.resolve(QUOTES_MODULE)
  const quote = await quotesService.retrieveQuoteRequest(req.params.id)

  if (quote.customer_id !== req.auth_context.actor_id) {
    return res.status(404).json({ message: "Quote not found" })
  }

  const { body, file_url, file_name } = req.body ?? {}
  if (!body || typeof body !== "string" || !body.trim()) {
    return res.status(400).json({ message: "body is required" })
  }

  const message = await quotesService.createQuoteMessages({
    quote_id: quote.id,
    sender: "customer",
    body,
    file_url,
    file_name,
  })

  // A customer reply on a quote the workshop already quoted signals they want
  // changes - mirrors the current app's "revision_requested" transition.
  if (quote.status === "quoted") {
    await quotesService.updateQuoteRequests({
      id: quote.id,
      status: "revision_requested",
    })
  }

  res.status(201).json({ message })
}

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUOTES_MODULE } from "../../../../../modules/quotes"
import QuotesModuleService from "../../../../../modules/quotes/service"

type AdminMessageBody = {
  body: string
  price?: number
  file_url?: string
  file_name?: string
}

export async function POST(req: MedusaRequest<AdminMessageBody>, res: MedusaResponse) {
  const quotesService: QuotesModuleService = req.scope.resolve(QUOTES_MODULE)
  const quote = await quotesService.retrieveQuoteRequest(req.params.id)
  const { body, price, file_url, file_name } = req.body ?? {}

  if (!body || typeof body !== "string" || !body.trim()) {
    return res.status(400).json({ message: "body is required" })
  }

  const message = await quotesService.createQuoteMessages({
    quote_id: quote.id,
    sender: "admin",
    body,
    price,
    file_url,
    file_name,
  })

  // A message carrying a price is a (re-)quote - same 30-day reset as the
  // direct quoted_price update on the quote route.
  if (price !== undefined) {
    await quotesService.updateQuoteRequests({
      id: quote.id,
      status: "quoted",
      quoted_price: price,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
  }

  res.status(201).json({ message })
}

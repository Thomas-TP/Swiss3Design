import type { MedusaContainer } from "@medusajs/framework/types"
import { QUOTES_MODULE } from "../modules/quotes"
import QuotesModuleService from "../modules/quotes/service"

const ALREADY_FINAL = new Set(["paid", "in_production", "done"])

/**
 * Idempotent quote payment finalization - mirrors the current app's
 * markQuotePaid()/markOrderPaid() pattern (called from both the webhook and
 * the client return-page, exactly once takes effect either way).
 */
export async function markQuotePaidIfNeeded(container: MedusaContainer, quoteId: string) {
  const quotesService: QuotesModuleService = container.resolve(QUOTES_MODULE)
  const quote = await quotesService.retrieveQuoteRequest(quoteId)

  if (ALREADY_FINAL.has(quote.status)) {
    return quote
  }

  return quotesService.updateQuoteRequests({ id: quoteId, status: "paid" })
}

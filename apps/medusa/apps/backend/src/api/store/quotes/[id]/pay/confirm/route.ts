import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUOTES_MODULE } from "../../../../../../modules/quotes"
import QuotesModuleService from "../../../../../../modules/quotes/service"
import { markQuotePaidIfNeeded } from "../../../../../../lib/mark-quote-paid"

// Client-side return-page confirmation, mirrors the current app's
// /checkout/success calling markOrderPaid() in parallel with the webhook -
// whichever of the two runs first wins, both are safe to call (idempotent).
export async function POST(
  req: AuthenticatedMedusaRequest<{ payment_collection_id: string }>,
  res: MedusaResponse
) {
  const quotesService: QuotesModuleService = req.scope.resolve(QUOTES_MODULE)
  const quote = await quotesService.retrieveQuoteRequest(req.params.id)

  if (quote.customer_id !== req.auth_context.actor_id) {
    return res.status(404).json({ message: "Quote not found" })
  }

  const { payment_collection_id } = req.body ?? {}
  if (!payment_collection_id) {
    return res.status(400).json({ message: "payment_collection_id is required" })
  }

  const query = req.scope.resolve("query")
  const { data: paymentCollections } = await query.graph({
    entity: "payment_collection",
    fields: ["id", "status", "metadata"],
    filters: { id: payment_collection_id },
  })
  const paymentCollection = paymentCollections[0]

  if (!paymentCollection || paymentCollection.metadata?.quote_id !== quote.id) {
    return res.status(400).json({ message: "Payment collection does not match this quote" })
  }
  if (paymentCollection.status !== "authorized" && paymentCollection.status !== "completed") {
    return res.status(400).json({ message: "Payment is not confirmed yet" })
  }

  const updated = await markQuotePaidIfNeeded(req.scope, quote.id)
  res.json({ quote: updated })
}

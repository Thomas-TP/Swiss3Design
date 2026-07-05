import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { QUOTES_MODULE } from "../../../../../modules/quotes"
import QuotesModuleService from "../../../../../modules/quotes/service"

const PAYABLE_STATUSES = new Set(["quoted", "accepted"])

// Devis payment is a standalone Payment Collection (no cart/order needed -
// the Store API's own POST /store/payment-collections requires a cart_id,
// but the Payment module service itself doesn't), mirroring the current
// app's dedicated /api/quote-checkout Stripe session for the exact quoted
// price rather than routing a bespoke price through the product catalog.
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const quotesService: QuotesModuleService = req.scope.resolve(QUOTES_MODULE)
  const quote = await quotesService.retrieveQuoteRequest(req.params.id)

  if (quote.customer_id !== req.auth_context.actor_id) {
    return res.status(404).json({ message: "Quote not found" })
  }
  if (!PAYABLE_STATUSES.has(quote.status)) {
    return res.status(400).json({ message: `Quote is not payable in status "${quote.status}"` })
  }
  if (!quote.quoted_price) {
    return res.status(400).json({ message: "Quote has no price yet" })
  }
  if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
    return res.status(400).json({ message: "Quote has expired" })
  }

  const paymentModuleService = req.scope.resolve(Modules.PAYMENT)
  const paymentCollection = await paymentModuleService.createPaymentCollections({
    currency_code: "chf",
    amount: quote.quoted_price,
    metadata: { quote_id: quote.id },
  })
  const paymentSession = await paymentModuleService.createPaymentSession(paymentCollection.id, {
    provider_id: "pp_stripe_stripe",
    currency_code: "chf",
    amount: quote.quoted_price,
    data: {},
  })

  res.status(201).json({ payment_collection_id: paymentCollection.id, payment_session: paymentSession })
}

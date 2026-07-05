import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, PaymentEvents } from "@medusajs/framework/utils"
import { markQuotePaidIfNeeded } from "../lib/mark-quote-paid"

// Webhook-driven path (Stripe -> Medusa's own /hooks/payment/stripe -> this
// event) for finalizing a quote payment. Runs independently of, and
// idempotently with, the client return-page confirmation in
// store/quotes/[id]/pay/confirm - same dual-path pattern as the current
// app's Stripe webhook + /checkout/success both calling markOrderPaid().
export default async function quotePaymentCapturedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: payments } = await query.graph({
    entity: "payment",
    fields: ["id", "payment_collection_id"],
    filters: { id: event.data.id },
  })
  const payment = payments[0]
  if (!payment?.payment_collection_id) {
    return
  }

  const { data: paymentCollections } = await query.graph({
    entity: "payment_collection",
    fields: ["id", "metadata"],
    filters: { id: payment.payment_collection_id },
  })
  const quoteId = paymentCollections[0]?.metadata?.quote_id as string | undefined
  if (!quoteId) {
    // Not a quote payment (e.g. a regular cart checkout) - nothing to do.
    return
  }

  await markQuotePaidIfNeeded(container, quoteId)
}

export const config: SubscriberConfig = {
  event: PaymentEvents.CAPTURED,
}

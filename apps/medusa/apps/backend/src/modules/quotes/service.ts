import { MedusaService } from "@medusajs/framework/utils"
import QuoteRequest from "./models/quote-request"
import QuoteMessage from "./models/quote-message"

class QuotesModuleService extends MedusaService({
  QuoteRequest,
  QuoteMessage,
}) {}

export default QuotesModuleService

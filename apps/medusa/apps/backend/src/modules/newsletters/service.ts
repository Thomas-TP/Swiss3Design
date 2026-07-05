import { MedusaService } from "@medusajs/framework/utils"
import NewsletterSend from "./models/newsletter-send"

class NewslettersModuleService extends MedusaService({
  NewsletterSend,
}) {}

export default NewslettersModuleService

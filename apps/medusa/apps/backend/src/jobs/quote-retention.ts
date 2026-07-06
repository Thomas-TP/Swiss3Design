import type { MedusaContainer } from "@medusajs/framework/types"
import { runQuoteRetention } from "../lib/run-quote-retention"

export default async function quoteRetentionJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const { deleted, filesCleared } = await runQuoteRetention(container)
  logger.info(`[quote-retention] deleted=${deleted} files-cleared=${filesCleared}`)
}

export const config = {
  name: "quote-retention",
  schedule: "0 3 * * *", // daily at 03:00
}

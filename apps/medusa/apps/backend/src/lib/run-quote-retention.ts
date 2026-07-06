import type { MedusaContainer } from "@medusajs/framework/types"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { QUOTES_MODULE } from "../modules/quotes"
import QuotesModuleService from "../modules/quotes/service"

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000
const KEPT_STATUSES = new Set(["paid", "in_production", "done"])

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// file_url is a full https://endpoint/bucket/key URL (see store/quotes/upload)
// - strip the known prefix to get the R2 object key for direct deletion.
function keyFromFileUrl(fileUrl: string): string | null {
  const prefix = `${process.env.R2_FILE_URL}/`
  return fileUrl.startsWith(prefix) ? fileUrl.slice(prefix.length) : null
}

async function deleteQuoteFile(fileUrl: string | null) {
  if (!fileUrl) return
  const key = keyFromFileUrl(fileUrl)
  if (!key) return
  await s3
    .send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }))
    .catch(() => {})
}

export interface QuoteRetentionReport {
  deleted: number
  filesCleared: number
}

/**
 * GDPR retention for quote requests (RGPD, art. 21) - mirrors runMaintenance()
 * in the current app: quotes older than 2 years are purged entirely unless
 * they represent a paying customer (paid/in_production/done), in which case
 * only the uploaded 3D file is dropped and the row is kept for accounting.
 *
 * Extracted from src/jobs/quote-retention.ts so it can be called both by the
 * daily scheduled job AND on-demand from the admin "Réglages" extension
 * (src/api/admin/maintenance/route.ts) — single implementation, matches the
 * current app's dual scheduled+manual trigger pattern
 * (src/lib/maintenance.ts + the "Réglages" button).
 *
 * Scoped to quotes only for this phase - abandoned-cart reminders/purge and
 * broader R2 orphan-file cleanup (also in workers/cron today) need their own
 * module/design pass (Medusa's Cart entity has no first-class "abandoned"
 * concept to hook into yet, and no R2 folder-prefix strategy has been
 * decided) and are deferred rather than bolted on here.
 */
export async function runQuoteRetention(container: MedusaContainer): Promise<QuoteRetentionReport> {
  const quotesService: QuotesModuleService = container.resolve(QUOTES_MODULE)

  const cutoff = new Date(Date.now() - TWO_YEARS_MS)
  const oldQuotes = await quotesService.listQuoteRequests({
    created_at: { $lt: cutoff },
  })

  let deleted = 0
  let filesCleared = 0

  for (const quote of oldQuotes) {
    if (KEPT_STATUSES.has(quote.status)) {
      if (quote.file_url) {
        await deleteQuoteFile(quote.file_url)
        await quotesService.updateQuoteRequests({ id: quote.id, file_url: null, file_name: null })
        filesCleared++
      }
      continue
    }

    await deleteQuoteFile(quote.file_url)
    await quotesService.deleteQuoteRequests(quote.id)
    deleted++
  }

  return { deleted, filesCleared }
}

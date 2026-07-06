import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { runQuoteRetention } from "../../../lib/run-quote-retention"

// Déclenchement manuel de la même logique que le job planifié quotidien
// (src/jobs/quote-retention.ts, 03:00) — pour un nettoyage immédiat entre deux
// exécutions planifiées, miroir du bouton "Lancer le nettoyage" de l'ancien
// panel Next.js (src/app/[locale]/admin/settings/maintenance-button.tsx).
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const report = await runQuoteRetention(req.scope)
  res.json(report)
}

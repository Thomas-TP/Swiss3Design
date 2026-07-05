import { MedusaResponse } from "@medusajs/framework/http"
import { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { MedusaRequest } from "@medusajs/framework/http"
import { QUOTES_MODULE } from "../../../modules/quotes"
import QuotesModuleService from "../../../modules/quotes/service"

type CreateQuoteBody = {
  email: string
  description: string
  material?: string
  colors?: string
  dimensions?: string
  file_url?: string
  file_name?: string
  locale?: "fr" | "de" | "it" | "en"
}

export async function POST(
  req: MedusaRequest<CreateQuoteBody> & { auth_context?: { actor_id?: string } },
  res: MedusaResponse
) {
  const { email, description, material, colors, dimensions, file_url, file_name, locale } =
    req.body ?? {}

  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "email is required" })
  }
  if (!description || typeof description !== "string" || description.trim().length < 10) {
    return res.status(400).json({ message: "description must be at least 10 characters" })
  }

  const quotesService: QuotesModuleService = req.scope.resolve(QUOTES_MODULE)
  const quote = await quotesService.createQuoteRequests({
    email,
    description,
    material,
    colors,
    dimensions,
    file_url,
    file_name,
    locale: locale ?? "fr",
    // Populated only if the request came in authenticated (better-auth
    // bridge token) - guests stay unlinked, exactly like the current app;
    // there is no retroactive back-fill-on-signup step yet (Phase 4).
    customer_id: req.auth_context?.actor_id ?? null,
  })

  res.status(201).json({ quote })
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const quotesService: QuotesModuleService = req.scope.resolve(QUOTES_MODULE)
  const quotes = await quotesService.listQuoteRequests(
    { customer_id: req.auth_context.actor_id },
    { order: { created_at: "DESC" } }
  )
  res.json({ quotes })
}

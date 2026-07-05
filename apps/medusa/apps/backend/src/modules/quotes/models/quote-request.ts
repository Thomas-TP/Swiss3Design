import { model } from "@medusajs/framework/utils"
import QuoteMessage from "./quote-message"

// Devis 3D sur mesure - bespoke, aucun equivalent Medusa (pas de "workflow de
// devis" dans une plateforme e-commerce standard). Miroir de quote_requests
// dans D1. customer_id est une reference brute vers Customer (core, autre
// module, cf. materials/product-color pour le meme choix) - resolue via le
// pont better-auth (Phase 0/4), jamais garantie non-nulle (devis invite).
const QuoteRequest = model
  .define("QuoteRequest", {
    id: model.id({ prefix: "quote" }).primaryKey(),
    customer_id: model.text().nullable(),
    email: model.text(),
    description: model.text(),
    material: model.text().nullable(),
    colors: model.text().nullable(),
    dimensions: model.text().nullable(),
    file_url: model.text().nullable(),
    file_name: model.text().nullable(),
    status: model
      .enum([
        "received",
        "quoted",
        "revision_requested",
        "accepted",
        "declined",
        "paid",
        "in_production",
        "done",
        "rejected",
      ])
      .default("received"),
    quoted_price: model.number().nullable(),
    admin_message: model.text().nullable(),
    valid_until: model.dateTime().nullable(),
    admin_note: model.text().nullable(),
    locale: model.enum(["fr", "de", "it", "en"]).default("fr"),
    messages: model.hasMany(() => QuoteMessage, { mappedBy: "quote" }),
  })
  .indexes([
    { on: ["email"] },
    { on: ["customer_id"] },
    { on: ["status"] },
  ])
  .cascades({ delete: ["messages"] })

export default QuoteRequest

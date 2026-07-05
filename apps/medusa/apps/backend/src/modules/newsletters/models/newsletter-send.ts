import { model } from "@medusajs/framework/utils"

// Historique des annonces newsletter envoyées depuis l'admin Medusa — aucun
// équivalent Medusa natif. Le rendu HTML et l'envoi réel (Resend) restent sur
// l'app Next.js (destinataires = notification_preferences, D1, jamais
// dupliqués ici) : cette entrée ne sert qu'à afficher l'historique dans
// l'admin, miroir allégé de newsletter_sends dans D1 (pas de bodyHtml/
// bannerImageUrl/ctaLabel/ctaUrl — la source de vérité de ce qui a été
// envoyé reste l'app Next.js).
const NewsletterSend = model
  .define("NewsletterSend", {
    id: model.id({ prefix: "newssend" }).primaryKey(),
    subject: model.text(),
    audience: model.enum(["newsletter", "product_news", "both"]),
    product_ids: model.text().nullable(),
    recipient_count: model.number(),
    sent_by: model.text().nullable(),
  })
  .indexes([{ on: ["audience"] }])

export default NewsletterSend

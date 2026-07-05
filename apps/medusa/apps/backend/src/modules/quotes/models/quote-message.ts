import { model } from "@medusajs/framework/utils"
import QuoteRequest from "./quote-request"

// Fil de discussion d'un devis - miroir de quote_messages dans D1. Un message
// admin peut porter un (re-)prix propose (price), un message client un
// fichier corrige (file_url/file_name).
const QuoteMessage = model
  .define("QuoteMessage", {
    id: model.id({ prefix: "qmsg" }).primaryKey(),
    sender: model.enum(["customer", "admin"]),
    body: model.text(),
    price: model.number().nullable(),
    file_url: model.text().nullable(),
    file_name: model.text().nullable(),
    quote: model.belongsTo(() => QuoteRequest, { mappedBy: "messages" }),
  })
  .indexes([{ on: ["quote_id"] }])

export default QuoteMessage

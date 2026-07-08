import { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { REVIEWS_MODULE } from "../../../modules/reviews"
import ReviewsModuleService from "../../../modules/reviews/service"

// Avis publiés d'un produit (fiche produit storefront) - lecture publique.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const reviewsService: ReviewsModuleService = req.scope.resolve(REVIEWS_MODULE)
  const { product_id } = req.query as { product_id?: string }

  if (!product_id) {
    return res.status(400).json({ message: "product_id is required" })
  }

  const reviews = await reviewsService.listReviews(
    { product_id, status: "published" },
    { order: { created_at: "DESC" } },
  )

  const average =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0

  res.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      author_name: r.author_name,
      rating: r.rating,
      body: r.body,
      created_at: r.created_at,
    })),
    summary: { average, count: reviews.length },
  })
}

type CreateReviewBody = {
  order_id: string
  product_id: string
  rating: number
  body?: string
  author_name: string
}

// Dépôt d'un avis par le client, uniquement sur une commande LIVRÉE lui
// appartenant et contenant bien ce produit - miroir de submitReview() côté
// ancienne app D1. La vérification d'éligibilité interroge directement le
// module Order de Medusa (les commandes n'existent plus que là).
// author_name est fourni par le client (session better-auth, cross-origine)
// plutôt que résolu depuis le Customer Medusa, qui n'a pas forcément de
// prénom/nom renseigné (voir loginToMedusa - crée le Customer avec l'email
// seul).
export async function POST(req: AuthenticatedMedusaRequest<CreateReviewBody>, res: MedusaResponse) {
  const { order_id, product_id, rating, body, author_name } = req.body ?? {}

  if (!order_id || typeof order_id !== "string" || !product_id || typeof product_id !== "string") {
    return res.status(400).json({ message: "order_id and product_id are required" })
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "rating must be an integer between 1 and 5" })
  }
  if (!author_name || typeof author_name !== "string") {
    return res.status(400).json({ message: "author_name is required" })
  }

  const orderService = req.scope.resolve(Modules.ORDER)
  let order
  try {
    order = await orderService.retrieveOrder(order_id, { relations: ["items"] })
  } catch {
    return res.status(404).json({ message: "Order not found" })
  }
  if (order.customer_id !== req.auth_context.actor_id) {
    return res.status(404).json({ message: "Order not found" })
  }
  if (order.fulfillment_status !== "delivered") {
    return res.status(400).json({ message: "Order is not delivered yet" })
  }
  const hasProduct = order.items?.some((i) => i.product_id === product_id)
  if (!hasProduct) {
    return res.status(400).json({ message: "Product is not part of this order" })
  }

  const reviewsService: ReviewsModuleService = req.scope.resolve(REVIEWS_MODULE)
  try {
    const review = await reviewsService.createReviews({
      product_id,
      order_id,
      customer_id: req.auth_context.actor_id,
      author_name,
      rating,
      body: body?.trim().slice(0, 1000) || null,
    })
    res.status(201).json({ review })
  } catch {
    // Contrainte unique (order_id, product_id) : avis déjà déposé pour cette ligne.
    res.status(409).json({ message: "Review already submitted for this order and product" })
  }
}

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { REVIEWS_MODULE } from "../../../modules/reviews"
import ReviewsModuleService from "../../../modules/reviews/service"

// Avis publiés d'un produit (fiche produit storefront) - lecture publique.
// Le dépôt d'un nouvel avis par le client (après livraison) reste une
// tâche séparée, pas encore construite côté storefront.
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

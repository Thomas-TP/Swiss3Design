import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { REVIEWS_MODULE } from "../../../modules/reviews"
import ReviewsModuleService from "../../../modules/reviews/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const reviewsService: ReviewsModuleService = req.scope.resolve(REVIEWS_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  const { status } = req.query as { status?: string }

  const filters: Record<string, unknown> = {}
  if (status) filters.status = status

  const reviews = await reviewsService.listReviews(filters, { order: { created_at: "DESC" } })

  const productIds = [...new Set(reviews.map((r) => r.product_id))]
  const products = productIds.length
    ? await productService.listProducts({ id: productIds }, { select: ["id", "title"] })
    : []
  const titleById = new Map(products.map((p) => [p.id, p.title]))

  res.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      product_title: titleById.get(r.product_id) ?? "Produit supprimé",
      author_name: r.author_name,
      rating: r.rating,
      body: r.body,
      status: r.status,
      created_at: r.created_at,
    })),
  })
}

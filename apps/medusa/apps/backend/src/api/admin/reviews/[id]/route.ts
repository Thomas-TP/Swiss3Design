import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { REVIEWS_MODULE } from "../../../../modules/reviews"
import ReviewsModuleService from "../../../../modules/reviews/service"

type ReviewStatus = "pending" | "published" | "rejected"
const VALID_STATUSES = new Set<string>(["pending", "published", "rejected"])

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const reviewsService: ReviewsModuleService = req.scope.resolve(REVIEWS_MODULE)
  const { id } = req.params
  const { status } = req.body as { status?: string }

  if (!status || !VALID_STATUSES.has(status)) {
    res.status(400).json({ message: "Statut invalide (pending, published ou rejected)." })
    return
  }

  const review = await reviewsService.updateReviews({ id, status: status as ReviewStatus })
  res.json({ review })
}

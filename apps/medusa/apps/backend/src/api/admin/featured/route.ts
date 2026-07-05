import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

// "Produits vedettes" (Sélection du moment, page d'accueil) : pas de nouveau
// module — s'appuie sur Product.metadata.featured / featured_order, déjà
// portés depuis D1 par import-legacy-catalog.ts.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productService = req.scope.resolve(Modules.PRODUCT)

  const products = await productService.listProducts(
    { status: ["published"] },
    { select: ["id", "title", "thumbnail", "metadata"], relations: ["images"], order: { created_at: "DESC" } },
  )

  const items = products
    .map((p) => {
      const metadata = (p.metadata ?? {}) as { featured?: boolean; featured_order?: number }
      return {
        id: p.id,
        title: p.title,
        thumbnail: p.thumbnail ?? p.images?.[0]?.url ?? null,
        featured: Boolean(metadata.featured),
        featured_order: metadata.featured_order ?? 0,
      }
    })
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1
      if (a.featured) return a.featured_order - b.featured_order
      return a.title.localeCompare(b.title)
    })

  res.json({ products: items })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const { orderedIds } = req.body as { orderedIds?: string[] }

  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    res.status(400).json({ message: "orderedIds doit être un tableau d'identifiants." })
    return
  }

  const products = await productService.listProducts(
    { status: ["published"] },
    { select: ["id", "metadata"] },
  )
  const validIds = new Set(products.map((p) => p.id))
  const nextOrder = new Map(orderedIds.filter((id) => validIds.has(id)).map((id, index) => [id, index]))

  // Un seul appel par produit dont l'état change réellement — le catalogue
  // publié est de toute façon petit, pas besoin d'une mise à jour groupée.
  for (const product of products) {
    const metadata = (product.metadata ?? {}) as { featured?: boolean; featured_order?: number }
    const featured = nextOrder.has(product.id)
    const featuredOrder = nextOrder.get(product.id) ?? 0
    if (Boolean(metadata.featured) === featured && (metadata.featured_order ?? 0) === featuredOrder) {
      continue
    }
    await productService.updateProducts(product.id, {
      metadata: { ...metadata, featured, featured_order: featuredOrder },
    })
  }

  res.json({ success: true })
}

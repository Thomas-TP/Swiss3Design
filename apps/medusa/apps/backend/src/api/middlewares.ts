import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import multer from "multer"

const upload = multer({ storage: multer.memoryStorage() })

export default defineMiddlewares({
  routes: [
    // Guest or logged-in customer can submit a quote request, exactly like
    // the current /custom page (better-auth optional, no account required).
    {
      matcher: "/store/quotes",
      method: "POST",
      middlewares: [
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
      ],
    },
    // File upload for a quote request (STL/3MF/OBJ) - same allow-guest rule
    // as the quote submission itself, matches current /api/quote-upload.
    {
      matcher: "/store/quotes/upload",
      method: "POST",
      middlewares: [
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
        upload.single("file"),
      ],
    },
    // Viewing/paying/messaging an existing quote requires a logged-in
    // customer (matches current /account/quotes being an authenticated area).
    {
      matcher: "/store/quotes",
      method: "GET",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/quotes/:id*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/admin/quotes*",
      middlewares: [authenticate("user", ["session", "bearer"])],
    },
    {
      matcher: "/admin/materials*",
      middlewares: [authenticate("user", ["session", "bearer"])],
    },
    {
      matcher: "/admin/featured*",
      middlewares: [authenticate("user", ["session", "bearer"])],
    },
  ],
})

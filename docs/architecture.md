# Architecture

Deep reference for how Swiss3Design is wired. The short operational brief is in
[`AGENTS.md`](../AGENTS.md); coding patterns are in
[`conventions.md`](conventions.md).

## Runtime model

Everything runs as a **single Cloudflare Worker**. Next.js 16 (App Router) is
compiled by `@opennextjs/cloudflare` into a Worker (`.open-next/worker.js`) plus
static assets. There is **no Node.js server** — code runs on the Workers
(Edge-style) runtime with `nodejs_compat`.

Consequences that shape the whole codebase:

- **Bindings are per-request.** `env.DB` / `env.R2` / `env.KV` only exist while
  handling a request. Get them through `getCloudflareContext()` *inside* the
  handler (wrapped by `getDb()` / `getAuth()`), never at import time.
- **Middleware must be Edge.** `src/middleware.ts` stays on the Edge runtime;
  Next 16's `proxy.ts` (Node) is not deployable here.
- **Server Actions can't `redirect()`.** It hangs the response on Workers — return
  state and navigate on the client. See [conventions.md](conventions.md).

```
Browser ──▶ Cloudflare Worker
              ├─ middleware.ts  (i18n routing, security headers, CSP nonce, www→apex)
              ├─ RSC / pages    src/app/[locale]/**
              ├─ route handlers src/app/api/**
              └─ bindings: DB (D1) · R2 (files) · KV (cache/rate-limit) · ASSETS
```

## Data model (D1 / Drizzle)

Source of truth: [`src/db/schema.ts`](../src/db/schema.ts). SQLite dialect.
Conventions: `id` = UUID (`crypto.randomUUID()`), timestamps stored as integer
epoch, **all money as integer `*_cents` (CHF)**, translatable text split into
`*_translations` tables keyed by `(parentId, locale)` with `LOCALES =
["fr","de","it","en"]`.

### Catalogue
- **products** — `slug`, `priceCents`, `saleType` (`stock` | `on_demand`),
  `productionDays`, `material`, `dimensionsMm`, `weightGrams`, `multicolor`,
  `featured` + `featuredOrder` (homepage "Sélection du moment"), `active`,
  `stock` (`null` = untracked, `0` = out of stock).
- **product_translations** — `(productId, locale)` → `name`, `description`.
- **product_images** — R2 `url`, `alt`, `sortOrder`.
- **product_variants** — `sku`, `name`, `priceCents` (`null` → inherits product),
  `stock` (`null` → on-demand).
- **materials** — editable filament palette; products store the chosen name as
  text in `products.material` (shop filters derive from real usage).
- **filament_colors** — `(materialId)` colours: `name` + `hex`.
- **product_colors** — `(productId, colorId)` colours a product offers.
- **categories** / **category_translations** / **product_categories** (M:N).

### Orders
- **orders** — `orderNumber` (unique), `customerId` (nullable; links to Better
  Auth user, also set retroactively for guests), `email`, `status`
  (`pending → paid → in_production → shipped → delivered`, plus `cancelled`),
  `subtotalCents` / `shippingCents` / `discountCents` / `totalCents`,
  `discountCode`, `shippingAddress` (JSON snapshot, **CH only**),
  `stripePaymentIntentId`, `trackingNumber`, `adminNote` (internal), `locale`.
- **order_items** — **snapshots**: `nameSnapshot`, `colorName`/`colorHex`,
  `priceCentsSnapshot`, `quantity`. History never changes when products change.

### Custom quotes
- **quote_requests** — `email`, `description`, `material`/`colors`/`dimensions`,
  `fileUrl`/`fileName` (R2 STL/3MF), `status` (`received → quoted →
  revision_requested → accepted/declined → paid → in_production → done`, plus
  `rejected`), `quotedPriceCents`, `adminMessage`, `validUntil` (+30 days at
  quoting), `adminNote`, `locale`.
- **quote_messages** — threaded customer ↔ workshop conversation; an admin message
  can carry a (re-)quoted `priceCents`, a customer message can attach a corrected
  R2 file.

### Stock & settings
- **inventory_log** — stock movements (`delta`, `reason`: order/restock/adjustment).
- **settings** — key/value store (e.g. `shipping_cents`,
  `free_shipping_over_cents`), edited in `/admin/settings`.
- **discount_codes** — `type` (`percent` | `fixed`), `value`, `minSubtotalCents`,
  `maxUses` / `usedCount`, `active`, `expiresAt`. Codes stored UPPERCASE.

### Auth (Better Auth tables)
`user` (with `role`, `twoFactorEnabled`), `session`, `account` (OAuth/password),
`two_factor` (TOTP secret + backup codes), `verification`, and our own
`customer_addresses` (one saved CH address per user). See [Auth](#auth--accounts).

## Key flows

### Checkout & payment (idempotent)
1. Cart lives client-side in `localStorage` (`src/lib/cart.tsx`, key `s3d-cart-v1`).
2. `POST /api/checkout` validates the cart + CH address server-side, computes
   shipping ([`src/lib/shipping.ts`](../src/lib/shipping.ts)) and any discount
   ([`src/lib/discounts.ts`](../src/lib/discounts.ts)), creates the `orders` row
   (`pending`) and a Stripe **PaymentIntent** (CHF).
3. The client confirms payment with the Stripe **Payment Element**.
4. **Finalization is idempotent and runs twice on purpose** — from the Stripe
   **webhook** (`src/app/api/stripe/webhook/route.ts`) *and* the success page as a
   safety net. `markOrderPaid()` ([`src/lib/orders.ts`](../src/lib/orders.ts)) uses
   a conditional `UPDATE ... WHERE status != 'paid'` to claim the order once, then
   decrements stock atomically (`stock >= qty` guard prevents oversell), logs
   inventory, increments discount usage, and sends confirmation + admin emails.
   Email failures never fail the payment.

### Quote lifecycle
Customer submits `/custom` (file → R2 via `/api/quote-upload`). Admin prices it in
`/admin/quotes` (`status: quoted`, `validUntil` +30d). Customer pays via a
dedicated PaymentIntent (`/api/quote-checkout`); `markQuotePaid()` is idempotent
(webhook + return page), accepting only `quoted`/`accepted` quotes.

### Auth & accounts
- `getAuth()` ([`src/lib/auth.ts`](../src/lib/auth.ts)) builds a per-request
  Better Auth instance (Drizzle adapter on D1).
- **Admin role** is assigned by a `databaseHooks.user.create.before` hook: emails
  in `ADMIN_EMAILS` get `role: "admin"`. `role` has `input: false` — **never**
  client-settable. Server code gates on `requireAdmin()`.
- **Guest → account linking**: on signup, an `after` hook back-fills `customerId`
  on `orders`/`quote_requests` matching the verified email. Safe because an
  unverified account can't sign in. The `/track` page lets guests follow an order
  without an account.
- **Email verification & social providers auto-enable** only when their secrets
  are present (`RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, …). 2FA = TOTP + backup codes.
- **Account deletion** (nLPD right to erasure) purges quotes + R2 files +
  addresses, but **keeps orders** (10-year accounting retention, art. 958f CO) by
  nulling `customerId`.

### Files (R2)
Uploads (`/api/quote-upload`, `/api/admin/upload`) and downloads
(`/api/files/[...path]`, gated `/api/admin/files/[...path]`) go through route
handlers — R2 is never public. `cron/maintenance` purges orphaned files.

### Security
`src/middleware.ts` sets HSTS / X-Content-Type-Options / X-Frame-Options /
Referrer-Policy / Permissions-Policy on every response, builds a strict CSP
(**per-request nonce in prod**, relaxed in dev for HMR), redirects `www → apex`,
and hardens the `NEXT_LOCALE` cookie. CSP violations report to `/api/csp-report`.
Rate limiting ([`src/lib/rate-limit.ts`](../src/lib/rate-limit.ts)) is a fixed
window on KV, per IP + route. See [conventions.md](conventions.md) for the nonce
contract.

### i18n
`next-intl` with locales `fr/de/it/en`, `fr` default/fallback, auto-detected from
`Accept-Language`. Routing config in [`src/i18n/`](../src/i18n); messages in
[`messages/`](../messages). Locale is the first path segment (`/fr`, `/de`, …).

## Deployment

Git-native **Cloudflare Workers Builds**: push `main` → build + D1 migrate +
deploy. No GitHub Actions. See
[`deploiement-cloudflare.md`](deploiement-cloudflare.md).

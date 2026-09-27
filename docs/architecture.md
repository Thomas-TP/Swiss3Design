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

- **Bindings are per-request.** `env.HYPERDRIVE` / `env.R2` / `env.KV` only exist
  while handling a request. Get them through `getCloudflareContext()` _inside_
  the handler (wrapped by `getDb()` / `getAuth()`), never at import time.
- **Middleware must be Edge.** `src/middleware.ts` stays on the Edge runtime;
  Next 16's `proxy.ts` (Node) is not deployable here.
- **Server Actions can't `redirect()`.** It hangs the response on Workers — return
  state and navigate on the client. See [conventions.md](conventions.md).

```
Browser ──▶ Cloudflare Worker
              ├─ middleware.ts  (i18n routing, security headers, CSP nonce, www→apex)
              ├─ RSC / pages    src/app/[locale]/**
              ├─ route handlers src/app/api/**
              └─ bindings: HYPERDRIVE (Postgres) · R2 (files) · KV (cache/rate-limit) · ASSETS
```

## Data model (Postgres / Hyperdrive / Drizzle)

Source of truth: [`src/db/schema.pg.ts`](../src/db/schema.pg.ts) (`schema.ts`
re-exports it — every call site still imports `@/db/schema`). Postgres (pg-core)
dialect via Neon + Cloudflare Hyperdrive. Conventions: `id` = text UUID
(`crypto.randomUUID()`, **not** the native `uuid` column type — real ids
include non-UUID values like hand-picked category slugs and Better Auth's own
ID format), timestamps stored as `timestamptz`, **all money as integer
`*_cents` (CHF)**, translatable text split into `*_translations` tables keyed
by `(parentId, locale)` with `LOCALES = ["fr","de","it","en"]`.

D1/SQLite is kept wired (`schema.d1.ts`, `wrangler.jsonc`'s `DB` binding) as an
inactive rollback safety net from the 2026-07-09 stack pivot — not the source
of truth.

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
  `stripePaymentIntentId`, clés de reprise Checkout, dates de réservation et de
  paiement, montant remboursé, `trackingNumber`, `adminNote` (internal),
  `locale`, `channel` (`web` | `stripe_acs` | `mpp` | `acp` | `ucp` | `x402`,
  migration `0007`) and `agentName` for orders placed by AI agents.
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
- **status_events** — journal append-only des créations et transitions de commandes/devis,
  écrit dans la même transaction que l'état courant (source + acteur éventuel).
- **settings** — key/value store (e.g. `shipping_cents`,
  `free_shipping_over_cents`), edited in `/admin/settings`.
- **discount_codes** — `type` (`percent` | `fixed`), `value`, `minSubtotalCents`,
  `maxUses` / `usedCount`, `active`, `expiresAt`. Codes stored UPPERCASE.

### Auth (Better Auth tables)

`user` (with `role`, `twoFactorEnabled`), `session`, `account` (OAuth/password),
`two_factor` (TOTP secret + backup codes), `passkey` (WebAuthn credentials via
`@better-auth/passkey`), `verification`, and our own `customer_addresses` (one
saved CH address per user) and `notification_preferences` (`newsletter` /
`productNews` opt-ins, one row per user). See [Auth](#auth--accounts).

Agent OAuth server (migration `0006`): `jwks` (RS256 signing key, private half
encrypted with `BETTER_AUTH_SECRET`), `oauth_client`, `oauth_consent`,
`oauth_access_token` / `oauth_refresh_token` (hashed), `oauth_resource`,
`oauth_client_resource`, `oauth_client_assertion`, and our own
`agent_registrations` (auth.md agents: claim token, 6-digit code and attempt
token stored as SHA-256 hashes, `assertion_version` for revocation). See
[Agents](#agents-oauth-21--authmd).

### Reviews & marketing

- **reviews** — `(productId, orderId)`, `authorName`, `rating`, `body`,
  `status` (`pending → published` | `rejected`). Only openable on delivered
  order items (verified-buyer reviews), moderated in `/admin/reviews`.
- **abandoned_carts** — `email`, `token` (unsubscribe link), `itemsJson`
  snapshot, `subtotalCents`, nLPD `consentAt`, `reminderSentAt` /
  `recoveredAt` / `unsubscribedAt`. Populated client-side on opt-in, reminder
  e-mail triggered by the standalone `workers/cron` Worker.
- **newsletter_sends** — one row per admin-composed announcement blast
  (`/admin/emails/announcements`): `subject`/`bodyHtml`, `audience`
  (`newsletter` | `product_news` | `both`), optional featured `productIds` +
  banner/CTA, `recipientCount`, `sentBy`.

## Key flows

### Checkout & payment (idempotent)

1. Cart lives client-side in `localStorage` (`src/lib/cart.tsx`, key `s3d-cart-v1`).
2. `POST /api/checkout` validates the cart + CH address server-side, computes
   shipping ([`src/lib/shipping.ts`](../src/lib/shipping.ts)) and any discount
   ([`src/lib/discounts.ts`](../src/lib/discounts.ts)), then creates the `orders`
   row, its immutable lines and the stock reservation in one transaction. A stable
   attempt key resumes the same Stripe Checkout Session after a retry.
3. The client confirms payment with the Stripe **Payment Element** embedded in that
   Checkout Session.
4. **Finalization is idempotent and runs twice on purpose** — from the Stripe
   **webhook** (`src/app/api/stripe/webhook/route.ts`) _and_ the success page as a
   safety net. `markOrderPaid()` ([`src/lib/orders.ts`](../src/lib/orders.ts)) locks
   the row and only acquires payment while `paidAt` is null. Payment state, status
   history and outbox messages commit together; repeated or out-of-order calls have
   no second stock, discount or e-mail effect. E-mail transport failures remain in
   the persistent outbox for the maintenance job.

### Quote lifecycle

Customer submits `/custom` (file → R2 via `/api/quote-upload`). Admin prices it in
`/admin/quotes` (`status: quoted`, `validUntil` +30d). Customer pays via a
dedicated PaymentIntent (`/api/quote-checkout`); `markQuotePaid()` is idempotent
(webhook + return page), accepting only `quoted`/`accepted` quotes.

### Auth & accounts

- `getAuth()` ([`src/lib/auth.ts`](../src/lib/auth.ts)) builds a per-request
  Better Auth instance (plain `betterAuth()` + the driver-agnostic
  `better-auth/adapters/drizzle` on Postgres/Hyperdrive). Its rate limit uses the
  shared atomic Postgres counter and the Cloudflare-controlled client IP header.
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

### Agents (OAuth 2.1 + auth.md)

Public agent surfaces (MCP `/mcp`, A2A `/a2a`, REST `/api/v1`, WebMCP,
Markdown negotiation, `/.well-known/*` discovery) need no credentials. Reading a
customer's own account goes through the **customer-account MCP server
`/mcp/account`**, an OAuth 2.1 protected resource:

- **Authorization server** = Better Auth `jwt` + `@better-auth/oauth-provider`
  plugins. Issuer = the site origin (`BETTER_AUTH_URL`), so its metadata is at
  `/.well-known/oauth-authorization-server` and `/.well-known/openid-configuration`
  (Next routes calling `auth.api`); endpoints stay under `/api/auth/oauth2/*`.
  Open dynamic client registration (RFC 7591, as MCP expects), PKCE, consent page
  `/[locale]/oauth/consent`, RS256 JWT access tokens bound to a resource
  (RFC 8707). Protected-resource identifiers: `/mcp/account` (canonical), plus the
  origin and the four locale roots as aliases, each with its own RFC 9728 document
  under `/.well-known/oauth-protected-resource/…` (scanners probe `/fr` because
  `/` redirects there).
- **Path A (apps, MCP clients)**: register → authorize (sign-in if needed; the
  login form must not `router.push` when better-auth answers `{ redirect, url }`)
  → consent → code + PKCE → tokens (refresh tokens rotate).
- **Path B (auth.md, [`/auth.md`](../src/lib/agent/auth-md.ts))**:
  `POST /api/auth/agent/identity` (`anonymous` → catalogue-only assertion;
  `service_auth` → 6-digit code) → the customer, signed in, types the code on
  `/[locale]/agent/claim` → the agent polls `/oauth2/token` with the
  `urn:workos:agent-auth:grant-type:claim` grant, then exchanges its identity
  assertion with the RFC 7523 jwt-bearer grant. Both grants are oauth-provider
  extensions: tokens come from the same `issueTokens`, signed by the same keys.
- **Revocation is immediate** although tokens are stateless JWTs: `/mcp/account`
  requires, on every call, the customer's OAuth consent (Path A) or an active
  registration at the token's `ver` (Path B). The customer removes access in
  `/account/agents`; account deletion cascades.
- Protected resources are not declared in the plugin config (it would re-read
  each one at every instance init, through Hyperdrive's cache):
  `ensureProtectedResources()` inserts them with `ON CONFLICT DO NOTHING` once
  per isolate on `/api/auth/oauth2|agent/*` requests. Registration, claim and
  revocation reads use `uncached` (`src/db/fresh.ts`, AGENTS.md rule 6c).
- Cleanup: `lib/maintenance.ts` purges expired auth.md registrations, expired
  tokens and dynamically registered clients never authorized in 90 days.

### Agentic commerce (Stripe Agentic Commerce Suite)

Stripe exposes the catalogue to partner AI agents (ChatGPT & co.), runs the
checkout inside the agent and captures the payment. Our side
([`src/lib/commerce/`](../src/lib/commerce)):

- **Catalogue feed** — `catalog.ts` turns active products into sellable SKUs
  (product × variant × colour). SKU = variant `sku` or product slug, suffixed
  with the colour (`vase-spirale--noir`): variant ids change at every product
  save, these don't. `feed.ts` writes the three Stripe CSV feeds (product,
  inventory, pricing; CHF, JPEG images through `/cdn-cgi/image`, shipping and
  delivery estimate identical to the site's JSON-LD). `stripe-catalog.ts`
  uploads them through the Product Catalog Import API v2: full product feed in
  `replace` mode once a day (maintenance cron) and after each product edit,
  inventory + pricing in `upsert` mode every cron run and after a sale.
  Switched by the `STRIPE_CATALOG_SYNC` var.
- **Hooks** — `POST /api/stripe/agentic-commerce` (signed with
  `STRIPE_ACS_HOOK_SECRET`, answered in < 4 s, no side effect): order approval
  before payment (CHF only, Swiss address only, current price, stock, shipping
  and total identical to the site), shipping options (flat Swiss Post rate, free
  over the threshold) and real-time price/availability per SKU.
- **Fulfillment** — Stripe sends `checkout.session.completed` for a session we
  did not create. The webhook re-reads it with its lines (the SKU is
  `price.external_reference`, preview API version) and `recordPaidAgentOrder()`
  (`agent-orders.ts`) creates the order **already paid**: idempotent on the
  session and PaymentIntent ids, stock taken best-effort (money is already
  captured — a shortfall, a removed SKU or a non-Swiss address become admin
  alerts in `adminNote` and the admin e-mail, never an error), confirmation
  e-mail mentioning the agent.
- Tax: Stripe Tax without any registration (not subject to VAT, art. 10 LTVA)
  → no tax, no Stripe Tax fee; the feed still carries `txcd_99999999`.

### Agentic commerce on our own APIs (MPP, ACP, UCP)

Agents can also buy directly from us, paying with a Stripe **Shared Payment
Token** (SPT, issued to our Stripe profile `STRIPE_PROFILE_ID`, e.g. by the Link
agent wallet). Unlike Stripe ACS, the money is taken only after the stock is
reserved ([`checkout-core.ts`](../src/lib/commerce/checkout-core.ts)): resolve
items (SKU, or slug + variant + colour) → quote (site price, flat Swiss Post
rate, free over the threshold) → Swiss address → `createPendingAgentOrder()`
(pending, stock reserved 30 min, idempotent on an attempt key per token) →
`payOrderWithSpt()` (PaymentIntent confirmed with
`shared_payment_granted_token`, preview API version) → `markOrderPaid()`, the
same finalization as the web checkout. A crashed Worker is covered twice: the
`payment_intent.succeeded` webhook (metadata `orderId`) and the maintenance
reconciliation, which asks Stripe about pending agent orders before releasing
their stock.

- **MPP** — `POST /api/v1/purchases` ([`mpp.ts`](../src/lib/commerce/mpp.ts)):
  HTTP `Payment` auth scheme, method `stripe`, intent `charge`. Without payment:
  `402`, quote and `WWW-Authenticate: Payment` challenge whose id is an
  HMAC-SHA256 of all fields (key derived from `STRIPE_SECRET_KEY`: stateless);
  the challenge's `externalId` is a fingerprint of the order (items, address,
  email, total). With `Authorization: Payment …` carrying the SPT: order,
  `Payment-Receipt`. Discovery: `x-payment-info` on the operation in
  `/openapi.json`.
- **ACP 2026-04-17** — `/api/acp/checkout_sessions` (create, get, update,
  complete, cancel) + `/.well-known/acp.json`; handler `dev.acp.tokenized.card`
  (PSP Stripe); `Idempotency-Key` required on POSTs, responses replayed from KV
  for 24 h.
- **UCP 2026-08-25** — `/api/ucp/checkout-sessions` (PUT to update) +
  `/.well-known/ucp` (service `dev.ucp.shopping` REST, checkout + fulfillment,
  keys = the Web Bot Auth Ed25519 key); payment handler
  `ch.swiss3design.stripe_spt`, specified at `/agents/ucp-stripe-spt.md`.
- Sessions ACP/UCP live in `agent_checkout_sessions` (migration `0008`),
  recomputed at each call, purged 7 days after expiry. Discovery documents are
  served only when `STRIPE_PROFILE_ID` is set.

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

Git-native **Cloudflare Workers Builds**: push `main` → build + deploy. No
GitHub Actions. **Postgres schema migrations are a separate manual step**
(`bun run db:generate:pg` + `db:push:pg`) — not part of this pipeline, unlike
the old D1 setup. See [`deploiement-cloudflare.md`](deploiement-cloudflare.md).

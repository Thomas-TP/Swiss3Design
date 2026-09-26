# Conventions & patterns

Concrete coding rules for Swiss3Design, with examples from the real codebase.
Architecture is in [`architecture.md`](architecture.md); the must-read summary is
in [`AGENTS.md`](../AGENTS.md).

## Server Actions — never `redirect()`

`redirect()` inside a `"use server"` action **freezes the UI on Cloudflare
Workers**. Return a serializable state object and navigate on the client.

```ts
// src/app/[locale]/admin/settings/actions.ts
"use server";
export async function saveSettings(
  _prev: State,
  formData: FormData,
): Promise<State> {
  await requireAdmin();
  if (!valid) return { error: "Valeurs invalides." };
  // …write…
  revalidatePath("/", "layout");
  return { saved: true }; // ← no redirect()
}
```

```tsx
// client component
const [state, action] = useActionState(saveSettings, {});
const router = useRouter();
useEffect(() => {
  if (state.saved) router.push("/admin");
}, [state.saved]);
```

Actions return `{ saved }` / `{ success }` / `{ error }`; the client reacts and
calls `router.push()` / `router.refresh()`. Mutations call `revalidatePath()` to
refresh RSC data.

## Data access

Always per-request, inside the handler:

```ts
import { getDb } from "@/db";
const db = await getDb(); // Drizzle on env.HYPERDRIVE (Postgres/Neon)
```

- Schema source of truth: [`src/db/schema.pg.ts`](../src/db/schema.pg.ts)
  (`schema.ts` re-exports it — call sites keep importing `@/db/schema`). After
  editing it, run `bun run db:generate:pg`, then apply it to the real Neon
  database with `bun run db:push:pg` **before** deploying code that depends on
  the change — unlike the old D1 setup, **Postgres migrations are not applied
  automatically on deploy.**
- **Never hand-edit a file in `drizzle-pg/`** and never edit an already-applied
  migration.
- D1/SQLite (`schema.d1.ts`, `drizzle/`) is kept as an inactive rollback safety
  net from the 2026-07-09 stack pivot — don't add new work there.
- Drizzle query helpers (`and`, `eq`, `sql`, `inArray`, …) come from `drizzle-orm`.
- Upserts use `.onConflictDoUpdate({ target, set })`.

## Money

Integer **centimes CHF** everywhere — columns are `*_cents`, variables end in
`Cents`. Parse user input to cents, never store floats:

```ts
const cents = Math.round(parseFloat(raw.replace(",", ".")) * 100);
```

Format for display with the helpers in [`src/lib/format.ts`](../src/lib/format.ts)
(CHF formatting, locale-aware) — don't hand-roll `toFixed`.

## Snapshots — never "fix" history

`order_items` and paid quotes freeze `nameSnapshot`, `priceCentsSnapshot`,
`colorName`/`colorHex` at purchase time. Rendering order history must read the
snapshot, **not** join the live product (prices/names change). Same for the
`shippingAddress` JSON snapshot on `orders`.

## Idempotent payment finalization

`markOrderPaid()` / `markQuotePaid()` ([`src/lib/orders.ts`](../src/lib/orders.ts))
run from **both** the Stripe webhook and the success/return page. Keep them
idempotent:

```ts
const claimed = await db
  .update(orders)
  .set({ status: "paid" })
  .where(and(eq(orders.id, id), ne(orders.status, "paid"))) // claim once
  .returning({ id: orders.id });
if (claimed.length === 0) return; // already done
```

Stock decrement is atomic with a `gte(stock, qty)` guard to prevent oversell on
concurrent orders. Side effects that can fail (emails) are wrapped in try/catch so
they never fail a captured payment.

## Auth & authorization

```ts
import { requireAdmin, getServerSession } from "@/lib/session";
await requireAdmin(); // throws "unauthorized" if not admin
const session = await getServerSession(); // or null
```

- Admin = email listed in `ADMIN_EMAILS` (assigned at signup via Better Auth db
  hook; `role` is `input: false`, never trust client input for it).
- Gate every admin Server Action / route with `requireAdmin()` — there is no
  separate admin gateway; authorization is in code.

## Files (R2)

R2 is private. Upload/serve only through route handlers in `src/app/api/**`
(`quote-upload`, `admin/upload`, `files/[...path]`, `admin/files/[...path]`).
Store the R2 key in the DB (`fileUrl`), never a public URL.

## Rate limiting

Protect abusable endpoints (email send, uploads):

```ts
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
if (!(await rateLimit(request, "quote-upload", { limit: 5, windowS: 60 })))
  return tooManyRequests(); // 429
```

KV-backed fixed window, per IP + route; a no-op locally (no `cf-connecting-ip`).

## i18n

- All UI strings live in `messages/{fr,de,it,en}.json`; read with `next-intl`
  (`useTranslations` / `getTranslations`). **Never hardcode** user-facing text;
  add the key to **all four** files (fr is the fallback).
- Navigate with the locale-aware helpers from
  [`src/i18n/navigation.ts`](../src/i18n/navigation.ts) (`Link`, `redirect`,
  `useRouter`), not bare `next/link` / `next/navigation`, so the `/fr` `/de` …
  prefix is preserved.
- DB content is localized via `*_translations` tables, not message files.

## SEO & GEO (every public page)

Derived from the Ahrefs Site Audit of September 2026 (health score 85, every
error and warning traced to one of the rules below). Break one and it errors
on _every_ page at once.

- **Indexable page** → `generateMetadata` returns
  `pageMetadata({ locale, path, title, description })` from
  [`src/lib/seo.ts`](../src/lib/seo.ts). It sets title, description, canonical,
  hreflang (4 locales + `x-default` → the **French** URL, never `/` which
  307-redirects) and a **complete** Open Graph set (`og:url`, image, locale…).
  Next merges metadata **shallowly**: a page that sets only `openGraph.title`
  silently loses the layout's `og:image`. Titles/descriptions come from the
  `seo.*` keys of `messages/*.json`: full title ≤ 60 chars (the layout template
  appends ` · Swiss3Design`), description 110–160 chars.
- **Private / transactional page** (account, admin, cart, checkout, track,
  favorites) → `robots: NOINDEX` (layout or page) **and** a `Disallow` in
  `app/robots.ts`.
- **hreflang comes only from `alternatesFor()`**. next-intl's HTTP `Link`
  header is disabled (`alternateLinks: false` in `i18n/routing.ts`); turning it
  back on duplicates every hreflang and points `x-default` at an unprefixed
  (redirecting) URL.
- **Structured data** → `<JsonLd data={…} />`
  ([`components/json-ld.tsx`](../src/components/json-ld.tsx), reads the CSP
  nonce itself). Reference the company/site by `@id` instead of redeclaring
  them. `OnlineStore` is an Organization, **not** a LocalBusiness:
  `currenciesAccepted`, `priceRange`, `openingHours` are invalid on it.
- **New page** → add it to `STATIC_PAGES` in `app/sitemap.xml/route.ts` (every
  locale gets its own `<loc>`) and, if useful to AI assistants, to
  `app/llms.txt/route.ts`.
- **Shop facets** (`sort`, `material`, `color`, `q`) are closed to crawlers in
  `robots.ts` and canonicalised to `/shop`; don't add a new filter parameter
  without adding its `Disallow`.
- **Product availability** in JSON-LD is `InStock` / `OutOfStock` only:
  `MadeToOrder` is valid schema.org but rejected by Google merchant listings —
  printed-to-order pieces are `InStock` with a longer `handlingTime`.
- **IndexNow**: any admin action that creates, renames, deletes, publishes or
  sells out a product calls `notifyIndexNow()`
  ([`src/lib/indexnow.ts`](../src/lib/indexnow.ts), Bing/Yandex/Seznam…). The
  key file `public/867cd9af686842c88e46c3f656218246.txt` must stay deployed.

## Analytics (PostHog, EU, cookieless)

- **Track with `track(event, props)`** from [`src/lib/analytics.ts`](../src/lib/analytics.ts)
  in client code. From a Server Component, render
  [`<TrackEvent>`](../src/components/track-event.tsx); pass `onceKey` for
  anything that must not double-count on reload (e.g. `Order Completed`).
- **Event names follow PostHog's e-commerce spec**: `Product Viewed`,
  `Product Added`, `Product Removed`, `Cart Viewed`, `Checkout Started`,
  `Checkout Step Viewed`, `Payment Info Entered`, `Order Completed`, and so on.
  Build product props with `productProperties()` / `cartProperties()`. Amounts
  are **CHF decimals** via `chf()`; never send cents.
  `Order Completed.revenue` is the amount actually paid, shipping included (the
  Stripe figure), and PostHog revenue analytics reads that exact property.
  Renaming it breaks the project config.
- **Never send personal data.** No email, name, address or payment message goes
  into a property. URLs are reduced to an allowlist of query params
  (`KEPT_PARAMS`: utm, click IDs, shop search and filters), and email-looking
  strings are masked, both in `sanitizeEvent`. A new query param that is useful
  in analytics must be added to that allowlist. Admin paths are never sent.
- **Bundle rule:** `posthog-js` is imported **only** by
  `src/instrumentation-client.ts`, lazily on idle. `lib/analytics.ts` holds
  types and a queue only. Importing `posthog-js` anywhere else puts it into the
  server Worker bundle, because client components are rendered server-side too.
- **Relay:** the browser only calls `/api/relay/*` on our own domain, which the
  middleware relays to `eu.i.posthog.com` (a static `/static/*` script goes to
  `eu-assets`). Only allowlisted headers are forwarded, so the session cookie
  never leaves. The visitor IP goes as `x-forwarded-for` for the cookieless
  hash; the project discards it.
- **Location** comes from Cloudflare (`cf` → `data-geo-*` on `<html>`, set in
  the `[locale]` layout). In cookieless mode PostHog drops the IP before its
  own GeoIP runs.
- **Cookieless by default, cookies only after consent.** posthog-js runs with
  `cookieless_mode: "on_reject"` and `opt_out_capturing_by_default: true`: an
  undecided visitor counts as a refusal, so they are measured without any
  cookie or storage. "Accepter" in
  [`<ConsentBanner>`](../src/components/consent-banner.tsx) calls
  `setConsent(true)` → `opt_in_capturing()`: cookies, session replay and
  surveys start for that visitor only. The PostHog project must keep
  "Cookieless server hash mode" on, otherwise every cookieless event is
  discarded.
- **Personal data on screen** (an email, an address) gets the `ph-mask`
  class, so it is masked in replays; inputs are always masked. `/account` and
  `/track` are excluded from recording in the project settings.
- **Full opt-out** (privacy page) and the team's own browser are dropped in
  `before_send`, not with `opt_out_capturing()`: under `on_reject` that call
  only switches back to cookieless measurement.

## CSP nonce contract (prod only)

In production every inline `<script>` must carry the per-request nonce or it's
blocked. The middleware injects it as the `x-nonce` request header; read it in a
Server Component:

```tsx
import { headers } from "next/headers";
const nonce = (await headers()).get("x-nonce") ?? undefined;
// pass nonce={nonce} to NextIntlClientProvider / any inline <script>
```

`bun run dev` relaxes CSP (HMR needs inline+eval), so a missing nonce is invisible
in dev. **Always verify CSP-affecting changes with `bun run preview`** (real
Workers runtime + prod CSP).

## Environment & secrets

- **Secrets** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BETTER_AUTH_SECRET`,
  `RESEND_API_KEY`, `GOOGLE_*`, `CRON_SECRET`, `ADMIN_EMAILS`, …): local in
  `.dev.vars` (gitignored), prod via `wrangler secret put` / dashboard.
  **Never commit them.** `ADMIN_EMAILS` in particular is a secret (not a
  `vars` entry) specifically because the repo is public — moved 2026-07-10.
- **Public** keys only in committed `.env.development` (Stripe **test**) and
  `.env.production` (Stripe **live**) — just `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
  inlined at build.
- **Non-secret vars** (`BETTER_AUTH_URL`, `EMAIL_FROM`) live in
  `wrangler.jsonc`. After editing bindings/vars there, run `bun run cf-typegen`.

## Swiss specifics

- **Shipping CH only** — validate the address country server-side; NPA = 4 digits.
- Single national shipping tariff + free over a threshold, both in `settings`.
- Email replies land on the Infomaniak alias `contact@swiss3design.ch`; outgoing
  mail is sent from `EMAIL_FROM` via Resend.

## Style

- **Comments and user-facing copy in French**; code identifiers in English.
- Keep the existing dense, explanatory comment style: explain the _why_ (the Workers
  constraint, the idempotency reason, the nLPD rule), not the obvious _what_.
- TypeScript **6** strict (7 was attempted and reverted 2026-07-09 — its
  package no longer exports the classic compiler API, which breaks `next
build` itself, not just tooling; revisit once 7.1 ships a JS API again).
  Prefer the `@/…` import alias over deep relative paths.
- Lint + format = **Oxlint** (`.oxlintrc.json`) + **Oxfmt** (`.oxfmtrc.json`),
  replacing Biome 2026-09-09 (ESLint had already been fully removed
  2026-07-09; see AGENTS.md for why). Run `bun run lint` before finishing;
  `bun run format` to auto-fix style. Suppress a rule with
  `// oxlint-disable`/`oxlint-enable <bare-rule-name> -- reason` bracketing
  the block — bare rule name, no plugin prefix.

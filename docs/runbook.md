# Runbook — operations & troubleshooting

Operational reference for the **live** store (swiss3design.ch). Architecture is in
[`architecture.md`](architecture.md); deploy connection details in
[`deploiement-cloudflare.md`](deploiement-cloudflare.md).

## Deploy

- **Trigger:** a merge into `main` (through a PR: `main` is protected). **Cloudflare Workers
  Builds** runs `opennextjs-cloudflare build`, then `wrangler deploy` (which also
  deploys the Worker; Postgres migrations remain a separate operation). GitHub
  Actions Quality checks the code and isolated Postgres tests; it does not deploy.
- **Postgres (the live database) has no deploy-time migration step at all** —
  `bun run db:generate:pg` + `db:push:pg` are manual, run _before_ deploying code
  that needs the new schema. See "Postgres schema changes" below.
- **Status:** the "Cloudflare Workers Builds" check on the commit. Green = build
  **and** deploy succeeded. Red = nothing shipped, the previous version stays live.
- **Logs:** Cloudflare dash → Worker `swiss3design` → Deployments / Builds.
  Runtime logs: Observability is enabled (`wrangler.jsonc`) → Worker → Logs.
- **Manual fallback:** `bun run deploy` from a machine with Cloudflare creds.

## Rollback

Cloudflare dash → `swiss3design` → **Deployments** → pick a previous deployment →
**Rollback**. Instant; no rebuild. Before rolling back checkout changes, read the reservation
warning in [the remediation notes](audit-remediation-2026-09.md). Old code must not
reapply a stock decrement to orders already reserved by the new version.

## Failed build / deploy

Open the failed check → **Details** → **Rerun** (or dash → Builds → Retry). Common
causes:

| Symptom                                                                    | Cause                                                                                                                                                                                                                                                    | Fix                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build fails bundling                                                       | Turbopack used for prod build                                                                                                                                                                                                                            | Build must be `opennextjs-cloudflare build`; no `--turbopack`                                                                                                                                                                                                                                               |
| "Node.js middleware is not supported"                                      | `proxy.ts` (Node runtime)                                                                                                                                                                                                                                | Keep `src/middleware.ts` (Edge); never rename to `proxy.ts`                                                                                                                                                                                                                                                 |
| Type / lint errors                                                         | strict TS                                                                                                                                                                                                                                                | `bun run lint` + fix; reproduce build with `bun run preview`                                                                                                                                                                                                                                                |
| Deploy stops after migrations                                              | a **D1** (inactive rollback DB) migration failed                                                                                                                                                                                                         | Harmless for the live site — see below                                                                                                                                                                                                                                                                      |
| Page 500s right after a deploy that touched `schema.pg.ts`                 | forgot to `db:push:pg` before deploying, or a query that worked on SQLite/D1 is invalid Postgres (e.g. `SELECT DISTINCT` + `ORDER BY` on a column outside the select list, `42P10`)                                                                      | Check `wrangler tail` for the real Postgres error (Drizzle hides it behind "Failed query")                                                                                                                                                                                                                  |
| Build fails at `next build` with `"no local hyperdrive connection string"` | `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` missing from the Workers Builds environment — `next build` executes page code at build time and needs a working DB connection, but this variable only lives in local `.env*` files by default | Add it as a **Build variable** (Worker → Settings → **Build** tab → "Build variables and secrets" — not the "Variables & Secrets" tab, that's runtime-only) — dashboard-only, no `wrangler.jsonc`/CLI/API path. Different value per Worker (prod vs. preview branch). See `docs/deploiement-cloudflare.md`. |

## Postgres schema changes (the live database)

There is **no deploy-time safety net** here, unlike the old D1 setup — get the
order right yourself:

1. Edit `src/db/schema.pg.ts`.
2. `bun run db:generate:pg` — writes SQL into `drizzle-pg/`.
3. `bun run db:push:pg` (or run the generated SQL against Neon by hand) —
   applies it to the real database. Do this **before** deploying code that
   depends on the new columns/tables.
4. Deploy as usual.

Never edit an already-applied migration in `drizzle-pg/`; add a new one.

## Failed D1 migration (legacy, inactive rollback DB)

D1 is kept wired (`wrangler.jsonc`'s `DB` binding) as a rollback safety net
from the 2026-07-09 Postgres/Hyperdrive pivot — it is **not** the live
database and normally receives no new migrations. If `wrangler deploy` ever
reports a failed D1 migration, it's almost certainly stale/irrelevant to the
live site (which runs on Postgres); confirm the live site is unaffected before
spending time on it. To recover if it genuinely needs fixing:

1. Inspect the migration in `drizzle/` and the build logs.
2. Apply manually once fixed: `bun run db:migrate:remote`.

## Database operations

```bash
# Postgres (the live database)
bun run db:generate:pg       # after editing src/db/schema.pg.ts
bun run db:push:pg           # apply to the real Neon database

# D1 (legacy, inactive rollback DB — rarely needed)
bun run db:migrate:local     # apply to local D1
bun run db:migrate:remote    # apply to the inactive D1 rollback DB
bun run db:seed:local        # seed local D1 from scripts/seed.sql

# Inspect prod Postgres data: write a throwaway .mjs script using the `postgres`
# package + DATABASE_URL from .dev.vars (see scripts/ for the pattern), run it
# with `node`, delete it after — don't leave ad hoc DB scripts lying around.
```

## Secrets & env

- **Prod secrets:** Cloudflare dash → Worker → Settings → Variables, or
  `npx wrangler secret put <NAME>`. Rotating one takes effect on next request — no
  redeploy needed.
- **Which secrets exist:** see [`.dev.vars.example`](../.dev.vars.example)
  (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ACS_HOOK_SECRET`,
  `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `GOOGLE_*`, optional
  `APPLE_*`/`FACEBOOK_*`, `CRON_SECRET`, `ADMIN_EMAILS`,
  `WEB_BOT_AUTH_PRIVATE_KEY`). `ADMIN_EMAILS` is a secret rather
  than a `vars` entry specifically because the repo is public (moved 2026-07-10).
- **`WEB_BOT_AUTH_PRIVATE_KEY`** (Ed25519 private JWK, one distinct key per
  Worker, set 2026-09-27): signs the site's own bot requests (IndexNow) and the
  `/.well-known/http-message-signatures-directory` response. Rotation = new key
  with `--env preview` / `--name swiss3design`, no user impact; if the key was
  registered with Cloudflare's Bot Submission Form, register the new one too.
- **`STRIPE_ACS_HOOK_SECRET`** (`whsec_…`, one per Stripe mode: live on
  `swiss3design`, test on `swiss3design-preview`): signing secret of the
  « Agentic Commerce Extension » event destination (Stripe dashboard →
  Developers → Webhooks). Without it `/api/stripe/agentic-commerce` answers 503
  and Stripe declines agent checkouts that require the order-approval hook.
- **Non-secret vars** (`BETTER_AUTH_URL`, `EMAIL_FROM`, `STRIPE_CATALOG_SYNC`)
  live in `wrangler.jsonc`; after editing run `bun run cf-typegen`.
- **Local dev:** copy `.dev.vars.example` → `.dev.vars` (gitignored) and fill in
  **test** values.

## Stripe

- **Mode:** LIVE in prod (`pk_live_…` in `.env.production`), TEST in dev
  (`pk_test_…` in `.env.development` + test secret in `.dev.vars`).
- **Webhook:** signed with `STRIPE_WEBHOOK_SECRET`; handler at
  `src/app/api/stripe/webhook/route.ts`. If payments succeed but orders don't flip
  to `paid`, check the webhook endpoint + secret in the Stripe dashboard (the
  success page is only a fallback).
- **Refund:** issue from the Stripe dashboard (Payments → the PaymentIntent on the
  order's `stripePaymentIntentId`). The app has no refund UI.
- **TWINT:** available via Stripe — enable in the Stripe dashboard (payment
  methods); no code change needed.
- **A local Stripe TEST payment** (`bun run dev`, up to `/checkout/success`)
  needs three things, none of them in the repo by default:
  1. In `.dev.vars`, **`STRIPE_PAYMENT_METHOD_CONFIGURATION=""`** (blank).
     `wrangler.jsonc` carries the **production** `pmc_…` at its top level, and a
     test-mode key cannot use a live-mode payment method configuration, so
     the Payment Element would not get its payment methods. Blank = Stripe uses
     the test account's defaults. (`env.preview` already blanks it.)
  2. In `.dev.vars`, **`BETTER_AUTH_URL`** pointing at the port you run on
     (`http://localhost:3000`, or the `-p` you passed): the top-level
     production value (`https://swiss3design.ch`) makes Better Auth log
     `Invalid origin` and answer 403 to the login/forgot/register forms
     (seen on `localhost:3111`), and return URLs would leave localhost.
  3. A **valid `pk_test_…`** in `.env.development`
     (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`), **from the same Stripe account as
     the test `STRIPE_SECRET_KEY`** in `.dev.vars`: an expired key, or one from
     another account than the secret key, leaves `/checkout` without a working
     card field. Use Stripe's published test card (`4242 4242 4242 4242`, any
     future date, any CVC).
     The Stripe.js warning « live integrations must use HTTPS » on `http://localhost`
     is expected. Never put a `pk_live_…` / `sk_live_…` in these files.

### Agentic commerce (sales through AI agents)

- **Settings:** Stripe dashboard → Settings → Agentic commerce (Stripe profile,
  policy URLs, Stripe Tax without registration, integration endpoint
  `https://swiss3design.ch/api/stripe/agentic-commerce` with order approvals +
  custom shipping options + price/availability, agents enabled one by one).
- **Catalogue:** dashboard → Agentic commerce → Feed history shows every import
  (errors downloadable for 5 min). The maintenance report returns
  `stripeCatalog` (`full` / `stock` / `error` + reason). Force a full feed by
  saving any product in the admin.
- **Agent order paid but missing:** the webhook endpoint must receive
  `checkout.session.completed`; logs `[stripe webhook] rapprochement requis`
  give the reason. Replaying the event from the dashboard is safe (idempotent
  on the session id). Orders show an « Agent IA » badge in the admin; anomalies
  (stock shortfall, non-Swiss address, unknown SKU) are in the internal note
  and the admin e-mail — refund from the Stripe dashboard if needed.
- **Pause selling:** disable the agent in the dashboard (Agentic commerce →
  Agents), or set `STRIPE_CATALOG_SYNC` to `off` and upload an empty catalogue.
- **Our own agent APIs (MPP, ACP, UCP):** need the public var
  `STRIPE_PROFILE_ID` (Stripe profile network ID: `profile_…` live,
  `profile_test_…` preview); without it the discovery documents answer 404.
  Test MPP end to end with the reference client, which mints a test SPT with
  the Stripe **test** key read from `MPPX_STRIPE_SECRET_KEY`:
  `npx mppx@0.11 validate <base-url> --endpoint POST:/api/v1/purchases --body '<order JSON>'`
  (challenge + error checks pass without a key; the payment step needs a real
  `sk_test_…` key — the one in `.dev.vars.example` is a placeholder). On
  Windows, call `node` on the cached `mppx/dist/bin.js` rather than `npx`, or
  the JSON body loses its quotes. The Link CLI works too:
  `npx @stripe/link-cli mpp pay <url> -X POST -d '{…}' --test`.
  A pending agent order is reconciled by the maintenance job with Stripe
  (PaymentIntent found by `metadata.orderId`) before its stock is released.

## Files (R2) & maintenance

- R2 (`swiss3design-files`) is private; files are served via route handlers, never
  public URLs. Quote files are deleted on account deletion (nLPD).
- **Maintenance route** `POST /api/cron/maintenance` (bearer `CRON_SECRET`):
  purges orphan R2 files + quote retention, **sends abandoned-cart reminders and
  purges old carts**. Triggered by the admin Settings button, a manual bearer
  call, or — in prod — the **dedicated Worker Cron** (`workers/cron`, hourly).
  `CRON_SECRET` must be set on **both** workers (`swiss3design` and
  `swiss3design-cron`). Deploy the cron worker once:
  `cd workers/cron && bunx wrangler deploy && bunx wrangler secret put CRON_SECRET`.

## Local dev setup

```bash
bun install
cp .dev.vars.example .dev.vars   # then fill in TEST secrets + DATABASE_URL (Postgres)
# Also set CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE to the same
# Postgres URL in .env.development.local (dev) — see AGENTS.md "Local Hyperdrive
# emulation" for why the right file differs between `bun run dev`/`preview`/`deploy`.
bun run db:push:pg               # apply schema.pg.ts to that Postgres database
bun run dev                      # http://localhost:3000 (Hyperdrive/R2/KV via OpenNext)
```

To exercise prod-only behaviour (CSP nonce, Workers runtime): `bun run preview`.

## Monitoring

- Cloudflare **Observability** (logs/metrics) enabled on the Worker.
- **Web Analytics** (cookieless): CSP already allows the beacon — enable it in the
  Cloudflare dashboard to start collecting.
- CSP violations are POSTed to `/api/csp-report`.

## Incident quick reference

| Situation                                 | First move                                     |
| ----------------------------------------- | ---------------------------------------------- |
| Site down after a deploy                  | Dashboard → Deployments → **Rollback**         |
| Build red on a commit                     | Open check → Details → read logs → Rerun       |
| Payments captured, orders stuck `pending` | Check Stripe webhook + `STRIPE_WEBHOOK_SECRET` |
| Inline script blocked in prod only        | Missing CSP nonce — `bun run preview` to repro |
| Suspected secret leak                     | Rotate via `wrangler secret put` (instant)     |

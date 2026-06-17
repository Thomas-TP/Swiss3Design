# Runbook — operations & troubleshooting

Operational reference for the **live** store (swiss3design.ch). Architecture is in
[`architecture.md`](architecture.md); deploy connection details in
[`deploiement-cloudflare.md`](deploiement-cloudflare.md).

## Deploy

- **Trigger:** `git push` to `main` (or `scripts/push.bat`). **Cloudflare Workers
  Builds** runs `opennextjs-cloudflare build`, then the deploy command applies D1
  migrations and `wrangler deploy`. No GitHub Actions.
- **Status:** the "Cloudflare Workers Builds" check on the commit. Green = build
  **and** deploy succeeded. Red = nothing shipped, the previous version stays live.
- **Logs:** Cloudflare dash → Worker `swiss3design` → Deployments / Builds.
  Runtime logs: Observability is enabled (`wrangler.jsonc`) → Worker → Logs.
- **Manual fallback:** `npm run deploy` from a machine with Cloudflare creds.

## Rollback

Cloudflare dash → `swiss3design` → **Deployments** → pick a previous deployment →
**Rollback**. Instant; no rebuild. Use when a deploy is bad but the build was green.

## Failed build / deploy

Open the failed check → **Details** → **Rerun** (or dash → Builds → Retry). Common
causes:

| Symptom | Cause | Fix |
| --- | --- | --- |
| Build fails bundling | Turbopack used for prod build | Build must be `opennextjs-cloudflare build`; no `--turbopack` |
| "Node.js middleware is not supported" | `proxy.ts` (Node runtime) | Keep `src/middleware.ts` (Edge); never rename to `proxy.ts` |
| Type / lint errors | strict TS | `npm run lint` + fix; reproduce build with `npm run preview` |
| Deploy stops after migrations | a D1 migration failed (the `&&` guard) | See below — old code stays live on the old schema (safe) |

## Failed D1 migration

The deploy command is `wrangler d1 migrations apply … --remote && wrangler deploy`,
so a failed migration **blocks the deploy** — the old code keeps running on the old
schema (consistent, never a half-deploy). To recover:

1. Inspect the migration in `drizzle/` and the build logs.
2. Apply manually once fixed: `npm run db:migrate:remote`.
3. If it's an auth-token issue specifically, temporarily drop the migration step
   from the deploy command and migrate locally before pushing (see
   [`deploiement-cloudflare.md`](deploiement-cloudflare.md) "Filet de sécurité").

Never edit an already-applied migration; add a new one.

## Database operations

```bash
npm run db:generate          # after editing src/db/schema.ts
npm run db:migrate:local     # apply to local D1
npm run db:migrate:remote    # apply to PROD D1 (normally automatic on deploy)
npm run db:seed:local        # seed local D1 from scripts/seed.sql

# Inspect prod data (read-only example)
npx wrangler d1 execute swiss3design-db --remote --command "SELECT count(*) FROM orders"
```

## Secrets & env

- **Prod secrets:** Cloudflare dash → Worker → Settings → Variables, or
  `npx wrangler secret put <NAME>`. Rotating one takes effect on next request — no
  redeploy needed.
- **Which secrets exist:** see [`.dev.vars.example`](../.dev.vars.example)
  (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BETTER_AUTH_SECRET`,
  `RESEND_API_KEY`, `GOOGLE_*`, optional `APPLE_*`/`FACEBOOK_*`, `CRON_SECRET`).
- **Non-secret vars** (`BETTER_AUTH_URL`, `ADMIN_EMAILS`, `EMAIL_FROM`) live in
  `wrangler.jsonc`; after editing run `npm run cf-typegen`.
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

## Files (R2) & maintenance

- R2 (`swiss3design-files`) is private; files are served via route handlers, never
  public URLs. Quote files are deleted on account deletion (nLPD).
- Orphan purge: scheduled route `GET /api/cron/maintenance` protected by
  `CRON_SECRET`. Trigger manually with that bearer token if needed.

## Local dev setup

```bash
npm ci
cp .dev.vars.example .dev.vars   # then fill in TEST secrets
npm run db:migrate:local
npm run db:seed:local
npm run dev                      # http://localhost:3000 (D1/R2/KV via OpenNext)
```

To exercise prod-only behaviour (CSP nonce, Workers runtime): `npm run preview`.

## Monitoring

- Cloudflare **Observability** (logs/metrics) enabled on the Worker.
- **Web Analytics** (cookieless): CSP already allows the beacon — enable it in the
  Cloudflare dashboard to start collecting.
- CSP violations are POSTed to `/api/csp-report`.

## Incident quick reference

| Situation | First move |
| --- | --- |
| Site down after a deploy | Dashboard → Deployments → **Rollback** |
| Build red on a commit | Open check → Details → read logs → Rerun |
| Payments captured, orders stuck `pending` | Check Stripe webhook + `STRIPE_WEBHOOK_SECRET` |
| Inline script blocked in prod only | Missing CSP nonce — `npm run preview` to repro |
| Suspected secret leak | Rotate via `wrangler secret put` (instant) |

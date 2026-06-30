<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Swiss3Design — Agent guide

> Operational brief for AI coding agents. Keep it short and high-signal.
> **Need to locate code? Read [`docs/codemap.md`](docs/codemap.md) first** — it maps
> "I need to do X" → exact file(s), so you find things in one read instead of grepping.
> Deep references: [`docs/architecture.md`](docs/architecture.md) ·
> [`docs/conventions.md`](docs/conventions.md) ·
> [`docs/playbook.md`](docs/playbook.md) ·
> [`docs/runbook.md`](docs/runbook.md) ·
> [`docs/deploiement-cloudflare.md`](docs/deploiement-cloudflare.md).
> Human-facing overview lives in [`README.md`](README.md).

## What this is

Swiss e-commerce store for **multicolour 3D prints**, **LIVE in production** at
**swiss3design.ch**. Solo project; the AI writes essentially all the code.
B2C, **shipping to Switzerland only**, prices in **CHF**, UI in **fr/de/it/en**.
Runs entirely on **Cloudflare Workers** (Next.js 16 via OpenNext) with **D1**
(SQLite), **R2** (files), **KV** (cache/rate-limit). Payments via **Stripe in
LIVE mode** — treat checkout/webhook code as production-critical.

## Golden rules (these break production — read first)

1. **Never `redirect()` from a Server Action.** On Cloudflare Workers it freezes
   the UI. Return a plain state object (`{ success }` / `{ error }`) and navigate
   client-side with `router.push()`. See any `**/actions.ts`.
2. **Keep `src/middleware.ts` (Edge). Never rename it to `proxy.ts`.** Next 16's
   new `proxy.ts` forces the Node runtime, which OpenNext-Cloudflare can't deploy
   → the build fails. The file deliberately stays `middleware.ts` (Edge).
3. **Don't use Turbopack for the production build.** Turbopack output chunks break
   OpenNext bundling. The deploy path is `opennextjs-cloudflare build`; don't add
   `--turbopack` to it or to `next build`.
4. **CSP nonce is production-only.** Every inline `<script>` must get the
   per-request nonce via the `x-nonce` request header
   (`(await headers()).get("x-nonce")`), or it's blocked **in prod only**.
   `npm run dev` will NOT reveal this — verify with `npm run preview`.
5. **Money is always integer centimes CHF** (`*_cents`). Never floats, never a
   plain `price`. Format for display via [`src/lib/format.ts`](src/lib/format.ts).
6. **Cloudflare bindings only exist inside a request.** Always obtain DB/auth via
   `await getDb()` / `await getAuth()` *inside* the handler — never at module top
   level.
7. **Never commit secrets.** Local secrets live in `.dev.vars`; prod secrets in
   Cloudflare (`wrangler secret put` / dashboard). The committed `.env.*` files
   hold only the **public** Stripe publishable key.
8. **All user-facing text is translated** in `messages/{fr,de,it,en}.json`
   (fr = default/fallback). Don't hardcode UI strings.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, RSC) + React 19 |
| Language | TypeScript 6 (strict). Import alias `@/* → src/*` |
| Styling | Tailwind CSS 4 (`src/app/globals.css`), `motion`, `lucide-react` |
| DB | Cloudflare D1 (SQLite) via Drizzle ORM |
| Auth | `better-auth` (email + Google OAuth, TOTP 2FA) |
| Payments | Stripe Payment Element + webhooks (LIVE in prod) |
| Email | Resend (REST) — no-op if `RESEND_API_KEY` unset |
| i18n | `next-intl` (fr/de/it/en, auto-detect, fr fallback) |
| Files / cache | Cloudflare R2 / KV |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |

## Commands

```bash
npm run dev               # dev server :3000 (loads D1/R2/KV bindings via OpenNext)
npm run lint              # ESLint (run before declaring a change done)
npm run typecheck         # tsc --noEmit — fast type check (no heavy OpenNext build)
npm run test              # Vitest (unit tests for pure domain logic in src/lib)
npm run format            # Prettier --write (format:check to verify only)
npm run preview           # OpenNext build + local Workers preview — tests prod CSP/nonce
npm run deploy            # OpenNext build + deploy from local machine (manual)
npm run cf-typegen        # regenerate cloudflare-env.d.ts after editing wrangler.jsonc
npm run db:generate       # generate a Drizzle migration after editing src/db/schema.ts
npm run db:migrate:local  # apply migrations to the LOCAL D1
npm run db:migrate:remote # apply migrations to the PROD D1 (normally automatic on deploy)
npm run db:seed:local     # seed local D1 from scripts/seed.sql
```

> **Lockfile / npm:** the project is on **npm 11**. The Cloudflare build image is
> pinned to **Node 24** via the repo's `.node-version` file (Node 24 ships npm 11;
> the image default is Node 22 / npm 10). That makes the CI `npm ci` match the
> npm 11 `package-lock.json` written locally and by Dependabot — no more
> `Missing: @esbuild/*… from lock file`. **Don't downgrade to npm 10 or delete
> `.node-version`**: npm 10's `npm ci` is strict about the per-platform optional
> packages (`@esbuild/*`) that npm 11 prunes from the lock, so the mismatch comes
> straight back. Regenerate the lock with the repo's npm (`npm install`) and
> validate with `npm ci` before pushing.

Cloudflare bindings (`wrangler.jsonc`): `DB` (D1 `swiss3design-db`),
`R2` (`swiss3design-files`), `KV`, `ASSETS`, `WORKER_SELF_REFERENCE`.

## Layout

```
src/
  app/[locale]/   localized pages: shop, products, cart, checkout, custom (quotes),
                  account, admin, legal, track. error.tsx / not-found.tsx
  app/api/        route handlers: stripe/webhook, checkout, quote-*, discount,
                  files & admin/files (R2), cron/maintenance, auth/[...all],
                  csp-report, track-order
  components/     shared UI (product-card, add-to-cart, theme-toggle, …)
  db/             Drizzle: schema.ts (source of truth), index.ts (getDb)
  i18n/           next-intl routing / request / navigation
  lib/            domain logic: auth, session, orders, cart, stripe, discounts,
                  shipping, email(+templates), rate-limit, maintenance, format, theme
  middleware.ts   Edge middleware: i18n + security headers + CSP nonce + www→apex
drizzle/          generated SQL migrations + snapshots — NEVER hand-edit
messages/         next-intl translations (fr/de/it/en)
scripts/          push.bat (one-click publish), seed*.sql
workers/cron/     standalone Cloudflare Cron Worker → POST /api/cron/maintenance
                  (purge R2 + cart reminders); deployed separately, excluded from
                  the app's tsconfig/eslint/OpenNext build
```

Server-side data access patterns to reuse: `getDb()` ([src/db/index.ts](src/db/index.ts)),
`requireAdmin()` / `getServerSession()` ([src/lib/session.ts](src/lib/session.ts)),
`rateLimit()` ([src/lib/rate-limit.ts](src/lib/rate-limit.ts)).

## Deployment

`git push` to `main` triggers **Cloudflare Workers Builds** (Git-native): build +
**D1 migrations** + deploy, with Cloudflare's own credentials. **There is no
GitHub Actions workflow** — the green commit check comes from Cloudflare. One-click
publish: run [`scripts/push.bat`](scripts/push.bat). Full details + how to
reconnect Git: [`docs/deploiement-cloudflare.md`](docs/deploiement-cloudflare.md).

## Workflow & etiquette

- **End of task:** auto-push to `main` and start the dev server (`npm run dev`);
  Thomas tests in his own browser — don't run automated browser verification.
- Branch `main` is the deploy branch; a push goes live. Be deliberate.
- Match the surrounding style: **comments and user-facing copy are in French**;
  code identifiers in English. Keep the dense, explanatory comment style already
  in the codebase (the *why*, not the *what*).
- Run `npm run lint` before declaring work done. When a change touches CSP, inline
  scripts, or anything runtime-specific, also run `npm run preview`.

## Brand constraints

Red / black / white only. Brand red `#E5231C`. No "3", no "S", no 3D-printing
cliché. Logo = isometric cube, 180° symmetry. Brand kit in `public/brand/`.
**Any new visual must be validated before use.**

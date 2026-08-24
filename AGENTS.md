<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Swiss3Design — Agent guide

> Operational brief for AI coding agents. Keep it short and high-signal.
> **Need to locate code? Read [`docs/codemap.md`](docs/codemap.md) first** — it maps
> "I need to do X" → exact file(s), so you find things in one read instead of grepping.

## Documentation map

Every `.md` in this repo, what it's for, and who reads it:

| File | Audience | Read it for |
| --- | --- | --- |
| [`docs/codemap.md`](docs/codemap.md) | Agents | **Start here for any code task** — "I need to do X" → exact file(s) |
| [`docs/architecture.md`](docs/architecture.md) | Agents / dev | Data model, request flows (checkout, quotes, auth), runtime model |
| [`docs/conventions.md`](docs/conventions.md) | Agents / dev | Code patterns, CSP nonce contract, i18n, Swiss specifics, style |
| [`docs/playbook.md`](docs/playbook.md) | Human ↔ agent | How to phrase a request well, task recipes, prompt templates |
| [`docs/runbook.md`](docs/runbook.md) | Ops | Deploy/rollback steps, incident procedures, secrets rotation |
| [`docs/deploiement-cloudflare.md`](docs/deploiement-cloudflare.md) | Ops | Git ↔ Cloudflare Workers Builds wiring, preview env, PR-stack pitfall |
| [`docs/refonte-plateforme-2026.md`](docs/refonte-plateforme-2026.md) | Product | Forward-looking redesign proposal — **not implemented**, don't treat as current state |
| [`README.md`](README.md) | Human (public) | Project overview, stack, setup, for anyone landing on the repo |
| [`ROADMAP.md`](ROADMAP.md) | Product | What's shipped vs. what's next, budget |
| [`SECURITY.md`](SECURITY.md) | Security | Vulnerability disclosure process |
| [`LICENSE.md`](LICENSE.md) | Legal | All-rights-reserved terms |

`CLAUDE.md` at the repo root is a one-line `@AGENTS.md` import — this file
*is* the actual source of truth Claude Code loads every session.

## What this is

Swiss e-commerce store for **multicolour 3D prints**, **LIVE in production** at
**swiss3design.ch**. Solo project; the AI writes essentially all the code.
B2C, **shipping to Switzerland only**, prices in **CHF**, UI in **fr/de/it/en**.
Runs entirely on **Cloudflare Workers** (Next.js 16 via OpenNext) with
**Postgres (Neon) via Cloudflare Hyperdrive**, **R2** (files), **KV**
(cache/rate-limit). Payments via **Stripe in LIVE mode** — treat
checkout/webhook code as production-critical.

**Stack pivot (2026-07-09):** the project moved off Medusa/Railway (never
viable on Cloudflare Workers — no persistent Node process — and Railway isn't
free) and off D1/SQLite onto Postgres/Hyperdrive, with **Bun** as the
package manager/dev runtime (deploy target is still `workerd`, unchanged).
**ESLint has been fully removed and replaced by Biome** as the sole
linter+formatter (same date) — Biome's `react` domain already covers
react-hooks (`useHookAtTopLevel`/`useExhaustiveDependencies`) and its `a11y`
domain covers what `jsx-a11y` did; the one confirmed, accepted gap is
`eslint-plugin-react-hooks`'s `react-hooks/purity` rule (flags non-deterministic
calls like `Date.now()` during render) and `@next/next`'s rules (e.g.
`no-img-element`), neither of which Biome replicates — low-severity, not
worth keeping a second linter for. **TypeScript 7 was attempted the same day
and reverted**: TS 7.0.2's `package.json` maps its root import to a
version-only stub (`./lib/version.cjs`, no compiler API), which breaks not
just `typescript-eslint` but `next build` itself (Next's internal
dependency-verification step `require()`s `typescript` and expects the classic
API) — confirmed by direct inspection of the installed package, not just
upstream reports. No config flag bypasses it. Stays on **TypeScript 6**
until TS 7.1 reintroduces a JS API. D1 stays wired in `wrangler.jsonc` for
now as a rollback safety net, not the active database.

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
   `bun run dev` will NOT reveal this — verify with `bun run preview`.
5. **Money is always integer centimes CHF** (`*_cents`). Never floats, never a
   plain `price`. Format for display via [`src/lib/format.ts`](src/lib/format.ts).
6. **Cloudflare bindings only exist inside a request.** Always obtain DB/auth via
   `await getDb()` / `await getAuth()` *inside* the handler — never at module top
   level.
6b. **Postgres is stricter than SQLite — don't assume a query that worked on D1
   still works.** Concretely: `SELECT DISTINCT` + `ORDER BY` on a column absent
   from the SELECT list is *tolerated* by SQLite but a hard Postgres error
   (`42P10`), and TypeScript/Drizzle's types don't catch it — this broke
   `/products/[slug]` in production right after the Hyperdrive cutover. When
   `DISTINCT` exists only to dedupe rows from a join, prefer a correlated
   `exists(...)` subquery over the join instead of reaching for `DISTINCT`.
7. **Never commit secrets.** Local secrets live in `.dev.vars`; prod secrets in
   Cloudflare (`wrangler secret put` / dashboard). The committed `.env.*` files
   hold only the **public** Stripe publishable key. **Never run `wrangler secret
   put` on an environment with real users without `--env <name>` explicitly
   set and double-checked** — a shared secret like `BETTER_AUTH_SECRET`
   encrypts existing 2FA/backup-code data; overwriting it silently locks users
   out with no self-service recovery (real incident, see
   [`docs/deploiement-cloudflare.md`](docs/deploiement-cloudflare.md#secrets--règles-après-lincident-2fa-juillet-2026)).
8. **All user-facing text is translated** in `messages/{fr,de,it,en}.json`
   (fr = default/fallback). Don't hardcode UI strings.
9. **Don't trust a `git push`/PR-merge to `main` as proof of deployment.**
   Cloudflare's auto-build has misfired in both directions (deployed to the
   wrong Worker; silently not fired at all) — after anything that matters,
   confirm the prod Worker's `modified_on` actually changed and fall back to
   a manual deploy if not (see
   [`docs/deploiement-cloudflare.md`](docs/deploiement-cloudflare.md)). For
   **stacked PRs** (branch-on-branch), merging each PR with `gh pr merge` only
   updates its own base branch, not `main`, unless that PR's base literally is
   `main` — see the same doc's PR-stack section before merging a phased feature.
10. **The Worker bundle has ~120 KiB of headroom under a hard 3 MiB cap. Never
   add a binary asset through a Next file convention.** The Workers **Free**
   plan caps a Worker at 3 MiB **gzipped** (`Total Upload: … / gzip:` in the
   deploy log is the number that counts — the uncompressed figure is 5× larger
   and irrelevant). The `app/icon.*` & `app/apple-icon.*` conventions inline
   their file as base64 **into that bundle** — a full icon set cost ~135 KiB
   and broke the deploy in August 2026 (`error 10027`). Icons therefore live in
   `public/` and are declared via `metadata.icons` in
   [`src/app/[locale]/layout.tsx`](src/app/[locale]/layout.tsx): `public/` ships
   as Cloudflare **static assets**, outside the bundle and outside the cap. The
   same trap applies to `opengraph-image.*`, `twitter-image.*` and any
   `import`ed image. Measure before pushing — `bunx wrangler deploy --dry-run`
   prints the gzip size in ~1 min without deploying. Known remaining fat:
   `three.js` sits in the **server** bundle (~718 KiB raw) because the 3D
   viewer's client component is server-rendered; moving it out is the next real
   win if headroom runs short.

## Tech stack

| Area | Choice |
| --- | --- |
| Runtime & package manager | Bun (install/scripts/dev) — deploy target is still `workerd` (Cloudflare Workers) |
| Framework | Next.js 16 (App Router, RSC) + React 19 |
| Language | TypeScript 6 (strict). Import alias `@/* → src/*` |
| Styling | Tailwind CSS 4 (`src/app/globals.css`), `motion`, `lucide-react` |
| DB | Postgres (Neon) via Cloudflare Hyperdrive + Drizzle ORM (pg dialect, `postgres.js` driver) |
| Auth | `better-auth` via `better-auth-cloudflare` (email + Google OAuth, TOTP 2FA, passkeys) — Postgres-backed |
| Lint/format | Biome (sole linter + formatter — ESLint removed 2026-07-09, see stack-pivot note) |
| Payments | Stripe Payment Element + webhooks (LIVE in prod) |
| Email | Resend (REST) — no-op if `RESEND_API_KEY` unset |
| i18n | `next-intl` (fr/de/it/en, auto-detect, fr fallback) |
| Files / cache | Cloudflare R2 / KV |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |

## Commands

```bash
bun run dev               # dev server :3000 (loads Hyperdrive/R2/KV bindings via OpenNext)
bun run lint              # biome lint (run before declaring a change done)
bun run typecheck         # tsc --noEmit — fast type check (no heavy OpenNext build)
bun run test              # Vitest (unit tests for pure domain logic in src/lib)
bun run format             # Biome --write (format:check to verify only)
bun run preview           # OpenNext build + local Workers preview — tests prod CSP/nonce
bun run deploy            # OpenNext build + deploy from local machine (manual)
bun run cf-typegen        # regenerate cloudflare-env.d.ts after editing wrangler.jsonc
bun run db:generate:pg    # generate a Drizzle migration after editing src/db/schema.pg.ts
bun run db:push:pg        # push schema changes to Postgres directly (drizzle-kit push)
```

> **Legacy D1 scripts** (`db:generate`, `db:migrate:local`, `db:migrate:remote`,
> `db:seed:local`) still exist in `package.json` and still work — the `DB`
> binding is kept wired as a rollback safety net (see Phase 6 of the stack
> pivot) — but they operate on the **inactive** database. Don't reach for them
> for day-to-day schema work; use the `:pg` commands above.

> **Local Hyperdrive emulation** needs a real Postgres connection string in
> `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`, and where it must
> live depends on which process reads it: `next dev` reads
> `.env.development.local`; `next build` (used by `preview`/`deploy`, which run
> in production mode) reads `.env.local` instead — `.env.development.local` is
> NOT loaded outside dev mode. The separate `wrangler preview`/`deploy`
> subprocess spawned by `opennextjs-cloudflare` does **not** inherit Next's
> dotenv-loaded values at all — on Windows/PowerShell, set it as a real
> `$env:` variable in the *same* command as `bun run preview`/`deploy`
> (PowerShell doesn't persist shell state between separate tool calls).

> **Lockfile:** the project is on **Bun** (`packageManager` in `package.json`,
> lockfile `bun.lock`) — `package-lock.json` is gone. Use `bun install`, not
> `npm install`, or the lockfile drifts.

Cloudflare bindings (`wrangler.jsonc`): `HYPERDRIVE` (Postgres/Neon, active DB),
`R2` (`swiss3design-files`), `KV`, `ASSETS`, `WORKER_SELF_REFERENCE`, plus a
still-wired but **inactive** `DB` (D1 `swiss3design-db`, rollback safety net —
see the stack-pivot note above). `env.preview` has its own separate
`HYPERDRIVE` binding pointing at an **isolated Neon branch** (`preview`, a
child of the `production` branch) — never the same database as prod. That
branch's PII-bearing tables (orders, customers, sessions, 2FA, passkeys,
quotes, reviews, …) are truncated after cloning; only a 6-product demo
catalog (`scripts/seed.sql`, reseeded onto that branch) is kept, so preview
has a populated shop without ever holding real customer data.

## Layout

```
src/
  app/[locale]/   localized pages: shop, products, cart, checkout, custom (quotes),
                  account, admin, legal, track. error.tsx / not-found.tsx
  app/api/        route handlers: stripe/webhook, checkout, quote-*, discount,
                  files & admin/files (R2), cron/maintenance, auth/[...all],
                  csp-report, track-order
  components/     shared UI (product-card, add-to-cart, theme-toggle, …)
  db/             Drizzle (Postgres/pg-core): schema.pg.ts + index.pg.ts are the
                  real source; schema.ts/index.ts are thin re-export shims
                  (so every call site still says `getDb()`/`@/db/schema`).
                  schema.d1.ts/index.d1.ts = old D1/SQLite versions, kept only
                  for the D1 rollback path and scripts/migrate-d1-to-pg.ts.
  i18n/           next-intl routing / request / navigation
  lib/            domain logic: auth, session, orders, cart, stripe, discounts,
                  shipping, email(+templates), rate-limit, maintenance, format, theme
  middleware.ts   Edge middleware: i18n + security headers + CSP nonce + www→apex
drizzle/          D1/SQLite migrations + snapshots (legacy, inactive DB) — NEVER hand-edit
drizzle-pg/       Postgres migrations + snapshots (active DB, drizzle.config.pg.ts) — NEVER hand-edit
messages/         next-intl translations (fr/de/it/en)
scripts/          push.bat (one-click publish), seed*.sql, migrate-d1-to-pg.ts (Bun,
                  one-off D1→Postgres data migration tool, reusable if D1 ever
                  needs resyncing before the rollback safety net is retired)
workers/cron/     standalone Cloudflare Cron Worker → POST /api/cron/maintenance
                  (purge R2 + cart reminders); deployed separately, excluded from
                  the app's tsconfig/Biome/OpenNext build
```

Server-side data access patterns to reuse: `getDb()` ([src/db/index.ts](src/db/index.ts)),
`requireAdmin()` / `getServerSession()` ([src/lib/session.ts](src/lib/session.ts)),
`rateLimit()` ([src/lib/rate-limit.ts](src/lib/rate-limit.ts)).

## Deployment

`git push` to `main` is *supposed* to trigger **Cloudflare Workers Builds**
(Git-native): build + deploy, with Cloudflare's own credentials — but this has
proven unreliable in practice (see golden rule 9), and from Phase 2 of the
stack pivot until 2026-07-09 it was **outright broken** for a real reason, not
flakiness: `next build` needs `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`
at build time and that variable only existed in local `.env*` files, never
uploaded to Cloudflare — fixed by adding it as a **Build variable** (Worker →
Settings → **Build tab** → "Build variables and secrets" — **not** the
"Variables & Secrets" tab, that's runtime-only and has zero effect on the
build; dashboard-only, no `wrangler.jsonc`/CLI/API equivalent) on both
`swiss3design` and `swiss3design-preview`. **Always verify the push actually
deployed**; fall
back to a manual deploy (`bunx opennextjs-cloudflare build && bunx
opennextjs-cloudflare deploy`, i.e. `bun run deploy`) if it didn't. **There is
no GitHub Actions workflow** — the green commit check, when it appears, comes
from Cloudflare. One-click publish: run [`scripts/push.bat`](scripts/push.bat).
Full details, the two-separate-Worker preview setup, the stacked-PR merge
pitfall, and the secrets-rotation incident:
[`docs/deploiement-cloudflare.md`](docs/deploiement-cloudflare.md).

**Postgres schema changes are NOT part of this pipeline.** Unlike the old D1
setup (migrations auto-applied by Cloudflare Workers Builds on every deploy),
a `bun run deploy`/git-push deploy does **not** touch the Postgres schema at
all. After editing `src/db/schema.pg.ts`, run `bun run db:generate:pg` then
apply it against the real Neon database (`bun run db:push:pg`, or run the
generated SQL in `drizzle-pg/` by hand) **before** deploying code that depends
on the new columns/tables — deploy order matters here in a way it didn't
under D1.

## Workflow & etiquette

- **End of task:** auto-push to `main` and start the dev server (`bun run dev`).
  Verify in a browser preview whenever it helps confirm the change — you're free
  to use the preview/verification tools as you see fit. **Then confirm it's
  actually live** (golden rule 9) — don't report done on faith that the push
  triggered a deploy.
- Branch `main` is the deploy branch; a push goes live. Be deliberate.
- **Multi-phase features on stacked branches**: merge the top-of-stack branch
  directly into `main` (`git merge <branch> --no-ff`) once every phase is
  approved, rather than merging each PR one by one — see the PR-stack pitfall
  in [`docs/deploiement-cloudflare.md`](docs/deploiement-cloudflare.md). Verify
  with `git log --oneline main -- <file only the last phase adds>` afterwards.
- Match the surrounding style: **comments and user-facing copy are in French**;
  code identifiers in English. Keep the dense, explanatory comment style already
  in the codebase (the *why*, not the *what*).
- Run `bun run lint` before declaring work done. When a change touches CSP, inline
  scripts, or anything runtime-specific, also run `bun run preview`.

## Brand constraints

Brand red `#E5231C`, over warm neutral ink/paper. Logo = layered geometric peak
(stacked print layers + alpine nod), **brand red only — no white or black inside
the mark**, so a single asset works on both the light and the dark theme. No
"3", no "S". Brand kit in `public/brand/`; the previous logo (isometric cube,
180° symmetry, ink + red) is archived under `public/brand/old-logo/` — kept for
reference, never referenced by the app.

The mark is a **raster** image (`public/brand/webp/mark.webp`, rendered by
[`src/components/brand-mark.tsx`](src/components/brand-mark.tsx)), unlike the
old inline-SVG mark: it can't be recoloured with `currentColor`, and it does
not scale to a legible 16 px favicon on its own — see golden rule 10 before
regenerating the icon set. **Any new visual must be validated before use.**

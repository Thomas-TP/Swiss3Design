<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Kreya (ex-Swiss3Design) — Agent guide

> Operational brief for AI coding agents. Keep it short and high-signal.
> **Need to locate code? Read [`docs/codemap.md`](docs/codemap.md) first** — it maps
> "I need to do X" → exact file(s), so you find things in one read instead of grepping.

## Documentation map

Every `.md` in this repo, what it's for, and who reads it:

| File                                                                       | Audience          | Read it for                                                                                                                 |
| -------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [`docs/codemap.md`](docs/codemap.md)                                       | Agents            | **Start here for any code task** — "I need to do X" → exact file(s)                                                         |
| [`docs/architecture.md`](docs/architecture.md)                             | Agents / dev      | Data model, request flows (checkout, quotes, auth), runtime model                                                           |
| [`docs/conventions.md`](docs/conventions.md)                               | Agents / dev      | Code patterns, CSP nonce contract, i18n, Swiss specifics, style                                                             |
| [`docs/playbook.md`](docs/playbook.md)                                     | Human ↔ agent     | How to phrase a request well, task recipes, prompt templates                                                                |
| [`docs/runbook.md`](docs/runbook.md)                                       | Ops               | Deploy/rollback steps, incident procedures, secrets rotation                                                                |
| [`docs/deploiement-cloudflare.md`](docs/deploiement-cloudflare.md)         | Ops               | Git ↔ Cloudflare Workers Builds wiring, preview env, PR-stack pitfall                                                       |
| [`docs/audit-remediation-2026-09.md`](docs/audit-remediation-2026-09.md)   | Ops               | September 2026 audit report (dated snapshot): fixes shipped, incident 1102 cause, post-deploy checks — not a rulebook       |
| [`docs/refonte-plateforme-2026.md`](docs/refonte-plateforme-2026.md)       | Product           | Forward-looking redesign proposal — **not implemented**, don't treat as current state                                       |
| [`docs/redesign-2026/DESIGN-BRIEF.md`](docs/redesign-2026/DESIGN-BRIEF.md) | Agents (redesign) | Binding spec of the « Strates » redesign (branch `claude/redesign-2026`): tokens, motion, Stage, packages, file ownership   |
| [`docs/redesign-2026/checklist-j3.md`](docs/redesign-2026/checklist-j3.md) | Owner             | J3 checklist of the « Strates » redesign: what to check on the preview, the merge to `main`, post-merge checks and rollback |
| [`docs/redesign-2026/measures-*.md`](docs/redesign-2026/)                  | Agents / ops      | Dated measurement reports of the redesign waves (Worker gzip, chunks, CSP, WebGL): history, not rules                       |
| [`README.md`](README.md)                                                   | Human (public)    | Project overview, stack, setup, for anyone landing on the repo                                                              |
| [`ROADMAP.md`](ROADMAP.md)                                                 | Product           | What's shipped vs. what's next, budget                                                                                      |
| [`SECURITY.md`](SECURITY.md)                                               | Security          | Vulnerability disclosure process                                                                                            |
| [`LICENSE.md`](LICENSE.md)                                                 | Legal             | All-rights-reserved terms                                                                                                   |

`CLAUDE.md` at the repo root is a one-line `@AGENTS.md` import — this file
_is_ the actual source of truth Claude Code loads every session.

## What this is

Swiss e-commerce store for **multicolour 3D prints**, **LIVE in production** at
**kreya.ch** (renamed from Swiss3Design in October 2026; the old domain
**swiss3design.ch** stays attached to the same Worker and 301-redirects pages
to kreya.ch, see `src/middleware.ts`). Solo project; the AI writes essentially all the code.
B2C, **shipping to Switzerland only**, prices in **CHF**, UI in **fr/de/it/en**.
Runs entirely on **Cloudflare Workers** (Next.js 16 via OpenNext) with
**Postgres (Neon) via Cloudflare Hyperdrive**, **R2** (files), **KV**
(cache/rate-limit). Payments via **Stripe in LIVE mode** — treat
checkout/webhook code as production-critical.

**Runtime and toolchain:** Cloudflare Workers has no persistent Node process,
so nothing that needs one can run here. Bun is the package manager and dev
runtime; the deploy target is `workerd`. The active database is
Postgres/Hyperdrive; the D1 binding stays wired in `wrangler.jsonc` only as a
rollback safety net. **Stay on TypeScript 6** until a TypeScript 7 release
ships a JS API again (expected in 7.1): TS 7.0's root import is a version-only
stub with no compiler API, and `next build` `require()`s `typescript`
expecting the classic API — no config flag bypasses it.

**Database driver:** node-postgres (`pg`), the driver Cloudflare's Hyperdrive
docs recommend (better prepared-statement caching, fewer round-trips to Neon).
`getPgDb()` ([`src/db/index.pg.ts`](src/db/index.pg.ts)) uses a
request-scoped `pg.Pool` (`max: 5`), **not** a bare `Client`: pages
parallelize independent reads with `Promise.all` (e.g. the product page), and a
`Client` runs one query at a time (a `DeprecationWarning` today, a hard error
in pg@9). Keep the pool's `.on("error", ...)` handler: Neon closes idle
connections (Postgres error `57P01`), which otherwise surface as an uncaught
exception. `src/lib/auth.ts` wires plain `betterAuth()` + the driver-agnostic
`better-auth/adapters/drizzle`, which works with any Postgres driver.
**Lint/format: Oxlint + Oxfmt.** `oxlint` (`.oxlintrc.json`) covers React
hooks, `react/purity` (Date.now-during-render), the `nextjs` plugin rules and
`jsx-a11y`. `nextjs/no-img-element` is kept **off**: Cloudflare Images already
handles optimization (`images.unoptimized` in `next.config.ts`), so converting
`<img>` to `next/image` is a real UI change, not a lint fix. `oxfmt`
(`.oxfmtrc.json`, still beta 0.x) is Prettier-compatible (LF line endings on
every platform, double quotes, printWidth 80, etc.);
`sortPackageJson`/`sortImports`/`sortTailwindcss` stay off on purpose to avoid
a repo-wide reorder diff unrelated to any real change. It formats neither CSS
(`src/app/globals.css` needs another tool if it drifts) nor imports. Suppress a
rule with `// oxlint-disable`/`oxlint-enable <bare-rule-name> -- reason` pairs
bracketing the block (bare rule name, no plugin prefix — e.g.
`exhaustive-deps`, not `react-hooks/exhaustive-deps`);
`oxlint-disable-line`/`-next-line` only reaches the _exact_ reported line,
which for a multi-line hook body is rarely the line you'd expect.

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
   `bun run preview` passes `--upstream-protocol https` to `wrangler dev` on
   purpose: wrangler gives `request.url` the host of the first route
   (`kreya.ch`) with the local protocol, so over plain http the
   middleware's http→https 308 fired on every page, and wrangler rewrote its
   `Location` back to `localhost` — an endless 308 loop. With the flag the
   Worker sees `https://kreya.ch/…` exactly as in production (the
   middleware is untouched). Running `opennextjs-cloudflare preview` by hand
   needs the same `-- --upstream-protocol https`.
5. **Money is always integer centimes CHF** (`*_cents`). Never floats, never a
   plain `price`. Format for display via [`src/lib/format.ts`](src/lib/format.ts).
6. **Cloudflare bindings only exist inside a request.** Always obtain DB/auth via
   `await getDb()` / `await getAuth()` _inside_ the handler — never at module top
   level.
   6b. **Postgres is stricter than SQLite — don't assume a query that worked on D1
   still works.** Concretely: `SELECT DISTINCT` + `ORDER BY` on a column absent
   from the SELECT list is _tolerated_ by SQLite but a hard Postgres error
   (`42P10`), and TypeScript/Drizzle's types don't catch it — this broke
   `/products/[slug]` in production right after the Hyperdrive cutover. When
   `DISTINCT` exists only to dedupe rows from a join, prefer a correlated
   `exists(...)` subquery over the join instead of reaching for `DISTINCT`.
   6c. **Hyperdrive caches `SELECT` results for 60 s and never invalidates them
   on write** (query caching is on for both configs). A read that must see a
   recent write — revocation, claim state, anything shown right after a
   mutation — adds `uncached` from [`src/db/fresh.ts`](src/db/fresh.ts) to its
   `where` (a `now()` call, which Hyperdrive never caches); "read then insert"
   must become `INSERT … ON CONFLICT`. Code that does not write its own SQL
   (Better Auth) gets `getFreshDb()`: every SELECT of that pool is prefixed with
   an unused `now()` CTE ([`src/db/fresh.ts`](src/db/fresh.ts)); never hand
   Better Auth the cached `getDb()` (2026-10-15: a signup cached « no user »
   and the verification link clicked within the minute failed with
   USER_NOT_FOUND). `bun run dev` connects straight to Neon
   and will NOT reveal stale reads — only preview/prod do (hit live: the OAuth
   resource seeding failed on preview with a duplicate insert).
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
10. **Keep the Worker bundle lean: 2 456 KiB gzip (2026-10-09, WP-99,
    41-character checkout, `wrangler deploy --dry-run`; it was 3 333 KiB on
    2026-10-08 before the webpack hook below, −26 %, see
    [`docs/redesign-2026/measures-wp99.md`](docs/redesign-2026/measures-wp99.md)
    and
    [`docs/redesign-2026/measures-wp99-worker.md`](docs/redesign-2026/measures-wp99-worker.md);
    earlier figures: 3 326 KiB on 2026-10-01 with the Studio, see
    [`measures-wave2b.md`](docs/redesign-2026/measures-wave2b.md)). The
    Studio's full server rendering (no-JS form, stats, posters) had pushed it
    past the 3 185 KiB cap of 2026-09-30; the overrun accepted on 2026-10-01
    on condition that WP-99 claws it back (target ≈ 3 250 KiB, brief §4.11)
    is now repaid with a wide margin. Re-measure rather than trust this figure
    as it ages, and compare two builds only from checkouts at the same path
    length: a long worktree path alone shifts the gzip figure by up to ±6 KiB.
    `next.config.ts` carries a `webpack()` hook, active only in the Node.js
    server build of `opennextjs-cloudflare build` (`next build --webpack`),
    that compiles modules once instead of once per webpack layer: modules
    imported from Server Actions (`action-browser` layer, except
    next/react/react-dom/scheduler) and, from the `ssr` layer, only zod and
    `src/lib/studio/**` go to the `rsc` layer, and the server `splitChunks`
    has no `minSize` nor request cap. It changes where modules sit in
    `.next/server`, never what runs. Do not remove it without re-measuring
    (−876 KiB gzip), and never extend the `ssr` → `rsc` rule to a package that
    touches React. The Studio direct purchase (2026-10-15) added +17.6 KiB gzip
    (2 471.59 → 2 489.17 KiB, same path length, see
    [`measures-achat-studio.md`](docs/redesign-2026/measures-achat-studio.md)); the
    admin STL button stays out of the Worker through `studio-stl-gate.tsx`.
    Never add a binary asset through a Next file convention.** Since
    2026-09-26 the account is on **Workers Paid**, whose cap is 10 MiB
    **gzipped**. The **Free** plan's 3 MiB cap is what broke the deploy in
    August 2026, and every KiB still lengthens cold starts. The number that
    counts is `Total Upload: … / gzip:` in the deploy log; the uncompressed
    figure is 5× larger and irrelevant. The `app/icon.*` & `app/apple-icon.*` conventions inline
    their file as base64 **into that bundle** — a full icon set cost ~135 KiB
    and broke the deploy in August 2026 (`error 10027`). Icons therefore live in
    `public/` and are declared via `metadata.icons` in
    [`src/app/layout.tsx`](src/app/layout.tsx): `public/` ships
    as Cloudflare **static assets**, outside the bundle and outside the cap. The
    same trap applies to `opengraph-image.*`, `twitter-image.*` and any
    `import`ed image. Measure before pushing — `bunx wrangler deploy --dry-run`
    prints the gzip size in ~1 min without deploying. Three.js never belongs in
    the server Worker (≈ 243 KiB gzip when it slipped in): the product viewer is
    the Stage scene `src/motion/stage/scenes/product-viewer.ts`, declared in the
    page by `<StageView>` (`components/catalog/product-viewer.tsx`) and loaded
    on the client by `SiteShell` through the gates of rule 11. A static import of
    `three` or of anything under `src/motion` from a component rendered on the
    server (including a `"use client"` one, which is also server-rendered)
    brings it back.
11. **Motion boundary (redesign « Strates »): `gsap`, `lenis` and `three`
    live only under `src/motion/**`, and `src/motion` is reached only from
    `src/gates/**`.** A gate is a `"use client"` file holding nothing but
    module-level `dynamic(() => import("@/motion/…"), { ssr: false })`
    declarations: with `ssr: false` Next strips the import from the server
    build, so the Worker never sees those packages. Anything else — a static import,
    or an `await import("three")` in an effect of a server-rendered component
    — stays in the Worker (rule 10). Three guards enforce it: `.oxlintrc.json`
    (`no-restricted-imports`, which also flags dynamic `import()`; types pass
    with `import type`), [`src/gates/boundary.test.ts`](src/gates/boundary.test.ts)
    (no `@/motion` string anywhere else in `src/**`, not even in a mock) and
    `bun scripts/check-worker-bundle.ts` after an OpenNext build (0 engine
    signature allowed in `.open-next/server-functions`). The DOM talks to the
    heavy side only through the light, SSR-safe bridge
    [`src/lib/motion-bridge/**`](src/lib/motion-bridge/) (store,
    `useStageView`, motion preference, capability tier): the heavy side
    imports the bridge, never the reverse. **Lenis and the WebGL Stage exist
    only inside the `src/app/[locale]/(site)/` route group**, mounted by
    [`SiteShell`](src/components/site-shell.tsx) from its layout: cart,
    checkout, account, admin, OAuth, track and legal stay outside the group
    and never get either (no Lenis, no transform, no canvas around Stripe
    iframes). A page that joins or leaves the group also updates
    `isSitePath()` in [`src/components/ui/site-link.tsx`](src/components/ui/site-link.tsx)
    (the « Coupe » page transition only plays between two pages of the
    group). **i18n by namespace:** the historical
    `messages/{fr,de,it,en}.json` were frozen during the redesign; WP-99
    cleaned them (76 unread keys removed, 2026-10-09) and the freeze is
    lifted, so they are editable again (same keys in the 4 locales). New text
    of the redesign's areas still goes in its own
    `messages/<locale>/<namespace>.json` (declared in
    [`src/i18n/namespaces.ts`](src/i18n/namespaces.ts), merged by
    `src/i18n/request.ts`), and `src/i18n/messages.test.ts` enforces the same
    keys and ICU arguments in the 4 locales and zero `ß` in German. **The
    browser only receives the messages its `"use client"` components read**:
    the root (`ROOT_CLIENT_NAMESPACES` in
    [`src/i18n/client-namespaces.ts`](src/i18n/client-namespaces.ts): chrome,
    consent, `error.tsx`) plus what each segment or page declares with
    `<ClientMessages namespaces={[…]}>`
    ([`src/i18n/client-messages.tsx`](src/i18n/client-messages.tsx)) in its own
    `layout.tsx`. A package that adds a client component reading a new
    namespace (WP-HOME `landing`, WP-STUDIO `studio`/`studioCore`) declares it
    there; `src/i18n/client-messages.test.ts` fails otherwise. Details:
    [`docs/conventions.md`](docs/conventions.md) → Motion, i18n, Design tokens.
12. **Studio direct purchase (14.10.2026): money, texts, migration.** The Studio
    objects (vase, business card, mountain, name tag) are bought in the cart like a
    shop product. The firm price comes from ONE pure function,
    [`src/lib/studio/price.ts`](src/lib/studio/price.ts) (integer centimes, rates in
    the module), shared by the browser (live price, cart) and by `POST /api/checkout`,
    which recomputes everything ([`studio/purchase.ts`](src/lib/studio/purchase.ts):
    strict schema, canonical config, printable guards, price) and never trusts the
    client's price (409 `price_changed` carries the server prices). The price must
    NOT depend on the full glyph font (the server never loads it) nor on the page
    language: never import `text/glyphs` or `text/shapes` on the stats path, and
    price the Montagne with `PRICE_LOCALE` (`price-font.test.ts`,
    `price-isolation.test.ts` enforce it). A Studio line has no stock, no product id
    and **no shipping** (`shippingForOrder`: only the shop part is shipped-charged);
    its snapshot is `order_items.studio` (jsonb: configuration + typed texts, which
    are personal data: kept with the order, never in Stripe metadata, analytics,
    logs or `checkout_fingerprint`). Server-side cart reminders never see Studio
    lines (`parseCart` drops them; the browser doesn't send them). **Migration
    `drizzle-pg/0009` (additive column) must be applied BEFORE deploying code that
    reads it**: every `select()` on `order_items` lists the column, the Stripe
    webhook included. Shipping defaults are 0/0 (free everywhere in Switzerland);
    the admin settings still override them. Studio filaments are the Bambu Lab
    PLA Matte hex (15.10.2026 decision, 10 colours), displayed untransformed (`filaments.ts`,
    `filaments.test.ts`).
13. **Filament stock (15.10.2026): reservations are DERIVED, the payment never
    depends on the stock migration.** Tables `filament_*` (migration
    `drizzle-pg/0010`, additive: no column added to an existing table); seeds
    `scripts/seed-filament-refs.sql` (safe in production, no spool) and
    `scripts/seed-filament-stock-preview.sql` (preview only), both applied by hand.
    Reserved grams are never stored: Studio orders (paid, in production, or pending
    with a live reservation; `order_items.studio.filamentGrams`) and accepted quotes
    (`filament_quote_details.plan`), minus whatever `filament_consumptions` records.
    Reads are fresh (`uncached`, rule 6c: `lib/filament/stock-db.ts`); the only write
    path is `lib/filament/ledger.ts` (append-only `filament_movements`, the spool's
    `remaining_grams` updated in the same transaction). `POST /api/checkout` re-checks
    every Studio line (fresh pre-check, then `pg_advisory_xact_lock` + check inside
    the order transaction): **409 `out_of_stock`**; missing tables (`42P01`) mean
    « colour not tracked » (logged), the sale goes on. The public
    `GET /api/stock/colors` gives a rounded capacity (10 g steps, capped at 1500 g),
    never the exact level; KV-cached 60 s, emptied by every admin write.
    `/custom`: the 3D file is required on the client AND in the Server Action (a
    Studio quote may carry its `S3D-STUDIO v1` configuration line instead); the
    weight is estimated in the browser (`src/lib/mesh-weight`; STEP/STP through
    `occt-import-js`, WebAssembly in a classic Worker served from
    `public/vendor/occt/`, LGPL-2.1, version pinned, files byte-identical to the npm
    package: `occt-assets.test.ts`). Those static responses carry no CSP (a path with a
    dot is outside the middleware), so `'wasm-unsafe-eval'` is NOT needed: keep the
    WASM in that Worker, never on the main thread, never in the server Worker
    (`mesh-estimator.tsx` is `ssr: false` for the same reason as the gates). Worker
    gzip measured with the stock and the admin: 2 528 KiB (2 491 KiB at `0be8e4e`,
    same path length, 2026-10-15). **Shop colours (15.10.2026): an article's colours
    ARE the stock's:** active `filament_refs` with `custom_ok` (the same as « Sur mesure »)
    minus `product_filament_exclusions` (boxes unticked in the admin product form); material
    always PLA (`CUSTOM_MATERIAL`, forced on save). The cart identifies a colour by `colorRef`
    (ref id; an old cart holding only a NAME is attached by `parseCart`: Blanc/Noir/Bleu,
    `lib/filament/shop.ts`); the server re-reads everything. Every article with a weight
    (`stock` as well as `on_demand`: the piece is printed in the chosen colour) reserves `ceil(weight × quantity × 1.10)` g in `order_item_filaments` (grams of ONE
    piece; its own table, not an `order_items` column: webhook included, every `select()` of
    that table lists its columns). Migration `drizzle-pg/0011` is additive, applied AFTER 0010
    and BEFORE the refs seed; the code tolerates 42P01 (no exclusion, nothing reserved, the
    sale goes on). A spool's need is the SUM of its Studio and shop lines, checked PER REF
    (`checkStockNeeds`: same advisory lock, same 409 `out_of_stock`); the cart sums the same
    way with the public capacity (`refs` of `/api/stock/colors`, KV key `v2`). No spool for a
    ref = « épuisée » for every article with a weight. `materials`/`filament_colors`/`product_colors`
    stay for the rollback but no code reads them; `/admin/materials` is gone. Preview data:
    `scripts/seed-preview-shop-pla.sql` (by hand, never in a deploy). Worker gzip with the shop colours: 2 536 KiB
    (2 528.56 before, same path length, 2026-10-15).

14. **Atelier 3D de « Sur mesure » (16.10.2026) : peinture par zone au format des
    trancheurs.** Le moteur est du TypeScript pur, testé, dans
    [`src/lib/paint3d/`](src/lib/paint3d/) (document, BVH, outils, lecture et écriture
    3MF). Une peinture = un arbre par triangle d'origine, au format `TriangleSelector`
    (attributs `paint_color` de Bambu Studio et OrcaSlicer, `slic3rpe:mmu_segmentation`
    de PrusaSlicer). Vérifié le 16.10.2026 avec Bambu Studio 02.08 en ligne de commande :
    - il réécrit nos chaînes à l'octet près ;
    - un cube peint tranché change de filament aux hauteurs peintes ;
    - le Benchy 4 couleurs de MakerWorld, repassé par l'atelier, garde ses grammes par
      couleur à ±7 %.

    Ne touchez pas à `selector.ts` sans refaire ce contrôle.

    Côté code :
    - **Chargement.** Les panneaux (`src/components/paint`) ne sont chargés que par
      `paint-studio-lazy.tsx` (`ssr: false`, hors du Worker) ; la 3D est la scène
      `paint-editor` du registre du Stage.
    - **Affichage.** L'atelier est un `<dialog>` modal plein écran dont le centre est
      transparent. Pendant qu'il est ouvert, `body[data-stage-front]` fait passer le
      canvas du Stage au-dessus de la page (`globals.css`) : toujours un seul contexte
      WebGL.
    - **Zones = emplacements, jamais couleurs (25.10.2026).** Une zone peinte
      appartient à un emplacement (filament 1 à 4, identifiant stable,
      `components/paint/slots.ts`) ; changer sa couleur, passer d'une à plusieurs
      couleurs et revenir ne touchent pas à la peinture. Seul le retrait d'un
      emplacement rend ses zones à la couleur principale. Deux emplacements de même
      couleur sont réunis à l'export et dans le résumé (`printedPalette`).
    - **Couleurs d'un 3MF peint** (Bambu, Orca, Prusa : peinture et filament par pièce).
      Ses zones sont reprises telles quelles, un emplacement par filament, chacun
      dans la couleur du stock la plus proche (un filament uni l'emporte sur une
      bobine co-extrudée) ; seul un fichier de plus de 4 filaments en réunit.
    - **Remplissage « Zone ».** Au niveau des feuilles de la peinture, même couleur
      et arêtes de plus de 30°, comme le pot de peinture de Bambu Studio
      (`lib/paint3d/bucket.ts`) : jamais de débordement sur une autre couleur.
    - **Orientation.** L'aperçu d'un fichier du visiteur garde celle du fichier (Z vers
      le haut), jamais `upAxisFor`, qui ne sert qu'aux modèles des produits.

    Côté devis :
    - **Projet Bambu Studio (24.10.2026).** Le 3MF du devis est un projet Bambu
      (`lib/paint3d/bambu-project.ts`) : à l'ouverture, Bambu Studio crée lui-même les
      filaments, avec leurs couleurs et leurs profils. Un 3MF « d'un autre logiciel » ne
      garde pas la peinture d'un filament absent du projet ouvert, même si on l'ajoute
      ensuite.
      - Les réglages viennent de `lib/paint3d/bambu-template.json`, généré par
        `bun scripts/bambu/build-project-template.ts` depuis les profils de Bambu Studio
        (P1S 0.4, 0.20mm Standard, Textured PEI). La ligne de commande de Bambu ne
        résout pas l'héritage des profils : ne pas reprendre ses valeurs.
      - Vérifié en ligne de commande : 3 filaments, profils reconnus, filament 3
        tranché, aucun profil marqué « modifié ».
      - Regénérer le modèle après une mise à jour majeure de Bambu Studio ou un
        changement de machine.
    - **Fichier.** Le 3MF peint passe par `/api/quote-upload` (30 Mo, compte dans le
      quota de 10 envois par heure).
    - **Résumé.** Il est revalidé par zod (`lib/paint3d/summary.ts`). Le projet n'est
      enregistré que si ses couleurs sont exactement les références choisies, dans le
      même ordre (= filaments 1 à 4 du 3MF).
    - **Table.** Il est enregistré dans `quote_color_projects` : migration
      **`drizzle-pg/0012`**, additive, à appliquer AVANT le déploiement ; le code tolère
      son absence (42P01).
    - **Poids et dimensions.** Le poids estimé suit le cube de l'échelle, et les
      dimensions la boîte tournée.

    Worker gzip avec l'atelier : 2 544 KiB (2 536 avant, même chemin, 16.10.2026).

## Tech stack

| Area                      | Choice                                                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime & package manager | Bun (install/scripts/dev) — deploy target is still `workerd` (Cloudflare Workers)                                                                                                                                                             |
| Framework                 | Next.js 16 (App Router, RSC) + React 19                                                                                                                                                                                                       |
| Language                  | TypeScript 6 (strict). Import alias `@/* → src/*`                                                                                                                                                                                             |
| Styling                   | Tailwind CSS 4 (`src/app/globals.css`, tokens of the « Strates » redesign), `motion` (Framer: admin and utility pages, no new use on showcase pages), `lucide-react`                                                                          |
| Motion & 3D               | GSAP (« Standard no-charge license »), Lenis, three (pinned `0.186.1`), d3-contour, earcut: **client-only**, under `src/motion/**` behind `src/gates/**` (rule 11). Fonts: Archivo SemiExpanded (self-hosted, OFL) + Geist / Geist Mono (OFL) |
| DB                        | Postgres (Neon) via Cloudflare Hyperdrive + Drizzle ORM (pg dialect, `node-postgres`/`pg` driver)                                                                                                                                             |
| Auth                      | `better-auth` (+`@better-auth/passkey`) via the driver-agnostic `better-auth/adapters/drizzle` (email + Google OAuth, TOTP 2FA, passkeys) — Postgres-backed                                                                                   |
| Lint/format               | Oxlint + Oxfmt (see the lint/format note under "What this is"; oxfmt is still beta)                                                                                                                                                           |
| Payments                  | Stripe Payment Element + webhooks (LIVE in prod)                                                                                                                                                                                              |
| Email                     | Resend (REST) — no-op if `RESEND_API_KEY` unset                                                                                                                                                                                               |
| i18n                      | `next-intl` (fr/de/it/en, auto-detect, fr fallback)                                                                                                                                                                                           |
| Files / cache             | Cloudflare R2 / KV                                                                                                                                                                                                                            |
| Analytics                 | PostHog Cloud EU, cookie `ph_…` + replay, Swiss opt-out (« OK / Refuser »), via the relay `/api/relay` (middleware) — `posthog-js` only in `src/instrumentation-client.ts`; see `docs/conventions.md` → Analytics                             |
| Hosting                   | Cloudflare Workers via `@opennextjs/cloudflare`                                                                                                                                                                                               |
| AI agents                 | Public MCP `/mcp`, A2A, REST `/api/v1`, WebMCP; customer-account MCP `/mcp/account` behind OAuth 2.1 (`@better-auth/oauth-provider`) + auth.md — see `docs/architecture.md` → Agents                                                          |
| Agentic commerce          | Stripe Agentic Commerce Suite (catalogue feed, hooks, webhook orders) in `src/lib/commerce` — see `docs/architecture.md` → Agentic commerce                                                                                                   |

## Commands

```bash
bun run dev               # dev server :3000 (loads Hyperdrive/R2/KV bindings via OpenNext)
bun run lint              # oxlint (run before declaring a change done)
bun run typecheck         # tsc --noEmit — fast type check (no heavy OpenNext build)
bun run test              # Vitest (tests unitaires ; intégrations ignorées sans URL)
bun run test:preview      # Suite complète sur la branche Neon preview verrouillée
bun run format             # oxfmt (writes by default; format:check verifies only)
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
> `$env:` variable in the _same_ command as `bun run preview`/`deploy`
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
  app/layout.tsx  ROOT layout: the only <html>/<body>, theme script, site JSON-LD,
                  default metadata. app/not-found.tsx = the server-rendered 404 of
                  any URL without a route (Next's internal /_not-found)
  app/[locale]/   localized pages: shop, products, cart, checkout, custom (quotes),
                  account, admin, legal, track. layout.tsx = LocaleShell (header,
                  footer, providers); error.tsx / not-found.tsx (notFound() thrown
                  by a page, client-rendered by Next: see src/app/layout.tsx)
  app/[locale]/(site)/  route group (not in the URL) of the public showcase
                  pages: home, shop, products, custom, a-propos, contact (and
                  the Studio). Its layout mounts SiteShell (Lenis + WebGL
                  Stage); everything else under [locale] never gets them
  app/api/        route handlers: stripe/webhook, checkout, quote-*, discount,
                  files & admin/files (R2), cron/maintenance, auth/[...all],
                  csp-report, track-order
  components/     shared UI (product-card, add-to-cart, theme-toggle, …)
  components/ui/  « Strates » primitives: SiteLink, PageCut, Button, Field,
                  Chip, Chapter, Drawer, Toast, StageView, MeasureStrip, icons…
  components/studio/  the Studio (configurator): controls, scene panel, send
                  drawer; the quote form it sends through is shared with /custom
                  (components/quote/quote-request-form.tsx)
  fonts/          self-hosted Archivo SemiExpanded (woff2 + OFL-Archivo.txt),
                  loaded by app/fonts.ts together with Geist / Geist Mono
  gates/          the ONLY door to src/motion: next/dynamic({ ssr: false }) (rule 11)
  motion/         client-only engines: gsap, Lenis runtime, three Stage + scenes
  db/             Drizzle (Postgres/pg-core): schema.pg.ts + index.pg.ts are the
                  real source; schema.ts/index.ts are thin re-export shims
                  (so every call site still says `getDb()`/`@/db/schema`).
                  schema.d1.ts/index.d1.ts = old D1/SQLite versions, kept only
                  for the D1 rollback path and scripts/migrate-d1-to-pg.ts.
  i18n/           next-intl routing / request / navigation
  lib/            domain logic: auth, session, orders, cart, stripe, discounts,
                  shipping, email(+templates), rate-limit, maintenance, format, theme
  lib/motion-bridge/  light SSR-safe bridge between the DOM and src/motion
                  (store, useStageView, motion preference, capability tier)
  lib/agent/      AI-agent surfaces: MCP (public + /mcp/account), A2A, REST,
                  discovery, OAuth 2.1 resource server, auth.md agent registration
  lib/studio/     pure TypeScript of the Studio: geometry generators, stats,
                  guards, STL, URL state (no three; zod only in schemas.ts / url-state.ts)
  lib/commerce/   agentic commerce: Stripe catalogue feed, ACS hooks, agent
                  orders (paid before they reach us — never fail, alert instead)
  middleware.ts   Edge middleware: i18n + security headers + CSP nonce + www→apex
drizzle/          D1/SQLite migrations + snapshots (legacy, inactive DB) — NEVER hand-edit
drizzle-pg/       Postgres migrations + snapshots (active DB, drizzle.config.pg.ts) — NEVER hand-edit
messages/         next-intl translations (fr/de/it/en); <locale>/<namespace>.json
                  = one file per redesign package (rule 11), merged at load
scripts/          seed*.sql, migrate-d1-to-pg.ts (Bun, one-off D1→Postgres data
                  migration tool, reusable if D1 ever needs resyncing before the
                  rollback safety net is retired); check-worker-bundle.ts (0
                  engine signature in the Worker) and chunk-report.ts (JS per
                  page, after an OpenNext build); gen-field-posters.ts and
                  fonts/ (SVG posters and Studio glyphs; `--check` fails if a file is out of date)
workers/cron/     standalone Cloudflare Cron Worker → POST /api/cron/maintenance
                  (purge R2 + cart reminders); deployed separately, excluded from
                  the app's tsconfig/oxlint/OpenNext build
```

Server-side data access patterns to reuse: `getDb()` ([src/db/index.ts](src/db/index.ts)),
`requireAdmin()` / `getServerSession()` ([src/lib/session.ts](src/lib/session.ts)),
`rateLimit()` ([src/lib/rate-limit.ts](src/lib/rate-limit.ts)).

## Deployment

A merge into `main` is _supposed_ to trigger **Cloudflare Workers Builds**
(Git-native): build + deploy, with Cloudflare's own credentials — but this has
proven unreliable in practice (see golden rule 9). `next build` needs
`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` at build time; on
Cloudflare it is a **Build variable** (Worker → Settings → **Build tab** →
"Build variables and secrets" — **not** the "Variables & Secrets" tab, which is
runtime-only and has no effect on the build; dashboard-only, no
`wrangler.jsonc`/CLI/API equivalent) on both `swiss3design` and
`swiss3design-preview`; a build failing on it means that variable is gone.
**Always verify the merge actually deployed**; fall
back to a manual deploy (`bunx opennextjs-cloudflare build && bunx
opennextjs-cloudflare deploy`, i.e. `bun run deploy`) if it didn't. GitHub
Actions runs [`quality.yml`](.github/workflows/quality.yml) (lint,
format:check, typecheck, migrations against a throwaway Postgres, tests,
`bun audit`) and CodeQL on every PR and every push to `main`, but deploys
nothing: only the Cloudflare checks (« Workers Builds: … ») deploy.
Full details, the two-separate-Worker preview setup, the stacked-PR merge
pitfall, and the secrets-rotation incident:
[`docs/deploiement-cloudflare.md`](docs/deploiement-cloudflare.md).

**Postgres schema changes are NOT part of this pipeline.** A deploy
(`bun run deploy` or a merge into `main`) does **not** touch the Postgres
schema. After editing `src/db/schema.pg.ts`, run `bun run db:generate:pg`
then apply it against the real Neon database (`bun run db:push:pg`, or run the
generated SQL in `drizzle-pg/` by hand) **before** deploying code that depends
on the new columns/tables: code that ships first queries columns that don't
exist yet.

## Workflow & etiquette

- **End of task:** push your branch, open a PR to `main` and merge it once
  `quality` and « Workers Builds: swiss3design-preview » are green. `main` is
  protected: a PR is required and its branch must be up to date
  (`gh pr update-branch <n>`, never `--admin`). Start the dev server
  (`bun run dev`) and verify in a browser preview whenever it helps confirm the
  change. **Then confirm it's actually live** (golden rule 9) — don't report
  done on faith that the merge triggered a deploy.
- Branch `main` is the deploy branch; a merge into it goes live. Be deliberate.
- **Multi-phase features on stacked branches**: once every phase is approved,
  merge the top-of-stack branch through a PR whose base is `main` (open one
  from that branch, or `gh pr edit <n> --base main`), rather than merging each
  PR one by one — see the PR-stack pitfall in
  [`docs/deploiement-cloudflare.md`](docs/deploiement-cloudflare.md). A local
  `git merge` pushed to `main` would skip the required PR and `quality` check.
  Verify with `git log --oneline main -- <file only the last phase adds>`
  afterwards.
- Match the surrounding style: **comments and user-facing copy are in French**;
  code identifiers in English. Keep the dense, explanatory comment style already
  in the codebase (the _why_, not the _what_).
- Run `bun run lint` before declaring work done. When a change touches CSP, inline
  scripts, or anything runtime-specific, also run `bun run preview`.
- **Dependabot PRs (bun):** Dependabot's lockfile update can leave a stale
  hoisted copy of a peer dependency (e.g. an older `@better-auth/core` at the
  root while each updated `@better-auth/*` package nests its own newer copy);
  the duplicate, incompatible types break `typecheck` and the Cloudflare build.
  To fix it on the branch: merge `main` in, run
  `bun update <direct deps involved>`, then check that `node_modules` holds a
  single copy. Merge only when both `quality` and « Workers Builds:
  swiss3design-preview » are green.

## Brand constraints

**Name: « Kreya »** (only the K capitalised), chosen 2026-10-08; legal identity
« Kreya — entreprise individuelle de Thomas Prud'homme ». Infrastructure
identifiers keep the old name on purpose (Workers `swiss3design` /
`swiss3design-preview`, R2/D1/KV names, `s3d-*` storage keys and CSS classes,
the `S3D-STUDIO v1` quote line, the published UCP handler
`ch.swiss3design.stripe_spt`): renaming them breaks data or clients for no
visible gain. New order numbers start with `KRY-`; `S3D-` ones stay valid
(`ORDER_NUMBER_PATTERN`).

Brand red `#E5231C`, over warm neutral ink `#1A1614` / paper `#F4F0E8`. Logo
« A · Pic en strates » (validated 2026-10-09): a two-peak silhouette sliced into
5 print layers (3 under 24 px), **always brand red**, and the « Kreya »
wordmark (Archivo SemiExpanded 800, outlined) in the text colour. Master kit:
`public/brand/svg` (copy of the owner's « Kreya - identité visuelle » folder),
icons in `public/brand/app`, social images in `public/brand/social`.
[`src/components/brand-mark.tsx`](src/components/brand-mark.tsx) is GENERATED
from those SVGs (inline paths: `BrandMark`, `BrandWordmark`, `BrandLogo`);
`animated` stacks the layers once (CSS `.k-print`, off under reduced motion).
Previous logos are archived under `public/brand/old-logo/` (isometric cube, then
the raster peak in `pic-swiss3design/`) — never referenced by the app. Icons stay
in `public/` (golden rule 10). **Any new visual must be validated before use.**

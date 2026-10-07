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

- All UI strings live in message files read with `next-intl`
  (`useTranslations` / `getTranslations`). **Never hardcode** user-facing text;
  add the key to **all four** locales (fr is the fallback).
- **Namespaces (redesign « Strates »).** The historical
  `messages/{fr,de,it,en}.json` are **frozen** during the redesign (only the
  final clean-up package removes dead keys). New text goes into the owning
  package's own file `messages/<locale>/<namespace>.json`: `shell` (chrome),
  `studioCore`, `landing`, `studio`, `quote`, `catalog`, `atelier`, `system`,
  `accountUi`. [`src/i18n/request.ts`](../src/i18n/request.ts) grafts each
  file at the root of the messages, so `useTranslations("shell")` reads
  `messages/<locale>/shell.json` exactly like `useTranslations("nav")` reads
  the `nav` key of the historical file. One namespace = one file per locale =
  one owner, so parallel packages never edit the same JSON.
- **Adding a namespace** = add it to `NAMESPACES` in
  [`src/i18n/namespaces.ts`](../src/i18n/namespaces.ts) **and** create the 4
  files (even `{}`): the import fails on a missing file, and a namespace whose
  name already exists as a root key of the historical file throws instead of
  silently replacing it.
- [`src/i18n/messages.test.ts`](../src/i18n/messages.test.ts) enforces, for
  every namespace and the historical files: the same key paths in the 4
  locales, the same ICU arguments (`{count, plural, …}`, `{name}`), no empty
  value, and **no `ß` in German** (de-CH writes « ss »: « Grösse »,
  « Schliessen », « Mass »).
- **Client messages are opt-in, by layer.** The merged messages (~45 KB of
  JSON in French) used to go to every page through `NextIntlClientProvider`;
  now the browser only gets what its `"use client"` components read. Server
  components (no directive, reached from a server component) read messages on
  the server and cost the client nothing. The layers add up:
  1. **Root**: `LocaleShell` provides `ROOT_CLIENT_NAMESPACES`
     ([`src/i18n/client-namespaces.ts`](../src/i18n/client-namespaces.ts):
     `nav`, `shell`, `consent`, `errors`, `system.error`), i.e. the header,
     BottomNav, footer toggles, consent banner and `error.tsx` (which replaces
     the page and cannot be wrapped). Add to that list only what the shared
     chrome itself reads.
  2. **Segment or page**: declare what your client components read with
     `<ClientMessages namespaces={["catalog.viewer"]}>` from
     [`src/i18n/client-messages.tsx`](../src/i18n/client-messages.tsx), in the
     `layout.tsx` next to your `page.tsx` (or around the relevant subtree of
     the page when nested pages must not inherit it, e.g. `checkout/page.tsx`
     vs `checkout/success/layout.tsx`). It merges with its parents (a nested
     provider alone would _replace_ them). Shared atoms go on the route group
     (`(site)/layout.tsx` declares `product` and `favorites` for the product
     cards).
  3. A **namespace** here is exactly the argument of a client-side
     `useTranslations("…")`: a whole root key (`account`) or a dotted path
     (`system.cart`, `atelier.form`); pick the narrowest that covers your
     calls, and never call `useTranslations()` without an argument in client
     code.

  [`src/i18n/client-messages.test.ts`](../src/i18n/client-messages.test.ts)
  checks it on the source: from every `page`, `layout`, `error` and
  `not-found` in `src/app` it follows the imports, and every namespace read
  by client code must be provided by the root or by `<ClientMessages>` in the
  entry file or an ancestor layout; every declared namespace must exist in the
  4 locales; `namespaces` must be a literal array. A forgotten namespace also
  shows as `MISSING_MESSAGE` in the browser console in dev. **A new package
  (WP-HOME `landing`, WP-STUDIO `studio` / `studioCore`) adds its
  `<ClientMessages>` in its own layout and does not edit the root list.**
  Measured (dev server, 2026-10-01): `/fr` 182 → 137 KiB raw (38.7 → 24.6 KiB
  gzip), `/fr/contact` 146 → 102 KiB.

- Budget: keep new text ≤ 25 KB per locale in total (it is bundled in the
  Worker whatever the page, see golden rule 10); what reaches the browser is
  governed by the layers above.
- Navigate with the locale-aware helpers from
  [`src/i18n/navigation.ts`](../src/i18n/navigation.ts) (`Link`, `redirect`,
  `useRouter`), not bare `next/link` / `next/navigation`, so the `/fr` `/de` …
  prefix is preserved. The one exception is `useLinkStatus`, imported from
  `next/link`. Chrome links and CTAs use
  [`SiteLink`](../src/components/ui/site-link.tsx) (below, Motion).
- DB content is localized via `*_translations` tables, not message files.

## Motion (redesign « Strates »)

Layers: the server renders a **complete** DOM (text, SVG posters, forms);
after hydration, the light bridge
[`src/lib/motion-bridge/**`](../src/lib/motion-bridge/) (store, hooks,
motion preference, capability tier) decides what to load; the heavy engines
live in `src/motion/**` and are reached only through `src/gates/**`
(AGENTS.md, golden rule 11).

- **Boundary.** Never import `gsap`, `@gsap/react`, `lenis`, `three` (or any
  sub-path) outside `src/motion/**`; `import type` from `three` is fine. A
  gate (`src/gates/<package>.tsx`) starts with `"use client"` and only holds
  module-level `dynamic(() => import("@/motion/…"), { ssr: false })`. Outside
  gates and `src/motion`, the string `@/motion` must not appear at all (the
  boundary test parses every file). The heavy side imports the bridge, never
  the reverse. After an OpenNext build, `bun scripts/check-worker-bundle.ts`
  must report 0 engine signature in the Worker.
- **`(site)` only.** `SiteShell` (from `src/app/[locale]/(site)/layout.tsx`)
  loads `MotionRuntime` (GSAP + Lenis) in full motion at capability ≥ C1, and
  `StageRoot` (three) only once a `StageView` registers, at ≥ C1, without a
  lost WebGL context. Pages outside the group (cart, checkout, account, admin,
  OAuth, track, legal) never get Lenis or the canvas; never put Lenis, a
  transform or an animated overflow around a Stripe iframe.
- **Motion preference** = `data-motion="reduce" | "full"` on `<html>`, set
  **before paint** by the anti-FOUC script of the root layout `src/app/layout.tsx` (choice
  stored in `localStorage["s3d-motion"]` by the footer's `MotionToggle`, else
  `prefers-reduced-motion`). Style with the Tailwind variants `motion-on:` /
  `motion-off:`; in JS read `readReducedMotion()` /
  `subscribeMotionPreference()` or `useMotionBridge((s) => s.reduced)`; in a
  React component, `useReducedMotionPreference()`
  (`src/lib/motion-bridge/use-reduced-motion.ts`: `false` on the server and
  during hydration, then the real value), never `useReducedMotion()` from
  `motion/react`, which only reads the OS setting. The `[locale]` layout
  drives `<MotionConfig reducedMotion>` from the same preference
  (`ReducedMotionConfig`).
  `globals.css` already cuts animations, transitions and View Transitions in
  reduced motion; a JS animation (WAAPI, GSAP) must check it itself.
- **Capability** C0–C2 (`src/lib/motion-bridge/tier.ts`) is detected after
  hydration; the server and hydration always render C0 (posters). Never make
  SSR output depend on it: `useMotionBridge` serves the server state during
  hydration.
- **Motion never holds content back.** No `opacity: 0` on SSR content
  waiting for JS, nothing on the `h1`/LCP element, no preloader, no
  `loading.tsx` inside `(site)` (it breaks View Transition pairs). Simple
  reveals are CSS: `.s3d-rise` (text blocks), `.s3d-print` (images, cards,
  8 steps); they only run with `data-motion="full"`.
- **One engine per property.** GSAP (core, ScrollTrigger, `useGSAP` and the
  brand eases via `@/motion/gsap`) for scroll-linked work, timelines and
  WebGL uniforms. `@/motion/gsap` sits in the runtime chunk (≤ 65 KiB gzip):
  a plugin only one choreography needs (SplitText, Flip, DrawSVGPlugin) is
  imported and `gsap.registerPlugin()`-ed **in that choreography**, never
  added there; CSS (`transition`, `@starting-style` / `starting:`,
  `animation-timeline: view()`) for UI. Framer Motion (`motion`) gets **no new
  use** on showcase pages; it stays for the admin (`Reorder`).
- **Stage views.** Render
  [`<StageView scene props poster>`](../src/components/ui/stage-view.tsx):
  a transparent container that covers its whole section, with the SSR poster
  as `.s3d-poster` child; the Stage sets `data-stage-ready="true"` on its first
  frame (the poster fades out) and removes it on context loss. `props` is an
  immutable snapshot (replace it, never mutate). The canvas is `aria-hidden`:
  anything that matters must exist in the DOM too.
- **Page transition « Coupe ».** Every page of `(site)` wraps its content in
  [`<PageCut>`](../src/components/ui/page-cut.tsx) **in its `page.tsx`**, not in
  a layout (a layout persists, enter/exit would never fire). `SiteLink` adds
  the `s3d-coupe` transition type only between two **different** `(site)`
  pages (`isSitePath()`, keep it in sync with the route group) and never in
  reduced motion; the back button carries no type, so nothing animates. The
  fixed chrome is anchored with a `view-transition-name`: `site-header`
  (`globals.css`), `site-bottom-nav`, `site-consent` and the active nav
  underline `nav-mark` (`src/components/ui/page-cut.css`). Names must be
  unique in the document: don't name another element without adding its CSS
  (or it gets covered by the page that prints over it).
- **Server wait.** Links use `prefetch={false}` by default; `SiteLink`
  reports `useLinkStatus()` to the bridge (`navPending`) and the header runs
  its red nozzle (`NavPending`).
- **Scrolling.** When Lenis runs, scroll programmatically through
  `motionBridge.get().scroll?.to(target)` (offset −80 for the 64 px header);
  otherwise jump natively with `behavior: "auto"` in reduced motion. A nested
  scroll container gets `data-lenis-prevent`; drawers and dialogs use
  [`<Drawer>`](../src/components/ui/drawer.tsx) (native `<dialog>` +
  `showModal()`, top layer), which stops Lenis while open. A navigation to a
  new path lands at `scrollY = 0` (Next scrolls up, `MotionRuntime.onRoute()`
  makes ScrollTrigger forget the pre-navigation position it would otherwise
  restore at every `refresh()`); the back button keeps native restoration.
- **No stepped animation.** Nothing on the site advances in `steps()` (owner
  decision of 07.10.2026, R06/R07): use `var(--ease-strate)` / `s3d.strate`.
  The layers idea may live in a **static** detail, never in a timing. The
  `s3d.pas` GSAP ease survives only as an alias of `s3d.strate`.
- **Stage canvas and native scroll.** With Lenis (wheel, trackpad) the DOM and
  the canvas share one frame (measured ≤ 0.6 px apart). Native scroll
  (touch, keyboard, scrollbar) is moved by the compositor ahead of the main
  thread, so a `fixed` canvas lags 1–2 frames behind its container. At C1
  `StageRoot` therefore anchors the canvas to the document (absolute wrapper
  clipped to the page height, canvas two windows tall, recentred each frame by
  the loop: `CanvasAnchor` in `stage/ticker.ts`); `ViewTracker.rect()` returns
  canvas-relative rectangles, so scenes and `stage.ts` don't know. A `liveRect`
  view (sticky or pinned) turns it back into a fixed canvas. Don't read a
  view's rect from outside the tracker.
- **Stacking** (z-index): Stage canvas −1 (portaled into `<body>`), content
  `auto`, favorite on a card 10, menus 20, chapter rail 30, header 40, consent
  banner 40, mobile Studio bar 45, BottomNav and skip links 50, toasts 55,
  drawers and dialogs in the top layer. The header stays 64 px tall
  (`top-16`, `top-24`, `scroll-mt-32` offsets rely on it); the BottomNav is
  64 px + safe area under `lg`.

## Design tokens (redesign « Strates »)

- **Token names are a contract** used by ~116 files (admin included):
  `paper`, `surface`, `elevated`, `ink`, `soft`, `line`, `accent`,
  `accent-dark`, `accent-text`, `on-accent`, `iso`, `iso-index`, `glacier`,
  `swatch-ring`, `night*`. Values live in
  [`src/app/globals.css`](../src/app/globals.css) (light, `.dark`,
  `[data-tone="ink"]`); never hardcode a hex in a component.
- **Red is heat, not decoration.** `accent` (`#E5231C`) is for graphics only
  (buttons, dots, pills, progress, text ≥ 24 px); any red text under 24 px is
  `text-accent-text` (≥ 5.4:1 on every background). **One `primary` (red)
  button per screen**; other actions are `secondary` (ink outline), `ink`,
  `ghost` or `text` ([`Button`](../src/components/ui/button.tsx)). White on
  red is 4.58:1: keep it ≥ 15 px, weight 600.
- **Ink chapter**: `data-tone="ink"` on a section redefines the tokens
  locally; in dark theme it becomes `elevated` with a red rule, never a white
  flash.
- **Type**: `font-display` (Archivo SemiExpanded, headings; never animate its
  width or variation axes), `font-sans` (Geist: UI, the wordmark, and the
  Stripe iframes — unchanged), `font-mono` (Geist Mono: telemetry, labels,
  12 px minimum). Scale utilities `text-hero` (home h1 only), `text-display`
  (other h1, chapter h2), `text-title`, `text-subtitle`, `text-lead`,
  `text-label`; German gets smaller `hero`/`display` and hyphenation from
  `globals.css`. `.s3d-label` = mono, uppercase, +0.06em, tabular figures;
  add `normal-case` where it carries a unit (« 0,2 mm », never « MM »). A
  display title ending with « . » gets the red dot via
  [`DotTitle` / `withDot()`](../src/components/ui/dot-title.tsx) (the period
  stays in the text).
- **Numbers** are always formatted with ``Intl.NumberFormat(`${locale}-CH`)``
  (`formatChf`, [`Num`](../src/components/ui/mono.tsx), the Studio helpers):
  a displayed figure is computed, never decorative, real unit first.
- **Layout**: `.s3d-page` (max 90rem, fluid margins), `.s3d-grid` (4/8/12
  columns), spacing tokens `gutter`, `margin`, `section` (`py-section`).
  Radii: `rounded-hair` 2 px (tags), `rounded-field` 4 px (fields, buttons),
  `rounded-card` 6 px, `rounded-sheet` 14 px (mobile drawer top);
  `rounded-full` only for pills, dots, avatars and the Studio disc. Hairlines
  (`line`) on editorial chapters, spec tables and the footer, never as a grid
  around forms, cart, checkout or account.
- **Motion tokens**: easings `ease-strate` (UI, reveals), `ease-buse`
  (camera, nozzle), `ease-purge` (slight overshoot: pills, add to cart),
  `ease-carte` (big state changes); durations `--dur-micro` 150 ms,
  `--dur-ui` 280 ms, `--dur-reveal` 800 ms, `--dur-chapter` 1400 ms,
  `--dur-page` 480 ms.
- **`globals.css` is frozen after WP-00.** Package styles go in colocated
  CSS Modules (`*.module.css`). Beware: the few rules written outside
  `@layer` there (`.s3d-pending`, `.s3d-progress`, `.s3d-stage`) beat every
  Tailwind utility; render a different element instead of trying to override
  them.
- Reuse the primitives of [`src/components/ui/`](../src/components/ui/)
  (`Button`/`ButtonLink`, `Chip`/`ChipRadio` on native radios,
  `Field`/`fieldClass`, `SpecTable`, `MeasureStrip`, `Ruler`, `MapFrame`,
  `Chapter`/`ChapterRail`, `Drawer`, `Toast`, `StageView`, icons) before
  writing a new one.

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
  `app/robots.txt/route.ts`.
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
  `robots.txt/route.ts` and canonicalised to `/shop`; don't add a new filter parameter
  without adding its `Disallow`.
- **Product availability** in JSON-LD is `InStock` / `OutOfStock` only:
  `MadeToOrder` is valid schema.org but rejected by Google merchant listings —
  printed-to-order pieces are `InStock` with a longer `handlingTime`.
- **IndexNow**: any admin action that creates, renames, deletes, publishes or
  sells out a product calls `notifyIndexNow()`
  ([`src/lib/indexnow.ts`](../src/lib/indexnow.ts), Bing/Yandex/Seznam…). The
  key file `public/867cd9af686842c88e46c3f656218246.txt` must stay deployed.

## Analytics (PostHog, EU, Swiss opt-out regime)

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
  never leaves. The visitor IP goes as `x-forwarded-for`; the project discards
  it (`anonymize_ips`). `Origin`/`Referer` are set to the site origin only:
  PostHog needs them to match the project's recording domains, and without
  them session replay silently stays disabled.
- **Location** comes from Cloudflare (`cf` → `data-geo-*` on `<html>`, set in
  the root layout `src/app/layout.tsx`) with `$geoip_disable`, so there is one source and the
  IP never needs to be kept.
- **Swiss opt-out regime (art. 45c LTC, nLPD), not EU opt-in.** The target
  market is Switzerland, so GDPR-style prior consent is deliberately not
  implemented. Measurement, the `ph_…` cookie and session replay run from the
  first page view. [`<ConsentBanner>`](../src/components/consent-banner.tsx)
  informs the visitor. "OK" closes it; "Refuser" (and the privacy-page button)
  call `setAnalyticsOptOut(true)`, which runs `opt_out_capturing()`, clears
  PostHog storage (`opt_out_persistence_by_default`), and makes `before_send`
  drop everything. The choice lives in `localStorage["s3d-consent"]`. No
  `identify()`: visitors stay random IDs, which keeps the "no profiling"
  statement of the privacy policy true.
- **Personal data on screen** (an email, an address) gets the `ph-mask`
  class, so it is masked in replays; inputs are always masked. `/account` and
  `/track` are excluded from recording in the project settings. Network request
  bodies and headers are never recorded: `recordBody`/`recordHeaders` are
  `false` in `posthogConfig()`, and an explicit `false` overrides the project
  setting even if someone enables it.
- **`defaults` tracks the newest posthog-js preset.** A test in
  `analytics.test.ts` fails when a posthog-js update ships a newer date. Read
  what it changes (the `defaults` doc in `@posthog/types`,
  `posthog-config.d.ts`), then bump it in `posthogConfig()`, keeping the
  privacy overrides above.
- **Attribution:** AI assistants are a custom channel type ("AI") in the
  PostHog project (referring domain or `utm_source`). ChatGPT adds
  `utm_source=chatgpt.com` to its links; Claude, Perplexity and Gemini only
  send a referrer. Site links in customer e-mails go through `withUtm()`
  (`lib/email-templates.ts`: `utm_medium=email`, campaign per e-mail type).
  Never put UTM on authentication links.

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
- TypeScript **6** strict: TypeScript 7.0 doesn't export the classic
  compiler API, which `next build` itself needs — revisit once a 7.x release
  ships a JS API again. Prefer the `@/…` import alias over deep relative paths.
- Lint + format = **Oxlint** (`.oxlintrc.json`) + **Oxfmt** (`.oxfmtrc.json`).
  Run `bun run lint` before finishing;
  `bun run format` to auto-fix style. Suppress a rule with
  `// oxlint-disable`/`oxlint-enable <bare-rule-name> -- reason` bracketing
  the block — bare rule name, no plugin prefix.

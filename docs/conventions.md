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
export async function saveSettings(_prev: State, formData: FormData): Promise<State> {
  await requireAdmin();
  if (!valid) return { error: "Valeurs invalides." };
  // …write…
  revalidatePath("/", "layout");
  return { saved: true };           // ← no redirect()
}
```

```tsx
// client component
const [state, action] = useActionState(saveSettings, {});
const router = useRouter();
useEffect(() => { if (state.saved) router.push("/admin"); }, [state.saved]);
```

Actions return `{ saved }` / `{ success }` / `{ error }`; the client reacts and
calls `router.push()` / `router.refresh()`. Mutations call `revalidatePath()` to
refresh RSC data.

## Data access

Always per-request, inside the handler:

```ts
import { getDb } from "@/db";
const db = await getDb();                 // Drizzle on env.DB (D1)
```

- Schema is the single source of truth: [`src/db/schema.ts`](../src/db/schema.ts).
  After editing it, run `npm run db:generate`, then `npm run db:migrate:local`.
- **Never hand-edit a file in `drizzle/`** and never edit an already-applied
  migration. Prod migrations apply automatically on deploy.
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
const claimed = await db.update(orders)
  .set({ status: "paid" })
  .where(and(eq(orders.id, id), ne(orders.status, "paid")))   // claim once
  .returning({ id: orders.id });
if (claimed.length === 0) return;                              // already done
```

Stock decrement is atomic with a `gte(stock, qty)` guard to prevent oversell on
concurrent orders. Side effects that can fail (emails) are wrapped in try/catch so
they never fail a captured payment.

## Auth & authorization

```ts
import { requireAdmin, getServerSession } from "@/lib/session";
await requireAdmin();                 // throws "unauthorized" if not admin
const session = await getServerSession();   // or null
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
  return tooManyRequests();           // 429
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

## CSP nonce contract (prod only)

In production every inline `<script>` must carry the per-request nonce or it's
blocked. The middleware injects it as the `x-nonce` request header; read it in a
Server Component:

```tsx
import { headers } from "next/headers";
const nonce = (await headers()).get("x-nonce") ?? undefined;
// pass nonce={nonce} to NextIntlClientProvider / any inline <script>
```

`npm run dev` relaxes CSP (HMR needs inline+eval), so a missing nonce is invisible
in dev. **Always verify CSP-affecting changes with `npm run preview`** (real
Workers runtime + prod CSP).

## Environment & secrets

- **Secrets** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BETTER_AUTH_SECRET`,
  `RESEND_API_KEY`, `GOOGLE_*`, `CRON_SECRET`, …): local in `.dev.vars` (gitignored),
  prod via `wrangler secret put` / dashboard. **Never commit them.**
- **Public** keys only in committed `.env.development` (Stripe **test**) and
  `.env.production` (Stripe **live**) — just `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
  inlined at build.
- **Non-secret vars** (`BETTER_AUTH_URL`, `ADMIN_EMAILS`, `EMAIL_FROM`) live in
  `wrangler.jsonc`. After editing bindings/vars there, run `npm run cf-typegen`.

## Swiss specifics

- **Shipping CH only** — validate the address country server-side; NPA = 4 digits.
- Single national shipping tariff + free over a threshold, both in `settings`.
- Email replies land on the Infomaniak alias `contact@swiss3design.ch`; outgoing
  mail is sent from `EMAIL_FROM` via Resend.

## Style

- **Comments and user-facing copy in French**; code identifiers in English.
- Keep the existing dense, explanatory comment style: explain the *why* (the Workers
  constraint, the idempotency reason, the nLPD rule), not the obvious *what*.
- TypeScript strict; prefer the `@/…` import alias over deep relative paths.
- Run `npm run lint` before finishing.

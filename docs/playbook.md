# Playbook — working with Claude on Swiss3Design

How to get fast, correct results from an AI agent on this repo. Pairs with
[`AGENTS.md`](../AGENTS.md) (rules), [`architecture.md`](architecture.md) (how it
works) and [`conventions.md`](conventions.md) (how to write code here).

## How to ask for the best result

- **State the goal + done-criteria**, not the implementation. "Customers should
  pick a gift-wrap option at checkout (+5 CHF), shown on the order and the admin
  detail" beats "add a field".
- **Point at an anchor** when you know one ("like the discount-code flow"). The
  agent already has the file map in `AGENTS.md`.
- **Name the surface**: which locales, admin vs storefront, dev vs prod.
- You don't need to paste conventions — the agent reads `AGENTS.md` + `docs/`
  automatically. Do flag anything *not* in those docs.

## The standing workflow (what the agent does by default)

1. Reads `AGENTS.md` / relevant `docs/` + the touched source files.
2. Implements, matching existing style (French comments, English identifiers).
3. Runs `npm run lint`; runs `npm run preview` when the change touches CSP, inline
   scripts, runtime, or anything prod-only.
4. **Pushes to `main`** (this triggers the Cloudflare deploy) and starts
   `npm run dev` so Thomas tests in his own browser. No automated browser checks.

If you do **not** want an auto-push (e.g. risky change), say so up front.

## Golden rules (full list in [`AGENTS.md`](../AGENTS.md))

Never `redirect()` from a Server Action · keep `middleware.ts` (Edge), never
`proxy.ts` · no Turbopack in the prod build · CSP nonce is prod-only (test with
`npm run preview`) · money is integer centimes CHF · bindings only inside a
request · never commit secrets · translate every UI string (fr/de/it/en).

## Task recipes

### Add / change a product field
1. Edit [`src/db/schema.ts`](../src/db/schema.ts) (`products` or a related table).
2. `npm run db:generate` → review the new file in `drizzle/` (never hand-edit it).
3. `npm run db:migrate:local`.
4. Wire it through the admin form + action
   (`src/app/[locale]/admin/products/product-form.tsx` + `actions.ts`).
5. Display it on the storefront (`product-card`, `products/[slug]`).
6. If it's user-visible text, add keys to all four `messages/*.json`.
7. Prod migration applies automatically on deploy.

### Add a UI string
Add the key to **all four** `messages/{fr,de,it,en}.json`; read it with
`next-intl` (`useTranslations` / `getTranslations`). Never hardcode.

### Add an API route
Under `src/app/api/**`. Inside the handler: `const db = await getDb()`, gate with
`requireAdmin()` if admin-only, and `rateLimit(request, "<route>", {limit, windowS})`
on anything abusable (email, upload). Return `Response.json(...)`.

### Touch a payment flow
Keep finalization **idempotent** — both the Stripe webhook and the success/return
page call `markOrderPaid` / `markQuotePaid`. Use the conditional `UPDATE` claim
pattern; never assume a single call. Stripe is **LIVE in prod**.

### Add an admin action
`"use server"`, call `await requireAdmin()` first, return a state object
(`{ saved }` / `{ error }`) — **never `redirect()`**; navigate client-side. Call
`revalidatePath()` after a mutation.

### "It works in dev but breaks in prod"
Almost always the **CSP nonce** (inline script without `x-nonce`) — invisible in
`npm run dev`. Reproduce with `npm run preview`, then pass `nonce={...}` from
`(await headers()).get("x-nonce")`. See [conventions.md](conventions.md).

## Don't ask the agent to (without saying so explicitly)

- Force-push, or push when you wanted to review first.
- Run `npm run deploy` / `db:migrate:remote` by hand (prod is automatic on push).
- Edit an already-applied migration in `drizzle/`.
- Hardcode UI text, or commit a secret.

## Prompt templates

**Feature**
> Goal: <user outcome>. Surface: <storefront/admin, locales>. Done when:
> <observable criteria>. Anchor: like <existing flow> if relevant.

**Bug**
> Symptom: <what happens> on <page/flow>, <dev or prod>. Expected: <…>.
> Repro: <steps>. (If prod-only, suspect CSP/nonce — check `npm run preview`.)

**Refactor**
> Refactor <area> for <reason>. Keep behaviour identical. Don't touch <X>.
> Verify with `npm run lint` (+ `npm run preview` if runtime-affecting).

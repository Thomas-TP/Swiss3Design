# Code map — localiser le code sans fouiller

> **Lis ce fichier AVANT de `grep`/`glob` ou d'ouvrir des fichiers au hasard.**
> Il fait le pont « je dois faire X » → fichier(s) exact(s). But : qu'un agent
> trouve le bon fichier en **une** lecture, pas en explorant dix.
>
> Règles & contraintes : [`AGENTS.md`](../AGENTS.md). Comment c'est câblé :
> [`architecture.md`](architecture.md). Comment écrire le code : [`conventions.md`](conventions.md).
> Ce fichier-ci est **uniquement de la navigation**.

## Conventions de nommage (un seul Glob suffit)

| Tu cherches… | Chemin |
| --- | --- |
| Une page | `src/app/[locale]/<route>/page.tsx` |
| Les Server Actions d'une route | `src/app/[locale]/<route>/actions.ts` (`"use server"`) |
| Le formulaire client d'une route | `src/app/[locale]/<route>/*-form.tsx` |
| Une route API | `src/app/api/<nom>/route.ts` |
| Un composant partagé | `src/components/<kebab-case>.tsx` |
| La logique métier | `src/lib/<domaine>.ts` |
| Le schéma DB (source de vérité) | `src/db/schema.ts` |
| Les requêtes de lecture | `src/db/queries.ts` |
| Les textes UI | `messages/{fr,de,it,en}.json` (fr = fallback) |

Le panneau admin suit le même schéma sous `src/app/[locale]/admin/<section>/`
(`page.tsx` + `actions.ts` + `*-form.tsx`/`*-manager.tsx`).

## `src/lib` — logique métier (1 ligne chacun)

| Fichier | Rôle | Exports clés |
| --- | --- | --- |
| `auth.ts` | Instance Better Auth par requête (adapter Drizzle/D1) | `getAuth()` |
| `auth-client.ts` | Client Better Auth (côté navigateur) | `authClient` |
| `session.ts` | Garde d'autorisation | `requireAdmin()`, `getServerSession()` |
| `cart.tsx` | Panier client (localStorage `s3d-cart-v1`) | `CartProvider`, `useCart()` |
| `favorites.tsx` | Favoris client | `FavoritesProvider`, `useFavorites()` |
| `orders.ts` | Finalisation paiement **idempotente** | `markOrderPaid()`, `markQuotePaid()` |
| `discounts.ts` | Validation & calcul des codes promo | — |
| `shipping.ts` | Frais de port CH + seuil gratuité | `FREE_SHIPPING_OVER_CENTS` |
| `stripe.ts` | Instance Stripe (serveur) | — |
| `stripe-appearance.ts` | Thème visuel du Payment Element | — |
| `format.ts` | Formatage CHF/locale (jamais `toFixed` à la main) | `formatChf()` |
| `rate-limit.ts` | Fenêtre fixe KV par IP+route | `rateLimit()`, `tooManyRequests()` |
| `email.ts` | Envoi via Resend (no-op si pas de clé) | — |
| `email-templates.ts` | Gabarits HTML d'e-mails (4 langues) — **gros, surtout du texte** | — |
| `email-proof.ts` | Aperçu d'e-mails pour `/admin/emails` | — |
| `maintenance.ts` | Mode maintenance | — |
| `theme.ts` | Constantes/aides de thème (clair/sombre) | — |

## `src/db` & `src/i18n`

| Fichier | Rôle |
| --- | --- |
| `db/index.ts` | `getDb()` — Drizzle sur `env.DB` (par requête) |
| `db/queries.ts` | Requêtes lecture : `getProducts()`, `getProductBySlug()`, … |
| `db/schema.ts` | Schéma Drizzle = **source de vérité** (catalogue, commandes, devis, auth) |
| `i18n/routing.ts` | `locales`, locale par défaut, config routing |
| `i18n/navigation.ts` | `Link`, `redirect`, `useRouter` **localisés** (à utiliser au lieu de `next/*`) |
| `i18n/request.ts` | Config requête next-intl |

## Routes API (`src/app/api`)

| Route | Rôle |
| --- | --- |
| `checkout/route.ts` | Valide panier+adresse CH, crée la commande `pending` + PaymentIntent |
| `stripe/webhook/route.ts` | Webhook signé → finalise (idempotent avec la page de retour) |
| `quote-checkout/route.ts` | PaymentIntent dédié au paiement d'un devis |
| `quote-upload/route.ts` | Upload STL/3MF client → R2 |
| `discount/validate/route.ts` | Validation live d'un code promo |
| `track-order/route.ts` | Suivi commande invité (page `/track`) |
| `files/[...path]/route.ts` | Sert un fichier R2 (privé) |
| `admin/files/[...path]/route.ts` · `admin/upload/route.ts` | R2 côté admin (gardé) |
| `auth/[...all]/route.ts` | Handler Better Auth |
| `cron/maintenance/route.ts` | Purge R2 orphelins (bearer `CRON_SECRET`) |
| `csp-report/route.ts` | Réception des violations CSP |

## « Je dois… » → où commencer

| Tâche | Point d'entrée |
| --- | --- |
| Ajouter/modifier un champ produit | `db/schema.ts` → `db/generate` → admin `products/product-form.tsx` + `actions.ts` → affichage `products/[slug]/page.tsx` + `components/product-card.tsx` |
| Toucher au tunnel de paiement | `app/[locale]/checkout/checkout-flow.tsx` + `api/checkout/route.ts` + `lib/orders.ts` (idempotence) |
| Toucher aux devis | `app/[locale]/custom/` + `api/quote-*` + admin `quotes/` + `lib/orders.ts` |
| Modifier les frais de port | `lib/shipping.ts` + admin `settings/` |
| Ajouter un code promo / une règle | `lib/discounts.ts` + admin `discounts/` + `api/discount/validate` |
| Changer un e-mail | `lib/email-templates.ts` (+ `email.ts` pour l'envoi) |
| Ajouter une chaîne UI | les 4 `messages/*.json` (cherche la clé dans `fr.json`, recopie partout) |
| Sécurité / en-têtes / CSP nonce | `src/middleware.ts` |
| Auth / rôle admin | `lib/auth.ts` + `lib/session.ts` |

## Gros fichiers — **ne pas lire en entier** sauf si tu édites le contenu

Surtout du texte/markup statique : lis par plage ciblée plutôt qu'en entier.

| Fichier | Lignes | Nature |
| --- | --- | --- |
| `a-propos/about-content.tsx` | ~990 | Copie marketing |
| `checkout/checkout-flow.tsx` | ~950 | Composant client du tunnel Stripe |
| `lib/email-templates.ts` | ~880 | Gabarits HTML d'e-mails (4 langues) |
| `legal/terms/content.tsx` · `legal/privacy/content.tsx` | ~760 / ~545 | Copie légale |
| `admin/products/product-form.tsx` | ~610 | Formulaire produit (le plus dense de l'admin) |

## Ce qu'il ne faut pas ouvrir pour comprendre le projet

- `package-lock.json` (~500 Ko), `drizzle/` (migrations générées), `cloudflare-env.d.ts`
  (généré par `cf-typegen`), `public/brand/**` (binaires). Aucune logique à y lire.

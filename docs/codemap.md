# Code map — localiser le code sans fouiller

> **Lis ce fichier AVANT de `grep`/`glob` ou d'ouvrir des fichiers au hasard.**
> Il fait le pont « je dois faire X » → fichier(s) exact(s). But : qu'un agent
> trouve le bon fichier en **une** lecture, pas en explorant dix.
>
> Règles & contraintes : [`AGENTS.md`](../AGENTS.md). Comment c'est câblé :
> [`architecture.md`](architecture.md). Comment écrire le code : [`conventions.md`](conventions.md).
> Ce fichier-ci est **uniquement de la navigation**.

## Conventions de nommage (un seul Glob suffit)

| Tu cherches…                     | Chemin                                                    |
| -------------------------------- | --------------------------------------------------------- |
| Une page                         | `src/app/[locale]/<route>/page.tsx`                       |
| Les Server Actions d'une route   | `src/app/[locale]/<route>/actions.ts` (`"use server"`)    |
| Le formulaire client d'une route | `src/app/[locale]/<route>/*-form.tsx`                     |
| Une route API                    | `src/app/api/<nom>/route.ts`                              |
| Un composant partagé             | `src/components/<kebab-case>.tsx`                         |
| La logique métier                | `src/lib/<domaine>.ts`                                    |
| Le schéma DB (source de vérité)  | `src/db/schema.pg.ts` (`schema.ts` n'est qu'un re-export) |
| Les requêtes de lecture          | `src/db/queries.ts`                                       |
| Les textes UI                    | `messages/{fr,de,it,en}.json` (fr = fallback)             |

Le panneau admin suit le même schéma sous `src/app/[locale]/admin/<section>/`
(`page.tsx` + `actions.ts` + `*-form.tsx`/`*-manager.tsx`).

## `src/lib` — logique métier (1 ligne chacun)

| Fichier                | Rôle                                                                                | Exports clés                                                   |
| ---------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `auth.ts`              | Instance Better Auth par requête (adapter Drizzle/Postgres, driver-agnostic)        | `getAuth()`                                                    |
| `auth-client.ts`       | Client Better Auth (côté navigateur)                                                | `authClient`                                                   |
| `session.ts`           | Garde d'autorisation                                                                | `requireAdmin()`, `getServerSession()`                         |
| `cart.tsx`             | Panier client (localStorage `s3d-cart-v1`)                                          | `CartProvider`, `useCart()`                                    |
| `favorites.tsx`        | Favoris client                                                                      | `FavoritesProvider`, `useFavorites()`                          |
| `orders.ts`            | Finalisation paiement **idempotente**                                               | `markOrderPaid()`, `markQuotePaid()`                           |
| `discounts.ts`         | Validation & calcul des codes promo                                                 | —                                                              |
| `shipping.ts`          | Frais de port CH + seuil gratuité                                                   | `FREE_SHIPPING_OVER_CENTS`                                     |
| `stripe.ts`            | Instance Stripe (serveur)                                                           | —                                                              |
| `stripe-appearance.ts` | Thème visuel du Payment Element                                                     | —                                                              |
| `format.ts`            | Formatage CHF/locale (jamais `toFixed` à la main)                                   | `formatChf()`                                                  |
| `rate-limit.ts`        | Compteur atomique Postgres par IP hachée + route                                    | `rateLimit()`, `tooManyRequests()`                             |
| `status-history.ts`    | Journal transactionnel des transitions commande/devis                               | `recordStatusTransition()`                                     |
| `email.ts`             | Envoi via Resend (no-op si pas de clé)                                              | —                                                              |
| `email-templates.ts`   | Gabarits HTML d'e-mails (4 langues) — **gros, surtout du texte**                    | —                                                              |
| `email-proof.ts`       | Aperçu d'e-mails pour `/admin/emails`                                               | —                                                              |
| `maintenance.ts`       | Mode maintenance                                                                    | —                                                              |
| `theme.ts`             | Constantes/aides de thème (clair/sombre)                                            | —                                                              |
| `seo.ts`               | Métadonnées complètes par page (canonical, hreflang, OG) + tous les JSON-LD         | `pageMetadata()`, `NOINDEX`, `siteJsonLd()`, `productJsonLd()` |
| `indexnow.ts`          | Notifie IndexNow (Bing, Yandex…) des URL produit modifiées — fire-and-forget        | `notifyIndexNow()`                                             |
| `analytics.ts`         | Mesure d'audience PostHog : file d'attente, nettoyage des données, props e-commerce | `track()`, `productProperties()`, `sanitizeEvent()`            |
| `analytics-config.ts`  | Constantes PostHog partagées middleware/navigateur (relais, hôtes UE)               | `ANALYTICS_RELAY_PATH`                                         |
| `cf-image.ts`          | URL image Cloudflare Transformations (`/cdn-cgi/image`, prod only)                  | `cfImage()`                                                    |
| `cantons.ts`           | Les 26 cantons suisses (code + nom), partagé checkout/carnet d'adresses             | `CANTONS`                                                      |
| `stripe-customer.ts`   | Identité Stripe client, créée paresseusement au 1er checkout connecté               | `getOrCreateStripeCustomer()`                                  |
| `newsletter.ts`        | Destinataires + jeton HMAC de désabonnement pour les annonces                       | —                                                              |
| `session-groups.ts`    | Regroupe les sessions Better Auth par appareil (écran « Sessions »)                 | —                                                              |
| `user-agent.ts`        | Lecture indicative du user-agent (« Chrome sur Windows »)                           | `describeUserAgent()`                                          |

## `src/db` & `src/i18n`

| Fichier                              | Rôle                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `db/index.ts`                        | `getDb()` — Drizzle sur `env.HYPERDRIVE` (Postgres, par requête) ; re-export de `index.pg.ts`                                                                |
| `db/queries.ts`                      | Requêtes lecture : `getProducts()`, `getProductBySlug()`, …                                                                                                  |
| `db/schema.pg.ts`                    | Schéma Drizzle = **source de vérité** (catalogue, commandes, devis, auth) — `schema.ts` n'en est qu'un re-export, tous les appelants importent `@/db/schema` |
| `db/schema.d1.ts` / `db/index.d1.ts` | Filet de secours D1/SQLite (inactif) — ne pas modifier sans raison de rollback                                                                               |
| `i18n/routing.ts`                    | `locales`, locale par défaut, config routing                                                                                                                 |
| `i18n/navigation.ts`                 | `Link`, `redirect`, `useRouter` **localisés** (à utiliser au lieu de `next/*`)                                                                               |
| `i18n/request.ts`                    | Config requête next-intl                                                                                                                                     |

## Routes API (`src/app/api`)

| Route                                                           | Rôle                                                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `checkout/route.ts`                                             | Valide panier+adresse CH, réserve le stock et reprend une Checkout Session idempotente |
| `stripe/webhook/route.ts`                                       | Webhook signé → finalise (idempotent avec la page de retour)                           |
| `quote-checkout/route.ts`                                       | Checkout Session liée à la version d'offre du devis                                    |
| `quote-upload/route.ts`                                         | Upload STL/3MF client → R2                                                             |
| `discount/validate/route.ts`                                    | Validation live d'un code promo                                                        |
| `track-order/route.ts`                                          | Suivi commande invité (page `/track`)                                                  |
| `files/[...path]/route.ts`                                      | Sert un fichier R2 (privé)                                                             |
| `admin/files/[...path]/route.ts` · `admin/upload/route.ts`      | R2 côté admin (gardé)                                                                  |
| `auth/[...all]/route.ts`                                        | Handler Better Auth                                                                    |
| `cron/maintenance/route.ts`                                     | Purge R2 orphelins (bearer `CRON_SECRET`)                                              |
| `csp-report/route.ts`                                           | Réception des violations CSP                                                           |
| `cart-reminder/route.ts` · `cart-reminder/unsubscribe/route.ts` | Opt-in relance panier (nLPD) + désinscription par token                                |
| `admin/model-upload/route.ts`                                   | Upload d'un modèle 3D (.stl/.glb) → R2                                                 |
| `checkout/verify-email/route.ts`                                | Vérification e-mail pour un checkout invité                                            |
| `newsletter/unsubscribe/route.ts`                               | Désinscription 1 clic aux annonces newsletter (jeton HMAC)                             |

## Surfaces agents IA (`src/lib/agent`)

| Fichier / route                                  | Rôle                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `lib/agent/paths.ts` · `config.ts`               | Chemins (sans dépendance, lus par le middleware), boutique, CORS public                   |
| `lib/agent/tools.ts`                             | Outils publics (zod → JSON Schema) partagés MCP / A2A / REST                              |
| `lib/agent/mcp.ts` · `app/mcp/route.ts`          | Serveur MCP public (Streamable HTTP sans état)                                            |
| `lib/agent/a2a.ts` · `app/a2a/route.ts`          | Agent A2A (cartes v0.3 + v1.0)                                                            |
| `lib/agent/discovery.ts` · `app/.well-known/*`   | Catalogue d'API (RFC 9727), carte MCP, ARD, index de skills                               |
| `lib/agent/oauth.ts`                             | Serveur OAuth des agents : émetteur, portées, ressources protégées (RFC 9728), défi 401   |
| `lib/auth.ts` (plugins `jwt` + `oauthProvider`)  | OAuth 2.1 + OIDC : DCR ouvert, PKCE, consentement, jetons RS256                           |
| `lib/agent/agent-auth.ts` · `agent-auth-core.ts` | Profil auth.md : `/api/auth/agent/identity`, grants jwt-bearer + claim, bloc `agent_auth` |
| `lib/agent/account-mcp.ts` · `account-tools.ts`  | Serveur MCP compte client `/mcp/account` : vérif. du jeton, révocation immédiate, outils  |
| `app/[locale]/oauth/consent/` · `agent/claim/`   | Pages de consentement OAuth et de saisie du code d'un agent auth.md                       |
| `app/[locale]/account/(dashboard)/agents/`       | « Agents IA » : liste et retrait des accès (consentements, agents revendiqués)            |
| `lib/agent/auth-md.ts` · `app/auth.md/route.ts`  | Document `/auth.md` généré depuis les mêmes constantes                                    |
| `lib/agent/markdown.ts` · `api/agent/markdown`   | Négociation `Accept: text/markdown` (Workers AI `toMarkdown`)                             |
| `components/webmcp-tools.tsx`                    | Outils WebMCP enregistrés dans le navigateur                                              |
| `lib/web-bot-auth.ts`                            | Web Bot Auth : répertoire JWKS signé + requêtes IndexNow signées (RFC 9421)               |

## Commerce agentique (`src/lib/commerce`)

| Fichier / route                            | Rôle                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `lib/commerce/catalog.ts`                  | SKU vendables (produit × variante × couleur), identifiants stables, images JPEG             |
| `lib/commerce/feed.ts`                     | Flux CSV Stripe (produits, stock, prix) — port, délai, taxe, avertissement CGV              |
| `lib/commerce/stripe-catalog.ts`           | Envoi du flux (Product Catalog Import API v2) : cron quotidien/horaire + après modification |
| `lib/commerce/acs.ts`                      | Stripe Agentic Commerce : hooks (validation, port, prix/stock) + session payée → commande   |
| `lib/commerce/agent-orders.ts`             | Enregistrement d'une commande d'agent déjà payée (idempotent, alertes admin, e-mails)       |
| `app/api/stripe/agentic-commerce/`         | Endpoint des hooks Stripe (signé `STRIPE_ACS_HOOK_SECRET`, réponse < 4 s)                   |
| `lib/commerce/checkout-core.ts`            | Nos API d'achat : articles, devis, adresse suisse, commande en attente, paiement par SPT    |
| `lib/commerce/mpp.ts` · `api/v1/purchases` | MPP : défi 402 HMAC, preuve `Authorization: Payment`, reçu                                  |
| `lib/commerce/agent-checkout.ts`           | Sessions de checkout ACP/UCP (état en base, recalcul, finalisation, purge)                  |
| `lib/commerce/acp-*.ts` · `api/acp/`       | ACP 2026-04-17 (+ `/.well-known/acp.json`), idempotence KV                                  |
| `lib/commerce/ucp-*.ts` · `api/ucp/`       | UCP 2026-08-25 (+ `/.well-known/ucp`, handler `ch.swiss3design.stripe_spt`)                 |

## « Je dois… » → où commencer

| Tâche                                  | Point d'entrée                                                                                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ajouter/modifier un champ produit      | `db/schema.pg.ts` → `bun run db:generate:pg` + `db:push:pg` → admin `products/product-form.tsx` + `actions.ts` → affichage `products/[slug]/page.tsx` + `components/product-card.tsx`                       |
| Toucher au tunnel de paiement          | `app/[locale]/checkout/checkout-flow.tsx` + `api/checkout/route.ts` + `lib/orders.ts` (idempotence)                                                                                                         |
| Toucher aux devis                      | `app/[locale]/custom/` + `api/quote-*` + admin `quotes/` + `lib/orders.ts`                                                                                                                                  |
| Modifier les frais de port             | `lib/shipping.ts` + admin `settings/`                                                                                                                                                                       |
| Ajouter un code promo / une règle      | `lib/discounts.ts` + admin `discounts/` + `api/discount/validate`                                                                                                                                           |
| Changer un e-mail                      | `lib/email-templates.ts` (+ `email.ts` pour l'envoi)                                                                                                                                                        |
| Ajouter une chaîne UI                  | les 4 `messages/*.json` (cherche la clé dans `fr.json`, recopie partout)                                                                                                                                    |
| Sécurité / en-têtes / CSP nonce        | `src/middleware.ts`                                                                                                                                                                                         |
| Auth / rôle admin                      | `lib/auth.ts` + `lib/session.ts`                                                                                                                                                                            |
| Toucher aux avis                       | `db/schema.pg.ts` (`reviews`) + `account/orders/[id]/` (dépôt, livré) + `admin/reviews/` (modération) + `products/[slug]` (affichage)                                                                       |
| Viewer 3D produit                      | `components/product-viewer-3d.tsx` + `api/admin/model-upload` + champ `products.model3dUrl`                                                                                                                 |
| Recherche / produits liés              | `db/queries.ts` (`getProducts` param `q`, `getRelatedProducts`) + `shop/page.tsx`                                                                                                                           |
| SEO d'une page                         | `generateMetadata` → `pageMetadata()` (`lib/seo.ts`) · JSON-LD via `components/json-ld.tsx` · `app/sitemap.xml/route.ts` · `app/robots.ts` · `app/llms.txt/route.ts` · textes `seo.*` des `messages/*.json` |
| Tâches planifiées (purge R2, relances) | `lib/maintenance.ts` + `api/cron/maintenance` ← déclenché par `workers/cron` (Worker Cron horaire, déployé à part)                                                                                          |
| Mesure d'audience (PostHog)            | `lib/analytics.ts` (`track()`) · chargement `src/instrumentation-client.ts` · relais `/api/relay` dans `middleware.ts` · `components/track-event.tsx` · refus : `components/analytics-opt-out.tsx`          |
| Ajouter un outil pour les agents       | public : `lib/agent/tools.ts` (repris par MCP, A2A, REST, OpenAPI) · compte client : `lib/agent/account-tools.ts` (+ portée dans `oauth.ts`)                                                                |
| Toucher à l'OAuth des agents / auth.md | `lib/auth.ts` (config) · `lib/agent/oauth.ts` · `agent-auth.ts` · pages `oauth/consent`, `agent/claim`, `account/agents` · tests `lib/agent/oauth.test.ts`                                                  |
| Ventes par agents IA (Stripe ACS)      | `lib/commerce/` (flux, hooks, commandes) · webhook `api/stripe/webhook` · hooks `api/stripe/agentic-commerce` · tests `lib/commerce/commerce.test.ts`                                                       |
| Achat direct par agent (MPP/ACP/UCP)   | `lib/commerce/checkout-core.ts` (cœur) · `mpp.ts` / `acp-*.ts` / `ucp-*.ts` · routes `api/v1/purchases`, `api/acp`, `api/ucp`, `/.well-known/{acp.json,ucp}` · tests `lib/commerce/protocols.test.ts`       |

## Remédiation septembre 2026

- Paiement/réservation : `lib/payment-state.ts`, `lib/stock.ts`, `lib/checkout-session.ts`, `lib/quote-session.ts`.
- Traçabilité des statuts : `lib/status-history.ts`, table `status_events`, affichage `admin/status-history.tsx`.
- E-mails persistants : `lib/outbox.ts` ; reprise par `lib/maintenance.ts`.
- Panier/restauration : `lib/cart-data.ts`, `lib/cart-snapshot.ts`, `components/cart-recovery.tsx`, `api/cart-reminder/restore/route.ts`.
- Entrées/fichiers : `lib/upload.ts`, `lib/file-signature.ts` ; vérification d'e-mail partagée dans `components/guest-email-verification.tsx`.
- Tests Postgres : `lib/payments.integration.test.ts`. CI : `.github/workflows/quality.yml`, `scripts/ci-migrate.ts` (base jetable exclusivement).
- État des vérifications et limites : [audit-remediation-2026-09.md](audit-remediation-2026-09.md).

## Gros fichiers — **ne pas lire en entier** sauf si tu édites le contenu

Surtout du texte/markup statique : lis par plage ciblée plutôt qu'en entier.

| Fichier                                                 | Lignes      | Nature                                        |
| ------------------------------------------------------- | ----------- | --------------------------------------------- |
| `a-propos/about-content.tsx`                            | ~990        | Copie marketing                               |
| `checkout/checkout-flow.tsx`                            | ~950        | Composant client du tunnel Stripe             |
| `lib/email-templates.ts`                                | ~880        | Gabarits HTML d'e-mails (4 langues)           |
| `legal/terms/content.tsx` · `legal/privacy/content.tsx` | ~760 / ~545 | Copie légale                                  |
| `admin/products/product-form.tsx`                       | ~610        | Formulaire produit (le plus dense de l'admin) |

## Ce qu'il ne faut pas ouvrir pour comprendre le projet

- `bun.lock`, `drizzle/` (migrations D1 legacy générées) et `drizzle-pg/`
  (migrations Postgres générées), `cloudflare-env.d.ts` (généré par
  `cf-typegen`), `public/brand/**` (binaires). Aucune logique à y lire.

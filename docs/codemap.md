# Code map — localiser le code sans fouiller

> **Lis ce fichier AVANT de `grep`/`glob` ou d'ouvrir des fichiers au hasard.**
> Il fait le pont « je dois faire X » → fichier(s) exact(s). But : qu'un agent
> trouve le bon fichier en **une** lecture, pas en explorant dix.
>
> Règles & contraintes : [`AGENTS.md`](../AGENTS.md). Comment c'est câblé :
> [`architecture.md`](architecture.md). Comment écrire le code : [`conventions.md`](conventions.md).
> Ce fichier-ci est **uniquement de la navigation**.

## Conventions de nommage (un seul Glob suffit)

| Tu cherches…                     | Chemin                                                       |
| -------------------------------- | ------------------------------------------------------------ |
| Une page vitrine                 | `src/app/[locale]/(site)/<route>/page.tsx` (voir plus bas)   |
| Une autre page                   | `src/app/[locale]/<route>/page.tsx`                          |
| Les Server Actions d'une route   | `…/<route>/actions.ts` (`"use server"`)                      |
| Le formulaire client d'une route | `…/<route>/*-form.tsx`                                       |
| Une route API                    | `src/app/api/<nom>/route.ts`                                 |
| Un composant partagé             | `src/components/<kebab-case>.tsx`                            |
| La logique métier                | `src/lib/<domaine>.ts`                                       |
| Le schéma DB (source de vérité)  | `src/db/schema.pg.ts` (`schema.ts` n'est qu'un re-export)    |
| Les requêtes de lecture          | `src/db/queries.ts`                                          |
| Les textes UI (nouveaux)         | `messages/<locale>/<namespace>.json` (`i18n/namespaces.ts`)  |
| Les textes UI (historiques)      | `messages/{fr,de,it,en}.json` (dégelés par WP-99, fr = base) |
| Le mouvement et la 3D            | `src/motion/**`, atteint seulement par `src/gates/**`        |

Le panneau admin suit le même schéma sous `src/app/[locale]/admin/<section>/`
(`page.tsx` + `actions.ts` + `*-form.tsx`/`*-manager.tsx`).

**Groupe de routes `(site)`** (absent de l'URL) : les pages vitrine vivent sous
`src/app/[locale]/(site)/` — `page.tsx` (accueil), `shop/`, `products/[slug]/`,
`custom/` (`quote-form.tsx`, `actions.ts`), `a-propos/` (`contact-form.tsx`,
`actions.ts`, `about-content.tsx`…), `contact/` (réutilise
`../a-propos/contact-form`) — avec `(site)/layout.tsx` qui monte la
`SiteShell` (Lenis + Stage). Panier, checkout, compte, admin, OAuth, agent,
suivi, favoris et légal restent directement sous `src/app/[locale]/`.

**Document, habillage et 404** : `src/app/layout.tsx` est le layout **racine**
(seul `<html>`/`<body>`, script anti-flash thème + mouvement, JSON-LD du site,
métadonnées par défaut, `data-geo-*`) ; `src/components/locale-shell.tsx`
(providers, Header, `<main>`, Footer, BottomNav, consentement) est posé par
`src/app/[locale]/layout.tsx`. `src/app/not-found.tsx` rend la 404 d'une URL
sans route (route interne `/_not-found` de Next, habillée par `LocaleShell`,
rendu serveur complet, statut 404) ; `src/app/[locale]/not-found.tsx` sert un
`notFound()` lancé par une page (fiche produit supprimée). Le contenu commun est
`src/components/not-found-content.tsx`. `<html lang>` suit la langue via
`components/html-lang-sync.tsx` (le layout racine n'est pas re-rendu au
changement de langue).

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
| `i18n/request.ts`                    | Config requête next-intl : fusionne `messages/<locale>.json` et les namespaces `messages/<locale>/<ns>.json`                                                 |
| `i18n/namespaces.ts`                 | Liste des namespaces (`shell`, `studioCore`, `landing`, `studio`, `quote`, `catalog`, `atelier`, `system`, `accountUi`) : un fichier = un package            |
| `i18n/messages.test.ts`              | Parité des clés et des arguments ICU entre les 4 langues, zéro `ß`, aucune valeur vide                                                                       |
| `i18n/client-namespaces.ts`          | Messages envoyés au navigateur : `ROOT_CLIENT_NAMESPACES` (habillage), `pickMessages`, `mergeMessages`                                                       |
| `i18n/client-messages.tsx`           | `<ClientMessages namespaces={[…]}>` : à poser dans le `layout.tsx` d'un segment pour ajouter les namespaces lus par ses composants client                    |
| `i18n/client-messages.test.ts`       | Suit les imports depuis chaque `page`/`layout`/`error`/`not-found` : échoue si un composant client lit un namespace non fourni                               |

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

## Mouvement et 3D (`src/motion`, `src/gates`, `src/lib/motion-bridge`)

Frontière du bundle (règle d'or 11 d'`AGENTS.md`) : gsap, lenis et three ne
s'importent que sous `src/motion/**`, atteint uniquement par un gate
`src/gates/*.tsx` (`next/dynamic`, `ssr: false`). Le DOM ne parle qu'au pont.

| Fichier                                                                                                             | Rôle                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/site-shell.tsx` · `app/[locale]/(site)/layout.tsx`                                                      | Coquille des pages vitrine : décide du montage du runtime et du Stage (`useMotionShell`)                                                                                                                                    |
| `gates/runtime.tsx`                                                                                                 | Seul chemin vers `@/motion/runtime` et `@/motion/stage/stage-root` (un gate par package ensuite)                                                                                                                            |
| `gates/boundary.test.ts`                                                                                            | Test de la frontière (imports statiques, `dynamic(…, { ssr: false })`, `"use client"`)                                                                                                                                      |
| `motion/gsap.ts`                                                                                                    | GSAP, ScrollTrigger, `useGSAP`, courbes de la marque ; jamais les plugins d'une chorégraphie                                                                                                                                |
| `motion/runtime.tsx`                                                                                                | Lenis sur `gsap.ticker`, `--s3d-progress` (écrit sur le filet du header, pas sur `<html>`), `bridge.scroll`, retour en haut de page à la navigation                                                                         |
| `motion/stage/stage-root.tsx` · `ticker.ts` · `loop.ts` · `view-tracker.ts` · `anchor-margin.ts` · `pixel-ratio.ts` | Canvas ancré au document (fixe si vue collante proche ; hauteur = fenêtre + marges selon le pointeur, anticipation du défilement), horloge, recalages par frame, rectangles des vues, budget de pixels du tampon par palier |
| `motion/stage/stage.ts`                                                                                             | Renderer WebGL unique : vues en scissor, rendu à la demande, bake au repos, perte de contexte, paliers                                                                                                                      |
| `motion/stage/scenes/index.ts`                                                                                      | Registre des 4 scènes (`print-hero`, `contour-field`, `studio-object`, `product-viewer`)                                                                                                                                    |
| `motion/stage/bake.ts`                                                                                              | Rendu en image WebP (`bridge.stage.bake`, vignettes) et bake au repos des vues C1                                                                                                                                           |
| `motion/stage/materials/print-material.ts` · `glsl/`                                                                | Matériau d'impression (coupe, bandes, lignes fantômes)                                                                                                                                                                      |
| `motion/stage/controllers.ts`                                                                                       | Contrôleurs animables d'une vue, pour les chorégraphies                                                                                                                                                                     |
| `lib/motion-bridge/store.ts` · `types.ts`                                                                           | Pont DOM ↔ côté lourd : état (`useMotionBridge`), registre des vues, contrats figés                                                                                                                                         |
| `lib/motion-bridge/use-stage-view.ts` · `components/ui/stage-view.tsx`                                              | Déclarer une vue 3D dans une page (poster SSR en enfant)                                                                                                                                                                    |
| `lib/motion-bridge/tier.ts`                                                                                         | Capacité C0–C2, déclassement, `s3d-webgl-lost`                                                                                                                                                                              |
| `lib/motion-bridge/motion-pref.ts` · `use-reduced-motion.ts`                                                        | Préférence de mouvement (`data-motion`), hook React `useReducedMotionPreference`                                                                                                                                            |
| `components/motion-toggle.tsx` · `reduced-motion-config.tsx`                                                        | Interrupteur du footer ; `<MotionConfig>` de motion/react piloté par la préférence                                                                                                                                          |
| `components/ui/page-cut.tsx` · `site-link.tsx`                                                                      | Transition « Coupe » entre pages vitrine (chaque `page.tsx` de `(site)` enveloppe son contenu)                                                                                                                              |
| `lib/studio/{types,creations,texts-store}.ts` · `lib/quote-handoff.ts`                                              | Contrats du Studio : types, « Mes créations », textes saisis, passage Studio → `/custom`                                                                                                                                    |

## Studio (`src/lib/studio`, pur TypeScript, WP-01 et WP-02)

Géométrie, chiffres et garde-fous du Studio : mm, Z vers le haut, aucun `Math.random`
(PRNG `mulberry32`), aucune dépendance à three, identique en SSR, dans le Worker du Studio
et côté client. Un chiffre affiché vient toujours d'ici (`computeStats`), jamais recopié
(brief §5.2, note du 30.09.2026). Écarts de WP-01 au brief : notes datées des §6.3.1, §6.5, §6.6 ;
écarts de WP-02 (texte en relief, Cartouche, Relief, Borne) : notes du 01.10.2026 aux §6.3.3 et §6.3.4.

| Fichier                                                               | Rôle                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studio/kernel/{rng,noise,hash}.ts`                                   | `mulberry32` ; simplex 2D/3D, FBM et variante périodique ; FNV-1a 32/64 (clés de cache, en-tête STL)                                                                                                                                                                    |
| `studio/kernel/{mesh,extrude,simplify,monotone}.ts`                   | `MeshBuilder`, volume signé, aire, test de variété ; polygones à trous (earcut) ; Douglas–Peucker ; cubique monotone                                                                                                                                                    |
| `studio/objects/lavaux.ts` · `lavaux-model.ts` · `lavaux-analysis.ts` | Vase « Lavaux » : maillage (LOD `drag`/`display`/`export`) ; surface analytique et plan d'anneaux ; volume, pentes, pied                                                                                                                                                |
| `studio/profile.ts` · `patterns.ts`                                   | Profil du vase (5 familles, galbe, lèvre) ; motifs δ(θ, z) et leurs dérivées analytiques                                                                                                                                                                                |
| `studio/ranges.ts`                                                    | Plages, bornage et aides de strates **sans zod** (WP-02) : les générateurs, `stats`, `guards` et `poster-flat` n'embarquent pas zod                                                                                                                                     |
| `studio/schemas.ts` · `url-state.ts`                                  | Schémas zod (`z.config({ jitless: true })` en tête : sans lui, la sonde `Function(")` de zod est une violation CSP « eval » en production) ; ré-exporte `ranges.ts` en entier (les importeurs disent toujours `schemas`) ; état dans l'URL (`#c=v1.…`, jamais de texte) |
| `studio/bands.ts` · `band-stats.ts`                                   | Opérations sur les bandes de couleur (quantifiées à 0,2 mm) ; `bandStatsFor(config, texts, params, locale)` : masse et couches par bande de l'éclaté des 4 objets                                                                                                       |
| `studio/stats.ts` · `estimate.ts` · `pricing-params.ts`               | `computeStats(config)` : couches, grammes, durée, changements ; prix (masqué tant que `PRICING.validated = false`) ; coefficients                                                                                                                                       |
| `studio/guards.ts`                                                    | Garde-fous d'imprimabilité (`overhang`, `plate`, `near-vase-spirale`…), sévérités, `issueValues`                                                                                                                                                                        |
| `studio/presets.ts`                                                   | `HERO_CONFIG`, `HERO_PATTERNS`, `HERO_PALETTES`, défauts des objets, « Surprenez-moi »                                                                                                                                                                                  |
| `studio/poster.ts` · `camera.ts`                                      | Posters SVG du héros (`ghost`, `final`, `exploded`) et Élévation exacte ; caméra et projection partagées avec le Stage                                                                                                                                                  |
| `studio/field-poster.ts` · `field-anchors.ts`                         | Posters de champ de courbes (FBM périodique, d3-contour) ; dimensions et points d'ancrage lus par les pages                                                                                                                                                             |
| `studio/build.ts` · `stl.ts` · `format.ts`                            | Point d'entrée unique de la géométrie ; STL binaire (en-tête `Swiss3Design Studio v1 …`) ; formats `fr-CH`/`de-CH`                                                                                                                                                      |
| `studio/testing.ts`                                                   | Aides de test (tirages de configurations valides ; WP-02 : `randomCartouche/Relief/Borne/Texts`, `loadTestFont`) : jamais importé par le code de production                                                                                                             |
| `scripts/gen-field-posters.ts` · `public/posters/field-*`             | `bun scripts/gen-field-posters.ts` écrit les 8 SVG ; `--check` échoue si un fichier diffère (CI)                                                                                                                                                                        |

### Texte en relief et objets plats (WP-02)

Cartouche (porte-carte), Relief (massif en strates) et Borne (porte-nom) partagent une
chaîne de texte : glyphes → mise en page (mesure SSR sans contours) → maillage. Le Worker
de géométrie doit appeler `loadGlyphFont(GLYPH_URL)` avant `buildStudioMesh` pour tout objet
à texte (`GlyphsNotLoadedError` sinon). Anticollision des glyphes (`pairExtraUnits`,
`GLYPH_HOOKS`) : pas un crénage, brief §6.3.3.

| Fichier                                                                     | Rôle                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studio/text/glyphs.ts`                                                     | Police maison : `parsePathData`, `flattenPath` (polylignes), `GlyphFont`, `loadGlyphFont(GLYPH_URL)` / `requireGlyphFont`, `GlyphsNotLoadedError`                                                                                                         |
| `studio/text/glyph-metrics.ts` (**généré**)                                 | `FONT_METRICS`, `GLYPH_TABLE` (chasse, aire, hauteurs des 322 glyphes), `GLYPH_HOOKS` (≈ 27 glyphes qui dépassent de leur boîte) : lu par le SSR, jamais édité à la main                                                                                  |
| `studio/text/layout.ts`                                                     | Mesure et mise en page sans contours : `measureText`, `fitCap` (ajustement auto), `pairExtraUnits` (anticollision), seuils de trait (0,8 / 0,6 mm), capitale minimale                                                                                     |
| `studio/text/shapes.ts` · `geometry.ts`                                     | Contours des lignes placées (`linesPolygons`, `plateMinusInk` = gravure sans CSG) ; anneaux de contour (rect. arrondi, polygone arrondi, enveloppe), aires                                                                                                |
| `studio/text/check.ts` · `fields.ts`                                        | Contrôles d'un texte (`checkLine` : caractère hors jeu, trait) ; champs et limites par objet, `sanitizeTexts`, `DEFAULT_TEXTS`                                                                                                                            |
| `studio/text/overlap.ts`                                                    | Distance entre contours et chevauchements (`boundaryGap`, `findOverlaps`) : outil des tests, pas du runtime                                                                                                                                               |
| `studio/objects/{cartouche,relief,borne}.ts` · `…-model.ts`                 | Maillage de l'objet (LOD `drag`/`display`/`export`) et modèle analytique (dimensions, bandes, volume) ; `relief.ts` ré-exporte `peakLabel` et `peakAltitude` ; `peakLabelParts` ne double pas le mot de préfixe si le nom le porte (`startsWithPeakWord`) |
| `studio/objects/{flat,flat-model}.ts`                                       | Socle commun des objets plats : plaque + relief/gravure, bandes, éclaté (ignoré par l'export, comme le vase)                                                                                                                                              |
| `studio/poster-flat.ts`                                                     | Vues de dessus SVG sans police : `cartoucheTopView`, `borneTopView`, `reliefTopView(config, texts, { theme, label })`, puis `topViewToSvg`                                                                                                                |
| `studio/presets.ts` (WP-02)                                                 | `CARTOUCHE_PRESETS`, `RELIEF_PRESETS` (`RELIEF_DEFAULT`), `BORNE_PRESETS`, `PRESETS[objet]` ; `surpriseCartouche/Relief/Borne(seed)`                                                                                                                      |
| `scripts/fonts/build-glyphs.ts` · `public/studio/glyphs/*`                  | Régénère `s3d-relief-v1.json` (+ `OFL.txt`) et la table `glyph-metrics.ts` depuis l'instance statique Archivo SemiExpanded Black (commande `uvx fonttools` en tête)                                                                                       |
| `scripts/fonts/gen-relief-posters.ts` · `public/posters/relief-default-*`   | `bun scripts/fonts/gen-relief-posters.ts` écrit les 2 SVG du massif (clair, sombre) ; `--check` échoue si un fichier diffère                                                                                                                              |
| `studio/text/text.test.ts` · `flat-objects.test.ts` · `poster-flat.test.ts` | Texte et 322 × 322 paires sans chevauchement ; 4 objets (variété, LOD, préréglages, débordements) ; posters plats                                                                                                                                         |

## « Je dois… » → où commencer

| Tâche                                   | Point d'entrée                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ajouter/modifier un champ produit       | `db/schema.pg.ts` → `bun run db:generate:pg` + `db:push:pg` → admin `products/product-form.tsx` + `actions.ts` → affichage `(site)/products/[slug]/page.tsx` + `components/product-card.tsx`                                                                                                                                                                                                                                     |
| Toucher au tunnel de paiement           | `app/[locale]/checkout/checkout-flow.tsx` + `api/checkout/route.ts` + `lib/orders.ts` (idempotence)                                                                                                                                                                                                                                                                                                                              |
| Toucher aux devis                       | formulaire partagé `components/quote/quote-request-form.tsx` (page `/custom` **et** tiroir du Studio) + Server Action `app/[locale]/(site)/custom/actions.ts` + `api/quote-*` + admin `quotes/` + `lib/orders.ts`                                                                                                                                                                                                                |
| Modifier les frais de port              | `lib/shipping.ts` + admin `settings/`                                                                                                                                                                                                                                                                                                                                                                                            |
| Ajouter un code promo / une règle       | `lib/discounts.ts` + admin `discounts/` + `api/discount/validate`                                                                                                                                                                                                                                                                                                                                                                |
| Changer un e-mail                       | `lib/email-templates.ts` (+ `email.ts` pour l'envoi)                                                                                                                                                                                                                                                                                                                                                                             |
| Ajouter une chaîne UI                   | le namespace du package : `messages/{fr,de,it,en}/<ns>.json` (`i18n/namespaces.ts`, parité vérifiée par `i18n/messages.test.ts`) ; les `messages/*.json` historiques (boutique, compte, checkout, légal) se modifient de nouveau depuis WP-99, mêmes clés dans les 4 langues ; si un composant `"use client"` la lit, déclarer le namespace dans le `layout.tsx` du segment avec `<ClientMessages>` (`i18n/client-messages.tsx`) |
| Sécurité / en-têtes / CSP nonce         | `src/middleware.ts`                                                                                                                                                                                                                                                                                                                                                                                                              |
| Auth / rôle admin                       | `lib/auth.ts` + `lib/session.ts`                                                                                                                                                                                                                                                                                                                                                                                                 |
| Toucher aux avis                        | `db/schema.pg.ts` (`reviews`) + `account/orders/[id]/` (dépôt, livré) + `admin/reviews/` (modération) + `(site)/products/[slug]` (affichage)                                                                                                                                                                                                                                                                                     |
| Viewer 3D produit                       | `components/catalog/product-viewer.tsx` (déclare un `<StageView>`) + scène `motion/stage/scenes/product-viewer.ts` + `api/admin/model-upload` + champ `products.model3dUrl`                                                                                                                                                                                                                                                      |
| Animer une page vitrine (scroll, GSAP)  | chorégraphie `motion/choreo/<page>.tsx` (créée par son package) chargée par son gate `gates/<package>.tsx` · outils `motion/gsap.ts` · état et scroll par `lib/motion-bridge/store.ts` (jamais d'import de `@/motion` hors des gates)                                                                                                                                                                                            |
| Afficher une vue 3D (Stage)             | `components/ui/stage-view.tsx` dans la page · scène `motion/stage/scenes/<id>.ts` (registre `scenes/index.ts`) · cœur `motion/stage/stage.ts` · vignette : `motionBridge.get().stage?.bake()`                                                                                                                                                                                                                                    |
| Objet du Studio à texte en relief       | `lib/studio/text/` (glyphes, mise en page, contours) · objet `lib/studio/objects/{cartouche,relief,borne}.ts` + `…-model.ts` · chiffres `stats.ts` / `band-stats.ts` · posters `poster-flat.ts` · textes des préréglages `messages/<locale>/studioCore.json` · `loadGlyphFont(GLYPH_URL)` avant tout maillage · voir la section « Studio » ci-dessus                                                                             |
| Le Studio (configurateur)               | pages `app/[locale]/(site)/studio/` · UI `components/studio/` (`studio-app.tsx`, `studio-controls.tsx`, `send-drawer.tsx`, `quote-send.ts`) · géométrie `lib/studio/` · moteur client `motion/studio/` (Worker de géométrie, export STL) via `gates/studio.tsx` · textes `messages/<locale>/{studio,studioCore}.json`                                                                                                            |
| Modifier l'accueil (héros, chapitres)   | `app/[locale]/(site)/page.tsx` → `components/home/` (`hero*.tsx`, `chapter-*.tsx`, `home.module.css`) · scène `motion/stage/scenes/print-hero.ts` · chorégraphie `motion/choreo/home.tsx` via `gates/home.tsx` · données calculées `home-data.generated.ts` (régénérées par `components/home/generate-home-data.ts`) · textes `messages/<locale>/landing.json`                                                                   |
| Boutique, fiches, vue « Registre »      | `app/[locale]/(site)/shop/page.tsx` · `components/catalog/` (`product-plate`, `shop-collection`, `registry-table`, `product-viewer`, `attribution-block`) · fiche `(site)/products/[slug]/page.tsx` · textes `catalog.json`                                                                                                                                                                                                      |
| Couleurs, polices, rayons (jetons)      | `app/globals.css` (jetons clair/`.dark`/`[data-tone="ink"]`, bloc « Admin » `.s3d-admin`) · polices `app/fonts.ts` + `src/fonts/` · primitives `components/ui/` · règles : `docs/conventions.md` → Design tokens                                                                                                                                                                                                                 |
| Revoir l'admin (thèmes, contrastes)     | `app/[locale]/admin/` (`ui.ts` = styles partagés et `STATUS_STYLE`, `admin-shell.tsx` porte `.s3d-admin`) · vérifier clair **et** sombre, 375 et 1440 px                                                                                                                                                                                                                                                                         |
| Événements de mesure (noms, propriétés) | `lib/analytics.ts` (`TrackedEvents`, `track()`) · `components/add-to-cart.tsx` (`Product Added`) · `components/quote/quote-request-form.tsx` (`Quote Requested`) · `components/studio/{studio-events,quote-send,studio-app}.ts*` (`Studio *`) · `account/register/register-form.tsx` (`Signed Up`) · `checkout/success/page.tsx` (`Order Completed`)                                                                             |
| Mouvement réduit                        | `lib/motion-bridge/motion-pref.ts` (`data-motion`) · `useReducedMotionPreference()` · CSS `motion-off:` / `motion-on:` · interrupteur `components/motion-toggle.tsx`                                                                                                                                                                                                                                                             |
| Recherche / produits liés               | `db/queries.ts` (`getProducts` param `q`, `getRelatedProducts`) + `(site)/shop/page.tsx`                                                                                                                                                                                                                                                                                                                                         |
| SEO d'une page                          | `generateMetadata` → `pageMetadata()` (`lib/seo.ts`) · JSON-LD via `components/json-ld.tsx` · `app/sitemap.xml/route.ts` · `app/robots.txt/route.ts` · `app/llms.txt/route.ts` · textes `seo.*` des `messages/*.json`                                                                                                                                                                                                            |
| Tâches planifiées (purge R2, relances)  | `lib/maintenance.ts` + `api/cron/maintenance` ← déclenché par `workers/cron` (Worker Cron horaire, déployé à part)                                                                                                                                                                                                                                                                                                               |
| Mesure d'audience (PostHog)             | `lib/analytics.ts` (`track()`) · chargement `src/instrumentation-client.ts` · relais `/api/relay` dans `middleware.ts` · `components/track-event.tsx` · refus : `components/analytics-opt-out.tsx`                                                                                                                                                                                                                               |
| Ajouter un outil pour les agents        | public : `lib/agent/tools.ts` (repris par MCP, A2A, REST, OpenAPI) · compte client : `lib/agent/account-tools.ts` (+ portée dans `oauth.ts`)                                                                                                                                                                                                                                                                                     |
| Toucher à l'OAuth des agents / auth.md  | `lib/auth.ts` (config) · `lib/agent/oauth.ts` · `agent-auth.ts` · pages `oauth/consent`, `agent/claim`, `account/agents` · tests `lib/agent/oauth.test.ts`                                                                                                                                                                                                                                                                       |
| Ventes par agents IA (Stripe ACS)       | `lib/commerce/` (flux, hooks, commandes) · webhook `api/stripe/webhook` · hooks `api/stripe/agentic-commerce` · tests `lib/commerce/commerce.test.ts`                                                                                                                                                                                                                                                                            |
| Achat direct par agent (MPP/ACP/UCP)    | `lib/commerce/checkout-core.ts` (cœur) · `mpp.ts` / `acp-*.ts` / `ucp-*.ts` · routes `api/v1/purchases`, `api/acp`, `api/ucp`, `/.well-known/{acp.json,ucp}` · tests `lib/commerce/protocols.test.ts`                                                                                                                                                                                                                            |

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
| `(site)/a-propos/about-content.tsx`                     | ~990        | Copie marketing                               |
| `checkout/checkout-flow.tsx`                            | ~950        | Composant client du tunnel Stripe             |
| `lib/email-templates.ts`                                | ~880        | Gabarits HTML d'e-mails (4 langues)           |
| `legal/terms/content.tsx` · `legal/privacy/content.tsx` | ~760 / ~545 | Copie légale                                  |
| `admin/products/product-form.tsx`                       | ~610        | Formulaire produit (le plus dense de l'admin) |

## Ce qu'il ne faut pas ouvrir pour comprendre le projet

- `bun.lock`, `drizzle/` (migrations D1 legacy générées) et `drizzle-pg/`
  (migrations Postgres générées), `cloudflare-env.d.ts` (généré par
  `cf-typegen`), `public/brand/**` (binaires). Aucune logique à y lire.

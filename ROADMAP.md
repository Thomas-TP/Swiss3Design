# Swiss3Design — Feuille de route

> Boutique en ligne d'impressions 3D · Basée à Gland (VD) · **Livraison Suisse uniquement**
> Imprimante : Bambu Lab P1S + AMS 2 Pro (multicolor jusqu'à 4 couleurs)
> Hébergement & données : **100 % Cloudflare**
>
> ✅ **EN PRODUCTION sur [swiss3design.ch](https://swiss3design.ch)** — Stripe en mode LIVE.
> Ce document retrace les décisions, l'état réel du projet et la suite envisagée.
> Référence technique à jour : [`docs/architecture.md`](docs/architecture.md) ·
> [`AGENTS.md`](AGENTS.md) · [`README.md`](README.md).

## ✅ Décisions verrouillées (et livrées)

| Sujet              | Choix                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | **Next.js 16 + React 19** via **OpenNext for Cloudflare**                                                                                                                                   |
| Animations / rendu | **GSAP + Lenis** (défilement, chorégraphies) et **three.js** (un seul canvas WebGL) côté client uniquement, **View Transitions** (« Coupe ») ; Motion (ex-Framer Motion) reste pour l'admin |
| Comptes clients    | **Better Auth** sur Postgres/Hyperdrive (e-mail + **Google OAuth**, **2FA TOTP**, passkeys)                                                                                                 |
| Auth admin         | **Rôle `admin` Better Auth**, attribué automatiquement aux adresses de `ADMIN_EMAILS` (pas de Cloudflare Access)                                                                            |
| Paiement           | **Stripe Payment Element** personnalisé (intégré) — cartes + Apple/Google Pay. **TWINT** disponible via Stripe (à activer au dashboard). PostFinance Pay : abandonné.                       |
| Langues            | **FR / DE / IT / EN** avec détection auto du navigateur (repli FR) via `next-intl`                                                                                                          |
| Frais de port      | **Tarif unique Suisse** + **gratuit dès un seuil** (réglable en admin)                                                                                                                      |
| Modèle de vente    | **Hybride** : stock pré-imprimé + impression à la demande (délai affiché)                                                                                                                   |
| Devis sur mesure   | **Oui** : upload STL/3MF (R2) + fil de discussion client ↔ atelier + paiement du devis                                                                                                      |
| Domaine            | **swiss3design.ch** (réservé, en ligne, `www` → apex)                                                                                                                                       |
| Implémentation     | **L'IA code l'intégralité**                                                                                                                                                                 |

---

## 1. Vision & principes

- **Style** : moderne, sobre, « business », pas traditionnel. Espace blanc, typographie soignée, micro-animations discrètes (Motion + View Transitions pour un effet « app native »).
- **UX** : mobile-first, **barre de navigation en bas** (style app), parcours d'achat ultra-court.
- **Différenciateur** : mise en avant du **multicolor 4 couleurs**.
- **Périmètre** : B2C, livraison **Suisse uniquement** (blocage étranger au checkout).

---

## 2. Stack technique (tout Cloudflare)

| Besoin                        | Outil                                                                                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework                     | Next.js 16 (App Router) + React 19, déployé via **OpenNext** sur **Cloudflare Workers**                                                                                                      |
| Animations & 3D               | **GSAP + Lenis** + **three.js** (Stage WebGL), client-only sous `src/motion/**`, derrière `src/gates/**` (règle d'or 11) ; View Transitions API ; Motion pour l'admin                        |
| Polices                       | **Archivo SemiExpanded** (titres, auto-hébergée) + **Geist / Geist Mono** (texte, interface, Stripe) — licence OFL                                                                           |
| Base de données               | **Postgres (Neon)** via **Cloudflare Hyperdrive** + **Drizzle ORM** — pivot 2026-07-09, D1/SQLite gardé en filet de secours inactif                                                          |
| Outillage                     | **Bun** (install/scripts/dev) + **Oxlint + Oxfmt** (lint + format, remplace Biome depuis 2026-09-09)                                                                                         |
| Fichiers (images, STL/3MF)    | **Cloudflare R2** (servis via route handlers, jamais publics)                                                                                                                                |
| Optimisation images           | **Cloudflare Images** (`images.unoptimized` côté Next, délégué au déploiement)                                                                                                               |
| Sessions / cache / rate-limit | **Workers KV**                                                                                                                                                                               |
| Tâches planifiées             | **Route cron** `/api/cron/maintenance` (purge R2 + relances panier) protégée par `CRON_SECRET`, déclenchée par un **Worker Cron dédié** (`workers/cron`, horaire) — pas de Cloudflare Queues |
| Auth clients & admin          | **Better Auth** (Postgres/Drizzle via Hyperdrive) — rôle `admin` via `ADMIN_EMAILS`                                                                                                          |
| Paiement                      | **Stripe Payment Element** (PaymentIntents + webhook) en CHF                                                                                                                                 |
| i18n                          | **next-intl** (routing `/fr` `/de` `/it` `/en`, détection auto)                                                                                                                              |
| Emails                        | **Resend** (réponses clients vers l'alias Infomaniak `contact@swiss3design.ch`)                                                                                                              |
| UI                            | **Tailwind CSS 4** + composants maison + **Lucide** (pas de shadcn/ui)                                                                                                                       |
| Sécurité                      | En-têtes durcis + **CSP à nonce par requête** (prod) + rate-limiting KV                                                                                                                      |
| Analytics                     | **PostHog Cloud EU** au régime suisse (information + refus, relais `/api/relay`) ; Cloudflare Web Analytics (sans cookie) activé avant                                                       |
| SEO                           | sitemap/robots dynamiques, metadata + JSON-LD (Product/AggregateRating/Organization), hreflang                                                                                               |
| Images                        | **Cloudflare Transformations** (`/cdn-cgi/image`) — resize + `format=auto`                                                                                                                   |
| 3D                            | **Stage WebGL** (three.js, un seul contexte) : héros de l'accueil, objets du **Studio**, viewer produit (`.stl`/`.glb`) ; chargé à la demande, jamais dans le Worker                         |

---

## 3. Modèle de données

Le schéma fait foi : [`src/db/schema.pg.ts`](src/db/schema.pg.ts) (Drizzle, Postgres — `schema.ts` n'en est qu'un re-export).
Vue d'ensemble commentée : [`docs/architecture.md`](docs/architecture.md#data-model-d1--drizzle).

Principes : `id` UUID, **argent en centimes CHF** (`*_cents`), textes traduits
dans des tables `*_translations` `(parentId, locale)`, **snapshots** figés (nom,
prix, couleur, adresse) dans `order_items` / commandes au moment de l'achat.
Familles de tables : catalogue (products, variants, images, materials, couleurs,
catégories), commandes (orders, order_items), devis (quote_requests,
quote_messages), stock & réglages (inventory_log, settings, discount_codes),
auth Better Auth (user, session, account, two_factor, customer_addresses).

---

## 4. Architecture

Détail des pages, du panel admin et des flux : [`README.md`](README.md) (vue
fonctionnelle) et [`docs/architecture.md`](docs/architecture.md) (runtime, flux
paiement idempotent, devis, rattachement invité, sécurité). Résumé :

- **Pages publiques** (préfixe langue) : accueil, catalogue, fiche produit, **Studio**
  (configurateur 3D de quatre objets), devis sur mesure, l'Atelier (`/a-propos`), contact, panier → checkout Stripe → confirmation, espace client, favoris,
  suivi invité `/track`, pages légales.
- **Navigation** : barre fixe en bas (mobile), header discret (desktop).
- **Admin** (`/admin`, gardé par `requireAdmin()`) : dashboard, produits,
  catégories, matières & couleurs, mises en avant, stock, commandes, devis,
  clients, codes promo, e-mails, réglages.

---

## 5. Paiement (Stripe personnalisé)

- **Stripe Payment Element** intégré (données carte dans l'iframe Stripe →
  conformité PCI SAQ A).
- Moyens : **Cartes**, **Apple/Google Pay**, en **CHF**. **TWINT** activable via le
  dashboard Stripe.
- Flux : PaymentIntent côté Worker → confirmation client → **webhook** valide,
  crée/confirme la commande, décrémente le stock, déclenche l'e-mail. La
  finalisation est **idempotente** (webhook + page de retour, le premier arrivé
  agit) — cf. `src/lib/orders.ts`.
- **Devis** : une fois chiffré, paiement via un PaymentIntent dédié.
- **Restriction Suisse** : pays limité à `CH` + contrôle serveur de l'adresse.
- **TVA** : non requise tant que CA < 100 000 CHF/an (activable plus tard, 8.1 %).

---

## 6. Livraison

- **La Poste Suisse**, **tarif unique national** + **gratuit dès un seuil**
  (réglable en admin via `settings`).
- Adresses CH : NPA 4 chiffres + canton. **Pays = CH uniquement.**
- N° de suivi saisi manuellement (champ `trackingNumber`, inclus dans l'e-mail
  d'expédition). Évolution : API Poste Suisse pour étiquettes/suivi automatique.

---

## 7. Conformité (Suisse)

- **nLPD** : politique de confidentialité ; analytics sans cookie ; **droit à
  l'effacement** (suppression de compte confirmée par e-mail, purge devis + R2 +
  adresses, commandes conservées 10 ans — art. 958f CO — en coupant le lien client).
- **CGV** + **Mentions légales** (vendeur, adresse Gland) + Livraison & retours.
- Inscription registre du commerce si CA ≥ 100 000 CHF.

---

## 8. Phases de réalisation — ✅ livrées

0. ✅ **Cadrage** : domaine, comptes Cloudflare + Stripe, gamme initiale.
1. ✅ **Design** : charte sobre (rouge marque + neutres), maquettes, nav bas.
2. ✅ **Setup** : Next.js + Tailwind + Motion ; D1, R2, KV ; Drizzle + migrations ; i18n.
3. ✅ **Auth & comptes clients** : Better Auth, espace client, Google OAuth, 2FA.
4. ✅ **Catalogue multilingue** : produits, variantes, couleurs, traductions, images R2 ; stock vs à la demande.
5. ✅ **Panier & checkout custom** : Stripe Payment Element, webhook, restriction Suisse, frais de port, codes promo, confirmation.
6. ✅ **Module devis sur mesure** : upload R2, fil de discussion, paiement du devis.
7. ✅ **Panel admin** : produits, stock, commandes, devis, clients, réglages.
8. ✅ **Emails** : Resend (confirmations, devis, comptes).
9. ✅ **Légal + SEO + perf + sécurité** : pages légales, metadata multilingue, manifest PWA, audit (PentestTools), CSP à nonce.
10. ✅ **Lancement** : DNS Cloudflare, passage Stripe test → live, déploiement Git natif (Cloudflare Workers Builds).

---

## 9. Suite envisagée (post-lancement)

Déjà fait après lancement : favoris, **suivi invité `/track`** + conversion
invité → compte (rattachement des commandes), codes promo, durcissement
sécurité, **TWINT** (activé), **Cloudflare Web Analytics** (activé).

Lot SEO / perf / conversion (livré) :

- ✅ **SEO** : `sitemap.ts` dynamique (D1, ×4 locales + hreflang), `robots.ts`,
  `generateMetadata` produit + **JSON-LD** Product/AggregateRating + Organization.
- ✅ **Perf** : images via **Cloudflare Transformations** (`/cdn-cgi/image`),
  lazy-loading, `fetchPriority` sur l'image LCP.
- ✅ **Avis produits** : ouverts **après livraison** sur les articles de la
  commande (acheteur vérifié), modération admin, étoiles + rich snippet.
- ✅ **Viewer 3D** produit (`.stl`/`.glb`, Three.js à la demande, teinté dans
  chaque couleur proposée) — champ `products.model3dUrl`.
- ✅ **Recherche** catalogue (`?q=`) + **produits liés** (« Vous aimerez aussi »).
- ✅ **Relance panier abandonné** : opt-in **nLPD**, table `abandoned_carts`,
  e-mail de relance (4 langues) + désinscription, déclenché par un **Worker Cron
  Cloudflare dédié** (`workers/cron`).
- ✅ **Outillage** : Vitest, `typecheck`, Prettier.
- ✅ **Commerce agentique** (2026-09-27) : catalogue et hooks Stripe Agentic
  Commerce Suite, achat direct par agent IA (MPP, ACP, UCP) payé par Shared
  Payment Token, section « agents IA » des CGV et de la confidentialité.
  Paiements de test réussis de bout en bout sur les trois protocoles.

Refonte « Strates » (octobre 2026, mise en ligne en une fois au jalon J3 ;
spécification : [`docs/redesign-2026/DESIGN-BRIEF.md`](docs/redesign-2026/DESIGN-BRIEF.md),
checklist de mise en ligne : [`docs/redesign-2026/checklist-j3.md`](docs/redesign-2026/checklist-j3.md)) :

- ✅ **Direction visuelle** : une couche = une courbe de niveau. Papier carte et
  encre chauds, le rouge de la marque réservé à la « chaleur » (boutons, point
  final des titres), Archivo SemiExpanded + Geist, isolignes SVG, bande de
  mesure, thème sombre sans flash blanc ; jetons conservés, valeurs changées.
- ✅ **Accueil** : héros « L'impression personnalisable » (un vase s'imprime
  couche par couche sous les yeux du visiteur, palette et motif réglables en
  direct), bascule en plan, sept chapitres, trois entrées (Personnaliser,
  Acheter, J'ai un fichier).
- ✅ **Studio** (`/studio`) : configurateur 3D de quatre objets originaux
  générés en code (vase « Lavaux », carte « Cartouche », sous-verre « Relief »,
  porte-nom « Borne »), garde-fous d'imprimabilité, grammes / durée /
  changements de filament, export STL dans un Worker, envoi à l'atelier par la
  même Server Action de devis que `/custom` (formulaire partagé).
- ✅ **Boutique, fiches produit, Atelier, contact, sur mesure, compte, tunnel de
  paiement, légal, 404** : refonte visuelle et éditoriale en 4 langues, avec
  l'attribution du Vase spirale (CC BY-ND) en données structurées.
- ✅ **Socle technique** : Stage WebGL unique, mouvement réduit et paliers C0 à
  C2, groupe de routes `(site)` (ni Lenis ni canvas autour de Stripe), textes
  par namespace avec messages client à la demande, nouveaux événements de
  mesure (`Hero Customized`, `Studio *`) sans aucun texte personnel.
- ✅ **Admin** : revu dans les deux thèmes (contrastes, rayons, débordements),\n corrigé par les jetons et les styles propres à l'admin, sans le redessiner.

Prochaines étapes (après J3) :

- **Renommer la marque en « Kreya »** (choix du 08.10.2026, vérifications
  faites) : acheter `kreya.ch` (Infomaniak, par le propriétaire), puis un
  paquet dédié : textes des 4 langues, métadonnées et JSON-LD, e-mails,
  logo, wordmark, domaine et redirections.
- **Calibrer le Studio** : inventaire réel des bobines (aujourd'hui des teintes
  indicatives) et coefficients de prix (aucun CHF affiché tant que
  `PRICING.validated` vaut `false`), après impression et pesée de quelques
  pièces.
- **Politique de confidentialité** : mentionner le stockage local du Studio
  (créations, textes saisis le temps de la session).
- Options du brief de la refonte (§11.2 n° 8) : police suisse premium, rendus
  Blender pour les images OG, image « Illustration » de l'Atelier. Liste
  « plus tard » du brief (§1.3) : export 3MF, plan de bureau, commande directe
  du Studio au panier à prix ferme, relief suisse réel, etc.

En attente — à ne pas oublier :

- **Connecter les agents IA** dans Stripe (Commerce agentique → Agents) dès que
  Stripe a fini de « préparer le flux de produits » : lire puis accepter les
  conditions de chaque agent avant de l'activer.
- **x402** (paiements USDC sur Base) : après l'accord de Stripe pour les
  stablecoins (demande envoyée à machine-payments@stripe.com le 2026-09-27),
  créer le compte Coinbase CDP et poser `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET`.
- **TWINT** : réactivation confirmée par le support Stripe, encore en cours le
  2026-09-27 — vérifier dans Paramètres → Moyens de paiement qu'il est bien
  « Actif ».

À étudier :

- **Refonte plateforme 2026** — devis instantané (« la Forge »), homepage à
  double intention, suivi de fabrication, bibliothèque de pièces : plan
  complet et phasé dans
  [`docs/refonte-plateforme-2026.md`](docs/refonte-plateforme-2026.md).
- **API Poste Suisse** : génération d'étiquettes + suivi automatique.
- **TVA** : si le seuil de 100 000 CHF/an approche (champ taux déjà prévu).

---

## 10. Budget mensuel

| Poste                                                                                      | Coût                                         |
| ------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Cloudflare Workers Paid (Hyperdrive, R2, KV inclus ; D1 gardé en filet de secours, inclus) | ~5 $/mois                                    |
| Neon Postgres (base active, branche `preview` isolée incluse)                              | Gratuit (palier free)                        |
| Domaine `.ch`                                                                              | ~10–12 CHF/an                                |
| Stripe                                                                                     | 0 fixe + ~2.9 % + 0.30 CHF/tx (TWINT ~1.3 %) |
| Resend                                                                                     | Gratuit jusqu'à ~3 000 emails/mois           |
| Cloudflare Web Analytics                                                                   | Gratuit                                      |

➡️ **~5–6 CHF/mois** + commissions à la vente.

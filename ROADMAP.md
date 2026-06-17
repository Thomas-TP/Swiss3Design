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

| Sujet | Choix |
|---|---|
| Framework | **Next.js 16 + React 19** via **OpenNext for Cloudflare** |
| Animations / rendu | **Motion** (ex-Framer Motion) + View Transitions |
| Comptes clients | **Better Auth** sur D1 (e-mail + **Google OAuth**, **2FA TOTP**) |
| Auth admin | **Rôle `admin` Better Auth**, attribué automatiquement aux adresses de `ADMIN_EMAILS` (pas de Cloudflare Access) |
| Paiement | **Stripe Payment Element** personnalisé (intégré) — cartes + Apple/Google Pay. **TWINT** disponible via Stripe (à activer au dashboard). PostFinance Pay : abandonné. |
| Langues | **FR / DE / IT / EN** avec détection auto du navigateur (repli FR) via `next-intl` |
| Frais de port | **Tarif unique Suisse** + **gratuit dès un seuil** (réglable en admin) |
| Modèle de vente | **Hybride** : stock pré-imprimé + impression à la demande (délai affiché) |
| Devis sur mesure | **Oui** : upload STL/3MF (R2) + fil de discussion client ↔ atelier + paiement du devis |
| Domaine | **swiss3design.ch** (réservé, en ligne, `www` → apex) |
| Implémentation | **L'IA code l'intégralité** |

---

## 1. Vision & principes

- **Style** : moderne, sobre, « business », pas traditionnel. Espace blanc, typographie soignée, micro-animations discrètes (Motion + View Transitions pour un effet « app native »).
- **UX** : mobile-first, **barre de navigation en bas** (style app), parcours d'achat ultra-court.
- **Différenciateur** : mise en avant du **multicolor 4 couleurs**.
- **Périmètre** : B2C, livraison **Suisse uniquement** (blocage étranger au checkout).

---

## 2. Stack technique (tout Cloudflare)

| Besoin | Outil |
|---|---|
| Framework | Next.js 16 (App Router) + React 19, déployé via **OpenNext** sur **Cloudflare Workers** |
| Animations | **Motion** + View Transitions API |
| Base de données | **Cloudflare D1** (SQLite) + **Drizzle ORM** |
| Fichiers (images, STL/3MF) | **Cloudflare R2** (servis via route handlers, jamais publics) |
| Optimisation images | **Cloudflare Images** (`images.unoptimized` côté Next, délégué au déploiement) |
| Sessions / cache / rate-limit | **Workers KV** |
| Tâches planifiées (purge R2) | **Route cron** `/api/cron/maintenance` protégée par `CRON_SECRET` (pas de Cloudflare Queues) |
| Auth clients & admin | **Better Auth** (D1/Drizzle) — rôle `admin` via `ADMIN_EMAILS` |
| Paiement | **Stripe Payment Element** (PaymentIntents + webhook) en CHF |
| i18n | **next-intl** (routing `/fr` `/de` `/it` `/en`, détection auto) |
| Emails | **Resend** (réponses clients vers l'alias Infomaniak `contact@swiss3design.ch`) |
| UI | **Tailwind CSS 4** + composants maison + **Lucide** (pas de shadcn/ui) |
| Sécurité | En-têtes durcis + **CSP à nonce par requête** (prod) + rate-limiting KV |
| Analytics | **Cloudflare Web Analytics** (sans cookie) — à activer au dashboard |

---

## 3. Modèle de données

Le schéma fait foi : [`src/db/schema.ts`](src/db/schema.ts) (Drizzle, SQLite).
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

- **Pages publiques** (préfixe langue) : accueil, catalogue, fiche produit, devis
  sur mesure, panier → checkout Stripe → confirmation, espace client, favoris,
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
invité → compte (rattachement des commandes), codes promo, durcissement sécurité.

À étudier :

- **Avis produits** (table + modération admin).
- **API Poste Suisse** : génération d'étiquettes + suivi automatique.
- **Activation TWINT** dans le dashboard Stripe.
- **Cloudflare Web Analytics** : activer le beacon (CSP déjà prête).
- **TVA** : si le seuil de 100 000 CHF/an approche (champ taux déjà prévu).

---

## 10. Budget mensuel

| Poste | Coût |
|---|---|
| Cloudflare Workers Paid (D1 + R2 + KV inclus) | ~5 $/mois |
| Domaine `.ch` | ~10–12 CHF/an |
| Stripe | 0 fixe + ~2.9 % + 0.30 CHF/tx (TWINT ~1.3 %) |
| Resend | Gratuit jusqu'à ~3 000 emails/mois |
| Cloudflare Web Analytics | Gratuit |

➡️ **~5–6 CHF/mois** + commissions à la vente.

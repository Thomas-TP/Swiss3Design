<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/png/logo-dark-960.png" />
  <img alt="Swiss3Design" src="public/brand/png/logo-light-960.png" width="380" />
</picture>

### Impression 3D multicolore en Suisse

Boutique e-commerce d'objets design imprimés en 3D jusqu'à **4 couleurs**,
fabriqués à **Gland (VD)** et livrés dans toute la Suisse.

🌐 **[swiss3design.ch](https://swiss3design.ch)**

[![Site en ligne](https://img.shields.io/website?url=https%3A%2F%2Fswiss3design.ch&label=swiss3design.ch&up_message=en%20ligne&down_message=hors%20ligne&color=E5231C)](https://swiss3design.ch)
&nbsp;
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=000)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-LIVE-635BFF?logo=stripe&logoColor=white)

</div>

---

## Sommaire

- [Aperçu](#aperçu)
- [Fonctionnalités](#fonctionnalités)
- [Identité visuelle](#identité-visuelle)
- [Stack technique](#stack-technique)
- [Intégrations](#intégrations)
- [Structure du projet](#structure-du-projet)
- [Démarrage rapide](#démarrage-rapide)
- [Variables d'environnement](#variables-denvironnement)
- [Scripts npm](#scripts-npm)
- [Base de données](#base-de-données)
- [Déploiement](#déploiement)
- [Sécurité](#sécurité)
- [Internationalisation](#internationalisation)
- [Propriété & licences](#propriété--licences)

---

## Aperçu

Swiss3Design est une boutique en ligne complète : catalogue, panier, paiement,
devis sur mesure, comptes clients et back-office d'administration. Le site est
**en production** sur [swiss3design.ch](https://swiss3design.ch), déployé sur
**Cloudflare Workers** et alimenté par une base **D1**, un stockage de fichiers
**R2** et un cache **KV**.

Le site est multilingue (🇫🇷 🇩🇪 🇮🇹 🇬🇧) avec détection automatique de la langue
du navigateur, et propose un mode clair/sombre.

---

## Fonctionnalités

### Côté client

- 🛍️ **Boutique** — catalogue par catégories, fiches produits, choix des couleurs
  et matières, galerie d'images.
- 🎨 **Configurateur multicolore** — sélection jusqu'à 4 couleurs par objet.
- 🧾 **Devis sur mesure** — envoi de fichiers 3D (upload R2), chiffrage, puis
  paiement du devis en ligne.
- 🛒 **Panier & paiement** — tunnel de commande avec **Stripe Payment Element**,
  codes promo, calcul des frais de port suisses.
- ❤️ **Favoris** — produits mis de côté.
- 👤 **Comptes clients** — inscription, connexion e-mail + **Google**, mot de
  passe oublié/réinitialisé, historique des commandes et des devis.
- 📦 **Suivi invité** — page `/track` pour suivre une commande sans compte, avec
  conversion invité → compte et rattachement des commandes.
- 🌍 **Multilingue & thème** — fr/de/it/en, bascule clair/sombre.

### Côté administration (`/admin`)

Gestion complète : produits, catégories, matières, mises en avant, codes promo,
commandes, devis, clients, e-mails transactionnels et réglages de la boutique.

---

## Identité visuelle

L'identité suit une ligne **« Swiss business »** : neutres chauds, **rouge suisse**
en accent, typographie nette, et un logomark géométrique.

| Élément | Valeur |
| --- | --- |
| 🔴 Rouge marque | `#E5231C` (foncé : `#C01D14`) |
| ⚫ Encre (texte) | `#1A1614` clair · `#F4F1ED` sombre |
| ⚪ Papier (fond) | `#FAFAF9` clair · `#0B0A09` sombre |
| 🔤 Police | **Geist Sans** (`next/font`) |
| 🧊 Logo | Cube isométrique, symétrie 180° : un « L » encre + son miroir rouge |

Le **kit de marque** complet est versionné dans [`public/brand/`](public/brand) :

- **Logos** — `svg/`, `png/`, `webp/`, `jpg/` en variantes claire/sombre et
  plusieurs tailles (480 / 960 / 1896 px).
- **Icônes / favicon** — `app/` (favicon.ico, icon.svg, apple-icon, icônes PWA
  192/512) et déclinaisons mono encre/blanc de 16 à 512 px.
- **Réseaux sociaux** — `social/og-image.png` (1200 × 630, balises Open Graph
  & Twitter Card).
- **Illustrations produits** — [`public/products/`](public/products) (SVG).

> 🎨 **Contraintes de marque** : rouge / noir / blanc uniquement ; pas de « 3 »,
> pas de « S », pas de cliché d'impression 3D. Toute nouvelle identité visuelle
> doit être validée avant usage.

---

## Stack technique

| Domaine | Technologie |
| --- | --- |
| Framework | **Next.js 16** (App Router, React Server Components) |
| UI | **React 19**, **Tailwind CSS 4**, [`motion`](https://motion.dev), `lucide-react` |
| Langage | **TypeScript 6** (strict) |
| Base de données | **Cloudflare D1** (SQLite) via **Drizzle ORM** |
| Authentification | **better-auth** (e-mail + Google OAuth) |
| Paiement | **Stripe** (Payment Element + webhooks) |
| E-mails | **Resend** (API REST) |
| i18n | **next-intl** (fr/de/it/en) |
| Stockage fichiers | **Cloudflare R2** |
| Cache / rate-limit | **Cloudflare KV** |
| Hébergement | **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) |

---

## Intégrations

- **Stripe** *(LIVE en production)* — Payment Element pour les commandes et le
  paiement des devis, webhooks pour la confirmation des paiements.
- **better-auth + Google OAuth** — sessions, comptes, rôle admin attribué
  automatiquement aux adresses de `ADMIN_EMAILS`.
- **Cloudflare** — D1 (`swiss3design-db`), R2 (`swiss3design-files`), KV,
  domaine personnalisé `swiss3design.ch`.
- **Resend** — e-mails transactionnels (confirmations, devis, comptes). Les
  réponses clients arrivent sur l'alias **Infomaniak** `contact@swiss3design.ch`.

---

## Structure du projet

```text
Swiss3Design/
├─ docs/                          # Doc interne : architecture, conventions, déploiement
├─ drizzle/                       # Migrations SQL (drizzle-kit) + snapshots — NE PAS éditer à la main
├─ messages/                      # Traductions next-intl (fr, de, it, en)
├─ public/
│  ├─ brand/                      # Kit de marque (logos, icônes, og-image)
│  ├─ products/                   # Illustrations produits (SVG)
│  ├─ avatars/                    # Avatars par défaut
│  ├─ about/                      # Photos page « À propos »
│  └─ .well-known/security.txt    # Contact sécurité
├─ scripts/                       # Outils hors-app
│  ├─ push.bat                    # Publier : commit + push (= déploiement auto)
│  ├─ seed.sql                    # Jeu de données de départ (boutique)
│  └─ seed-categories.sql         # Jeu de données catégories
├─ src/
│  ├─ app/
│  │  ├─ [locale]/                # Pages localisées (boutique, compte, admin, devis…)
│  │  ├─ api/                     # Routes API (Stripe, auth, fichiers, cron…)
│  │  ├─ globals.css              # Thème Tailwind v4 (clair/sombre, rouge marque)
│  │  ├─ manifest.ts              # Manifest PWA
│  │  └─ favicon.ico · icon.svg · apple-icon.png
│  ├─ components/                 # Composants UI (header, footer, product-card…)
│  ├─ db/                         # Drizzle : schema, queries, client D1
│  ├─ i18n/                       # Config next-intl (routing, request, navigation)
│  ├─ lib/                        # Logique métier (auth, panier, stripe, email…)
│  └─ middleware.ts               # Middleware Edge (i18n + sécurité + CSP nonce)
├─ next.config.ts                 # Next.js + next-intl + OpenNext
├─ open-next.config.ts            # Adaptateur Cloudflare (build webpack)
├─ wrangler.jsonc                 # Bindings Cloudflare (D1, R2, KV) + domaine
├─ drizzle.config.ts              # Config drizzle-kit
├─ AGENTS.md                      # Guide pour agents IA (CLAUDE.md l'importe)
└─ ROADMAP.md                     # Feuille de route
```

---

## Démarrage rapide

**Prérequis** : [Node.js 22+](https://nodejs.org), un compte Cloudflare et un
compte Stripe (mode test pour le développement).

```bash
# 1. Installer les dépendances
npm install

# 2. Créer les secrets locaux (non versionnés) dans .dev.vars
#    voir « Variables d'environnement » ci-dessous

# 3. Préparer la base D1 locale
npm run db:migrate:local
npm run db:seed:local

# 4. Lancer le serveur de développement
npm run dev
```

Le site est servi sur **http://localhost:3000**. Le `next dev` charge les
bindings Cloudflare (D1, R2, KV) via OpenNext.

> 💡 La **CSP avec nonce** n'est active qu'en production. Pour la tester avant
> de déployer : `npm run preview` (build + aperçu Workers en local).

---

## Variables d'environnement

### Clés publiques (versionnées)

`.env.development` (Stripe **test**) et `.env.production` (Stripe **live**) :

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Clé publiable Stripe (test en dev, live en prod) |

### Secrets — local : `.dev.vars` · prod : secrets Cloudflare

> ⚠️ Jamais versionnés. En production, gérés via `wrangler secret put` ou le
> dashboard Cloudflare.

| Variable | Rôle |
| --- | --- |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Signature des webhooks Stripe |
| `BETTER_AUTH_SECRET` | Secret de signature des sessions |
| `RESEND_API_KEY` | Envoi d'e-mails (optionnel — sans clé, l'envoi est ignoré) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Connexion Google |
| `APPLE_*` / `FACEBOOK_*` | Fournisseurs sociaux additionnels (optionnels) |
| `CRON_SECRET` | Jeton de la maintenance planifiée (purge R2) |

### Variables non-secrètes (dans `wrangler.jsonc`)

| Variable | Valeur |
| --- | --- |
| `BETTER_AUTH_URL` | `https://swiss3design.ch` |
| `ADMIN_EMAILS` | Adresses recevant le rôle admin |
| `EMAIL_FROM` | Expéditeur des e-mails |

### Bindings Cloudflare

`DB` (D1) · `R2` (fichiers) · `KV` (cache / rate-limit) · `ASSETS` ·
`WORKER_SELF_REFERENCE`. Types régénérés avec `npm run cf-typegen`.

---

## Scripts npm

| Script | Action |
| --- | --- |
| `npm run dev` | Serveur de développement (bindings Cloudflare inclus) |
| `npm run build` | Build Next.js |
| `npm run lint` | ESLint |
| `npm run preview` | Build OpenNext + aperçu Workers en local (teste la CSP prod) |
| `npm run deploy` | Build OpenNext + déploiement Cloudflare |
| `npm run cf-typegen` | Régénère `cloudflare-env.d.ts` depuis `wrangler.jsonc` |
| `npm run db:generate` | Génère une migration Drizzle depuis `src/db/schema.ts` |
| `npm run db:migrate:local` | Applique les migrations sur la D1 **locale** |
| `npm run db:migrate:remote` | Applique les migrations sur la D1 **de production** |
| `npm run db:seed:local` | Injecte `scripts/seed.sql` dans la D1 locale |

---

## Base de données

Schéma défini dans [`src/db/schema.ts`](src/db/schema.ts) (Drizzle ORM, dialecte
SQLite). Le workflow :

```bash
# Après modification du schéma → générer la migration
npm run db:generate

# Appliquer en local
npm run db:migrate:local
```

Les migrations sont stockées dans [`drizzle/`](drizzle) et **appliquées
automatiquement à la base de production** par Cloudflare Workers Builds à chaque
push sur `main` (voir [Déploiement](#déploiement)). Ne jamais éditer un fichier de
migration déjà appliqué.

---

## Déploiement

Hébergement **Cloudflare Workers** via l'adaptateur OpenNext. Le build de
production utilise **webpack** (les chunks Turbopack cassent le bundling
OpenNext).

### Automatique (recommandé)

Le dépôt est connecté à **Cloudflare Workers Builds** (intégration Git native).
Tout push sur `main` déclenche, côté Cloudflare et avec ses propres identifiants :

1. build OpenNext (`opennextjs-cloudflare build`) ;
2. application des **migrations D1** manquantes sur la base de production ;
3. **déploiement** sur Cloudflare Workers.

> Il n'y a **plus de workflow GitHub Actions** : le statut de déploiement est porté
> par le *check* « Cloudflare Workers Builds » sur le commit (vert = build **et**
> deploy réussis ; rouge = l'ancienne version reste en ligne, rien n'est cassé).
> Détails et procédure de (re)connexion Git :
> [`docs/deploiement-cloudflare.md`](docs/deploiement-cloudflare.md).

Pour publier en un clic : double-cliquer sur [`scripts/push.bat`](scripts/push.bat)
(commit + push), et la mise en production démarre automatiquement.

### Manuel

```bash
npm run deploy   # build + déploiement depuis la machine locale
```

Le domaine `swiss3design.ch` (et `www`) est routé en *custom domain* dans
[`wrangler.jsonc`](wrangler.jsonc).

---

## Sécurité

- **CSP avec nonce par requête** en production (plus d'`unsafe-inline`). Tout
  `<script>` inline doit recevoir le `nonce` — à vérifier via `npm run preview`.
- **Middleware Edge** ([`src/middleware.ts`](src/middleware.ts)) : routage i18n
  et en-têtes de sécurité.
- **Rate-limiting** via KV ([`src/lib/rate-limit.ts`](src/lib/rate-limit.ts)).
- **`security.txt`** publié sous [`public/.well-known/`](public/.well-known).
- Corrections issues d'un audit **PentestTools**.

---

## Internationalisation

Quatre langues gérées par **next-intl** : **français** (défaut), allemand,
italien, anglais. La langue est détectée via l'en-tête `Accept-Language`, puis
reflétée dans l'URL (`/fr`, `/de`, `/it`, `/en`). Les traductions vivent dans
[`messages/`](messages).

---

## Propriété & licences

Projet **privé** — © 2026 Swiss3Design. Tous droits réservés.

Les modèles 3D proposés à la vente sont des **produits tiers sous licence** ; chaque
licence doit autoriser la vente d'impressions physiques.

<div align="center">

---

Fait avec ❤️ en Suisse · [swiss3design.ch](https://swiss3design.ch)

</div>

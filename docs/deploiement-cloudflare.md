# Déploiement — Cloudflare Workers Builds (connexion Git native)

Ce document explique comment le site est déployé et comment (re)connecter GitHub
à Cloudflare si besoin.

## Pourquoi ce mode de déploiement

- **Avant** : GitHub Actions buildait puis déployait avec `wrangler deploy`,
  authentifié par le secret GitHub `CLOUDFLARE_API_TOKEN`.
- **Problème** : ce token a expiré → le push du 16/06/2026 a échoué sur
  `Unable to authenticate request [code: 10001]` et le site n'a pas été redéployé.
- **Maintenant** : Cloudflare est connecté directement au dépôt GitHub
  (**Workers Builds**). À chaque push sur `main`, Cloudflare **build + applique
  les migrations D1 + déploie**, avec ses propres identifiants — plus aucun token
  à gérer ni à renouveler.
- Le **statut de déploiement** est porté par Cloudflare : Workers Builds publie sur
  chaque commit un **check GitHub** qui n'est vert que si le build **et** le deploy
  ont réellement réussi. L'ancien workflow GitHub Actions a été **supprimé** pour ne
  pas afficher un second « vert » trompeur.

## Pré-requis (déjà en place)

- Dépôt GitHub : `Thomas-TP/Swiss3Design`.
- Worker existant : `swiss3design` (domaine `swiss3design.ch`, bindings D1/R2/KV).
- **Secrets runtime déjà configurés sur le Worker** (Stripe secret, BETTER_AUTH_SECRET,
  OAuth Google, e-mail…). La connexion Git **ne les touche pas** : ils restent.
- `.env.production` est **commité** (clés publiques seulement, dont
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`). Elles sont inlinées automatiquement au
  build → **aucune variable de build à reconfigurer** côté Cloudflare.

## Étapes — connecter GitHub à Cloudflare

1. Aller sur https://dash.cloudflare.com → **Workers & Pages** (ou **Compute**).
2. Ouvrir le Worker existant **swiss3design**.
3. Onglet **Settings** → section **Builds** → cliquer **Connect** (connexion à Git).
   *(Le nom du Worker doit correspondre au `name` de `wrangler.jsonc` — ici les deux
   valent `swiss3design`, donc OK.)*
4. **Autoriser** l'app GitHub « Cloudflare Workers & Pages » (popup GitHub).
   Choisir *Only select repositories* → **Swiss3Design** → valider.
5. De retour sur Cloudflare :
   - **Repository** : `Thomas-TP/Swiss3Design`
   - **Production branch** : `main`
6. **Build configuration** :
   - **Build command** :
     ```
     npx opennextjs-cloudflare build
     ```
   - **Deploy command** :
     ```
     npx wrangler d1 migrations apply swiss3design-db --remote && npx wrangler deploy
     ```
   - **Root directory** : `/` (par défaut)
   - **Build variables** : rien à ajouter (clés publiques déjà dans `.env.production`).
7. **Save and Deploy** → Cloudflare lance un premier build depuis `main`.

> **Pourquoi les migrations sont dans le deploy command** : elles s'appliquent
> (de façon idempotente) **avant** `wrangler deploy`. Si une migration échoue, le
> `&&` bloque le déploiement → l'ancien code reste en ligne sur l'ancien schéma
> (état cohérent, jamais de demi-déploiement). L'environnement Workers Builds
> fournit l'authentification Cloudflare, donc **aucun token n'est requis**.
>
> **Filet de sécurité** : si un jour l'étape migrations échoue pour une raison
> d'authentification, retire-la du deploy command et applique les migrations en
> local avant le push : `npm run db:migrate:remote`.

## Vérifier que ça marche

- Worker **swiss3design → Deployments / Builds** : le build passe de *Building* à
  *Success*. Les logs montrent `opennextjs-cloudflare build`, l'application des
  migrations, puis le deploy.
- Ouvrir https://swiss3design.ch pour confirmer.

## Au quotidien

- `git push` sur `main` (ou merge d'une PR) → Cloudflare build + migre + déploie
  automatiquement.
- Les branches / PR génèrent des **builds de preview** avec une URL de test
  (commentée directement sur la PR GitHub).
- Le statut s'affiche directement sur le commit via le **check Cloudflare Workers
  Builds** : vert = build + deploy réussis ; rouge = échec (l'ancienne version reste
  en ligne, rien n'est cassé).

## Réessayer / revenir en arrière

- **Retry** : depuis GitHub, ouvrir le Check Run échoué → *Details* → **Rerun**
  (ou dashboard Cloudflare → Builds → *Retry*).
- **Rollback** : dashboard → swiss3design → **Deployments** → choisir un
  déploiement précédent → **Rollback**.

## Nettoyage (optionnel)

- GitHub → repo → *Settings → Secrets and variables → Actions* : le secret
  `CLOUDFLARE_API_TOKEN` n'est plus utilisé, tu peux le **supprimer**.
- Le workflow `.github/workflows/deploy.yml` a été supprimé : le check de
  déploiement vient désormais de Cloudflare. Plus aucun workflow GitHub Actions.

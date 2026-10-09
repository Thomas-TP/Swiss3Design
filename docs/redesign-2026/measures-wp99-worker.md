# WP-99 · Worker : un seul exemplaire de chaque module

**09.10.2026.** Branche `claude/redesign-2026--wp99-worker` (commit `685e293`, intégrée dans
`claude/redesign-2026--verify-wp99`). Un seul fichier de code modifié : `next.config.ts`. Vue
d'ensemble de WP-99 : [`measures-wp99.md`](measures-wp99.md).

## Résultat

| Mesure (dossier de 41 caractères, `wrangler deploy --dry-run`) | Contrôle (HEAD `2efa27e`, sans le hook) | Avec le hook (`685e293`) | Écart                                 |
| -------------------------------------------------------------- | --------------------------------------- | ------------------------ | ------------------------------------- |
| `Total Upload` brut                                            | 16 986,69 KiB                           | 12 894,95 KiB            | −4 091,74 KiB                         |
| `Total Upload` gzip                                            | **3 336,02 KiB**                        | **2 460,34 KiB**         | **−875,68 KiB (−26 %)**               |
| Mesure du premier agent (autre build du même code)             | 3 333,53 KiB                            | 2 459,42 KiB             | −874,11 KiB                           |
| Plafond du brief (§4.11, 30.09) / cible WP-99                  | 3 185 / ≈ 3 250 KiB                     | tenus                    |                                       |
| Signatures three / gsap / lenis (`check-worker-bundle.ts`)     | 0                                       | 0                        |                                       |
| Client (`chunk-report.ts`)                                     | 209 chunks, 1 220,3 KiB gzip            | identique                | le hook ne touche pas le build client |

Après fusion de tous les lots de WP-99 (nettoyage des clés mortes compris), la mesure finale est
de **2 456,33 KiB gzip** (voir `measures-wp99.md`).

## Ce que fait le hook

Webpack compile un module **une fois par couche** : `rsc` (pages, layouts, routes), `action-browser`
(Server Actions importées par un composant client) et `ssr` (rendu serveur des composants client).
La pile d'authentification (better-auth et ses greffons, kysely, drizzle), Stripe et zod se
retrouvaient donc en deux ou trois exemplaires (1,2 Mo bruts chacun pour l'authentification, zod en
trois), et, par défaut, Next ne sort un module partagé dans un fichier commun que s'il pèse ≥ 20 Ko
et tant qu'une page ne charge pas plus de 30 fichiers : le reste était recopié dans chaque page et
chaque route (119 entrées). Trois réglages, actifs seulement dans le build webpack serveur Node.js
d'`opennextjs-cloudflare build` (`next build --webpack`) :

1. **`action-browser` → `rsc`** : tout module demandé depuis une Server Action, sauf `next`, `react`,
   `react-dom`, `scheduler` (les seuls paquets liés à la couche). Les fichiers `"use server"` eux-mêmes
   restent dans leur couche.
2. **`ssr` → `rsc`** : seulement du code pur, zod et `src/lib/studio/**` (la bibliothèque du Studio,
   importée à la fois par le serveur de pages et par le rendu des composants client).
3. **`splitChunks` serveur sans `minSize` ni plafond de requêtes** : chaque module n'existe qu'une
   fois ; le coût (plus de petits fichiers) est nul dans le Worker, où tout tient dans un seul fichier.

Ce qui change : l'**emplacement** des modules dans `.next/server`. Ce qui ne change pas : le code
exécuté, les modules déplacés étant résolus avec les mêmes conditions d'export, les mêmes alias et la
même chaîne de loaders (voir l'examen de risque).

## Examen de risque

- **`ssr` → `rsc`.** zod 4.6.5 n'a aucune dépendance et aucune condition d'export propre à une couche
  (`react-server`, `node`, `browser`). `src/lib/studio/**` hors tests n'importe que d3-contour (qui
  dépend de d3-array puis internmap, mêmes exports), earcut et zod ; `testing.ts` (`node:fs`) n'est
  importé par aucun fichier de l'application. 0 import de `react`, `react-dom`, `next`,
  `server-only`, `client-only`, 0 directive `"use client"` ou `"use server"` dans `src/lib/studio`. La
  chaîne de loaders se choisit par la couche de l'importeur : un module déplacé résout ses dépendances
  avec les conditions `react-server` comme tout module `rsc`.
- **`action-browser` → `rsc`.** `GROUP.builtinReact = [rsc, action-browser]` dans
  `next/dist/lib/constants.js` : `webpack-config.js` applique aux deux les mêmes `conditionNames`
  (`react-server`), les mêmes alias de React vendorisé, les mêmes alias `server-only` / `client-only` et
  les mêmes loaders. Seul le nom de la couche diffère. Aucun paquet npm de la couche `action-browser`
  (448 modules au build de référence) n'importe React hors `next` ; les trois fichiers `"use client"` de
  `src/lib` (`auth-client`, `cart`, `favorites`) ne sont importés par aucune des 20 Server Actions.
- **État de module partagé entre couches** (désormais commun, jamais dépendant de la couche) : pool
  Postgres par requête (`src/db/index.pg.ts`, une `WeakMap` indexée par le contexte de requête : un seul
  pool par requête entre l'action et le rendu, libéré par `after()`), ensemencement OAuth (une fois par
  isolate, `INSERT … ON CONFLICT DO NOTHING`), clé du cache JWKS, registres de zod sur `globalThis` ;
  aucun `cache()` de React ni `unstable_cache` dans `src/lib` ni `src/db`. Côté Studio : caches purs
  (caméra du héros, analyse de Lavaux, relief, `Intl.NumberFormat`) ; la police de glyphes n'est
  enregistrée que par `src/motion` (navigateur).
- **Même chemin en CI.** `open-next.config.ts` : `buildCommand = npx next build --webpack` ; Workers
  Builds exécute `npx opennextjs-cloudflare build` (production et preview), donc le hook tourne aussi
  sur Linux (`packageOf` et `unixPath` ne dépendent pas du séparateur). `next dev` (Turbopack) démarre
  avec le hook, qui est ignoré ; un `next build` nu l'ignore aussi, comme avant. Observation : l'absence
  d'erreur de `next dev` tient à la clé `turbopack` que le plugin next-intl ajoute ; si elle disparaissait,
  `bun run dev` s'arrêterait avec un message clair de Next (ajouter `turbopack: {}`), jamais la production.

## Équivalence fonctionnelle contre le contrôle (build sans le hook, même HEAD)

Deux builds `opennextjs-cloudflare` dans le dossier de 41 caractères, servis chacun par
`opennextjs-cloudflare preview -- --upstream-protocol https`, mêmes variables, même base de test.

- **119 URL** (58 pages : 4 langues, boutique, produit, Studio et ses 4 objets, sur mesure, Atelier,
  contact, panier, checkout, connexion, légales, redirections compte et admin, 404 ; 61 sondes GET /
  OPTIONS / HEAD / POST sans effet : `robots.txt`, `sitemap.xml`, `llms.txt`, `agents.md`, `auth.md`,
  `openapi.json`, `manifest.webmanifest`, 13 fichiers `.well-known`, `/a2a`, `/mcp`, `/mcp/account`,
  `/api/v1/*`, `/api/auth/*`, webhook Stripe à signature invalide, `discount/validate`, MCP
  `tools/list` et `tools/call`, A2A, `track-order`, `csp-report`…) : mêmes statuts et mêmes corps après
  neutralisation de l'identifiant de build, des noms hachés, des identifiants d'actions, des nonces et
  des UUID. Une seule différence brute : la page 404 de `GET /a2a/.well-known/agent-card.json`, dont seul
  l'identifiant de build diffère. Deux captures du même build sont identiques entre elles.
- **37 Server Actions** appelées sur leur page : mêmes statuts et mêmes corps (13 × 200 dont
  « unauthenticated », qui exerce session, better-auth et base ; 24 × 500 par charge synthétique
  invalide, aussi en contrôle) ; seul le nonce CSP aléatoire diffère dans deux corps.
- **17 pages en navigateur** (`/fr /de /it /en`, boutique, produit, Studio et ses 4 objets, sur mesure,
  Atelier, contact, panier, checkout, connexion) : 0 violation CSP, 0 erreur d'hydratation, 0
  `MISSING_MESSAGE`, 0 défilement horizontal, 1 `h1`, journal identique au contrôle.
- **Parcours réels** (CDP, résultats identiques octet pour octet au contrôle) : ajout au panier depuis
  la fiche puis depuis une carte de la boutique, le panier liste le produit ; formulaire `/fr/custom` avec
  e-mail et description invalides (alerte, formulaire conservé) ; contact (honeypot : succès sans écriture
  ni envoi ; e-mail invalide : alerte) ; connexion avec un mauvais mot de passe (message d'erreur) ;
  Studio de Lavaux (hauteur 150 → 190 mm, dimensions mises à jour, tiroir d'envoi ouvert avec son champ
  e-mail, non envoyé). `RESEND_API_KEY` vide : aucun e-mail possible. Le Studio n'a pas de panier (devis
  seulement) : « ajout au panier depuis un objet du Studio » n'existe pas.

La vérification d'intégration de WP-99 rejoue ces parcours sur le build fusionné : `measures-wp99.md`.

## Leviers non retenus

| Levier prévu (brief §4.11, 01.10)                         | Décision        | Raison                                                                                                                                                                                                                                                               |
| --------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) pas de copie RSC/SSR en double de `src/lib/studio/**` | **fait** (hook) | Une seule copie de `schemas.ts` (`z.config` jitless dans un seul chunk) et une seule de zod (3 copies avant).                                                                                                                                                        |
| (b) messages du Studio par langue                         | **sans objet**  | Le Worker sert les 4 langues, donc les 4 jeux restent dans le bundle : 52 Ko bruts, 18,5 KiB gzip pour `studio` + `studioCore` (13,5 + 5,0). Plafond théorique 13,9 KiB si une seule langue y restait. Charger par fichier (non eager) augmenterait même la taille.  |
| (c) `zod/mini` au lieu de `zod`                           | **abandonné**   | Le zod complet reste dans le Worker de toute façon : better-auth (83 fichiers), `@better-auth/core` (21), oauth-provider (5), passkey (2) et better-call font 112 imports de `zod`. Passer nos 20 fichiers à `zod/mini` n'ôterait rien et réécrirait l'API (risque). |

## Ce qui reste

- **Doublons** (`dups.mjs` sur `.next/server`) : 54 groupes, 211 KiB bruts, tous des internes de Next
  dupliqués par couche par conception, plus une table CSS de 0,6 KiB ; aucun code de l'application ni
  paquet npm dupliqué.
- **Plus gros poste de page** : `admin/featured/page.js`, dont 42,8 KiB gzip sont la copie SSR de
  `Reorder` de `motion/react`. Le sortir du Worker exigerait `next/dynamic` avec `ssr: false` (la liste
  ne serait plus rendue côté serveur) : changement de comportement de l'admin, **non fait** ; la marge
  (2 456 KiB pour un plafond de 3 185) rend le gain inutile.
- À remesurer à chaque changement qui déplace des modules entre couches (`AGENTS.md`, règle 10).

## Méthode (à rejouer)

1. Copier le worktree dans `C:\s3d-matched-path-w2a-0123456789abcdefg` (41 caractères ; `robocopy /MIR`
   sauf `.git`, `node_modules`, `.next`, `.open-next`).
2. `bunx opennextjs-cloudflare build`, avec `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`
   dans l'environnement (jamais affichée), puis `bunx wrangler deploy --dry-run` : ligne
   `Total Upload … / gzip:`.
3. `bun scripts/check-worker-bundle.ts` (0 signature) et `bun scripts/chunk-report.ts` (client inchangé).
4. Équivalence : deux builds (avec et sans le bloc `webpack()`), même série de requêtes sur les deux
   `preview`, comparaison des statuts et des corps après neutralisation de ce que Next change à chaque
   build ou à chaque requête (identifiant de build, noms hachés, identifiants d'actions, nonces, UUID).
   Sous MSYS Git Bash, `MSYS_NO_PATHCONV=1` pour passer des chemins commençant par `/` aux scripts.

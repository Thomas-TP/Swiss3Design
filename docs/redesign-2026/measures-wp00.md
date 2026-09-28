# WP-00 · Mesures

Mesures de référence de la refonte « Strates » (brief §4.11, fiche WP-00 étape 1),
prises **avant tout changement de code** sur `claude/redesign-2026` (commit `fd61dee`),
puis complétées à chaque étape de WP-00 qui peut bouger le bundle.

## Environnement

|           |                                                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Date      | 28.09.2026                                                                                                                                      |
| Machine   | Windows 11, worktree local (OpenNext sous Windows, sans WSL)                                                                                    |
| Outils    | Bun 1.4.2 · Next 16.3.6 (webpack) · `@opennextjs/cloudflare` 1.20.6 · wrangler 4.141.0                                                          |
| Commandes | `bunx opennextjs-cloudflare build` puis `bunx wrangler deploy --dry-run` ; `bun scripts/check-worker-bundle.ts` ; `bun scripts/chunk-report.ts` |

Les deux scripts arrivent à l'étape 3 de WP-00 ; ils ne font que lire `.open-next/` et
`.next/`, et ont été lancés sur la sortie du build de référence avant tout commit de code.

## 1. Référence (avant WP-00)

### Worker (règle d'or 10)

| Mesure                                                                 | Valeur            |
| ---------------------------------------------------------------------- | ----------------- |
| `Total Upload` (wrangler, dry-run)                                     | **15 853,89 KiB** |
| `gzip` (wrangler, dry-run) : **la valeur qui compte**                  | **3 064,86 KiB**  |
| Signatures three / gsap / lenis dans le Worker (`check-worker-bundle`) | **0**             |

La note d'`AGENTS.md` (2 946 KiB au 27.09) est dépassée d'environ 119 KiB : c'est la
base de la refonte. Budget du §4.11 : **≤ 3 084,86 KiB** gzip à la fin de WP-00
(base + 20 KiB), **≤ 3 124,86 KiB** à la fin de la refonte (base + 60 KiB).

Ventilation indicative (`check-worker-bundle`, gzip fichier par fichier, donc sans
rapport direct avec le chiffre de wrangler) : `handler.mjs` 2 589,0 KiB,
`server-functions/default/.next/` 2 293,8 KiB, `server-functions/default/node_modules/`
5 011,8 KiB, middleware 102,1 KiB.

### Chunks client (`chunk-report`)

164 chunks dans `.next/static/chunks` : 1 011,2 KiB gzip au total.

JS initial par page (rootMainFiles + chunks des modules client de la route, hors
chunks `next/dynamic`), mesuré avec la première version du script, qui comptait aussi
les chunks d'entrée hors de la chaîne de la route (voir la note de la section 2) :

| Route                                       | gzip          | brut      | chunks |
| ------------------------------------------- | ------------- | --------- | ------ |
| `/[locale]` (accueil)                       | **218,7 KiB** | 691,8 KiB | 13     |
| `/[locale]/shop`                            | 222,5 KiB     | 702,9 KiB | 13     |
| `/[locale]/products/[slug]`                 | 225,6 KiB     | 711,7 KiB | 14     |
| `/[locale]/custom`                          | 241,0 KiB     | 755,7 KiB | 15     |
| `/[locale]/a-propos`                        | 243,6 KiB     | 765,9 KiB | 15     |
| `/[locale]/contact`                         | 239,7 KiB     | 750,9 KiB | 15     |
| `/[locale]/cart` (témoin hors `(site)`)     | 246,1 KiB     | 769,1 KiB | 16     |
| `/[locale]/checkout` (témoin hors `(site)`) | 255,9 KiB     | 797,5 KiB | 17     |

Budget du §4.11 : JS initial de l'accueil **≤ 233,7 KiB** gzip (actuel + 15 KiB).

Chunks qui embarquent déjà un moteur : `bd904a5c…` (three, 99,4 KiB gzip),
`b536a0f1…` (three, 87,3 KiB) et `4668…` (3,7 KiB, notre viewer qui appelle
`THREE.WebGLRenderer`), tous chargés par `next/dynamic` depuis
`product-viewer-3d.tsx`, donc absents du JS initial. Aucun chunk gsap ni lenis.

Les 15 plus gros chunks (gzip) :

| gzip     | brut      | moteur | fichier                         |
| -------- | --------- | ------ | ------------------------------- |
| 99,4 KiB | 371,0 KiB | three  | `bd904a5c.90c130a0395f68cc.js`  |
| 96,5 KiB | 294,9 KiB | —      | `b468fba8.82c69e67d4c3165f.js`  |
| 96,5 KiB | 294,9 KiB | —      | `d3cfdde2.33efec35f03e6db0.js`  |
| 87,3 KiB | 359,4 KiB | three  | `b536a0f1.38a847592118e1c9.js`  |
| 68,1 KiB | 213,8 KiB | —      | `framework-3a41051109d8ea39.js` |
| 64,6 KiB | 235,7 KiB | —      | `3794-9e890110b26aff02.js`      |
| 62,5 KiB | 196,3 KiB | —      | `4bd1b696-8a4ab4fdf0ae305a.js`  |
| 43,4 KiB | 130,0 KiB | —      | `1269-5175932c2e5be88b.js`      |
| 40,0 KiB | 134,8 KiB | —      | `main-34f2b975612ba71a.js`      |
| 39,0 KiB | 110,0 KiB | —      | `polyfills-42372ed130431b0a.js` |
| 18,7 KiB | 53,9 KiB  | —      | `4144-f70ee2ec9637e58b.js`      |
| 13,1 KiB | 43,8 KiB  | —      | `6883.fa3beb2d9c3db9d5.js`      |
| 11,9 KiB | 38,8 KiB  | —      | `1697-661378e286fea6a2.js`      |
| 8,4 KiB  | 23,0 KiB  | —      | `2026-c075cfd1bab987a7.js`      |
| 8,3 KiB  | 19,7 KiB  | —      | `9394-de7ee51596897530.js`      |

### Lighthouse

Non mesuré dans cette passe (facultatif pour WP-00a : pas de navigateur piloté pour
Lighthouse dans la session). À faire sur `bun run preview` avant le jalon J0 : mobile,
`/fr`, `/fr/shop`, `/fr/products/vase-spirale`.

### Routes et sitemap (serveur de dev, avant le `git mv`)

Relevé des 6 pages vitrine × 4 langues, plus `/fr/cart`, `/fr/legal/terms` et deux 404
(statut, `<title>`, canonical, nombre de h1 et de blocs JSON-LD) et copie de
`/sitemap.xml` : tous en 200 (404 pour les deux URL inexistantes), un seul h1 par
page (les deux 404 n'ont aucun h1 dans le HTML du serveur de dev, avant comme après
le déplacement : point à revoir par WP-UTILITY). Ce relevé sert de témoin à l'étape 4.

## 2. Après les étapes 2 à 4 de WP-00 (paquets, garde-fous, groupe `(site)`)

Build `bunx opennextjs-cloudflare build` sur `claude/redesign-2026--wp00-base`, après
l'ajout des paquets du §4.7 (aucun n'est encore importé), des garde-fous et du
`git mv` des six routes vitrine dans `src/app/[locale]/(site)/` avec son
`layout.tsx` et une `SiteShell` minimale.

### Worker

| Mesure                                              | Référence     | Après l'étape 4  | Écart     |
| --------------------------------------------------- | ------------- | ---------------- | --------- |
| `Total Upload` (dry-run)                            | 15 853,89 KiB | 15 882,26 KiB    | +28,4 KiB |
| `gzip` (dry-run)                                    | 3 064,86 KiB  | **3 057,96 KiB** | −6,9 KiB  |
| Signatures three/gsap/lenis (`check-worker-bundle`) | 0             | **0**            | —         |

Dans le budget de WP-00 (≤ base + 20 KiB gzip). L'écart négatif relève de la variation
d'un build à l'autre : aucun code servi n'a changé hormis la `SiteShell`.

### JS initial

À méthode égale (première version du script), chaque page gagne 0,3 KiB gzip et un
chunk : celui du layout `(site)`, que Next fusionne dans le manifeste de toutes les
pages de `/[locale]`. Accueil : 218,7 → **219,0 KiB** (budget ≤ 233,7 KiB).

Le script a ensuite été corrigé : Next fusionne dans le manifeste d'une page ceux de
ses segments parents, si bien que `/shop` comptait aussi la page d'accueil. Les chunks
d'entrée `app/…` hors de la chaîne de la route sont désormais retirés (les chunks
partagés restent comptés : c'est une borne haute). L'accueil n'est pas concerné.

| Route                                | gzip          | brut      | chunks |
| ------------------------------------ | ------------- | --------- | ------ |
| `/[locale]` (accueil)                | **219,0 KiB** | 692,1 KiB | 14     |
| `/[locale]/shop`                     | 218,9 KiB     | 692,3 KiB | 13     |
| `/[locale]/products/[slug]`          | 222,0 KiB     | 701,1 KiB | 14     |
| `/[locale]/custom`                   | 237,5 KiB     | 745,1 KiB | 15     |
| `/[locale]/a-propos`                 | 240,0 KiB     | 755,3 KiB | 15     |
| `/[locale]/contact`                  | 236,1 KiB     | 740,4 KiB | 15     |
| `/[locale]/cart` (hors `(site)`)     | 242,3 KiB     | 758,2 KiB | 15     |
| `/[locale]/checkout` (hors `(site)`) | 252,1 KiB     | 786,6 KiB | 16     |

Ce tableau est la référence pour les packages suivants.

### Routes, sitemap, 404

- Table des routes de `next build` : **identique** (121 lignes, aucune URL changée).
- `/sitemap.xml` (serveur de dev, catalogue de la branche Neon `preview`) :
  **identique à l'octet** (même SHA-256 avant et après).
- Relevé des 28 URL (6 pages × 4 langues, `/fr/cart`, `/fr/legal/terms`, deux 404) :
  statut, `<title>`, canonical, nombre de h1 et de JSON-LD **identiques**.
- Navigation client dans le navigateur : `/fr/shop` → `/fr/a-propos` → `/fr/cart` (hors
  `(site)`) → `/fr`, sans erreur de console.

## 3. Vérification de fin de WP-00

Checkout principal, branche `claude/redesign-2026` au commit `4d29a15` (fusion de
`claude/redesign-2026--wp00-chrome`), 28.09.2026. Mêmes outils qu'en section 1.

### Contrôles du §10

| Contrôle               | Résultat                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`         | vert                                                                                                                                                                       |
| `bun run typecheck`    | vert après le build (avant : 18 erreurs dans les `.next/types` périmés d'un build d'avant le `git mv`)                                                                     |
| `bun run test`         | vert : 22 fichiers, 374 tests (15 ignorés sans URL) ; `messages.test.ts` et `boundary.test.ts` : 174 tests verts                                                           |
| `bun run format:check` | **rouge** : les 14 fichiers de `docs/redesign-2026/{DESIGN-BRIEF,concepts,research}` (commit `fd61dee`, antérieur à WP-00) ne sont pas formatés ; `measures-wp00.md` l'est |

### Worker

| Mesure                                              | Référence     | Fin de WP-00     | Écart      |
| --------------------------------------------------- | ------------- | ---------------- | ---------- |
| `Total Upload` (dry-run)                            | 15 853,89 KiB | 15 743,98 KiB    | −109,9 KiB |
| `gzip` (dry-run)                                    | 3 064,86 KiB  | **3 062,66 KiB** | −2,2 KiB   |
| Signatures three/gsap/lenis (`check-worker-bundle`) | 0             | **0**            | —          |

Dans le budget de WP-00 (≤ 3 084,86 KiB). Ventilation `check-worker-bundle` : 1 565
fichiers, `node_modules/` 5 011,8 KiB, `handler.mjs` 2 586,0 KiB, `.next/` 2 309,0 KiB,
middleware 102,0 KiB (gzip fichier par fichier).

### Chunks client

173 chunks, 1 100,6 KiB gzip (3 400,0 KiB brut).

| Route (JS initial, borne haute)      | gzip          | brut      | chunks | Écart / section 2 |
| ------------------------------------ | ------------- | --------- | ------ | ----------------- |
| `/[locale]` (accueil)                | **224,8 KiB** | 709,0 KiB | 14     | +5,8 KiB          |
| `/[locale]/shop`                     | 224,8 KiB     | 709,3 KiB | 13     | +5,9 KiB          |
| `/[locale]/products/[slug]`          | 227,9 KiB     | 718,0 KiB | 14     | +5,9 KiB          |
| `/[locale]/custom`                   | 243,5 KiB     | 762,6 KiB | 15     | +6,0 KiB          |
| `/[locale]/a-propos`                 | 245,8 KiB     | 772,2 KiB | 15     | +5,8 KiB          |
| `/[locale]/contact`                  | 242,0 KiB     | 757,3 KiB | 15     | +5,9 KiB          |
| `/[locale]/cart` (hors `(site)`)     | 245,3 KiB     | 767,5 KiB | 15     | +3,0 KiB          |
| `/[locale]/checkout` (hors `(site)`) | 255,3 KiB     | 796,4 KiB | 16     | +3,2 KiB          |

Accueil dans le budget (≤ 233,7 KiB). Chunks des gates, d'après
`.next/react-loadable-manifest.json` (gzip zlib par défaut, comme `chunk-report`) :

| Gate                                | Chunks                                               | gzip           | Budget    |
| ----------------------------------- | ---------------------------------------------------- | -------------- | --------- |
| `@/motion/runtime` (gsap + Lenis)   | `4745…` 44,00 · `c15bf2b0…` 19,50 · `7783…` 1,86     | **65,36 KiB**  | ≤ 65 KiB  |
| `@/motion/stage/stage-root` (three) | `bd904a5c…` 99,44 · `b536a0f1…` 87,26 · `5445…` 6,90 | **193,60 KiB** | ≤ 200 KiB |
| scène `product-viewer`              | `3753…` 2,58                                         | 2,58 KiB       | ≤ 15 KiB  |

Le chunk runtime dépasse son budget de 0,36 KiB. Le Stage n'est demandé par aucune
page (aucun `StageView` monté à ce stade) : taille statique seulement.

### Navigateur (`opennextjs-cloudflare preview`, CSP de production)

`bun run preview` boucle en 308 sur toutes les pages en HTTP : wrangler donne à
`request.url` l'hôte de la première route (`swiss3design.ch`), et le middleware
redirige alors `http:` vers `https:` (`src/middleware.ts`, lignes 156 à 163, antérieur
à la refonte). Relevés faits sur le même build servi par
`bunx opennextjs-cloudflare preview --port 8792 --local-upstream localhost:8792`
(les sondes `curl` aussi en `--local-protocol https`).

- **SSR** (`curl`, HTTPS) : 200 et un seul h1 sur `/fr`, `/fr/shop`,
  `/fr/products/vase-spirale`, `/fr/contact`, `/fr/custom`, `/fr/a-propos`, `/fr/cart`,
  `/fr/checkout`, `/fr/legal/terms` ; `/fr/account` → 307 vers la connexion. CSP à nonce
  partout, 100 % des scripts inline portent le nonce.
- **CSP et hydratation**, mouvement complet, 1440 × 900, clair et sombre : aucune
  violation CSP, aucune erreur d'hydratation sur `/fr`, `/fr/shop`,
  `/fr/products/vase-spirale`, `/fr/contact`. Seule erreur : 404 sur
  `/posters/field-footer-{light,dark}.svg` (fond du cartouche du footer, fichiers absents
  de `public/`), sur toutes les pages.
- **`html.lenis`** : présent sur `/fr`, `/fr/shop`, `/fr/products/vase-spirale`,
  `/fr/contact` ; absent sur `/fr/cart`, `/fr/checkout`, `/fr/account`,
  `/fr/legal/terms`, `/fr/track`, `/fr/favorites`. En navigation client, `/fr/shop` →
  `/fr/cart` retire la classe et `/fr/cart` → `/fr/shop` la remet.
- **three** : aucun chunk three demandé sur `/fr/contact` (ni sur `/fr`, `/fr/shop`, ni
  sur la fiche avant d'ouvrir la vue 3D).
- **Interrupteur du footer** : bascule sans rechargement (Lenis détruit,
  `data-motion="reduce"`, `localStorage["s3d-motion"]`), le rechargement suivant ne
  télécharge plus le runtime ; le script anti-FOUC (nonce, deuxième enfant de
  `<body>`, avant tout contenu visible) pose `data-motion` avant le paint.
- **Mouvement réduit** (Chromium headless, `prefers-reduced-motion` émulé par CDP) :
  ni Lenis ni runtime, contenu dans son état final. Mais, sur `/fr` seulement, erreur
  React #418 (hydratation) et `data-motion` perdu sur `<html>` après la reprise de
  React. Avec l'interrupteur sur « reduce » et l'OS sans préférence, le héros de
  l'accueil boucle toujours et les `Reveal` s'animent encore au défilement :
  `motion/react` ne lit que la préférence du système.
- **Mobile** 375 × 812 (émulation tactile) : aucun défilement horizontal sur `/fr`,
  `/fr/shop`, `/fr/products/vase-spirale`, `/fr/contact`, `/fr/cart` ; BottomNav collée
  en bas ; bandeau de consentement au-dessus d'elle (bas du bandeau à 740 px, haut de la
  nav à 747 px).
- **Contrastes** (texte réel, couleur composée sur le fond effectif) : header, clair
  ≥ 5,21, sombre ≥ 7,07 ; footer, clair ≥ 5,21, sombre ≥ 6,45, hors le point rouge
  décoratif (`.s3d-dot`, texte transparent) ; bandeau de consentement (servi seulement
  en dev, hôte non mesuré en preview), clair ≥ 5,92, sombre ≥ 6,04. Aucun texte sous
  4,5:1.

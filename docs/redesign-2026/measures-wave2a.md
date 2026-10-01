# Vague 2a · Vérification et mesures

Vérification de ce que la vague 2a a fusionné dans `claude/redesign-2026` : les paquets de
la vague 1, les correctifs de la vague 1 (`fix-w1`) et **WP-02** (texte en relief,
Cartouche, Relief, Borne). Code vérifié : `6ceaf0c` (merge de WP-02) ; la branche de
vérification `claude/redesign-2026--verify-w2a` n'ajoute que de la documentation
(`4ab94a2`). **01.10.2026**, worktree isolé, rien poussé. Références : `measures-wave1.md`
(base de comparaison), `measures-wp00.md`, brief §4.11 et §10.

Ce document s'écrit au fil des étapes : chaque section est commitée dès que sa mesure est
faite (le passage précédent avait été coupé par la limite d'usage avant de rien consigner).

## Environnement

|            |                                                                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outils     | Bun 1.4.2 · Next 16.3.6 (webpack) · `@opennextjs/cloudflare` 1.20.6 · Vitest 5.0.2                                                                                                        |
| Dépôt      | worktree `wf_106251d3-62d-1` (chemin de 77 caractères, voir section 2 : la taille gzip du Worker en dépend), `bun install` à neuf (523 paquets)                                           |
| Navigateur | Edge headless piloté par CDP (Playwright `connectOverCDP`, port 9340), profil isolé, contextes neufs, cache désactivé pour le CLS, consentement non donné                                 |
| Garde-fous | jeux d'essai uniquement sur `localhost`, base = branche Neon de développement, clés Stripe de test, e-mails en `example.test`, aucun événement de mesure sorti (hôte ≠ `swiss3design.ch`) |

## 1. Contrôles du §10

| Contrôle               | Résultat                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`         | vert (oxlint, aucun diagnostic, 1 s)                                                                                                |
| `bun run typecheck`    | vert (18 s), `.next/types` et `.next/dev/types` supprimés avant                                                                     |
| `bun run test`         | vert : 44 fichiers passés (1 ignoré), **709 tests passés**, 15 ignorés sans URL de base (21 s)                                      |
| `bun run format:check` | **vert sur les 612 fichiers** (le fichier non suivi `docs/signature-infomaniak.html` du propriétaire n'existe pas dans ce worktree) |

## 2. Worker et chunks client

Build : `bunx opennextjs-cloudflare build` (réussi, `worker.js` produit), puis
`bunx wrangler deploy --dry-run`, `bun scripts/check-worker-bundle.ts` et
`bun scripts/chunk-report.ts`.

### 2.1 Worker (gzip du dry-run, la valeur qui compte)

**Les chiffres de ce tableau ne sont comparables qu'à chemin de build égal.** Les
manifestes du Worker embarquent des chemins absolus (le `handler.mjs` du worktree pèse
11 249,2 KiB brut contre 10 991,5 KiB dans un dossier de 41 caractères pour le même code) :
la taille gzip varie donc avec le dossier **et**, à code identique, d'un build à l'autre
(3 138,49 / 3 144,05 / 3 145,30 / 3 150,48 KiB pour le même code, soit ±6 KiB). Pour avoir
une référence propre, trois builds successifs ont été faits **dans un même dossier de
41 caractères** (la longueur du checkout principal, où la vague 1 avait été mesurée), avec
le même `node_modules` (écart de `node_modules` entre les trois : 0,0 KiB, aucune
dépendance n'a bougé).

| Révision (même dossier de 41 caractères) | `Total Upload` (brut) | `gzip` (dry-run) | Écart de gzip             |
| ---------------------------------------- | --------------------- | ---------------- | ------------------------- |
| `ac9d0a5` fin de la vague 1 (relevé)     | 15 901,83 KiB         | **3 110,61 KiB** | —                         |
| `26bb1f3` + correctifs `fix-w1`          | 16 167,99 KiB         | **3 150,19 KiB** | +39,6 KiB                 |
| `6ceaf0c` + WP-02 (le code vérifié ici)  | 16 170,02 KiB         | **3 145,30 KiB** | −4,9 KiB                  |
| même code, build dans le worktree        | 16 417,68 KiB         | 3 144,05 KiB     | (chemin de 77 caractères) |

- **Le relevé de la vague 1 est reproduit** : 3 110,61 KiB ici contre 3 109,13 KiB alors
  (+1,5 KiB), la méthode est donc fiable à quelques KiB près.
- **Le Worker a grossi de ≈ 35 KiB depuis la vague 1** (3 109,13 → 3 145,30 ; 3 144,05 dans
  le worktree), **et c'est entièrement dû aux correctifs `fix-w1`, pas à WP-02** :
  - WP-02 : +2,0 KiB brut et −4,9 KiB gzip, c'est-à-dire du bruit de build. Aucune chaîne de
    ses modules (`GlyphsNotLoadedError`, `S3D Relief`, `mulberry32`, `opentype`) n'est dans le
    `handler.mjs` : le texte en relief, la Cartouche, le Relief et la Borne sont du code
    client ou de Worker de géométrie, sans page serveur qui les importe avant WP-STUDIO.
  - `fix-w1` : +266 KiB brut, +75,4 KiB de gzip fichier par fichier, **sans aucun changement
    de dépendance**. Ventilation (gzip fichier par fichier, `ac9d0a5` → `26bb1f3`) :
    `handler.mjs` +30,7 KiB (+197 KiB brut), les 111 entrées `page.js`/`route.js` +25,7 KiB
    (+129 KiB brut), les chunks serveur numérotés +14,7 KiB, les manifestes
    `client-reference` +4,6 KiB. Cause la plus probable : le nouveau layout racine
    `src/app/layout.tsx`, la route interne `/_not-found` (`src/app/not-found.tsx`, qui rend
    `LocaleShell`) et la douzaine de `layout.tsx` de segment portant `ClientMessages` ont
    redistribué les modules entre les entrées de page et les chunks partagés : le gros chunk
    partagé `2430.js` (427 KiB brut) devient `946.js` (449 KiB) et passe de 232 à 266 modules
    (surtout `next/link`, la navigation next-intl et des composants client désormais tirés
    dans le graphe serveur ; cette attribution vient de la comparaison des modules webpack,
    pas d'un profil de bundle). Le
    `Total Upload` brut a gagné 266 KiB (+1,7 %) pour +39,6 KiB de gzip (+1,3 %), soit le
    même ratio que le reste du Worker : aucun gros bloc isolé à retirer.
- **Budget de fin de refonte** (§4.11, relevé à **3 185 KiB** le 30.09.2026) : **3 145,30 KiB,
  marge de 39,7 KiB** (34,8 KiB si l'on retient le pire build du même code, 3 150,48). Il
  reste WP-HOME, WP-STUDIO et WP-99 ; WP-02 n'a rien consommé. À re-mesurer après chaque
  fusion, **toujours dans un dossier de 41 caractères** pour comparer à ce tableau.
- `check-worker-bundle` : **0 signature** (WebGLRenderer, NeutralToneMapping, GreenSock,
  ScrollTrigger, lenis-smooth) sur 1 570 fichiers (39 790,8 KiB brut, 10 227,1 KiB gzip
  fichier par fichier dans le worktree) ; les mêmes 0 sur les trois builds de 41 caractères.
  `node_modules/` 5 011,8 KiB (inchangé depuis la vague 1), middleware 102,0 KiB.

### 2.2 Chunks client

189 chunks, **1 071,5 KiB gzip** (3 270,1 KiB brut), contre 178 chunks et 1 065,6 KiB en
vague 1 ; 6 chunks portent un moteur (three ×3, gsap ×2, lenis ×1), tous derrière un gate.

| Route (JS initial, borne haute)         | gzip          | brut      | chunks | Écart / vague 1 |
| --------------------------------------- | ------------- | --------- | ------ | --------------- |
| `/[locale]` (accueil)                   | **231,4 KiB** | 723,6 KiB | 17     | +1,1 KiB        |
| `/[locale]/shop`                        | 230,4 KiB     | 720,3 KiB | 18     | +1,7 KiB        |
| `/[locale]/products/[slug]`             | 234,8 KiB     | 733,5 KiB | 18     | +1,6 KiB        |
| `/[locale]/custom`                      | 259,7 KiB     | 803,8 KiB | 20     | +1,6 KiB        |
| `/[locale]/a-propos`                    | 258,9 KiB     | 803,9 KiB | 20     | +1,6 KiB        |
| `/[locale]/contact`                     | 253,5 KiB     | 784,3 KiB | 20     | +1,6 KiB        |
| `/[locale]/cart` (hors `(site)`)        | 256,3 KiB     | 793,4 KiB | 20     | +1,4 KiB        |
| `/[locale]/checkout` (hors `(site)`)    | 265,3 KiB     | 819,5 KiB | 20     | +1,1 KiB        |
| `/[locale]/track` (hors script)         | 234,8 KiB     | 731,5 KiB | 19     | +1,4 KiB        |
| `/[locale]/favorites` (hors script)     | 233,2 KiB     | 728,7 KiB | 17     | +1,4 KiB        |
| `/[locale]/account/login` (hors script) | 256,1 KiB     | 793,1 KiB | 19     | +0,8 KiB        |
| `/[locale]/legal/terms` (hors script)   | 225,9 KiB     | 708,6 KiB | 16     | +0,9 KiB        |

Les quatre dernières lignes viennent d'une copie jetable de `chunk-report.ts` dont la liste
`ROUTES` est étendue (le script du dépôt ne suit que les 8 premières routes).

- **Accueil : 231,4 KiB pour un budget de 233,7 KiB** (base + 15) : dans le budget, **marge de
  2,3 KiB** (3,4 en vague 1). Toutes les routes ont pris +0,8 à +1,7 KiB, uniformément, et
  deux chunks de plus : c'est l'effet de `fix-w1` (layout racine, `ClientMessages`), pas de
  WP-02. L'accueil n'a pas encore reçu WP-HOME : **la marge restante est étroite pour un
  paquet qui doit y ajouter du JS** ; le budget de l'accueil se tiendra ou non à ce moment.
- Gates (`.next/react-loadable-manifest.json`, gzip zlib par défaut) : **inchangés depuis la
  vague 1**, donc WP-02 n'a ajouté aucun chunk de moteur.

| Gate                                | Total gzip               | Budget      |
| ----------------------------------- | ------------------------ | ----------- |
| `@/motion/runtime` (gsap + Lenis)   | **53,7 KiB**             | ≤ 65 KiB ✓  |
| `@/motion/stage/stage-root` (three) | **148,9 KiB**            | ≤ 200 KiB ✓ |
| `@/motion/choreo/about`             | 49,7 KiB (2,8 en propre) | —           |
| `@/motion/choreo/product`           | 50,5 KiB (3,7 en propre) | —           |

## 3. Navigateur (preview, CSP de production)

Preview local : `opennextjs-cloudflare preview -- --upstream-protocol https --port 8790
--inspector-port 9330` sur le build du worktree (même code que la section 2.1), Hyperdrive
lu dans `.env.local` et posé en `$env:` dans la même commande (branche Neon `preview`). Le
premier lancement a démarré du premier coup (pas de `EAI_AGAIN` cette fois). Navigateur :
Edge 155 headless, contextes neufs, 1440 × 900 sauf mention.

### 3.1 HTML brut (`curl`-équivalent, sans JavaScript)

Statut, structure et poids, `accept-encoding: identity` puis gzip niveau 9 :

| URL                              | Statut  | header | `<main>` | h1  | footer | Brut      | Gzip     |
| -------------------------------- | ------- | ------ | -------- | --- | ------ | --------- | -------- |
| `/fr`                            | 200     | 1      | 1        | 1   | 1      | 119,6 KiB | **19,6** |
| `/fr/shop`                       | 200     | 1      | 1        | 1   | 1      | 143,7 KiB | **20,5** |
| `/fr/products/vase-spirale`      | 200     | 5      | 1        | 1   | 1      | 131,0 KiB | **21,0** |
| `/fr/custom`                     | 200     | 1      | 1        | 1   | 1      | 93,5 KiB  | 18,3     |
| `/fr/a-propos`                   | 200     | 7      | 1        | 1   | 1      | 179,3 KiB | 32,1     |
| `/fr/contact`                    | 200     | 1      | 1        | 1   | 1      | 87,5 KiB  | **16,1** |
| `/fr/cart`                       | 200     | 1      | 1        | 1   | 1      | 76,4 KiB  | 14,1     |
| `/fr/checkout`                   | 200     | 1      | 1        | 1   | 1      | 75,2 KiB  | 13,6     |
| `/fr/track`                      | 200     | 1      | 1        | 1   | 1      | 74,7 KiB  | 13,1     |
| `/fr/favorites`                  | 200     | 1      | 1        | 1   | 1      | 72,3 KiB  | 12,7     |
| `/fr/account/login`              | 200     | 1      | 1        | 1   | 1      | 78,2 KiB  | 14,7     |
| `/fr/legal/terms`                | 200     | 1      | 1        | 1   | 1      | 105,1 KiB | 22,3     |
| `/de/shop`                       | 200     | 1      | 1        | 1   | 1      | 143,6 KiB | 20,7     |
| `/fr/zzz-inconnu` (sans route)   | **404** | 1      | 1        | 1   | 1      | 68,7 KiB  | 12,0     |
| `/de/zzz` (sans route)           | **404** | 1      | 1        | 1   | 1      | 68,6 KiB  | 11,9     |
| `/fr/products/slug-supprime-xyz` | **404** | 0      | 0        | 0   | 0      | 49,3 KiB  | 8,9      |

(« header » compte les balises `<header>`, celles des sections comprises : les fiches
produit et `/a-propos` en portent plusieurs, d'où 5 et 7.)

- **Poids du HTML : l'écart 5 de la vague 1 est résorbé.** `/fr/contact` : **30,3 → 16,1 KiB
  gzip** (118,6 → 87,5 KiB brut) ; `/fr` : 34,6 → 19,6 KiB gzip (151,6 → 119,6 brut). Les
  pages ne reçoivent plus que les namespaces qu'elles lisent (`ClientMessages`, `fix-w1`) :
  `/fr/contact` est même sous la production d'avant la refonte (21,4 KiB gzip, 85,3 brut).
  Le HTML le plus lourd est `/fr/a-propos` (32,1 KiB gzip : FAQ de 10 `<details>`, JSON-LD).
- **404 d'une URL sans route** (`/fr/zzz-inconnu`, `/de/zzz`) : statut 404, `<meta name="robots"
content="noindex">` (pas d'en-tête `X-Robots-Tag`, le `noindex` passe par la balise), et
  **un header, un `<main>`, un h1 et un footer dans le HTML brut** (961 caractères de texte
  visible hors scripts : « Point non coté », « Page introuvable. », « Altitude 404 m… ») :
  la correction de `fix-w1` tient en production-like. Le `<title>` est « Page introuvable ·
  Swiss3Design ».
- **Fiche produit supprimée** (`/fr/products/slug-supprime-xyz`) : statut **404**, `noindex`,
  `<title>` « Page introuvable · Swiss3Design », mais **corps vide dans le HTML brut**
  (`<body><div hidden><!--$--><!--/$--></div>` puis les scripts, 0 caractère de texte visible,
  `id="__next_error__"`). **La limite documentée au §7.18 du brief est confirmée** : c'est le
  repli d'erreur de coquille de Next 16.3.6 (`app-render.js`, repli `errorRecovery` vers les
  lignes 2364 à 2412, graine `id: '__next_error__'` à la ligne 1326 : les numéros ont glissé
  d'une ligne ou deux depuis la note du brief), qui fixe le statut 404 et laisse le contenu au
  client. Le navigateur affiche bien la page 404 après hydratation (h1 = 1 dans le DOM, voir 3.2).
  Rien à corriger côté dépôt tant que Next ne permet pas de poser le statut autrement.
- **Nonce** : sur les 15 pages ci-dessus, **chaque** `<script>` inline porte le nonce de
  l'en-tête `Content-Security-Policy` (la valeur est comparée, pas seulement sa présence :
  0 écart, de 2 à 6 scripts inline par page) et chaque `<script src>` aussi (5 à 22). **Le
  script anti-flash du nouveau layout racine `src/app/layout.tsx` porte le nonce sur les 15
  pages**, repli d'erreur de la fiche supprimée compris. `script-src 'self' 'nonce-…'
https://js.stripe.com https://static.cloudflareinsights.com https://*.posthog.com`.

### 3.2 Console, CSP, hydratation, 4xx

Les 15 URL demandées (`/fr`, `/fr/shop`, la fiche `vase-spirale`, `/fr/custom`,
`/fr/a-propos`, `/fr/contact`, `/fr/cart`, `/fr/checkout`, `/fr/track`, `/fr/favorites`,
`/fr/account/login`, `/fr/legal/terms`, `/de/shop`, `/fr/zzz-inconnu` et la fiche supprimée),
page défilée jusqu'en bas. Les autres modes ont été passés sur 4 pages seulement
(`/fr/shop`, `/fr/a-propos`, `/fr/legal/terms`, `/fr/favorites`).

| Mode                                                 | Pages | Violations CSP | Erreurs d'hydratation | MISSING_MESSAGE / IntlError | 4xx inattendus | Débordement horizontal |
| ---------------------------------------------------- | ----- | -------------- | --------------------- | --------------------------- | -------------- | ---------------------- |
| Clair, mouvement complet                             | 15    | 0              | 0                     | 0                           | 0              | aucun                  |
| Sombre                                               | 4     | 0              | 0                     | 0                           | 0              | aucun                  |
| Mouvement réduit par l'OS (`prefers-reduced-motion`) | 4     | 0              | 0                     | 0                           | 0              | aucun                  |
| Mouvement réduit par l'interrupteur du footer        | 4     | 0              | 0                     | 0                           | 0              | aucun                  |
| Mobile 375 × 812 (tactile, DPR 2)                    | 4     | 0              | 0                     | 0                           | 0              | aucun (0 px)           |

- Aucun `securitypolicyviolation` capturé dans la page, aucun message « Refused to… », aucune
  erreur React (#418, #423, #425, « did not match »), aucun `MISSING_MESSAGE`. **Le journal
  serveur du preview ne contient aucune erreur** (2 522 lignes en fin de passage, 2 448
  requêtes : 2 336 × 200, 97 × 304, 2 × 307 de `GET /` vers la langue, 13 × 404).
- **Les seuls messages** : (1) sur `/fr/checkout`, l'avertissement de Stripe.js « live Stripe.js
  integrations must use HTTPS » (attendu en HTTP local) et 47 lignes « Tracking Prevention »
  d'Edge (bruit du navigateur sur les ressources tierces de Stripe, pas une erreur de
  l'application) ; (2) sur les deux 404, « Failed to load resource: 404 », c'est-à-dire le
  document lui-même. **L'avertissement `navigator.modelContext is deprecated` de la vague 1
  n'apparaît sur aucune page** : `fix-w1` a inversé l'ordre de lecture dans
  `webmcp-tools.tsx` (`document.modelContext` d'abord). Constaté dans Edge 155 seulement,
  pas dans un navigateur sans `document.modelContext`.
- 13 réponses 404 côté serveur, toutes attendues : les trois URL sans page, chacune
  demandée plusieurs fois par les différents scripts (4 × `/fr/zzz-inconnu`, 4 × la fiche
  supprimée, 1 × `/de/zzz`) et **4 × `GET /fr/studio`**, des préchargements du lien
  « Studio » de la page 404 (`not-found-content.tsx`). Le Studio n'existe qu'avec WP-STUDIO ;
  à surveiller à la fusion, pas un défaut d'ici.

### 3.3 `html.lenis`, mouvement réduit, mobile

- **`html.lenis` uniquement dans `(site)`** : présent sur `/fr`, `/fr/shop`, la fiche
  produit, `/fr/custom`, `/fr/a-propos`, `/fr/contact` et `/de/shop` (clair ; sombre et mobile contrôlés sur `/fr/shop` et
  `/fr/a-propos`) ;
  **absent** sur `/fr/cart`, `/fr/checkout`, `/fr/track`, `/fr/favorites`, `/fr/account/login`,
  `/fr/legal/terms`, la 404 et la fiche supprimée. **Absent partout en mouvement réduit**,
  OS comme interrupteur du footer (`data-motion="reduce"` posé sur les 4 pages testées, y
  compris celles qui sont dans `(site)`, comme `/fr/shop` et `/fr/a-propos`).
- Interrupteur du footer : partant de `data-motion="full"`, un clic le passe à `reduce` et
  retire `html.lenis` sur `/fr/shop` et `/fr/a-propos` (le défaut de `destroy()` de la
  vague 1 reste corrigé).
- Aucun élément `<canvas>` dans le DOM sur aucune page (la sonde de capacité WebGL jette son
  contexte), comme en vague 1. **Mobile 375 × 812** : `scrollWidth − innerWidth = 0` sur
  `/fr/shop`, `/fr/a-propos`, `/fr/legal/terms` et `/fr/favorites`.

### 3.4 CLS de laboratoire

`PerformanceObserver` (`layout-shift`, `hadRecentInput` exclu), **cache désactivé** (CDP),
première visite, 3 runs par page, 3,5 s d'observation. Seuil : ≤ 0,05.

| Page (largeur)                 | Run 1  | Run 2  | Run 3  | Vague 1                 |
| ------------------------------ | ------ | ------ | ------ | ----------------------- |
| `/fr/a-propos` (1440)          | 0,0115 | 0,0115 | 0,0115 | 0,04 à 0,105 (écart 7)  |
| `/fr/favorites` (1440)         | 0,0014 | 0,0014 | 0,0014 | 0,076 à 0,085 (écart 4) |
| `/fr/legal/terms` (1440)       | 0,0014 | 0,0014 | 0,0014 | 0,152 avant correctif   |
| `/fr/a-propos` (375 mobile)    | 0      | 0      | 0      | —                       |
| `/fr/favorites` (375 mobile)   | 0      | 0      | 0      | —                       |
| `/fr/legal/terms` (375 mobile) | 0      | 0      | 0      | —                       |
| `/de/a-propos` (1440)          | 0,0107 | 0,0107 | 0,0107 | —                       |
| `/it/favorites` (1440)         | 0,0020 | 0,0020 | 0,0020 | —                       |
| `/de/favorites` (1440)         | 0,0016 | 0,0016 | 0,0016 | —                       |
| `/en/legal/terms` (1440)       | 0,0045 | 0,0045 | 0,0045 | —                       |
| `/en/a-propos` (1440)          | 0,0318 | 0,0318 | 0,0318 | —                       |

**Tous ≤ 0,05** (maximum 0,0318 sur `/en/a-propos`, où deux sections se décalent au
remplacement de la police à t ≈ 370 ms). Les trois pages demandées passent de 0,04–0,15 à
≤ 0,0115 : les correctifs CLS de `fix-w1` (légal, favoris) tiennent, et le décalage de
police de `/a-propos` (écart 7 de la vague 1, jusqu'à 0,105) tombe à 0,0115 ici. Les trois
runs sont identiques à 4 décimales (la police arrive toujours au même instant sur ce poste,
donc le cas intermittent de la vague 1 n'a pas été rejoué à d'autres instants) ; le
laboratoire ne remplace pas les web vitals de PostHog en cache chaud.

### 3.5 Bouton « Ajouter aux favoris » de la fiche produit

`elementFromPoint` au centre du bouton (`aria-label` « Ajouter aux favoris »), après
`scrollIntoView` centré :

| Largeur | Bouton (x)  | Élément touché      | Rail « Chapitres de la fiche » |
| ------- | ----------- | ------------------- | ------------------------------ |
| 1280    | 1173 – 1225 | **le bouton** (svg) | masqué                         |
| 1440    | 1329 – 1381 | **le bouton** (svg) | masqué                         |
| 1536    | 1382 – 1434 | **le bouton** (svg) | visible, x 1445 – 1497 (11 px) |
| 1920    | 1564 – 1616 | **le bouton** (svg) | visible, x 1829 – 1881         |

Le clic tombe toujours sur le bouton, jamais sur le rail (écart 2 de la vague 1 corrigé : le
rail ne s'affiche qu'à partir de `min-[96rem]`, soit 1536 px, avec 11 px de dégagement).

## 4. Paiement Stripe de test, de bout en bout (serveur de développement)

`bun run dev -p 3120`, **pas** sur le preview : son hôte `swiss3design.ch` enverrait le
`return_url` de Stripe vers le vrai site. Clé secrète `sk_test_`, clé publiable `pk_test_`,
carte de test publiée par Stripe (4242 4242 4242 4242, échéance et CVC fictifs), invité,
e-mail en `example.test`, adresse suisse de test. Base : la branche Neon `preview`
(chaîne unique de `.env.development.local`, aucune donnée de production). Script jetable,
non commité, piloté par CDP.

**Réglage local nécessaire (trouvé en route, corrigé dans l'exemple).** Avec un `.dev.vars`
qui ne porte que `STRIPE_SECRET_KEY`, la page `/fr/checkout` de `next dev` reçoit une clé
publiable **`pk_live_`** : `env.STRIPE_PUBLISHABLE_KEY` vient du niveau racine de
`wrangler.jsonc` (clé live) et prime sur le repli `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` de
`.env.development` (`checkout-flow.tsx:51`, `checkout/page.tsx:67`) ; or `.dev.vars.example`
affirmait que la clé publiable de test était dans `.env.development`. Une clé live avec un
secret de test est incohérente (aucun paiement réel n'est possible : le secret de test ne
crée que des intentions de test ; l'échec côté Stripe.js n'a pas été rejoué). Posé
dans le `.dev.vars` local (gitignoré, valeur de test lue dans `.env.development`) ; la page
reçoit alors `pk_test_`. `.dev.vars.example` est corrigé (une ligne ajoutée, commentaire
rectifié), comme `STRIPE_PROFILE_ID` l'était déjà pour la même raison.

| Étape                                  | Résultat                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Panier                                 | « Ajouter au panier » de la fiche `vase-spirale` (29,90 CHF), `s3d-cart-v1` écrit                                                                                                                                                                                              |
| Contact invité                         | e-mail `w2a-verif-…@example.test`, code à 6 chiffres lu dans le journal du serveur de dev (pas de clé Resend local : `[email ignoré]`), « E-mail confirmé »                                                                                                                    |
| Adresse                                | suggestion `api3.geo.admin.ch` choisie (« Rue du Perron 1, 1196 Gland, VD »), canton VD rempli, « Continuer vers le paiement »                                                                                                                                                 |
| Paiement                               | total **38,80 CHF** (29,90 + livraison 8,90), bouton « Payer 38.80 CHF », Payment Element en **accordéon** (TWINT, Carte bancaire, Klarna, Billie, Amazon Pay) ; « Carte bancaire » dépliée : champs `cc-number`, `cc-exp`, `cc-csc`, plus les champs Link                     |
| Retour                                 | redirection vers `/fr/checkout/success?session_id=…` environ 6 s après le clic, sans erreur de console                                                                                                                                                                         |
| Page de succès                         | h1 « Merci, votre commande est reçue. », surtitre « La buse chauffe. », ticket **N° S3D-MUPI90LS1WN1**, **montant réglé 38.80 CHF**, question d'attribution et offre « Créez votre compte » (invité) ; **panier vidé** (`s3d-cart-v1` = `[]`)                                  |
| Statut de la commande (base)           | **`paid`** : `paid_at` posé, identifiant de session et d'intention de paiement posés, `total_cents` 3880 = 2990 + 890, stock réservé, canal `web`, langue `fr`                                                                                                                 |
| `/fr/track` avec le numéro et l'e-mail | commande retrouvée : « PAYÉE · Paiement reçu. L'impression n'a pas encore commencé. », frise Commande terminée puis Impression, Contrôle, Expédiée, Livrée « à venir », 1 × Vase Spirale, sous-total 29.90, livraison 8.90, total 38.80, adresse de livraison, offre de compte |

- **Le webhook n'est pas livré en local, et la commande passe quand même à `paid`** : la page
  de succès lit la session Stripe et appelle `settleSession` (idempotent, `success/page.tsx:113`)
  avant d'afficher « succeeded ». Le webhook de production arrive donc en second et ne doit
  rien changer. Le cas « complete mais pas encore réglé » (« processing ») n'a pas été
  provoqué. **E-mails** : les lignes `order-confirmation:` et `order-admin:` de la commande
  sont dans `email_outbox` (1 essai, non envoyées : pas de clé Resend), donc aucun e-mail réel
  n'est parti.
- **« Order Completed » part une fois, par le code et par l'observation.** Code :
  `TrackEvent` (`track-event.tsx:20-31`) écrit `s3d-tracked:Order Completed:<n° de commande>`
  dans `sessionStorage` puis émet ; au rendu suivant, la clé existe et il sort avant `track()`.
  Mesuré (espion sur `Storage.setItem`) : **1 écriture** de
  `s3d-tracked:Order Completed:S3D-MUPI90LS1WN1` au premier affichage, **0** après un
  rechargement de la page (la clé est toujours là). Le rendu serveur ne l'émet que si
  `settleSession` a réussi (`purchase` nul sinon). Rien ne sort d'ici : `track()` met en file
  d'attente et PostHog ne s'attache que si `window.location.hostname` vaut
  `ANALYTICS_HOSTNAME` (`analytics.ts:186`), donc jamais sur `localhost`.
- **Payment Element en clair et en sombre** (2 captures, le haut de l'accordéon est hors
  cadre) : clair = fond papier chaud, cartes à filet fin et texte encre ; sombre = fond
  brun-noir, cartes sombres, texte gris clair, logos Billie et Amazon Pay sur pastille
  blanche restés lisibles. **Le Payment Element suit le thème en direct** : après un clic sur le
  bouton de thème (`html.dark` passe à vrai), l'iframe se redessine en sombre en moins de
  2,5 s, sans recréer le paiement (`stripeAppearance(isDark)`, `useIsDark`). Le parcours n'a
  pas été refait en sombre dès le départ (il aurait créé une troisième commande en attente).
- Console de la page de paiement : seulement les avertissements attendus de Stripe.js en HTTP
  local (HTTPS conseillé ; Apple Pay non enregistré pour `localhost`) et un
  `Origin trial controlled feature not enabled: 'tools'` d'Edge ; un chargement de
  `logo.png` d'hCaptcha avorté (`ERR_ABORTED`, tiers de Stripe). Aucune erreur applicative.
- **Effets de bord sur la base de test** (branche `preview`, aucune donnée réelle) : trois
  commandes `@example.test` créées par les passages de vérification, dont **deux restées
  `pending` avec stock réservé** (`S3D-MUOQCSH3PHXM`, coupée avant le paiement par le passage
  précédent ; `S3D-MUPI78C0HZLA`, première tentative de ce passage, arrêtée devant
  l'accordéon) et la commande payée `S3D-MUPI90LS1WN1`. Le drainage de l'outbox lancé par la
  page de succès a aussi écarté (disponibilité repoussée de 365 jours, journal « intervention
  nécessaire ») des lignes de devis et de commandes plus anciennes de la même base, laissées
  par d'anciens essais (plus de 23 h, plusieurs tentatives). Rien n'a été envoyé. Ce qui
  libérera le stock réservé des deux commandes en attente n'a pas été vérifié (le code de
  libération est dans `orders.ts` et `stock.ts` ; le cron de `maintenance.ts` ne s'en charge
  pas) : à purger à la main si le propriétaire veut un catalogue de démo propre. Aucune
  écriture manuelle n'a été faite (la lecture de la base passe par un client `SELECT`
  seulement).

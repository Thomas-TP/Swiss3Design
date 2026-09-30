# Vague 1 · Vérification et mesures

Vérification de la vague 1 de la refonte « Strates » : WP-01, WP-QUOTE, WP-SHOP,
WP-ABOUT, WP-UTILITY et WP-ACCOUNT fusionnés dans `claude/redesign-2026`.
Checkout principal, commit `ac9d0a5`, **30.09.2026**, rien poussé. Les paquets avaient
reporté ici leurs critères de production (CSP/nonce, bundle, hydratation, moteurs) : ils
sont couverts ci-dessous. Références : `measures-wp00.md` (base), brief §4.11 et §10.

## Environnement

|            |                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Outils     | Bun 1.4.2 · Node 26.7.0 · Next 16.3.6 (webpack) · `@opennextjs/cloudflare` 1.20.6                                                                                                                                                                |
| Build      | `bunx opennextjs-cloudflare build` (116 s), puis `bunx wrangler deploy --dry-run`                                                                                                                                                                |
| Preview    | `opennextjs-cloudflare preview -- --upstream-protocol https`, donc la seconde moitié de `bun run preview` sur le build ci-dessus (même HEAD) ; Hyperdrive lu dans `.env.local` et posé en `$env:` dans la même commande (branche Neon `preview`) |
| Navigateur | Chromium 1234 (Playwright) en headless, SwiftShader, piloté par CDP depuis des scripts Node jetables (non commités), cache désactivé, consentement refusé, `http://127.0.0.1:8787`. Pas de Safari. 6 captures au total, jamais relues.           |
| Garde-fous | aucun formulaire envoyé (`.dev.vars` contient `RESEND_API_KEY`), aucune écriture en base, aucun événement de mesure sorti (hôte ≠ `swiss3design.ch`), serveur et navigateur arrêtés en fin de passe                                              |

Le premier lancement du preview est tombé sur `getaddrinfo EAI_AGAIN` (DNS passager de
l'hôte Neon, déjà vu en section 4 de `measures-wp00.md`) : wrangler s'arrête à la première
requête. Relancé une fois la résolution revenue, sans autre changement.

## 1. Contrôles du §10

| Contrôle                           | Résultat                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`                     | vert (oxlint, aucun diagnostic)                                                                                                                                     |
| `bun run typecheck`                | vert avant le build (12 s) **et** après le build (`.next/types` régénérés)                                                                                          |
| `bun run test`                     | vert : 40 fichiers (1 ignoré), 596 tests passés, 15 ignorés sans URL de base                                                                                        |
| `bun run format:check`             | rouge **uniquement** pour `docs/signature-infomaniak.html` (fichier non suivi du propriétaire) ; aucun fichier suivi ; vert aussi après le correctif et ce document |
| `bunx opennextjs-cloudflare build` | réussi, `worker.js` produit                                                                                                                                         |

## 2. Worker

| Mesure                                                  | Référence (WP-00) | Fin de WP-00 (contre-vérif.) | Vague 1           | Écart / contre-vérif. |
| ------------------------------------------------------- | ----------------- | ---------------------------- | ----------------- | --------------------- |
| `Total Upload` (dry-run)                                | 15 853,89 KiB     | 15 755,25 KiB                | **15 921,65 KiB** | +166,4 KiB            |
| `gzip` (dry-run), la valeur qui compte                  | 3 064,86 KiB      | 3 064,04 KiB                 | **3 109,13 KiB**  | **+45,1 KiB**         |
| Signatures three / gsap / lenis (`check-worker-bundle`) | 0                 | 0                            | **0**             | —                     |

- Budget de fin de refonte (§4.11, base + 60 KiB) : **≤ 3 124,86 KiB** (la consigne dit
  3 125). **Dans le budget, mais il ne reste que 15,7 KiB** pour WP-02, WP-HOME, WP-STUDIO
  et WP-99 alors que la vague 1 en a consommé 45,1 (le brief en prévoyait 10 par paquet,
  donc 60 pour six : on est à 75 % avec trois paquets serveur encore à venir, dont deux qui
  rendent des posters SVG côté serveur). À re-mesurer après chaque fusion.
- `check-worker-bundle` : 1 569 fichiers, `node_modules/` 5 011,8 KiB, `handler.mjs`
  2 625,9 KiB, `.next/` 2 358,7 KiB, middleware 102,0 KiB (gzip fichier par fichier).
  **0 signature** (WebGLRenderer, NeutralToneMapping, GreenSock, ScrollTrigger, lenis-smooth).
- Première piste sur la croissance : les 9 namespaces de messages pèsent 66,8 KiB brut,
  **18,1 KiB gzip** pour 4 langues, tous fusionnés à chaque requête par `src/i18n/request.ts`
  et donc embarqués dans le Worker (voir l'écart 5 pour l'effet sur le HTML).

## 3. Chunks client

178 chunks, 1 065,6 KiB gzip (3 260,0 KiB brut) ; 6 chunks portent un moteur (three ×3,
gsap ×2, lenis ×1), tous derrière un gate.

| Route (JS initial, borne haute)         | gzip          | brut      | chunks | Écart / fin de WP-00 |
| --------------------------------------- | ------------- | --------- | ------ | -------------------- |
| `/[locale]` (accueil)                   | **230,3 KiB** | 721,3 KiB | 15     | +4,7 KiB             |
| `/[locale]/shop`                        | 228,7 KiB     | 717,1 KiB | 15     | +3,6 KiB             |
| `/[locale]/products/[slug]`             | 233,2 KiB     | 730,4 KiB | 15     | +5,0 KiB             |
| `/[locale]/custom`                      | 258,1 KiB     | 800,6 KiB | 17     | +14,3 KiB            |
| `/[locale]/a-propos`                    | 257,3 KiB     | 800,7 KiB | 17     | +10,7 KiB            |
| `/[locale]/contact`                     | 251,9 KiB     | 781,1 KiB | 17     | +9,2 KiB             |
| `/[locale]/cart` (hors `(site)`)        | 254,9 KiB     | 790,8 KiB | 17     | +9,3 KiB             |
| `/[locale]/checkout` (hors `(site)`)    | 264,2 KiB     | 817,4 KiB | 18     | +8,6 KiB             |
| `/[locale]/track` (hors script)         | 233,4 KiB     | 729,1 KiB | 16     | —                    |
| `/[locale]/favorites` (hors script)     | 231,8 KiB     | 726,1 KiB | 14     | —                    |
| `/[locale]/account/login` (hors script) | 255,3 KiB     | 791,5 KiB | 17     | —                    |
| `/[locale]/legal/terms` (hors script)   | 225,0 KiB     | 707,1 KiB | 14     | —                    |

Les quatre dernières lignes viennent d'une copie jetable de `chunk-report.ts` dont la
liste `ROUTES` est étendue (le script du dépôt ne suit que les 8 premières routes).

- **Accueil : 230,3 KiB pour un budget de 233,7 KiB** (base + 15). Dans le budget, marge de
  3,4 KiB, alors que l'accueil n'a pas encore changé (WP-HOME) : la hausse de 4,7 KiB vient
  de chunks partagés (chrome, favoris, contexte produit).
- Aucun budget explicite pour les autres pages ; le plus gros saut est `/custom` (+14,3 KiB
  depuis la fin de WP-00, +20,6 depuis la référence de la section 2 de `measures-wp00.md`).

Gates (`.next/react-loadable-manifest.json`, gzip zlib par défaut, à ±1 % de `chunk-report`) :

| Gate                                                          | Chunks (gzip)                                                                   | Total                | Budget                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------- | -------------------------------- |
| `@/motion/runtime` (gsap + Lenis)                             | `c15bf2b0…` 19,3 · `6809…` 27,6 · `8391…` 6,9                                   | **53,7 KiB**         | ≤ 65 KiB ✓                       |
| `@/motion/stage/stage-root` (three)                           | `b536a0f1…` 82,8 · `bd904a5c…` 59,1 · `9499…` 7,0                               | **148,9 KiB**        | ≤ 200 KiB ✓                      |
| `@/motion/choreo/about`                                       | `c15bf2b0…` + `6809…` (partagés avec le runtime) + `6362…` 2,8                  | 49,7 (2,8 en propre) | —                                |
| `@/motion/choreo/product`                                     | idem + `5235…` 3,7                                                              | 50,6 (3,7 en propre) | —                                |
| scène `product-viewer`                                        | `8643…` 2,4 · `3753…` 3,1 ; `GLTFLoader` (import dynamique, GLB seulement) 12,7 | 5,5 (+12,7)          | ≤ 15 KiB ✓ (18,2 avec le loader) |
| scènes `print-hero`, `contour-field`, `studio-object` (stubs) | 2,6 chacune                                                                     | 2,6                  | ≤ 15 KiB ✓                       |

Le Stage a perdu 45 KiB depuis WP-00 (193,8 → 148,9) : l'ancien viewer est supprimé, la
scène produit ne fait que tourner. Le chunk `posthog-js` (2 × 95,6 KiB) est chargé par
`instrumentation-client.ts`, comme avant la refonte.

## 4. Navigateur (preview, CSP de production)

### 4.1 SSR (HTML brut, sans JavaScript)

- **Fiche produit, 4 langues** (`/fr`, `/de`, `/it`, `/en` + `/products/vase-spirale`) : 200,
  « Ian » ×11, « CC BY-ND 4.0 » ×4, `https://makerworld.com/fr/models/1262112-vase`, deed
  `creativecommons.org/licenses/by-nd/4.0/deed.<locale>`, un h1, un `<main>`, canonical
  correct, 6 blocs JSON-LD dont `Product` avec
  `subjectOf: { "@type": "3DModel", name: "Vase", creator: { Person, "Ian" }, url: …, license: …by-nd/4.0/ }`.
- 200 et **un seul h1, un seul `<main>`**, CSP à nonce, 100 % des `<script>` inline avec le
  nonce de l'en-tête : `/fr`, `/fr/shop`, `/fr/products/vase-spirale`, `/fr/custom`,
  `/fr/a-propos`, `/fr/contact`, `/fr/cart`, `/fr/checkout`, `/fr/track`, `/fr/favorites`,
  `/fr/account/login`, `/fr/legal/{terms,privacy,shipping}`, et `/de`, `/it`, `/en`,
  `/de/a-propos`, `/it/contact`, `/en/custom`. `/fr/account` et `/fr/oauth/consent` → 307
  vers la connexion. `/fr/studio` → 404 (WP-STUDIO).
- **Boutique** : 6 cartes `<article>` (catalogue démo de la branche `preview`), canonical
  `/fr/shop` avec ou sans filtre, filtres et recherche par formulaire GET (`?q=vase` → 1
  carte : le cas N = 1). `/custom` : formulaire `multipart/form-data` avec champs
  d'action serveur, textarea et champ fichier dans le HTML, `customServiceJsonLd` présent.
  `/a-propos` : 10 `<details>` de FAQ et `FAQPage` dans le HTML.
- **404** : statut 404 et `noindex` corrects, mais **le HTML brut n'a ni h1 ni `<main>`**
  (voir l'écart 1).

### 4.2 Console, CSP, hydratation, 4xx

Treize URL (les 12 pages demandées, `/fr/legal/terms` comprise, plus une 404 `/fr/cette-page-n-existe-pas`),
page défilée jusqu'en bas, 1440 × 900, 375 × 812 tactile pour le mobile :

| Mode                                                      | Violations CSP | Erreurs (hydratation comprise) | Réponses 4xx | Débordement horizontal |
| --------------------------------------------------------- | -------------- | ------------------------------ | ------------ | ---------------------- |
| Clair, mouvement complet                                  | 0              | 0                              | 0            | aucun                  |
| Sombre                                                    | 0              | 0                              | 0            | aucun                  |
| Mouvement réduit par l'OS (`prefers-reduced-motion`, CDP) | 0              | 0                              | 0            | aucun                  |
| Mouvement réduit par l'interrupteur du footer             | 0              | 0                              | 0            | aucun                  |
| Mobile 375 × 812 (UA Android, DPR 3)                      | 0              | 0                              | 0            | aucun                  |
| `de`, `it`, `en` (13 pages chacune, clair, complet)       | 0              | 0                              | 0            | aucun                  |

Seuls messages : (1) sur **chaque** page, l'avertissement `navigator.modelContext is
deprecated. Please use document.modelContext instead.` (écart 6) ; (2) sur `/checkout`,
l'avertissement de Stripe.js « live Stripe.js integrations must use HTTPS » (attendu en
HTTP local) ; (3) sur l'URL 404, le 404 du document lui-même. Aucune erreur React #418,
#423 ou #425, aucun `securitypolicyviolation`.

### 4.3 `html.lenis`, Stage, moteurs

- **Lenis** : présent sur `/fr`, `/shop`, `/products/…`, `/custom`, `/a-propos`, `/contact`
  (clair, sombre, mobile : classe présente ; le tactile reste natif d'après le §3.6) ;
  **absent** sur `/cart`, `/checkout`, `/track`, `/favorites`, `/account/login`,
  `/legal/terms` et sur la 404, et absent partout en mouvement réduit.
- Navigation client (desktop) : `/shop` → `scrollTo(300)` puis clic « Panier » dans les
  400 ms → `/cart` sans `lenis` ; logo → `/fr` avec ; `/shop` avec ; interrupteur du footer
  actionné < 400 ms après un défilement natif → `data-motion="reduce"` et pas de `lenis` ;
  retour en complet → `lenis` revient. **Le défaut de `destroy()` relevé dans
  `measures-wp00.md` est corrigé** (`dropLenis()` appelle `stop()` d'abord).
- **Chunks de moteur demandés** : pages `(site)` en mouvement complet : runtime seulement
  (`c15bf2b0`, `6809`, `8391`), plus `6362` (chorégraphie `about`) sur `/a-propos` et `5235`
  (chorégraphie `product`) sur la fiche ; **aucun chunk three, aucune requête STL/GLB, aucun
  élément `<canvas>`** sur aucune page (contact compris). Hors `(site)` et en mouvement
  réduit : aucun chunk de moteur.
- Un contexte WebGL est créé puis jeté sur les pages `(site)` (1 appel `getContext('webgl')`,
  0 `<canvas>` dans le DOM ensuite) : c'est la sonde de capacité
  (`src/lib/motion-bridge/tier.ts:110`, `getContext("webgl2")`), pas three. Hors `(site)` : 0.

### 4.4 Mouvement réduit et mobile, pages restylées

- **Réduit** (OS et interrupteur) : `data-motion="reduce"` posé sur les 13 pages y compris
  hors `(site)`, pas de Lenis, pas de chunk de moteur. **DrawSVG** de `/a-propos` : en complet,
  27 traits démarrent en `stroke-dasharray` inline et sont propres (0 style inline) 2 s après
  l'entrée dans l'écran ; en réduit, 0 style inline dès le chargement (schémas finals).
- **Mobile 375 × 812** : `scrollWidth − innerWidth = 0` sur les 12 pages, BottomNav fixe
  de 747 à 812 px, le dernier texte du footer finit à 692 px (rien sous la nav), 0
  `.pin-spacer`, 0 élément sticky de plus de 60 % de la hauteur. Captures : `/fr/custom`
  (titre, deux cartes « J'ai un fichier » / « Je n'ai pas de fichier », bouton Studio rouge
  central) et `/fr/account/login` en sombre : lisibles, pas de coupe.
- **Clavier** : 44 tabulations sur `/fr/contact`, `/fr/custom`, `/fr/account/login`,
  `/fr/track` : **chaque** élément focalisé porte un contour ou une ombre (aucune exception),
  ce qui couvre la réserve de WP-ABOUT sur les champs de contact.

### 4.5 Critères différés par paquet

| Paquet     | Critère                                                                    | Résultat                                                                                                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WP-QUOTE   | CSP et bundle de `/custom`                                                 | 0 violation, 258,1 KiB de JS initial (voir écarts pour la progression)                                                                                                                                                                                                                           |
| WP-QUOTE   | faux `QuoteHandoff` dans `sessionStorage`                                  | **OK** : carte « Configuration Studio jointe » (nom du fichier, 4 242 triangles), description, couleurs et dimensions préremplies, lien vers `/fr/studio/lavaux` ; sans handoff, carte absente. Aucun envoi.                                                                                     |
| WP-QUOTE   | envoi avec fichier sur `preview`                                           | **non fait** : `.dev.vars` contient `RESEND_API_KEY`, un e-mail réel partirait vers l'admin                                                                                                                                                                                                      |
| WP-SHOP    | grille de 6 produits, cas N = 1                                            | **OK** : 6 cartes, `?q=vase` → 1 carte                                                                                                                                                                                                                                                           |
| WP-SHOP    | un seul contexte WebGL et pas de STL avant l'approche de la section viewer | **non exerçable** : aucun des 6 produits démo n'a de `model_3d_url` (pas de chapitre « Tourner », `scripts/seed.sql` sans modèle). Constaté seulement : aucun chunk three, aucune requête STL sur la fiche. Le code (`product-viewer.tsx`, `IntersectionObserver` à 100 % d'écran) est conforme. |
| WP-SHOP    | événements PostHog (`Product Viewed`, `Products Searched`, …)              | **non fait** : la mesure ne part que sur l'hôte `swiss3design.ch`, rien ne doit sortir d'ici                                                                                                                                                                                                     |
| WP-SHOP    | JSON-LD Product/3DModel                                                    | structure vérifiée (4.1) ; validateur schema.org et test Google non lancés (URL publique nécessaire)                                                                                                                                                                                             |
| WP-ABOUT   | nonce CSP, frontière de mouvement, taille, gate `about`                    | **OK** (nonce 3/3, 0 signature, 257,3 KiB, chunk `6362` 2,8 KiB seulement sur `/a-propos`)                                                                                                                                                                                                       |
| WP-ABOUT   | section active de l'AboutNav, header de 64 px                              | **OK** : header 65 px (64 + filet) ; le clic sur chacun des 6 liens amène la section à 128 px du haut (header 64 + barre AboutNav + 16) et la marque active                                                                                                                                      |
| WP-UTILITY | 404 d'une URL inconnue avec un h1 dans le HTML brut                        | **ÉCHEC** (écart 1), le statut 404 est bon                                                                                                                                                                                                                                                       |
| WP-UTILITY | paiement de test Stripe jusqu'à `/checkout/success`                        | **non fait** : clé publiable de test expirée (à renouveler par le propriétaire). `/checkout` se charge sans erreur ni Lenis ni canvas.                                                                                                                                                           |
| WP-ACCOUNT | `/account/login`, `/legal/terms` sous CSP de production et poids           | **OK** : 0 violation, nonce 3/3, un `<main>`, 255,3 et 225,0 KiB                                                                                                                                                                                                                                 |
| WP-ACCOUNT | `/oauth/consent`                                                           | redirige vers la connexion sans session (attendu) ; écran de consentement non vu, il demande une session                                                                                                                                                                                         |

## 5. Correctif appliqué

`src/app/[locale]/legal/legal-layout.module.css` (une ligne), **CLS 0,152 → 0,002** sur
`/legal/terms` à la première visite : la colonne `.page` avait
`max-inline-size: calc(68ch + 6rem)`. `ch` suit la police : quand Geist remplace la police
de repli, la colonne passait de 730 à 817 px (centrée, donc −44 px à gauche) et tout le
texte légal de 835 px de haut se déplaçait (reproduit 3 fois sur 3 sans le correctif).
Remplacé par `51rem`, la largeur exacte avec Geist. Validé en injectant la règle au
chargement (CLS 0,0016, 3 fois sur 3) ; non revalidé sur un nouveau build. Les pages
`privacy` et `shipping` ne bougeaient pas dans ce relevé (probablement parce que la
police était déjà chargée) mais partagent le même CSS : même cause, même correctif.

## 6. Écarts et suites (rien d'autre n'est corrigé ici)

Classés par gravité. Fichier et ligne, puis correctif recommandé.

1. **404 sans contenu dans le HTML brut** (moyenne, **déjà vrai en production**
   aujourd'hui : `curl https://swiss3design.ch/fr/zzz` → 404, 0 h1, 0 `<main>`).
   `/fr/zzz-inconnu` et `/fr/products/slug-inexistant` répondent 404 + `noindex`, mais le
   `<body>` ne contient que `<div hidden><!--$--><!--/$--></div>` et les scripts ; le h1, le
   header et le footer n'existent que dans la charge utile RSC, donc après l'hydratation
   (le navigateur affiche bien « Page introuvable. », h1 = 1). Concerne
   `src/app/[locale]/not-found.tsx` et le layout `src/app/[locale]/layout.tsx`. À
   investiguer : comparer `next start` et OpenNext (le rendu de `not-found` semble basculer
   côté client), puis corriger ; c'était déjà noté comme « point à revoir par WP-UTILITY »
   dans `measures-wp00.md`. Sans incidence sur le SEO (noindex), mais les agents et
   lecteurs sans JS voient une page vide.
2. **Le rail de chapitres recouvre le bouton « Ajouter aux favoris » de la fiche produit**
   (moyenne). `src/components/ui/chapter-rail.tsx:55` (`fixed right-6 top-1/2 … min-[80rem]:block`,
   52 px de large) ; usage : `src/app/[locale]/(site)/products/[slug]/page.tsx:274`. À 1440 px
   le rail occupe x 1349–1401 et le cœur est à x 1329–1381 (recouvrement de 32 px, 52 px à
   1280, aucun à 1920) : le clic tombe sur le rail (z-30). Correctif : n'afficher le rail que
   si la marge droite le contient (par exemple `min-[110rem]:block`) ou réserver une marge
   droite de 5 rem à la colonne d'achat ; revérifier 1280, 1440, 1536 et 1920.
3. **Budget Worker** (haute pour la suite, aucun défaut de code) : 3 109,13 KiB, marge de
   15,7 KiB (section 2). Le poste le plus net à réduire : les namespaces de messages
   embarqués en entier (écart 5).
4. **CLS de la page Favoris 0,076 à 0,085** (> 0,05, trois langues, reproductible).
   `src/app/[locale]/favorites/favorites-list.tsx:73-78` (l'`eyebrow` « n objets » apparaît
   quand `ready` passe à vrai : +28 px) et `:106-117` (`!ready ? null` puis le bloc « vide »
   : le footer descend de 183 px). Correctif : réserver la hauteur (un `min-h` sur la
   `<section>` de `:105`, et un `eyebrow` de remplacement de la même hauteur tant que
   `!ready`).
5. **Poids du HTML** (moyenne) : chaque page embarque tous les namespaces de la refonte
   (`/fr/contact` : `shell` 13,8 KiB, `studioCore` 12,5, `quote` 8,8, `catalog` 6,1,
   `atelier` 3,0, `system` 2,5 ; aucun de `studioCore` ni `catalog` n'y sert). HTML
   de `/fr/contact` : 85,3 → 118,6 KiB brut (21,4 → 30,3 KiB gzip) depuis la production
   actuelle ; `/fr` : 113,6 → 151,6 KiB (26,5 → 34,6 KiB gzip). Cause : `NextIntlClientProvider`
   sans `messages` (`src/app/[locale]/layout.tsx:143`) hérite de l'ensemble fusionné de
   `src/i18n/request.ts`. Correctif : ne passer que les namespaces utiles au groupe de
   routes (`pick` de next-intl, ou un provider par groupe). WP-STUDIO et WP-HOME vont
   alourdir encore cet ensemble.
6. **`navigator.modelContext` déprécié** (faible) : `src/components/webmcp-tools.tsx:59-60`,
   avertissement sur chaque page. Lire `document.modelContext ?? navigator.modelContext`.
   Non touché ici : le fichier appartient à WP-STUDIO, qui le modifie.
7. **CLS de police, intermittent** (faible, cache désactivé) : sur `/a-propos` (0,04 à 0,105
   selon l'instant où la police arrive, trois langues) les libellés mono de l'AboutNav
   passent de 311 à 230 px de large au remplacement de la police : la barre retombe de deux
   lignes à une et le contenu monte de 47 px. `src/app/fonts.ts:20-24` (Geist Mono, repli
   calculé contre Arial, donc très éloigné d'une chasse fixe) et
   `src/app/[locale]/(site)/a-propos/about-nav.tsx`. Correctif : `whitespace-nowrap` avec
   défilement horizontal interne et hauteur fixe de la barre, ou `display: "optional"`
   pour la mono. À confirmer par Lighthouse et les web vitals PostHog (cache chaud).
8. **Liens `/studio` en 404 tant que WP-STUDIO n'est pas fusionné** (attendu) :
   `src/components/header.tsx:38`, `bottom-nav.tsx:54`, `footer.tsx:115`,
   `src/app/[locale]/not-found.tsx` (bouton secondaire), `favorites-list.tsx:190`.
9. **Recherche boutique sensible aux accents** (faible, **antérieur à la refonte**) :
   `?q=voronoi` → 0 résultat, `?q=Voronoï` → 1. `src/db/queries.ts:134-135` (`ilike`). Hors
   périmètre de la refonte.
10. **LCP de laboratoire** (à refaire correctement) : sans étranglement, machine de dev,
    cache désactivé : `/fr` 2,0 à 2,2 s (élément h1), `/fr/shop` 2,6 à 2,9 s (h1),
    fiche produit 1,2 s (paragraphe). Le budget est de 2,0 s en p75 mobile 4G : Lighthouse
    mobile sur `bun run preview` reste à faire (aucune mesure INP non plus).
11. **Reportés au propriétaire** (rappel des comptes rendus de paquets, sans valeur
    ici) : clé publiable de test Stripe expirée ; le `.dev.vars` du dépôt principal
    contient en commentaire une URL Postgres de production avec mot de passe (à faire
    tourner) ; compte de test `wpaccount-test-*` à supprimer de la base après avoir
    confirmé la branche ; `QuotePayFlow` avec un vrai devis à J3 ; `viewport-fit=cover` à
    décider.

## 7. Non vérifié dans cette passe

Lighthouse et INP ; Safari (« Coupe ») ; événements PostHog ; validateurs JSON-LD externes ;
viewer 3D avec un vrai modèle (aucun produit démo n'en a : ajouter un `model_3d_url` au
jeu de démo, ou le vérifier sur la preview déployée à J2) ; envoi de devis avec fichier ;
paiement de test Stripe ; écran de consentement OAuth ; contrastes du thème sombre des
pages restylées (seuls les chromes l'avaient été, section 4 de `measures-wp00.md`) ;
bandeau de consentement (il n'apparaît que sur l'hôte `swiss3design.ch`).

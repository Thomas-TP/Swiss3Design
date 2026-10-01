# Vague 2b · Vérification et mesures

Vérification de la branche d'intégration `claude/redesign-2026` après la fusion de WP-HOME
(`f2dd5b5`) et de WP-STUDIO (`cdefa67`), plus quatre petits correctifs (partie A). Base de
comparaison : `measures-wave2a.md` (Worker 3 145,30 KiB après WP-02), `measures-wave1.md`,
brief §4.11 et §10. **01.10.2026**, worktree isolé, rien poussé, branche
`claude/redesign-2026--verify-w3`.

Ce document s'écrit au fil des étapes : chaque section est commitée dès que sa mesure est
faite (la limite d'usage a déjà coupé des passages précédents).

## Résumé

_(rempli en fin de passage)_

## Environnement

|            |                                                                                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outils     | Bun 1.4.2 · Next 16.3.6 (webpack) · `@opennextjs/cloudflare` 1.20.6 · Vitest 5.0.2 · Node 26.7                                                                                                     |
| Dépôt      | worktree `wf_c69b4bef-c00-1`, `bun install` à neuf (523 paquets) ; mesures du Worker aussi dans `C:\s3d-matched-path-w2a-0123456789abcdefg` (41 caractères, mêmes `package.json` et `bun.lock`)    |
| Navigateur | Edge headless piloté par CDP (Playwright `connectOverCDP`, port 9343), profil isolé, contextes neufs, consentement non donné ; WebGL par SwiftShader (logiciel, voir les réserves de la section 7) |
| Garde-fous | jeux d'essai uniquement sur `localhost`, base = branche Neon de développement, clés Stripe de test, clé Resend vide (aucun e-mail réel), ports 3130 / 8792 / 9332 / 9343                           |

## A. Correctifs

### A1. Vie privée : champs cachés du formulaire de devis hors des enregistrements de visite

**Défaut.** Dans la variante « tiroir » verrouillée de `QuoteRequestForm`
(`src/components/quote/quote-request-form.tsx`), la description complète (avec les textes à
imprimer d'un passage Studio) voyage dans un `<input type="hidden" name="description">`.
PostHog masque les saisies par `maskAllInputs: true`, mais **rrweb ne couvre pas le type
`hidden`** (son attribut `value` entre en clair dans l'enregistrement) et `ph-mask` ne masque
que des textes. WP-STUDIO avait posé `ph-no-capture` autour de son tiroir
(`send-drawer.tsx:292`), mais le composant partagé restait exposé chez tout autre hôte.

**Correctif.** Les quatre champs cachés de la variante verrouillée portent
`className="ph-no-capture"` (aucun enrobage : une `<div>` vide aurait ajouté un espace au
`flex gap-6` du tiroir) ; la vignette de `StudioAttachmentCard` (une `data:` URL qui montre
le texte gravé) porte `ph-no-capture` et la liste des lignes du résumé `ph-mask` (le tiroir y
met le résumé des textes saisis). Rien n'est retiré de ce que le visiteur voit ou saisit : les
classes n'ont d'effet que sur l'enregistrement. Variante « page » (`/custom`) : champs visibles
(textarea, e-mail), masqués d'office par `maskAllInputs`, donc rien à retirer.

**Test.** `quote-request-form.test.ts` (rendu serveur avec `react-dom/server`, 4 tests) : les
quatre champs cachés portent `ph-no-capture` et la description garde son texte ; la variante
verrouillée n'a aucun `<textarea>` ; la variante « page » reste un formulaire normal ; la
vignette porte `ph-no-capture` et la liste `ph-mask`.

### A2. Robustesse : un échec réseau de la Server Action ne remplace plus la page

**Défaut.** `useActionState(submitQuoteRequest)` : une Server Action qui échoue au niveau
réseau (connexion coupée, 5xx) **lève dans le rendu du composant** ; sans frontière, l'erreur
remonte jusqu'à `error.tsx` et emporte la page, `/custom` comprise, avec la saisie du visiteur.
(Un `try/catch` autour de `startTransition(() => formAction(data))` n'attraperait rien :
`formAction` rend la main tout de suite, l'exception arrive plus tard, dans le rendu.)

**Correctif.** L'envoi piloté par JavaScript appelle désormais la Server Action
**directement**, dans une transition, par `attemptSubmit()` (`quote-logic.ts`, ne lève
jamais) ; la réponse alimente un état local (`sentState`). Un échec devient une valeur :
le formulaire reste monté (saisie et fichier déjà préparé gardés dans `prepared.current`, donc
**aucun second export ni téléversement** au « Réessayer »), affiche le message existant
`quote.errors.network` (« L'envoi a échoué. Vérifiez votre connexion et réessayez. ») et le
bouton passe à `quote.retry` (« Réessayer »). `useActionState` reste branché pour le
formulaire natif sans JavaScript (amélioration progressive conservée). Aucune clé de message
ajoutée : `errors.network` et `retry` existaient déjà dans les quatre langues (ajoutées par
WP-STUDIO pour son `SendErrorBoundary`, qui reste en place derrière le formulaire).

**Test.** `quote-logic.test.ts` : `attemptSubmit` rend l'état, attrape un rejet et une erreur
levée avant la première attente. La vérification dans le navigateur est en section 6.

### A3. `peakLabel` : plus de « POINTE POINTE ZORGL »

**Défaut.** `peakLabelParts` (`src/lib/studio/objects/relief-model.ts`) préfixait toujours le
mot de la langue : un visiteur qui tape « Pointe Zorgl » lisait « POINTE POINTE ZORGL ».

**Correctif.** Nouvelle fonction exportée `startsWithPeakWord(name, locale)` : vrai quand le
nom nettoyé commence par le mot de la langue (fr Pointe, de Piz, it Pizzo, en Mount), **mot
entier** (la frontière est une non-lettre : « Pointe-Noire » compte, « Pointer » et
« Mountain » non), sans tenir compte de la casse ni des accents (« POINTÉ »). Le mot d'une
autre langue ne compte pas (« Piz Bernina » sous `/fr` reste « POINTE PIZ BERNINA »).
`peakLabelParts` ne préfixe plus dans ce cas ; l'altitude reste celle du nom saisi.
**`peakLabelParts` est le point unique** : `peakLabel` (chapitre 02 de l'accueil, par
`home-tools.tsx` et `home-data-build.ts`) et `layoutLabel` (étiquette gravée du sous-verre du
Studio, STL compris) en dérivent, les deux suivent donc la règle. Les clés
`studioCore.relief.peak` / `relief.summit` (« Pointe {name} ») ne sont lues par aucun code.

**Tests.** `flat-objects.test.ts`, trois tests ajoutés : préfixe non doublé dans les quatre
langues (casse, accents, espaces, trait d'union, mot seul), préfixe ajouté sinon (mot entier,
autre langue), et l'étiquette gravée par `layoutLabel` suit la même règle.

**Vérification dans le navigateur (preview de production, Edge, 01.10.2026).** Les appels de
Server Action sont coupés par Playwright (`route.abort("connectionfailed")` sur toute requête
portant l'en-tête `next-action`) :

| Cas                                    | Après l'échec                                                                                                                                                                                                                                                                | Après « Réessayer »                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `/fr/custom` (variante page)           | **page conservée** (1 h1, ni `error.tsx` ni « Erreur inattendue »), alerte « L'envoi a échoué. Vérifiez votre connexion et réessayez. », bouton « Réessayer », **description et e-mail intacts**, une ligne `[quote] envoi interrompu TypeError: Failed to fetch` en console | panneau « Reçu. » (demande enregistrée)          |
| Tiroir du Studio (`/fr/studio/lavaux`) | tiroir ouvert, même alerte, **1 téléversement** (`/api/quote-upload`) fait avant la coupure                                                                                                                                                                                  | « Reçu. », **0 téléversement de plus** (total 1) |

**Preuve DOM de A1** dans le tiroir réel : les quatre champs cachés `description` (819
caractères), `material`, `colors`, `dimensions` portent `ph-no-capture` (`locale` non, il ne
porte rien de personnel), la vignette porte `ph-no-capture`, la liste du résumé `ph-mask`.

**Effets de bord sur la base de test** : deux demandes de devis `@example.test`
(`w3-net@…`, `w3-drawer@…`) créées par ces essais dans la branche Neon de développement ; leurs
e-mails sont dans l'outbox, **aucun envoi** (clé Resend vide).

### A4. Chapitre 02 de l'accueil avec la vraie scène du Studio

Preview de production (`/fr`, `/de`, `/en`, `/it`, 1440 × 900, WebGL SwiftShader, consentement
non donné). Le chapitre `#sommet` est amené à l'écran, le moteur (gate `home-tools`) s'y charge
(marge 150 %), puis frappe au clavier dans `#summit-input` (90 ms par touche).

| Contrôle                                      | Résultat                                                                                                                                                                                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scène                                         | vue `studio-object` (`data-stage-ready="true"`), **un canvas, un seul contexte WebGL vivant** (la sonde en avait créé un autre, jeté) ; l'affiche SVG passe à `opacity: 0` une fois la vue prête                                                                              |
| **Relief du nom**                             | capture du chapitre (1 image, 712 × 845) : le sous-verre est rendu en strates (bleu, vert, gris, blanc) avec « POINTE ZORGL · 4 364 M » **gravé en relief** sur la zone plate, sur le quadrillage de la carte                                                                 |
| **Fond encre**                                | le conteneur `[data-tone="ink"]` devient transparent quand la vue est prête (`rgba(0,0,0,0)`) ; le Stage peint le fond : pixel de coin = **(26, 22, 20) = `#1a1614`**, le jeton `--paper` du ton encre (les autres coins tombent sur le filet de l'en-tête et le quadrillage) |
| **Étiquette DOM** (`p[aria-live]`, `ph-mask`) | fr « POINTE LÉA · 2 566 M » (exemple) → « POINTE ZORGL · 2 359 M » en tapant « Zorgl » ; de « PIZ ZORGL · 2’359 M », en « MOUNT ZORGL », it « PIZZO ZORGL » (séparateur de milliers de la langue)                                                                             |
| **Plus de doublon (A3)**                      | « Pointe Zorgl » en français → « POINTE ZORGL · 4 364 M » (et non « POINTE POINTE ZORGL ») ; sous `/de`, `/en`, `/it` le mot d'une autre langue est conservé (« PIZ POINTE ZORGL »), comme voulu                                                                              |
| **Zéro requête réseau pendant la frappe**     | **0** requête (`page.on("request")`) pour « Zorgl » puis pour « Pointe Zorgl », dans les quatre langues                                                                                                                                                                       |
| Texte au Studio par `sessionStorage`          | `s3d-studio-texts-v1` = `{"relief":{"peak":"Zorgl"}}` ; vidé en effaçant le champ (retour à l'exemple) ; **jamais dans l'URL** (le lien du bouton rouge ne porte que la configuration, `#c=v1.…`)                                                                             |
| Arrivée au Studio                             | `/fr/studio/relief#c=…` : le champ du nom est prérempli (« Zorgl »), le résumé dit « texte : « Zorgl » », l'URL ne contient pas le texte, un canvas et un contexte WebGL vivants                                                                                              |
| Console                                       | 0 erreur, 0 avertissement (hors la violation CSP « eval » du Studio, voir A5)                                                                                                                                                                                                 |

La bande de mesure (`MeasureStrip live`) montre « 100 × 100 × 6,2 mm, ≈ 23 g, ≈ 47 min, 3
changements » avant et après la frappe : les chiffres sont arrondis à ce niveau et l'étiquette
ne pèse que quelques dixièmes de gramme, ils ne changent donc pas d'un nom à l'autre ; le
recalcul lui-même est couvert par les tests du chapitre (`home-data.test.ts`).

### A5. CSP : violation « eval » sur chaque page objet du Studio (trouvée par le balayage)

**Défaut.** `/fr/studio/{lavaux,cartouche,relief,borne}` et `/it/studio/lavaux` déclenchent
chacune **une `securitypolicyviolation`** (`script-src`, bloqué : `eval`) en production, donc
un rapport vers `/api/csp-report` à chaque visite et un critère « 0 violation CSP » en échec.
Source : `Function("")`, la sonde de **zod 4** (`allowsEval`) qui s'exécute à la construction
du premier schéma, dans le chunk client `3125-*` (colonne 6 346 de sa ligne 1). L'exception est
avalée, donc **aucune fonctionnalité n'est cassée** ; mais Edge la signale quand même. Le Studio
est le seul code client qui importe zod (`src/lib/studio/schemas.ts:10`).

**Correctif.** `z.config({ jitless: true })` juste après les imports de `schemas.ts`, avant la
construction du premier schéma (zod saute alors la sonde : son propre commentaire le documente
pour les CSP strictes). Dans le Worker, zod ne compilait déjà pas (« Cloudflare » dans le
`userAgent`). **Test** `schemas-csp.test.ts` : un espion sur `Function` ne voit **aucun** appel
`Function("")` pendant le chargement de `schemas.ts` et trois `parseConfig` (le test échoue sans
le correctif, vérifié). La preuve en navigateur est en section 6.

## B. Vérification de production

### 5.1 Worker (gzip du dry-run, la valeur qui compte)

Builds : `bunx opennextjs-cloudflare build`, puis `bunx wrangler deploy --dry-run`,
`bun scripts/check-worker-bundle.ts` et `bun scripts/chunk-report.ts`. **Comparables à chemin
égal seulement** (voir `measures-wave2a.md` §2.1) : les quatre premiers builds ci-dessous ont
été faits dans `C:\s3d-matched-path-w2a-0123456789abcdefg` (41 caractères, mêmes `package.json`
et `bun.lock` que la vague 2a, sources recopiées par `robocopy` depuis `git archive`).

| Révision (même dossier de 41 caractères)         | `Total Upload` (brut)                 | `gzip` (dry-run) | Écart de gzip | Budget du brief |
| ------------------------------------------------ | ------------------------------------- | ---------------- | ------------- | --------------- |
| `6ceaf0c` après WP-02 (relevé de la vague 2a)    | 16 170,02 KiB                         | **3 145,30 KiB** | —             | —               |
| `f2dd5b5` + **WP-HOME**                          | 16 310,31 KiB                         | **3 163,14 KiB** | **+17,84**    | +10             |
| `cdefa67` + **WP-STUDIO** (avant mes correctifs) | 16 974,36 KiB                         | **3 324,75 KiB** | **+161,61**   | +10             |
| `7bd21df`… HEAD de ce passage (+ A1 à A3, zod)   | 16 975,44 KiB (sans le correctif zod) | **3 324,97 KiB** | +0,22 (bruit) | —               |
| même HEAD, build dans le worktree (77 car.)      | 17 252,94 KiB                         | 3 323,61 KiB     | (chemin long) | —               |

**Total : 3 324,97 KiB, soit +179,7 KiB depuis la vague 2a et 140 KiB AU-DESSUS du plafond de
3 185 KiB** (décision du propriétaire du 30.09, brief §4.11). **C'est le seul critère chiffré en
échec de ce passage** ; il n'y a aucune urgence technique (le plafond de Cloudflare Workers Paid
est de 10 MiB gzip, nous sommes à 3,2 MiB), mais le budget voté est dépassé et il reste WP-99.
Le build du `HEAD` a été fait avant le correctif zod (A5) : le correctif ne change pas le Worker
de façon mesurable (une ligne), le chiffre sera redonné en fin de passage si un nouveau build est
fait.

**Croissance par paquet** (gzip du dry-run, 41 caractères) :

| Paquet                | Budget | Mesuré      | Dépassement                                     |
| --------------------- | ------ | ----------- | ----------------------------------------------- |
| WP-HOME (`f2dd5b5`)   | +10    | **+17,84**  | +7,8 (dans le bruit de ±6 d'un build à l'autre) |
| WP-STUDIO (`cdefa67`) | +10    | **+161,61** | **+151,6**                                      |

Le brut grossit de 140 KiB (HOME) puis 664 KiB (STUDIO). Attribution du côté Studio
(comparaison fichier par fichier de `.next/server` entre les builds `f2dd5b5` et `cdefa67`,
`srvdiff`) : **13 fichiers ajoutés, 474 KiB bruts, 145 KiB de gzip fichier par fichier**, plus
+43 KiB bruts dans le chunk des messages (`4569.js`, les quatre langues du namespace `studio`
chargées dans le Worker) :

| Fichier serveur ajouté                       | Brut    | gzip   | Contenu (modules webpack les plus gros)                                                                                                                                 |
| -------------------------------------------- | ------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/[locale]/(site)/studio/[objet]/page.js` | 92 KiB  | 29 KiB | `StudioApp` rendu côté serveur (module 27826, 68,5 KiB) : le composant client est rendu en SSR, donc embarqué dans le Worker                                            |
| `chunks/5629.js`                             | 93 KiB  | 29 KiB | **zod** (module 32769, 81,2 KiB) + earcut (7 KiB) + d3-array (4,5 KiB) : une copie de zod de plus (couche SSR), `schemas.ts` étant importé par le code client du Studio |
| `chunks/2956.js`                             | 68 KiB  | 26 KiB | bibliothèque du Studio : `ranges`, schémas, géométrie, statistiques (21 modules)                                                                                        |
| `chunks/345.js`                              | 35 KiB  | 14 KiB | texte en relief, mise en page de l'étiquette (19 modules)                                                                                                               |
| `chunks/9689.js`                             | 25 KiB  | 9 KiB  | `QuoteRequestForm` (13,3 KiB) et ses voisins, tirés par le tiroir d'envoi                                                                                               |
| `app/…/studio/page.js` (index du Studio)     | 24 KiB  | 8 KiB  | page du hub                                                                                                                                                             |
| 7 autres (manifestes, petits chunks)         | 137 KiB | 30 KiB |                                                                                                                                                                         |

Le Worker contenait déjà deux copies de zod (chunks `7031.js` 300 KiB et `7377.js` 101 KiB, côté
actions et routes) ; celle de `5629.js` est la troisième : webpack ne partage pas un module entre
la couche des actions et la couche SSR des composants client.

**Pistes pour revenir sous 3 185 KiB** (à la discrétion du propriétaire ; rien n'est implémenté
ici, un seul levier tient dans le périmètre d'un correctif) :

1. **Retirer zod du code client du Studio** (`src/lib/studio/schemas.ts:10`, importé par le
   code client pour `parseConfig` : lien partagé, paramètres GET, outil WebMCP). Valider à la
   main avec les plages de `ranges.ts` (déjà sans zod) : ≈ **−25 KiB** de gzip dans le Worker et
   autant dans le JS client du Studio (le chunk client `3125-*` : 85,7 KiB bruts, 25,6 KiB gzip,
   est essentiellement zod).
2. **Ne pas rendre `StudioApp` en SSR** (`next/dynamic({ ssr: false })` derrière un gate, avec un
   poster SSR comme au héros) : ≈ **−45 KiB** (page + chunks 2956/345 : la bibliothèque du Studio
   ne serait plus tirée par le rendu serveur). Contre-partie : plus de HTML des champs avant
   hydratation (le formulaire GET sans JavaScript de WP-STUDIO, commit `3fb00b4`, disparaîtrait
   de la page objet) : à arbitrer.
3. **Charger les messages du Studio à la demande** (4 langues × 11 KiB bruts = 43 KiB bruts,
   ≈ 10 KiB gzip) : `src/i18n/request.ts` ne fournit au Worker que la langue de la requête.
4. **Relever le plafond** à environ 3 350 KiB : décision du propriétaire, vu la marge de Cloudflare
   Workers Paid.

### 5.2 `check-worker-bundle`

**0 signature** (WebGLRenderer, NeutralToneMapping, GreenSock, ScrollTrigger, lenis-smooth) sur
1 582 fichiers (HEAD, 41 caractères : 40 677,0 KiB bruts, 10 565,4 KiB gzip fichier par
fichier). Mêmes 0 sur les builds `f2dd5b5` et `cdefa67`. `node_modules/` 5 011,8 KiB gzip
(inchangé), middleware 102,0 KiB.

### 5.3 Chunks client (`bun scripts/chunk-report.ts`, build du worktree)

208 chunks, **1 219,4 KiB gzip** (3 671,3 KiB bruts) contre 189 chunks et 1 071,5 KiB en vague
2a (+147,9 KiB : le Studio et l'accueil, tous derrière un gate). 6 chunks portent un moteur
(three ×3, gsap ×2, lenis ×1), tous derrière un gate. `scripts/chunk-report.ts` suit désormais
aussi les routes du Studio, `/track`, `/favorites`, `/account/login` et `/legal/terms`
(14 routes au lieu de 8 ; plus besoin de la copie jetable de la vague 2a).

| Route (JS initial, borne haute)      | gzip          | brut      | chunks | Vague 2a |
| ------------------------------------ | ------------- | --------- | ------ | -------- |
| `/[locale]` (accueil)                | **194,2 KiB** | 612,1 KiB | 17     | 231,4    |
| `/[locale]/studio`                   | **188,8 KiB** | 594,7 KiB | 18     | —        |
| `/[locale]/studio/[objet]`           | **302,1 KiB** | 924,4 KiB | 28     | —        |
| `/[locale]/shop`                     | 187,1 KiB     | 590,9 KiB | 18     | 230,4    |
| `/[locale]/products/[slug]`          | 187,7 KiB     | 594,6 KiB | 17     | 234,8    |
| `/[locale]/custom`                   | 217,2 KiB     | 675,8 KiB | 21     | 259,7    |
| `/[locale]/a-propos`                 | 215,7 KiB     | 674,6 KiB | 20     | 258,9    |
| `/[locale]/contact`                  | 210,2 KiB     | 654,9 KiB | 20     | 253,5    |
| `/[locale]/cart` (hors `(site)`)     | 213,0 KiB     | 664,0 KiB | 20     | 256,3    |
| `/[locale]/checkout` (hors `(site)`) | 222,0 KiB     | 690,1 KiB | 20     | 265,3    |
| `/[locale]/track`                    | 191,5 KiB     | 602,2 KiB | 19     | 234,8    |
| `/[locale]/favorites`                | 190,3 KiB     | 600,2 KiB | 17     | 233,2    |
| `/[locale]/account/login`            | 212,8 KiB     | 663,7 KiB | 19     | 256,1    |
| `/[locale]/legal/terms`              | 182,6 KiB     | 579,3 KiB | 16     | 225,9    |

- **Accueil : 194,2 KiB pour un budget de 233,7 KiB** (« base + 15 »), marge de **39,5 KiB**.
  Toutes les routes ont perdu 37 à 44 KiB par rapport à la vague 2a, de façon uniforme : ce n'est
  pas WP-HOME, c'est un changement commun à toutes les routes (les quatre fichiers racine
  `webpack`, `4bd1b696`, `3794`, `main-app` font 132 KiB ; le relevé de la vague 2a comptait
  apparemment aussi le chunk `polyfills`, 39 KiB, qui n'est plus dans `rootMainFiles`). **Cause
  non isolée** (le build 2a n'a pas été conservé) ; à ne pas lire comme un gain réel.
- **`/[locale]/studio/[objet]` : 302,1 KiB de JS initial** (28 chunks) : la route la plus lourde
  du site, 80 KiB de plus que le checkout. Pas de budget dédié au brief ; à comparer à
  l'objectif INP et LCP de la section 7. Le zod du client (module de 81 KiB bruts, chunk
  `3125`) en fait partie (piste 1 ci-dessus).
- Gates (`.next/react-loadable-manifest.json`, gzip zlib par défaut, chunks partagés compris) :

| Gate                                                | gzip                                  | Budget                            |
| --------------------------------------------------- | ------------------------------------- | --------------------------------- |
| `@/motion/runtime` (gsap + Lenis)                   | **54,2 KiB**                          | ≤ 65 ✓                            |
| `@/motion/stage/stage-root` (three)                 | **157,3 KiB**                         | ≤ 200 ✓ (148,9 en 2a : +8,4)      |
| scène `studio-object`                               | 14,4 KiB                              | ≤ 15 ✓                            |
| scène `print-hero`                                  | 38,8 KiB (6 chunks, partagés compris) | ≤ 15 en propre (non isolable ici) |
| `@/motion/studio/engine` + `geometry-core` (Worker) | 2,2 + 28,1 KiB                        | ≤ 40 + ≤ 60 ✓                     |
| `@/motion/choreo/home` / `home-tools`               | 52,3 / 32,5 KiB                       | —                                 |
| `@/motion/choreo/about` / `product`                 | 50,1 / 51,0 KiB                       | —                                 |
| outil WebMCP `configure-tool` (chargé à la demande) | 58,4 KiB                              | —                                 |
| posthog-js (`instrumentation-client`, paresseux)    | 193,0 KiB (2 chunks)                  | —                                 |

- Glyphes 3D : `public/studio/glyphs/s3d-relief-v1.json` **34,0 KiB** gzip (121,4 bruts) pour un
  budget de ≤ 45 ✓ (fichier statique, hors Worker).

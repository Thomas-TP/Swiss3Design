# Vague 2b · Vérification et mesures

Vérification de la branche d'intégration `claude/redesign-2026` après la fusion de WP-HOME
(`f2dd5b5`) et de WP-STUDIO (`cdefa67`), plus quatre petits correctifs (partie A). Base de
comparaison : `measures-wave2a.md` (Worker 3 145,30 KiB après WP-02), `measures-wave1.md`,
brief §4.11 et §10. **01.10.2026**, worktree isolé, rien poussé, branche
`claude/redesign-2026--verify-w3`.

Ce document s'écrit au fil des étapes : chaque section est commitée dès que sa mesure est
faite (la limite d'usage a déjà coupé des passages précédents).

## Résumé

| Critère                                                                   | Résultat                                                                                                                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lint, typecheck, tests, format                                            | **verts** (843 tests passés, 15 ignorés sans URL de base ; 64 fichiers)                                                                                                              |
| A1 vie privée : champs cachés du devis hors des enregistrements de visite | **corrigé** et vérifié dans le tiroir réel (`ph-no-capture` sur les 4 champs et la vignette)                                                                                         |
| A2 échec réseau de la Server Action                                       | **corrigé** : page conservée, message « L'envoi a échoué… », « Réessayer » réussit sans second téléversement (`/custom` et tiroir)                                                   |
| A3 « POINTE POINTE ZORGL »                                                | **corrigé** (`startsWithPeakWord`), accueil et gravure du Studio par `peakLabelParts`                                                                                                |
| A4 chapitre 02 avec la vraie scène                                        | **conforme** : relief du nom gravé, fond encre `#1a1614`, étiquette DOM, **0 requête** pendant la frappe, texte au Studio par `sessionStorage` (4 langues)                           |
| A5 (trouvé) violation CSP « eval » sur les pages d'objet du Studio        | **corrigé** (zod en `jitless`) ; 5 violations avant, **0** après                                                                                                                     |
| **Worker gzip ≤ 3 185 KiB**                                               | **ÉCHEC : 3 326,10 KiB** (+180,8 depuis la vague 2a) ; HOME +17,8 (budget +10), **STUDIO +161,6 (budget +10)** ; plafond Cloudflare 10 MiB non menacé ; **décision du propriétaire** |
| 0 signature three / gsap / lenis dans le Worker                           | **0**                                                                                                                                                                                |
| JS initial de l'accueil ≤ 233,7 KiB                                       | **194,2 KiB** (marge 39,5 ; baisse uniforme de 37 à 44 KiB sur toutes les routes, non expliquée) ; Studio objet 302,7 KiB                                                            |
| Gates : runtime ≤ 65, Stage ≤ 200, moteur Studio + Worker, glyphes ≤ 45   | **54,2 / 157,3 / 2,2 + 28,1 / 34,0 KiB**, tous dans le budget                                                                                                                        |
| 20 URL : 0 CSP, 0 hydratation, 0 MISSING_MESSAGE, 0 4xx inattendu         | **0 / 0 / 0 / 0** ; nonce correct sur chaque script (21 URL en HTML brut) ; journal du serveur sans erreur ni 5xx                                                                    |
| Un contexte WebGL au plus par page ; `html.lenis` seulement dans `(site)` | **oui** ; mouvement réduit (OS et footer) et 375 × 812 conformes (0 px de débordement)                                                                                               |
| CLS de laboratoire ≤ 0,05                                                 | **≤ 0,0317** (Lighthouse), 0 à 0,0203 (pilote CDP)                                                                                                                                   |
| LCP ≤ 2,0 s (mobile 9 Mbps, 150 ms, CPU × 4)                              | `/fr` **1,93 s** (h1 ✓) ; Studio **2,02 à 2,17 s** (chapeau, à la limite) ; desktop `/fr` 2,8 à 4,0 s observés avec WebGL logiciel (0,72 s sans WebGL)                               |
| TBT                                                                       | **4,7 à 5,7 s (`/fr`) et 2,6 à 2,7 s (Studio) en Lighthouse avec WebGL logiciel ; 29 et 100 ms sans WebGL** : à confirmer sur un vrai GPU                                            |

**Verdict** : prêt pour J1 sous réserve de la décision sur le plafond du Worker ; **les mesures de
fil principal (TBT, LCP desktop) du chemin WebGL doivent être refaites sur de vrais appareils** avant
de les tenir pour acquises. Détail en sections 7 à 9.

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

| Révision (même dossier de 41 caractères)         | `Total Upload` (brut) | `gzip` (dry-run) | Écart de gzip | Budget du brief |
| ------------------------------------------------ | --------------------- | ---------------- | ------------- | --------------- |
| `6ceaf0c` après WP-02 (relevé de la vague 2a)    | 16 170,02 KiB         | **3 145,30 KiB** | —             | —               |
| `f2dd5b5` + **WP-HOME**                          | 16 310,31 KiB         | **3 163,14 KiB** | **+17,84**    | +10             |
| `cdefa67` + **WP-STUDIO** (avant mes correctifs) | 16 974,36 KiB         | **3 324,75 KiB** | **+161,61**   | +10             |
| HEAD de ce passage, sans le correctif zod        | 16 975,44 KiB         | 3 324,97 KiB     | +0,22 (bruit) | —               |
| **HEAD final** (A1 à A5, zod en jitless)         | 16 979,06 KiB         | **3 326,10 KiB** | +1,35 (bruit) | —               |
| même HEAD, build dans le worktree (77 car.)      | 17 256,25 KiB         | 3 323,83 KiB     | (chemin long) | —               |

**Total : 3 326,10 KiB, soit +180,8 KiB depuis la vague 2a et 141 KiB AU-DESSUS du plafond de
3 185 KiB** (décision du propriétaire du 30.09, brief §4.11). **C'est le seul critère chiffré en
échec de ce passage** ; il n'y a aucune urgence technique (le plafond de Cloudflare Workers Paid
est de 10 MiB gzip, nous sommes à 3,2 MiB), mais le budget voté est dépassé et il reste WP-99.
Mes cinq correctifs (A1 à A5) pèsent ensemble +1,35 KiB (dans le bruit de ±6 d'un build à
l'autre) : le correctif zod (A5) tient en une ligne et ne change pas le Worker de façon mesurable.

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
le Worker du `HEAD` final (41 caractères : 40 679,7 KiB bruts, 10 567,4 KiB gzip fichier par
fichier ; `handler.mjs` 2 833,7 KiB gzip). Mêmes 0 sur les builds `f2dd5b5` et `cdefa67` et sur
le build du worktree. `node_modules/` 5 011,8 KiB gzip (inchangé), middleware 102,0 KiB.

### 5.3 Chunks client (`bun scripts/chunk-report.ts`, build du worktree)

208 chunks, **1 219,9 KiB gzip** (3 672,9 KiB bruts) contre 189 chunks et 1 071,5 KiB en vague
2a (+148,4 KiB : le Studio et l'accueil, tous derrière un gate). 6 chunks portent un moteur
(three ×3, gsap ×2, lenis ×1), tous derrière un gate. `scripts/chunk-report.ts` suit désormais
aussi les routes du Studio, `/track`, `/favorites`, `/account/login` et `/legal/terms`
(14 routes au lieu de 8 ; plus besoin de la copie jetable de la vague 2a).

| Route (JS initial, borne haute)      | gzip          | brut      | chunks | Vague 2a |
| ------------------------------------ | ------------- | --------- | ------ | -------- |
| `/[locale]` (accueil)                | **194,2 KiB** | 612,1 KiB | 17     | 231,4    |
| `/[locale]/studio`                   | **188,8 KiB** | 594,7 KiB | 18     | —        |
| `/[locale]/studio/[objet]`           | **302,7 KiB** | 926,0 KiB | 28     | —        |
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
- **`/[locale]/studio/[objet]` : 302,7 KiB de JS initial** (28 chunks) : la route la plus lourde
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

## 6. Preview de production (`opennextjs-cloudflare preview`, port 8792)

Build du `HEAD` final (A1 à A5), `opennextjs-cloudflare preview -- --upstream-protocol https
--port 8792 --inspector-port 9332`, Hyperdrive lu dans `.env.local` et posé en `$env:` dans la
même commande (branche Neon de développement). Navigateur : Edge 155 headless, WebGL par
SwiftShader (logiciel), contextes neufs, consentement non donné, 1440 × 900 sauf mention.

### 6.1 HTML brut (sans JavaScript)

Statut, structure, nonce (la valeur de chaque `nonce=` est comparée à celle de l'en-tête
`Content-Security-Policy`, pas seulement sa présence) et poids (`accept-encoding: identity`,
puis gzip niveau 9). « nonce » = scripts inline / scripts `src` en écart.

| URL                         | Statut  | header | main | h1  | footer | nonce (inline / src) | Brut / gzip (KiB) |
| --------------------------- | ------- | ------ | ---- | --- | ------ | -------------------- | ----------------- |
| `/fr`                       | 200     | 6      | 1    | 1   | 1      | 4 / 0, 18 / 0        | 217,7 / 33,8      |
| `/de`                       | 200     | 6      | 1    | 1   | 1      | 4 / 0, 18 / 0        | 217,6 / 34,1      |
| `/fr/studio`                | 200     | 1      | 1    | 1   | 1      | 7 / 0, 17 / 0        | 194,0 / 43,3      |
| `/fr/studio/lavaux`         | 200     | 1      | 1    | 1   | 1      | 7 / 0, 28 / 0        | 190,8 / 33,7      |
| `/fr/studio/cartouche`      | 200     | 1      | 1    | 1   | 1      | 7 / 0, 28 / 0        | 152,6 / 28,8      |
| `/fr/studio/relief`         | 200     | 1      | 1    | 1   | 1      | 7 / 0, 28 / 0        | 181,1 / 33,7      |
| `/fr/studio/borne`          | 200     | 1      | 1    | 1   | 1      | 7 / 0, 28 / 0        | 151,4 / 28,6      |
| `/it/studio/lavaux`         | 200     | 1      | 1    | 1   | 1      | 7 / 0, 28 / 0        | 189,9 / 33,4      |
| `/fr/shop`                  | 200     | 1      | 1    | 1   | 1      | 5 / 0, 17 / 0        | 143,7 / 20,5      |
| `/fr/products/vase-spirale` | 200     | 5      | 1    | 1   | 1      | 6 / 0, 17 / 0        | 131,0 / 21,0      |
| `/fr/custom`                | 200     | 1      | 1    | 1   | 1      | 5 / 0, 20 / 0        | 93,8 / 18,4       |
| `/fr/a-propos`              | 200     | 7      | 1    | 1   | 1      | 6 / 0, 19 / 0        | 179,3 / 32,1      |
| `/fr/contact`               | 200     | 1      | 1    | 1   | 1      | 5 / 0, 19 / 0        | 87,5 / 16,1       |
| `/fr/cart`                  | 200     | 1      | 1    | 1   | 1      | 4 / 0, 22 / 0        | 76,2 / 14,1       |
| `/fr/checkout`              | 200     | 1      | 1    | 1   | 1      | 4 / 0, 22 / 0        | 75,0 / 13,6       |
| `/fr/track`                 | 200     | 1      | 1    | 1   | 1      | 4 / 0, 21 / 0        | 74,6 / 13,1       |
| `/fr/favorites`             | 200     | 1      | 1    | 1   | 1      | 4 / 0, 19 / 0        | 72,1 / 12,7       |
| `/fr/account/login`         | 200     | 1      | 1    | 1   | 1      | 4 / 0, 20 / 0        | 78,2 / 14,7       |
| `/fr/legal/terms`           | 200     | 1      | 1    | 1   | 1      | 4 / 0, 18 / 0        | 104,9 / 22,3      |
| `/fr/zzz-inconnu`           | **404** | 1      | 1    | 1   | 1      | 4 / 0, 12 / 0        | 68,7 / 12,0       |
| `/fr/studio/inconnu`        | **404** | 0      | 0    | 0   | 0      | 2 / 0, 5 / 0         | 70,3 / 15,7       |

- **Nonce : 0 écart sur les 21 URL**, du script anti-flash du layout racine aux scripts du
  Studio ; l'en-tête CSP porte `'nonce-…'` partout.
- **L'accueil pèse de nouveau 217,7 KiB bruts / 33,8 KiB gzip** (119,6 / 19,6 en vague 2a ;
  151,6 / 34,6 en vague 1) : WP-HOME y ajoute les posters et les textes des chapitres. Le
  hub du Studio est la page la plus lourde en gzip (43,3 KiB). Rien n'est plafonné au brief
  pour ces poids ; ils pèsent surtout sur l'hydratation (section 7).
- **404 d'un slug de Studio inconnu** (`/fr/studio/inconnu`, `notFound()` levé par la page) :
  statut 404 et `noindex`, mais **corps vide dans le HTML brut**, comme la fiche produit
  supprimée de la vague 2a : c'est la limite de Next 16.3.6 déjà documentée au §7.18 du brief,
  la page 404 s'affiche après hydratation. L'URL sans route (`/fr/zzz-inconnu`) rend bien
  header, `<main>`, h1 et footer côté serveur.

### 6.2 Console, CSP, hydratation, 4xx

Chaque page est défilée jusqu'en bas par paliers de 700 px (le balayage échantillonne aussi les
contextes WebGL). Violation CSP = événement `securitypolicyviolation` capté dans la page +
messages « Refused to… » de la console.

| Mode                                                 | Pages | Violations CSP | Erreurs d'hydratation | MISSING_MESSAGE / IntlError | 4xx inattendus | Débordement horizontal |
| ---------------------------------------------------- | ----- | -------------- | --------------------- | --------------------------- | -------------- | ---------------------- |
| Clair, mouvement complet (les 20 URL du balayage)    | 20    | **0**          | 0                     | 0                           | 0              | aucun                  |
| Sombre                                               | 4     | 0              | 0                     | 0                           | 0              | aucun                  |
| Mouvement réduit par l'OS (`prefers-reduced-motion`) | 4     | 0              | 0                     | 0                           | 0              | aucun                  |
| Mouvement réduit par l'interrupteur du footer        | 4     | 0              | 0                     | 0                           | 0              | aucun                  |
| Mobile 375 × 812 (tactile, DPR 2)                    | 4     | 0              | 0                     | 0                           | 0              | aucun (0 px)           |

(Les quatre pages des modes spéciaux : `/fr`, `/fr/studio/lavaux`, `/fr/studio/relief`,
`/fr/shop`.) Les 20 URL : `/fr`, `/de`, `/fr/studio`, les quatre objets en français,
`/it/studio/lavaux`, `/fr/shop`, la fiche `vase-spirale`, `/fr/custom`, `/fr/a-propos`,
`/fr/contact`, `/fr/cart`, `/fr/checkout`, `/fr/track`, `/fr/favorites`, `/fr/account/login`,
`/fr/legal/terms` et `/fr/zzz-inconnu`. `/fr/custom#studio` après un passage Studio est vérifié à
part (A4 : carte jointe, description préremplie, 0 violation, 0 message de console).

- **Premier balayage, avant A5 : 5 violations** (une `script-src` « eval » sur chacune des cinq
  pages d'objet du Studio, voir A5). **Après le correctif : 0 sur les 20 pages.** C'était le
  seul défaut de ce passage dans cette grille.
- Seuls messages de console, tous attendus : l'avertissement de Stripe.js (« live Stripe.js
  integrations must use HTTPS », HTTP local) et 48 lignes « Tracking Prevention » d'Edge sur
  `/fr/checkout` ; sur la 404 « Failed to load resource: 404 » (le document lui-même). Aucune
  erreur React, aucun message « did not match ».
- **Journal du serveur du preview** (4 208 requêtes) : 3 998 × 200, 199 × 304, 1 × 307 (`GET /` vers
  la langue), **10 × 404 tous attendus** (7 × `/.well-known/appspecific/com.chrome.devtools.json`,
  sonde des outils de développement d'Edge ; 2 × `/fr/zzz-inconnu` ; 1 × `/fr/studio/inconnu`),
  **0 × 5xx, 0 erreur**. Les quatre 404 sur `/fr/studio` de la vague 2a (liens du Studio avant
  son existence) ont disparu.

### 6.3 `html.lenis`, WebGL, mouvement réduit, mobile

- **`html.lenis` uniquement dans `(site)`** : présent sur `/fr`, `/de`, les cinq pages du Studio,
  `/fr/shop`, la fiche produit, `/fr/custom`, `/fr/a-propos`, `/fr/contact` ; **absent** sur
  `/fr/cart`, `/fr/checkout`, `/fr/track`, `/fr/favorites`, `/fr/account/login`,
  `/fr/legal/terms` et la 404. **Absent partout en mouvement réduit** (OS et interrupteur du
  footer, `data-motion="reduce"` posé sur les quatre pages).
- **Au plus un contexte WebGL vivant par page** : `/fr` (Stage du héros) et les quatre pages
  d'objet du Studio en ont **un** (la sonde de capacité en crée un autre, jeté tout de suite :
  « 2 créés, 1 vivant ») ; `/fr/studio`, `/fr/shop`, la fiche produit, `/fr/custom`,
  `/fr/a-propos`, `/fr/contact` : la sonde seule, **0 vivant** ; pages hors `(site)` : aucun.
  Mobile 375 × 812 : mêmes comptes, **0 px** de débordement horizontal. L'arrivée sur `/fr/custom`
  depuis le Studio libère le contexte (0 vivant).
- Mouvement réduit : **`/fr` n'a aucun canvas** (affiches SVG) ; **les pages d'objet du Studio
  gardent un canvas** (un contexte) : le Studio est un outil, sa scène reste, à confirmer qu'elle
  ne tourne pas en continu (non mesuré ici, voir « points à confirmer »).

## 7. Performance (preview, WebGL logiciel)

**Réserve générale.** Le poste n'a pas de GPU exploitable par Edge headless : WebGL passe par
**SwiftShader** (rasterisation logicielle), dont la compilation des shaders est synchrone et
bloque le fil principal. Les chiffres du chemin WebGL sont donc **pessimistes pour le fil
principal** ; en revanche l'endroit du coût est réel. Chaque relevé a un témoin sans WebGL (tier
C0). Aucun relevé ne remplace les web vitals de PostHog en cache chaud ni une mesure sur un
téléphone réel (voir la section 8).

**Lighthouse 13.5.0 fonctionne** avec l'Edge installé (`CHROME_PATH`, `--chrome-flags="--headless=new
--enable-webgl --ignore-gpu-blocklist --use-angle=swiftshader --enable-unsafe-swiftshader"`),
première tentative réussie, **il est donc utilisé** pour le tableau principal. Profil demandé :
mobile 375 × 812, **9 Mbps / 150 ms de RTT / CPU × 4** (`--throttling.throughputKbps=9216
--throttling.rttMs=150 --throttling.cpuSlowdownMultiplier=4`, throttling simulé de Lighthouse),
cache désactivé par Lighthouse, 3 runs par page. Un second jeu de mesures, **observées** (pas
simulées), vient d'un pilote CDP (`Emulation.setCPUThrottlingRate` ×4, `Network.emulateNetworkConditions`
9 Mbps / 1,6 Mbps / 150 ms, `Network.setCacheDisabled`).

### 7.1 Lighthouse, mobile (9 Mbps / 150 ms / CPU × 4)

| Page                             | Run | Score | FCP    | **LCP**    | Élément LCP                     | **TBT**    | CLS    | TTI   |
| -------------------------------- | --- | ----- | ------ | ---------- | ------------------------------- | ---------- | ------ | ----- |
| `/fr`                            | 1   | 69    | 1,38 s | **1,93 s** | `h1#hero-title`                 | 4 723 ms   | 0,0018 | 7,9 s |
| `/fr`                            | 2   | 69    | 1,38 s | **1,94 s** | `h1#hero-title`                 | 5 677 ms   | 0,0018 | 8,7 s |
| `/fr`                            | 3   | 69    | 1,38 s | **1,93 s** | `h1#hero-title`                 | 5 037 ms   | 0,0018 | 8,2 s |
| `/fr/studio/lavaux`              | 1   | 70    | 1,38 s | **2,02 s** | `p` (chapeau « Cinq profils… ») | 2 608 ms   | 0,0317 | 5,1 s |
| `/fr/studio/lavaux`              | 2   | 70    | 1,38 s | **2,10 s** | idem                            | 2 649 ms   | 0,0317 | 5,0 s |
| `/fr/studio/lavaux`              | 3   | 69    | 1,38 s | **2,17 s** | idem                            | 2 739 ms   | 0,0317 | 5,2 s |
| _`/fr/shop` (témoin sans Stage)_ | 1   | 84    | 1,38 s | 2,01 s     | `img` « Vase Spirale »          | 575 ms     | 0,0015 | 2,6 s |
| _`/fr` sans WebGL (C0)_          | 1   | 100   | 1,23 s | 1,62 s     | `h1#hero-title`                 | **29 ms**  | 0,0018 | 1,9 s |
| _`/fr/studio/lavaux` sans WebGL_ | 1   | 98    | 1,38 s | 2,01 s     | `p` (chapeau)                   | **100 ms** | 0,0317 | 2,2 s |

Avec le profil par défaut de Lighthouse (« slow 4G », 1,6 Mbps) : `/fr` LCP 3,69 à 3,70 s
(score 57 à 58, TBT 4,4 à 4,6 s), `/fr/studio/lavaux` LCP 4,16 à 4,18 s (score 56, TBT 2,1 à
2,4 s) : le LCP du brief (≤ 2,0 s p75 mobile 4G) n'est tenu qu'avec le profil à 9 Mbps.

**Lecture.**

- **LCP** : `/fr` **1,93 s (≤ 2,0 ✓)**, l'élément est bien le **h1** (texte SSR, comme voulu) ; la
  page d'objet du Studio **2,02 à 2,17 s, à la limite du budget**, et son élément LCP est le
  **chapeau (`p.mt-4`)**, pas le h1 (le brief demande « h1 ou poster SSR »).
- **CLS** : **≤ 0,0317 partout (≤ 0,05 ✓)** ; `/fr` 0,0018.
- **TBT : 4,7 à 5,7 s sur `/fr` et 2,6 à 2,7 s sur le Studio : hors du seuil « bon » de Lighthouse (200 ms),
  mais entièrement imputable au chemin WebGL** : sans WebGL, 29 ms et 100 ms (score
  100 et 98), et la boutique sans Stage fait 575 ms. Dans les traces, le temps de script de
  `/fr` (7,8 à 8,3 s simulés) se range sous le chunk racine `3794-*` (5,2 à 5,6 s : la tâche est
  lancée depuis l'ordonnanceur de React) et `5907-*` (le Stage, 1,8 à 2,2 s), tâche la plus
  longue 2,1 à 2,7 s simulées. SwiftShader compile les shaders de façon synchrone ; sur un vrai
  GPU ce coût est bien plus faible, **mais il ne disparaît pas** (création de la scène, des
  géométries, `renderer.render` à froid, voir la recommandation 2 en section 8).

### 7.2 Mesures observées (CPU × 4, 9 / 1,6 Mbps, 150 ms, 375 × 812, cache désactivé)

Pilote CDP, 3 runs par page, observation 9 s après `load`. TBT = tâches longues (> 50 ms)
entre le FCP et la fin de l'observation ; « Stage prêt » = apparition de `data-stage-ready="true"`.

| Page                | Run | TTFB   | FCP    | **LCP**    | Élément LCP     | CLS    | TBT      | Tâche la plus longue | Stage prêt |
| ------------------- | --- | ------ | ------ | ---------- | --------------- | ------ | -------- | -------------------- | ---------- |
| `/fr`               | 1   | 533 ms | 1,26 s | **1,26 s** | `h1#hero-title` | 0      | 946 ms   | 581 ms               | 5,24 s     |
| `/fr`               | 2   | 517 ms | 1,18 s | **1,18 s** | idem            | 0      | 1 042 ms | 588 ms               | 5,33 s     |
| `/fr`               | 3   | 537 ms | 1,16 s | **1,16 s** | idem            | 0      | 1 114 ms | 606 ms               | 5,44 s     |
| `/fr/studio/lavaux` | 1   | 183 ms | 0,76 s | **0,76 s** | `p` (chapeau)   | 0,0203 | 532 ms   | 192 ms               | 3,72 s     |
| `/fr/studio/lavaux` | 2   | 189 ms | 0,78 s | **0,78 s** | idem            | 0,0203 | 520 ms   | 190 ms               | 3,78 s     |
| `/fr/studio/lavaux` | 3   | 197 ms | 0,78 s | **0,78 s** | idem            | 0,0203 | 451 ms   | 193 ms               | 3,75 s     |

Ici le LCP du mobile throttlé est de **1,2 s pour `/fr`** et **0,8 s pour le Studio**
(le h1 / le chapeau est peint au premier rendu) ; le TBT tombe à 0,5 à 1,1 s, la scène WebGL est
prête en 3,7 à 5,4 s. Les poids transférés (cache désactivé) : `/fr` 702 KiB dont 466 KiB de JS
(47 requêtes), Studio 812 KiB dont 530 KiB de JS (50 requêtes).

### 7.3 Desktop 1440 × 900

| Page / outil                            | FCP           | **LCP**                            | TBT          | CLS    | Remarque                                                  |
| --------------------------------------- | ------------- | ---------------------------------- | ------------ | ------ | --------------------------------------------------------- |
| `/fr`, Lighthouse (preset desktop)      | 0,43 s        | 1,99 s simulé (**3,97 s observé**) | 1 177 ms     | 0,0133 | score 60 ; délai de rendu de l'élément observé : 3 327 ms |
| `/fr`, pilote CDP (4 runs)              | 0,78 à 0,82 s | **2,83 à 2,92 s**                  | 923 à 954 ms | 0,0022 | une tâche de 880 à 903 ms ; Stage prêt à 1,35 s           |
| `/fr` sans WebGL, Lighthouse desktop    | 0,43 s        | **0,72 s**                         | **0 ms**     | 0,0133 | score 100                                                 |
| `/fr/studio/lavaux`, Lighthouse desktop | 0,43 s        | 0,92 s                             | 734 ms       | 0,0124 | score 73                                                  |
| `/fr/studio/lavaux`, pilote CDP         | 0,33 s        | 0,33 s                             | 51 ms        | 0,0115 | Stage prêt à 1,83 s                                       |
| `/fr/shop`, pilote CDP (témoin)         | 0,95 s        | 0,95 s                             | 0 ms         | 0,0019 | sans Stage                                                |

**Le LCP du héros sur desktop, 2,8 à 4,0 s observés, est le point à regarder** : le h1 de `/fr`
est peint au premier rendu (FCP 0,8 s) mais l'élément est re-déclaré plus grand à 2,1 puis 4,3 s
(journal des candidats : 228 914 puis 250 584 px² dans une capture à part), ce qui coïncide avec
l'arrivée de la police d'affichage (`archivo`, requise à 2,0 s dans cette capture) alors que le
fil principal est occupé par la tâche de ≈ 0,9 s de création de la scène. **Sans WebGL,
LCP 0,72 s et TBT 0** : tout vient du chemin WebGL, probablement amplifié par le rendu logiciel
d'un canvas de 1440 × 900. **À mesurer sur un vrai GPU avant de conclure** ; en attendant, le
risque est réel pour le budget « LCP ≤ 2,0 s » du brief sur l'accueil desktop.

CLS de laboratoire (cache désactivé, 2 runs) : Studio desktop 0,0115 (deux décalages à ≈ 490 ms,
formulaire et fil d'Ariane, au remplacement de la police), `/fr` 0,0022, hub du Studio 0 ;
mobile 375 : 0 sur `/fr` et sur la page objet. **Tous ≤ 0,05.**

## 8. Écarts et suites

Classés par gravité ; fichier et ligne, puis correctif recommandé. Les cinq correctifs A1 à A5
sont faits, les points ci-dessous ne le sont pas.

1. **Worker : 3 326,10 KiB pour un plafond de 3 185 (+141 KiB), dû à WP-STUDIO (+161,6 KiB)
   et, de façon marginale, à WP-HOME (+17,8, budget +10).** Détail et attribution en 5.1.
   Décision du propriétaire : relever le plafond (environ 3 350 KiB, le plafond de Cloudflare
   est de 10 MiB) ou faire revenir WP-99 sur le Studio. Leviers chiffrés : retirer zod du code
   client (`src/lib/studio/schemas.ts:10`, ≈ −25 KiB, et autant de JS client), ne pas rendre
   `StudioApp` en SSR (`src/app/[locale]/(site)/studio/[objet]/page.tsx:116`, ≈ −45 KiB, au prix du
   formulaire GET sans JavaScript de la page objet), charger les messages du Studio par langue
   (`src/i18n/request.ts`, ≈ −10 KiB). **Ce n'est pas un blocage technique de J1** (le déploiement
   passe), c'est un budget voté qui n'est plus tenu.
2. **Chemin WebGL : TBT 2,6 à 5,7 s (Lighthouse, WebGL logiciel) et LCP du héros desktop
   2,8 à 4,0 s ; sans WebGL 0 à 100 ms et 0,72 s.** À confirmer sur un vrai GPU avant de
   conclure (section 7). Correctif recommandé quel que soit le résultat : ne jamais compiler un
   shader sur le chemin du premier rendu. Appeler `renderer.compileAsync(scene, camera)` (three
   0.186, extension `KHR_parallel_shader_compile`) à la création des scènes, avant le premier
   `renderer.render` (`src/motion/stage/scenes/print-hero.ts:869` et `:767`,
   `src/motion/stage/scenes/studio-object.ts:985`), et ne monter le Stage qu'après `load` puis un
   `requestIdleCallback` (`src/components/site-shell.tsx:36`, gate `src/gates/runtime.tsx:16`),
   pour que le h1 soit peint, et sa police appliquée, avant la tâche de ≈ 0,9 s. Aucun
   `compileAsync` n'existe dans `src/motion` aujourd'hui.
3. **Élément LCP du Studio = le chapeau (`p.mt-4`), 2,02 à 2,17 s à 9 Mbps** (budget ≤ 2,0 s ; le
   brief veut le h1 ou le poster SSR). `src/components/studio/studio-app.tsx` : composer l'entête
   pour que le h1 soit le plus grand bloc de texte au premier rendu, ou accepter le chapeau et
   relever le budget de la page objet à 2,2 s. Gain attendu : faible.
4. **JS initial de `/[locale]/studio/[objet]` : 302,7 KiB gzip (28 chunks)**, la route la plus
   lourde du site (+80 KiB sur le checkout). Aucun budget au brief pour cette route : à fixer ;
   le client embarque zod (chunk `3125-*`, 25,6 KiB gzip) et tout `StudioApp`.
5. **Le JS initial de toutes les routes est 37 à 44 KiB plus bas qu'en vague 2a** (accueil 194,2
   pour 231,4), de façon uniforme : cause non isolée (le build 2a n'a pas été conservé), très
   probablement le chunk `polyfills` (39 KiB) qui ne figure plus dans `rootMainFiles` ; ne pas le
   lire comme un gain réel, et ne pas s'appuyer sur la marge de 39,5 KiB de l'accueil.
6. **404 d'un slug de Studio inconnu : corps vide avant hydratation** (`/fr/studio/inconnu` :
   0 header, 0 `<main>`, 0 h1 dans le HTML brut, statut 404 et `noindex` corrects). Même limite
   de Next 16.3.6 que la fiche produit supprimée (brief §7.18) ; rien à corriger dans le dépôt.
7. **Poids du HTML de l'accueil : 217,7 KiB bruts / 33,8 KiB gzip** (119,6 / 19,6 en vague 2a).
   Les posters et textes de WP-HOME sont dans le HTML ; c'est surtout un coût d'hydratation
   (section 7). À surveiller si l'accueil grossit encore.
8. **Mouvement réduit : les pages d'objet du Studio gardent un canvas WebGL** (un contexte vivant).
   À confirmer qu'il ne tourne pas en continu quand `data-motion="reduce"` (rendu sur demande
   seulement) : non mesuré ici.
9. **`AGENTS.md`, règle 10 : « 3 145 KiB » est périmé** (mesure du 01.10 après WP-02) et le
   plafond de 3 185 est dépassé. Hors périmètre de ce passage (fichier du propriétaire) ; à mettre à
   jour avec la décision du point 1 (3 326 KiB mesuré le 01.10.2026, dossier de 41 caractères).
10. **Effets de bord sur la base de test** (branche Neon de développement) : deux demandes de
    devis `w3-net@example.test` et `w3-drawer@example.test`, leurs deux lignes d'outbox (aucun envoi,
    clé Resend vide), un fichier STL dans le R2 local du preview (non partagé).
    Rien n'a été écrit autrement ; les vérifications du chapitre 02 n'écrivent nulle part.

## 9. Prêt pour J1 / J2 ?

**Oui pour J1 (déploiement de la preview), sous deux conditions** : (a) la décision du
propriétaire sur le plafond du Worker (écart 1), qui ne bloque pas le déploiement mais ne peut
plus attendre WP-99 sans réponse ; (b) le correctif A5 (zod en `jitless`) est dans la branche,
sinon chaque visite d'une page d'objet du Studio produit un rapport CSP « eval » dans
`/api/csp-report`. **Aucun blocage fonctionnel** : lint, typecheck, 843 tests, format verts ;
20 pages sans violation CSP, sans erreur d'hydratation, sans message manquant, sans 4xx
inattendu ; un seul contexte WebGL par page ; `html.lenis` seulement dans `(site)` ; mouvement
réduit et 375 × 812 conformes ; 0 signature d'un moteur dans le Worker.

**Ce que le propriétaire doit tester sur la preview déployée** (rien de cela n'est vérifiable
depuis ce poste, sans GPU, sans clé Resend, sans Safari) :

1. **Une vraie demande de devis envoyée depuis le Studio** (un objet à texte : Relief ou
   Cartouche, avec « Pointe Zorgl »), sur téléphone puis sur ordinateur : l'e-mail de l'atelier
   arrive (Resend), le STL joint s'ouvre dans le trancheur et porte le texte gravé, la demande
   figure dans `/account/quotes` pour un compte connecté, l'événement « Quote Requested » arrive
   dans PostHog **sans le texte**, et l'**enregistrement de visite de cette session ne montre ni la
   description ni la vignette** (A1). Couper le réseau (mode avion) au troisième temps de l'envoi :
   le tiroir doit dire « L'envoi a échoué… » et « Réessayer » doit réussir sans renvoyer le fichier (A2).
   Limite : 5 demandes par 10 minutes.
2. **Un paiement de test** (clé `sk_test` du Worker de preview, `pk_test` de `env.preview`) :
   panier, e-mail, adresse, carte 4242…, page de succès, commande `paid` en base, webhook reçu par
   la preview, e-mails de commande. Vérifier aussi le Payment Element en sombre.
3. **La revue de l'accueil et de la boutique sur de vrais appareils** : iPhone (Safari) et un
   Android moyen, Chrome ; **mesurer TBT et LCP sur ces appareils** (écart 2 : le chemin WebGL est
   ici le seul coupable connu, sur un rendu logiciel) ; chapitre 02 (taper un nom, le relief
   se réécrit, le bouton rouge amène au Studio avec le nom) ; mouvement réduit (footer et
   réglage du système) ; thème sombre ; les quatre langues ; boutique, fiche produit, favoris.
4. **Après le déploiement** : vérifier que le Worker de prod a bien changé (`modified_on`, règle 9),
   que `/api/csp-report` ne reçoit plus de « eval », et que la taille déployée correspond à
   3 326 KiB (`Total Upload … gzip` du journal de build).

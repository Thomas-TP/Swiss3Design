# WP-99 · Intégration, mesures et vérification

Branche `claude/redesign-2026--verify-wp99`, créée depuis `claude/redesign-2026` (`2efa27e`), **09.10.2026**,
worktree isolé, **rien poussé, `main` non touché**. Dernier paquet avant la PR unique vers `main`, qui n'est
pas dans cette passe : voir [`checklist-j3.md`](checklist-j3.md) pour ce qui reste à faire par le propriétaire.
**Directive du propriétaire pour WP-99** : réduire ce qui peut l'être, **sans rien retirer d'utile et sans
changer le comportement ni le design**. Rapports de détail des lots : [`measures-wp99-worker.md`](measures-wp99-worker.md),
[`measures-wp99-canvas.md`](measures-wp99-canvas.md).

## Résumé

| Critère                                                                             | Résultat                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fusion des quatre lots (`worker`, `canvas`, `cleanup`, `review`)                    | **propre**, aucun conflit (4 fusions `--no-ff`)                                                                                                                                                                    |
| Lint, typecheck, tests, format                                                      | **verts** : 67 fichiers et 882 tests passés (15 ignorés sans URL de base), 722 fichiers formatés                                                                                                                   |
| **Worker gzip** (dossier de 41 caractères, `wrangler deploy --dry-run`)             | **2 456,33 KiB** (brut 12 881,63) contre 3 333,53 avant WP-99 : **−877,20 KiB (−26,3 %)** ; cible ≈ 3 250 et plafond 3 185 tenus avec ≈ 730 KiB de marge ; plafond Cloudflare 10 MiB très loin                     |
| 0 signature three / gsap / lenis dans le Worker                                     | **0**                                                                                                                                                                                                              |
| JS client                                                                           | **inchangé** : 209 chunks, 1 220,6 KiB gzip (1 220,3 avant) ; JS initial `/fr` 194,1 ; boutique 187,7 ; Studio 189,4 ; objet du Studio 304,2 (mesures de `measures-r1.md`, à 0,1 KiB près)                         |
| 21 URL × 2 gabarits (bureau 1440, mobile 375 émulé) en production locale            | statuts attendus (200, `/fr/admin` → 307 vers la connexion, inconnue → 404), **0 CSP, 0 hydratation, 0 `MISSING_MESSAGE`/`IntlError`, 0 erreur de page, 1 contexte WebGL vivant au plus, 0 défilement horizontal** |
| Parcours des Server Actions (le Worker a déplacé des modules entre couches webpack) | **identiques octet pour octet** au contrôle du lot Worker : panier (fiche, carte), devis et contact invalides, formulaires vides bloqués, connexion refusée, réglage du Studio, tiroir d'envoi                     |
| Métriques de laboratoire (CDP, bureau et mobile CPU ×4, 9 Mbps)                     | voir §7 : FCP, LCP, CLS et transfert égaux ou meilleurs que le contrôle (même passe) ; LCP ≤ 2,0 s et CLS ≤ 0,05 tenus ; TBT mobile dans le bruit de la machine                                                    |
| Écart DOM ↔ canvas en C2 (clavier, Page Bas, molette, DPR 1 et 2)                   | **≤ 0,83 px, 0 image au-dessus de 1 px**, marge du canvas jamais épuisée (min. 54 px)                                                                                                                              |
| Requêtes des lots                                                                   | appliquées, refusées ou laissées au propriétaire, chacune avec sa raison (§2)                                                                                                                                      |

## 1. Fusions

Ordre : `worker`, `canvas`, `cleanup`, `review`. Les quatre étaient présentes ; aucune fusion n'a eu de conflit
(`globals.css`, touché par le nettoyage et par la revue, s'est fusionné proprement).

| Branche fusionnée (tête)                         | Fusion (`--no-ff`) | Contenu                                                                                         |
| ------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------- |
| `claude/redesign-2026--wp99-worker` (`685e293`)  | `bbeb240`          | `next.config.ts` : hook `webpack()`                                                             |
| `claude/redesign-2026--wp99-canvas` (`645b150`)  | `a39fe41`          | `anchor-margin.ts`, `pixel-ratio.ts`, `stage-root.tsx`, `stage.ts`, `ticker.ts`, tests, mesures |
| `claude/redesign-2026--wp99-cleanup` (`75109b9`) | `3536111`          | 3 fichiers retirés, 76 clés de messages × 4 langues, `pas()`, entrées oxlint                    |
| `claude/redesign-2026--wp99-review` (`c8c33f8`)  | `b2d1c2a`          | admin clair et sombre, mots longs, checklist J3, crédits, docs                                  |

## 2. Requêtes des lots

Chaque requête appliquée l'est dans son propre commit (les documents voisins sont groupés par thème).

| Requête (lot)                                                                                    | Décision            | Où / raison                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.oxfmtrc.json` : ignore périmé de `icon.svg` (nettoyage)                                        | **appliquée**       | `c1210f5`                                                                                                                                                                                                         |
| `conventions.md` : phrase sur `s3d.pas` (nettoyage)                                              | **appliquée**       | « plus d'ease par paliers : `s3d.strate` »                                                                                                                                                                        |
| Brief : icônes, `.s3d-hairlines`, extrait oxlint, stubs (nettoyage)                              | **appliquée**       | `DESIGN-BRIEF.md` §2.3, §2.4, §4.4, §4.6, tableau des paquets                                                                                                                                                     |
| Dégel des messages historiques (nettoyage)                                                       | **appliquée**       | `AGENTS.md` règle 11, `codemap.md`, `conventions.md`, brief §4.9, commentaire de `src/i18n/namespaces.ts`                                                                                                         |
| `boundary.test.ts` : fixtures sans `pas` (nettoyage)                                             | **appliquée**       | `926cc6c`, `{ gsap }` au lieu de `{ pas }`                                                                                                                                                                        |
| 12 clés de `studioCore` épinglées par un test (nettoyage)                                        | **refusée**         | ≈ 1 Ko au total, 0 octet côté client ; le test les épingle volontairement (contrat du noyau pur du Studio), les retirer relève du propriétaire du test                                                            |
| Exports morts sans référence (`orderState`, `reliefTop`, `lineInkBox`…) (nettoyage)              | **refusée**         | 0 KiB de bundle (déjà éliminés par l'arbre), ce sont des helpers exportés de bibliothèques pures : du bruit de diff sans gain                                                                                     |
| `mono.tsx` (`MonoLabel`, `Num`), jamais importé (nettoyage)                                      | **laissée**         | `conventions.md` nomme `Num` comme formateur de nombres ; 0 octet livré ; à décider avec cette ligne de doc                                                                                                       |
| `--s3d-progress` sur le filet du header, `ph-no-capture` (revue)                                 | **appliquée**       | `f6e75e8` : `runtime.tsx` + `header.tsx`. Vérifié en production : variable sur le filet, `<html>` propre, `scaleX` suit la progression (0, 0,5, 1), retombe à 0 hors du groupe `(site)` et reprend au retour (§5) |
| Placeholders des champs publics (3,1:1) (revue)                                                  | **appliquée**       | `d82fadd` : `placeholder:text-soft` (5,9:1 en clair, 7,1:1 en sombre), comme le champ du sommet qui l'avait déjà                                                                                                  |
| Licence OFL de Geist dans le dépôt (revue)                                                       | **laissée**         | le texte exact ne peut pas être vérifié hors ligne et ne s'invente pas ; à récupérer sur le dépôt officiel (`checklist-j3.md` §1.1)                                                                               |
| Mention du stockage local du Studio dans la politique de confidentialité (revue)                 | **laissée**         | contenu juridique, validation du propriétaire (`legal/privacy/content.tsx:211`, texte proposé dans `checklist-j3.md` §1.1)                                                                                        |
| Registre de l'italien (tu / voi / Lei) dans `messages/it.json` (revue)                           | **refusée ici**     | ≈ 150 chaînes de la boutique en production (impératifs de boutons compris) : un changement de copie qui demande une décision, pas un nettoyage ; les nouveaux textes sont déjà au Lei (`checklist-j3.md` §1.1)    |
| Readout de la barre mobile du Studio à 320 px en allemand (revue)                                | **laissée**         | 10 px de débordement dans l'interstice, sans toucher le bouton, sous la matrice de 375 px du brief                                                                                                                |
| `quote-upload` et pool Postgres en `next dev` (revue)                                            | **laissées**        | observations de `next dev` seulement (fichiers inchangés par la refonte, OK sur workerd/preview)                                                                                                                  |
| `AGENTS.md` règle 10, `conventions.md` (note du hook), brief §4.11 (Worker) (worker)             | **appliquées**      | avec le chiffre remesuré ici (2 456 KiB) ; nouvelle section « Worker bundle » dans `conventions.md`                                                                                                               |
| `measures-wp99-worker.md` à créer (worker)                                                       | **appliquée**       | ce dossier                                                                                                                                                                                                        |
| `featured-manager.tsx` : sortir `Reorder` du Worker (worker)                                     | **refusée**         | `next/dynamic` + `ssr: false` : la liste de l'admin ne serait plus rendue côté serveur, un changement de comportement pour 42,8 KiB que la marge rend inutiles                                                    |
| Brief §4.11 (GPU) et §4.4, `measures-r16.md` §6 et §8, `codemap.md`, `retours-j1-j2.md` (canvas) | **appliquées**      | budget de pixels 8 / 4 Mpx, canvas de 1,6 fenêtre, anticipation                                                                                                                                                   |
| Commentaire de `downgrade()` dans `tier.ts` (canvas)                                             | **appliquée**       | `ac25526`                                                                                                                                                                                                         |
| Budget de 14 Mpx et marge de 0,35 (canvas)                                                       | **au propriétaire** | deux constantes, voir §9                                                                                                                                                                                          |

Retouches d'intégration (commentaires seulement, `b66f73d`) : le registre des scènes, `holdPoster` et deux
commentaires du pont parlaient encore des scènes témoins de WP-00 que le nettoyage a retirées.

## 3. Portes

| Porte                  | Résultat                                                   |
| ---------------------- | ---------------------------------------------------------- |
| `bun run lint`         | **0 avertissement, 0 erreur**                              |
| `bun run typecheck`    | **0 erreur**                                               |
| `bun run test`         | **882 passés**, 15 ignorés (sans URL de base), 67 fichiers |
| `bun run format:check` | **propre**                                                 |

## 4. Build de production et taille

`bunx opennextjs-cloudflare build` dans `C:\s3d-matched-path-w2a-0123456789abcdefg` (41 caractères, copie par
`robocopy` du worktree, mêmes `package.json` et `bun.lock`), puis `bunx wrangler deploy --dry-run`.

| Mesure                                                                                | Avant WP-99                  | Après WP-99                                                           | Écart                                 |
| ------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| **Worker gzip**                                                                       | 3 333,53 KiB (`2efa27e`)     | **2 456,33 KiB**                                                      | **−877,20 KiB (−26,3 %)**             |
| Worker brut                                                                           | 16 986,6 KiB                 | 12 881,63 KiB                                                         | −4 105 KiB                            |
| Dont le hook webpack seul (même `HEAD`, mesuré par le lot Worker)                     | 3 336,02 KiB                 | 2 460,34 KiB                                                          | −875,68 KiB                           |
| Dont le nettoyage seul (mesuré à 77 caractères)                                       | 3 327,58 KiB                 | 3 320,17 KiB                                                          | −7,41 KiB (messages des 4 langues)    |
| `check-worker-bundle.ts`                                                              | 0                            | **0**                                                                 | aucune signature three / gsap / lenis |
| Chunks client (`chunk-report.ts`)                                                     | 209 chunks, 1 220,3 KiB gzip | 209 chunks, 1 220,6 KiB gzip                                          | +0,3 KiB (`anchor-margin.ts`)         |
| JS initial `/fr`                                                                      | 194,1 KiB                    | 194,1 KiB                                                             | 0                                     |
| JS initial boutique / fiche produit                                                   | 187,7 / 187,8                | 187,7 / 187,8                                                         | 0                                     |
| JS initial Studio (index) / page d'objet                                              | 189,4 / 304,2                | 189,4 / 304,2                                                         | 0                                     |
| Autres : custom, Atelier, contact, panier, checkout, suivi, favoris, connexion, légal | —                            | 217,2 · 215,7 · 210,2 · 213,1 · 222,0 · 191,5 · 190,6 · 212,9 · 182,6 | première mesure par page              |

Le plus gros chunk client reste `d3cfdde2` (96,5 KiB). Les moteurs restent tous hors du JS initial (three 83,4 +
65,6 + 8,5, gsap 27,8 + 19,5, lenis 7,0 KiB).

**Contrôle reconstruit dans cette passe** (`claude/redesign-2026`, sans aucun des quatre lots, même dossier de 41
caractères) : **3 335,93 KiB gzip**, brut 16 986,69 KiB, 0 signature, soit −879,60 KiB (−26,4 %) pour le build fusionné ;
il rejoint le contrôle du lot Worker (3 336,02). Le build fusionné reconstruit une seconde fois donne exactement
**2 456,33 KiB** : la mesure est reproductible.

**Réserve de méthode** : les retouches d'intégration faites après le premier build (commentaires de
`scenes/index.ts`, `stage/types.ts`, `motion-bridge/types.ts`, `i18n/namespaces.ts`, documents) ne changent pas le code
compilé. Les §5, §6 et §8 et la première série du §7 ont été mesurés sur le premier build, les séries de répétition du §7
(boutique et accueil mobiles) sur le second : même dernier commit de code, même gzip à l'octet près.

## 5. Preview de production : matrice de pages

`opennextjs-cloudflare preview -- --upstream-protocol https --port 8799 --inspector-port 9339`, Edge headless
piloté en CDP (port 9375, profil dédié, **GPU réel**, `--use-angle=d3d11`, consentement non donné), base Neon de
la branche `preview`, clés de test, `RESEND_API_KEY` vide. Crochets injectés avant la page : contextes WebGL
(créés et vivants), `securitypolicyviolation`, erreurs et rejets.

**Bureau 1440 × 900 puis mobile 375 × 812 (DPR 2, tactile émulé)**, 21 URL chacun :
`/fr /de /it /en`, `/fr/studio`, `/fr/studio/{lavaux,cartouche,relief,borne}`, `/fr/shop`,
`/fr/products/vase-spirale`, `/fr/custom`, `/fr/a-propos`, `/fr/contact`, `/fr/cart`, `/fr/checkout`,
`/fr/favorites`, `/fr/account/login`, `/fr/legal/terms`, `/fr/admin` (hors session), une URL inconnue.

| Contrôle                                         | Bureau                                                                                                                                                                              | Mobile                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Statut attendu                                   | **21 / 21**                                                                                                                                                                         | **21 / 21**                  |
| `/fr/admin` sans session                         | 307 vers `/fr/account/login`                                                                                                                                                        | 307 vers `/fr/account/login` |
| URL inconnue                                     | 404, page habillée, 1 `h1`                                                                                                                                                          | idem                         |
| Violations CSP                                   | **0**                                                                                                                                                                               | **0**                        |
| Erreurs d'hydratation                            | **0**                                                                                                                                                                               | **0**                        |
| `MISSING_MESSAGE` / `IntlError` (DOM et console) | **0**                                                                                                                                                                               | **0**                        |
| Erreurs JS de page (exceptions, rejets)          | **0**                                                                                                                                                                               | **0**                        |
| Contextes WebGL vivants (maximum observé)        | **1** (jamais 2)                                                                                                                                                                    | **1**                        |
| Défilement horizontal                            | **0 px** partout                                                                                                                                                                    | **0 px** partout             |
| Lenis (`html.lenis`)                             | pages du groupe `(site)` seulement : accueil, 4 langues, Studio, boutique, fiche, custom, Atelier, contact ; **jamais** sur panier, checkout, favoris, connexion, légal, admin, 404 | idem                         |
| Console                                          | 3 messages attendus (ci-dessous)                                                                                                                                                    | idem                         |

Messages de console, tous attendus et sans lien avec WP-99 : (1) `/fr`, avertissement du compilateur de shaders
de Windows (ANGLE / Direct3D, `X4122`, « sum of 0.996094 and -2.98545e-017 cannot be represented accurately in
double precision »), un `warning` de three.js, pas une erreur ; (2) `/fr/checkout`, « You may test your Stripe.js
integration over HTTP » (la preview locale est en http) et 52 messages de Tracking Prevention d'Edge sur
`js.stripe.com` (comptés à part, 52 en mobile aussi) ; (3) l'URL inconnue : « Failed to load resource : 404 ».
Aucun `console.error` d'application.

**Progression du défilement (`--s3d-progress`)** : sur `/fr` en production, la variable est écrite sur
`.s3d-progress.ph-no-capture` (`barVar` 0,0000 → 0,5001 → 1,0000) et jamais sur `<html>` (`htmlVar` vide) ;
`scaleX` du filet vaut la progression (0, 0,5, 1) ; après un clic vers `/fr/cart` (hors groupe) la variable
est retirée et le filet retombe à 0 ; au retour la progression reprend (0,3 à 30 % de la page).

## 6. Parcours des Server Actions

Le lot Worker a déplacé des modules entre couches webpack (`action-browser` → `rsc`) : les actions ont été
rejouées dans la preview du build fusionné (`journeys.ts`, Edge en CDP, aucune valeur réelle, aucun e-mail :
`RESEND_API_KEY` est vide).

| Parcours                                                                      | Résultat                                                                                        |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Ajout au panier depuis la fiche du Vase spirale                               | « Panier, vide » → « Panier, 1 article »                                                        |
| `/fr/cart` liste le produit                                                   | oui, lien vers le paiement présent                                                              |
| Ajout au panier depuis une carte de la boutique                               | « Panier, 2 articles »                                                                          |
| Devis `/fr/custom` avec e-mail et description invalides (Server Action + zod) | alerte d'erreur affichée, formulaire conservé                                                   |
| Devis et contact **vides**                                                    | la validation native bloque (4 et 3 champs invalides, focus sur le premier), **0 requête POST** |
| Contact : champ piège rempli                                                  | « succès » sans écriture ni envoi                                                               |
| Contact : e-mail invalide                                                     | alerte d'erreur                                                                                 |
| Connexion avec un mauvais mot de passe (better-auth, lecture en base)         | « E-mail ou mot de passe incorrect. », on reste sur `/fr/account/login`                         |
| Studio de Lavaux : hauteur 150 → 190 mm                                       | dimensions « 96 × 96 × 150 » → « 96 × 96 × 190 mm »                                             |
| Tiroir « Envoyer à l'atelier »                                                | ouvert, champ e-mail présent (non envoyé)                                                       |

Le fichier de résultats est **identique octet pour octet** à celui du contrôle (build sans le hook) du lot Worker.
« Ajout au panier depuis un objet du Studio » n'existe pas : le Studio n'a pas de panier (devis seulement, rien dans
`src/components/studio` n'appelle le panier), sa conversion est `Quote Requested` avec `source = studio`. 0 violation CSP
et 0 erreur de page sur toute la série.

## 7. Métriques de laboratoire

CDP, `Tracing.start` / `Tracing.end` (catégories `loading`, `devtools.timeline`, `blink.user_timing`, `toplevel`) :
FCP, LCP (dernier candidat), CLS (fenêtres de session), TBT (tâches du fil principal > 50 ms entre le FCP et 9 s
après `load`, comme `measures-wave2b.md` §7.2), recoupés par un `PerformanceObserver` dans la page (même LCP à
quelques ms près, même CLS). Cache désactivé, GPU réel, 3 passages par page. **Bureau** : 1440 × 900, sans
étranglement. **Mobile** : 375 × 812, DPR 2, CPU ×4, réseau 9 Mbps / 150 ms (profil de `measures-wave2b.md` §7.2).

`measures-r1.md` ne contient aucune métrique de laboratoire : la comparaison est faite avec un **contrôle**
(`claude/redesign-2026`, `2efa27e`, construit et mesuré dans les mêmes conditions et la même passe) et avec
`measures-wave2b.md` §7 (rendu logiciel SwiftShader pour le bureau, d'où des TBT sans commune mesure).

Médiane [étendue] en ms ; « base » = contrôle, « WP-99 » = ce build.

**Bureau 1440 × 900**, sans étranglement, 3 passages par page :

| Page                | Build | FCP             | LCP (élément)            | CLS    | TBT        | Tâche la plus longue | Stage prêt          | Transfert        |
| ------------------- | ----- | --------------- | ------------------------ | ------ | ---------- | -------------------- | ------------------- | ---------------- |
| `/fr`               | base  | 620 [603–1 261] | 1 528 [1 487–2 119] (h1) | 0,0023 | 29 [28–31] | 79                   | 1 266 [1 219–1 794] | 716 KiB, 49 req. |
| `/fr`               | WP-99 | 712 [633–739]   | 1 562 [1 508–1 631] (h1) | 0,0023 | 22 [20–25] | 72                   | 1 256 [1 180–1 367] | 717 KiB, 49 req. |
| `/fr/shop`          | base  | 900 [876–908]   | 900 (h1)                 | 0,0021 | 0          | 0                    | sans Stage          | 461 KiB, 39 req. |
| `/fr/shop`          | WP-99 | 861 [845–864]   | 861 (h1)                 | 0,0021 | 0          | 0                    | sans Stage          | 461 KiB, 39 req. |
| `/fr/studio/lavaux` | base  | 270 [267–378]   | 270 (chapeau)            | 0,0137 | 19 [19–22] | 69                   | 964 [959–1 060]     | 818 KiB, 52 req. |
| `/fr/studio/lavaux` | WP-99 | 267 [265–280]   | 267 (chapeau)            | 0,0137 | 14 [7–19]  | 64                   | 935 [910–951]       | 818 KiB, 52 req. |

**Mobile 375 × 812**, DPR 2, CPU ×4, 9 Mbps / 150 ms (8 passages « base » et 14 « WP-99 » pour `/fr` et la boutique, 3 pour le Studio) :

| Page                | Build | FCP = LCP (élément)         | CLS        | TBT           | Tâche la plus longue | Stage prêt          | Transfert        |
| ------------------- | ----- | --------------------------- | ---------- | ------------- | -------------------- | ------------------- | ---------------- |
| `/fr`               | base  | 978 [901–1 319] (h1)        | 0          | 536 [463–716] | 212                  | 3 555 [3 411–3 887] | 714 KiB, 48 req. |
| `/fr`               | WP-99 | 985 [919–1 265] (h1)        | 0          | 586 [431–804] | 228                  | 3 600 [3 310–3 906] | 714 KiB, 48 req. |
| `/fr/shop`          | base  | 1 334 [1 277–1 544] (image) | 0          | 183 [140–284] | 162                  | sans Stage          | 455 KiB, 35 req. |
| `/fr/shop`          | WP-99 | 1 313 [1 268–1 531] (image) | 0 à 0,0012 | 233 [156–360] | 174                  | sans Stage          | 455 KiB, 35 req. |
| `/fr/studio/lavaux` | base  | 560 [520–570] (h1)          | 0,0455     | 585 [501–618] | 190                  | 3 104 [3 062–3 263] | 818 KiB, 52 req. |
| `/fr/studio/lavaux` | WP-99 | 534 [522–535] (h1)          | 0,0455     | 587 [564–691] | 202                  | 3 133 [3 119–3 208] | 818 KiB, 52 req. |

Lecture :

- **Budgets du brief §4.11 tenus** : LCP ≤ 2,0 s (bureau 1,5 s sur `/fr`, mobile throttlé 1,0 s ; `/fr` est le
  seul cas où le LCP est re-déclaré plus grand que le FCP, à l'arrivée de la police d'affichage, comme noté en
  vague 2b), CLS ≤ 0,05 (maximum 0,0455, Studio mobile).
- **Aucune régression de WP-99** : FCP, LCP, CLS, transfert et nombre de requêtes sont identiques ou meilleurs que
  le contrôle. Le **TBT mobile** à CPU ×4 montre un écart de médiane de +50 ms (`/fr` 536 → 586, boutique 183 → 233) qui reste **dans l'étendue d'un même build** sur cette machine partagée : le build WP-99 de la boutique varie
  de 156 à 360 ms d'un passage à l'autre (trois séries successives du même build : 213–322, 197–360, puis 156–250),
  et la dernière série revient au niveau du contrôle (174–284). Le JS initial est identique à 0,1 KiB près et aucun
  code de WP-99 ne s'exécute avant une interaction sur la boutique ; un essai alterné contrôle / WP-99 n'a pas été
  répété plus loin.
- **Le CLS du Studio mobile (0,0455) n'est pas de WP-99** : il est identique sur le contrôle. Un seul décalage, à
  ≈ 1,8 s : le bloc `div.flex.flex-col.gap-10` des sections de réglages descend de 96 px (de y = 413 à 509, hauteur
  342 → 246) quand la mise en page mobile du Studio se règle. Sous le budget (0,05), non bloquant (§10).
- Comparaison avec `measures-wave2b.md` §7 (rendu logiciel, pas de GPU) : bureau `/fr` LCP 2,8 à 2,9 s et TBT
  0,92 à 0,95 s (maintenant 1,5 s et 22 ms : le chemin WebGL ne se paie plus en logiciel) ; Studio bureau 0,33 s,
  51 ms, CLS 0,0115 (0,27 s, 14 ms, 0,0137) ; mobile `/fr` LCP 1,16 à 1,26 s, TBT 0,95 à 1,11 s (1,0 s, 0,59 s) ;
  mobile Studio CLS 0,0203 avant R1 et R17 (0,0455 depuis, sans lien avec WP-99). Un GPU de bureau ne dit rien d'un
  téléphone : **R18 reste ouvert** (§10).

## 8. Écart DOM ↔ canvas en C2

Production locale, GPU réel, marqueurs peints dans le canvas (même méthode que `measures-r16.md`) :

| Page et geste                            | Images | Écart max.  | Images > 1 px | Marge min. haut / bas |
| ---------------------------------------- | ------ | ----------- | ------------- | --------------------- |
| `/fr` chapitre 02, DPR 1 · clavier       | 89     | **0,71 px** | 0             | 186 / 270 px          |
| `/fr` chapitre 02, DPR 1 · Page Bas      | 29     | **0,58 px** | 0             | 54 / 270 px           |
| `/fr` chapitre 02, DPR 1 · molette       | 237    | **0,72 px** | 0             | 105 / 270 px          |
| `/fr` héros épinglé, **DPR 2** · clavier | 200    | **0,83 px** | 0             | calque fixe           |

Hauteur de page 9 711 px avant et après, 0 px de défilement horizontal. Au DPR 2 le canvas est de 1 425 × 1 440 px CSS,
tampon 2 137 × 2 160 (4,62 Mpx), exactement le calcul de `measures-wp99-canvas.md` §3. L'ensemble des 37 séries du lot
(DPR 1 et 2, C1, tactile, téléphone) reste dans `measures-wp99-canvas.md` §4.

## 9. Ce qui a été fait, lot par lot

**Worker** (`measures-wp99-worker.md`) : un hook `webpack()` dans `next.config.ts` compile chaque module une fois
et non une fois par couche (`rsc`, `action-browser`, `ssr`) : −875,68 KiB gzip (−26 %), JS client inchangé, équivalence
fonctionnelle prouvée contre un build sans le hook (119 URL, 37 Server Actions, 17 pages en navigateur). **Sautés** :
`zod/mini` (better-auth et ses greffons importent zod complet 112 fois, il resterait dans le Worker) et les messages du
Studio par langue (le Worker sert les 4 langues, 18,5 KiB gzip au total, une seule copie).

**Canvas** (`measures-wp99-canvas.md`) : marge de 0,3 fenêtre à la souris (0,5 au doigt), anticipation du défilement,
budget de pixels du tampon de 8 Mpx (C2) / 4 Mpx (C1 à pointeur précis) : −20 % de pixels aux fenêtres usuelles, −46 à
−51 % aux très grands écrans à DPR > 1, écart DOM ↔ canvas inchangé (≤ 0,83 px), C2 → C1 qui réalloue le tampon. **Seul
changement visible** : netteté un peu moindre sur un 4K à 150 % et un 27 pouces Retina (rapport 1,17 et 1,23 au lieu de
1,5) ; **décision du propriétaire** à la section 10.

**Nettoyage** : `Reveal`, la scène témoin `stub-cube.ts`, `NozzleIcon`, `LayerIcon`, `SummitIcon`, `.s3d-hairlines`,
`pas()` et `s3d.pas`, deux entrées d'oxlint, **76 clés de messages × 4 langues** (304 suppressions, parité gardée, −15,7 Ko
de messages) ; −7,4 KiB gzip au Worker. Gardés par prudence : `mono.tsx` (doc), les clés lues dynamiquement (14 sites
vérifiés à la main), 12 clés épinglées par un test.

**Revue** : admin dans les deux thèmes (19 routes × 2 thèmes × 2 largeurs, 18 groupes de contraste sous 4,5:1 corrigés, 4
débordements corrigés, 0 restant), 24 pages × 4 langues × 2 largeurs (192 chargements, un défaut d'allemand corrigé,
`Filamenttrocknung`), audit des événements PostHog (les quatre actions du projet reposent sur des noms d'événements :
non cassées), `checklist-j3.md`, crédits des licences (GSAP « no-charge », Lenis, three, d3-contour, earcut, polices),
README, ROADMAP, architecture, conventions, codemap.

## 10. Problèmes ouverts

À regarder avant ou après J3 ; aucun ne bloque la revue du propriétaire sur la preview.

| #   | Problème                                                                                                                                                                                                                                                                                                 | Où                                                                                                                                                | Suite recommandée                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Netteté vs pixels sur très grand écran** : le budget de 8 Mpx en C2 rend un 4K à 150 % et un 27 pouces Retina à 1,17 et 1,23 (laplacien −27 % au 27 pouces). C'est la seule régression visible de WP-99 ; elle dépend du jugement du propriétaire.                                                     | `src/motion/stage/pixel-ratio.ts:42` (`STAGE_PIXEL_BUDGET[2]`)                                                                                    | Regarder l'accueil sur un tel écran ; si la netteté prime, `14_000_000` (tampons 13,2 et 11,9 Mpx, rien ne change) ; `10_000_000` en compromis.    |
| 2   | **Images à nu à CPU ralenti ×2** : à Page Bas toutes les 50 ms, 5 images à nu sur 11 séries (au pire −170 px pendant une image) contre 2 avant (−113 px). Rien à CPU normal ni sur des machines de bureau ; à suivre sur un petit portable.                                                              | `src/motion/stage/anchor-margin.ts:27` (`ANCHOR_MARGIN_FINE`)                                                                                     | Si cela gêne : `0.35` (non mesuré, +8 % de pixels). Fin / Début dépasse toute marge avant et après, comme avant.                                   |
| 3   | **CLS mobile du Studio : 0,0455** (budget 0,05, 0,0203 mesuré en vague 2b avant R1 et R17) : à ≈ 1,8 s, le bloc des sections de réglages descend de 96 px (haut 413 → 509 px, hauteur 342 → 246 px). Identique sur le contrôle (base) : antérieur à WP-99, qui ne touche aucun composant du Studio (§7). | `src/components/studio/studio-sections.tsx:238`                                                                                                   | Réserver la hauteur du bloc d'aperçu mobile avant l'hydratation (R17) ; sous le budget, non bloquant.                                              |
| 4   | **R18 toujours non traité** : TBT mobile à CPU ×4 de 0,43 à 0,80 s sur `/fr` (médiane 0,59) et 0,56 à 0,69 s sur le Studio (chemin WebGL), avec un GPU de bureau. Sans WebGL le TBT est nul : tout vient du chemin WebGL, à mesurer sur un vrai téléphone.                                               | `print-hero.ts`, `studio-object.ts`, `src/components/site-shell.tsx`                                                                              | Lighthouse mobile sur un vrai téléphone ; si le TBT est confirmé, `renderer.compileAsync` avant le premier rendu et montage du Stage après `load`. |
| 5   | **Politique de confidentialité** : le stockage local du Studio (`s3d-creations-v1`, `s3d-studio-texts-v1`…) n'y est pas mentionné (nLPD, brief §11.2 n° 4).                                                                                                                                              | `src/app/[locale]/legal/privacy/content.tsx:211`                                                                                                  | Valider le texte proposé dans `checklist-j3.md` §1.1.                                                                                              |
| 6   | **Registre de l'italien** : tu, voi et Lei mêlés dans les chaînes historiques (≈ 150), le brief §1.6 demande le Lei.                                                                                                                                                                                     | `messages/it.json`                                                                                                                                | Décision du propriétaire (changement de copie en production).                                                                                      |
| 7   | **Licence Geist** : crédit dans `LICENSE.md` et le README, aucun fichier OFL dans le dépôt (la police vient de `next/font/google`).                                                                                                                                                                      | `public/licenses/` (à créer)                                                                                                                      | Récupérer `OFL.txt` sur le dépôt officiel de Geist.                                                                                                |
| 8   | **Non testé hors Edge / Chromium** : canvas ancré (`overflow: clip`, `lvh`, `translate3d`, rubber-band) sur Safari iOS et Firefox ; pas d'iGPU de bureau ni de téléphone réel (une RTX 5070).                                                                                                            | `src/motion/stage/stage-root.tsx`                                                                                                                 | Un passage sur un iPhone et un portable modeste avant la mise en production.                                                                       |
| 9   | **Reliquats optionnels** : `mono.tsx` jamais importé ; 12 clés `studioCore` épinglées par un test (≈ 1 Ko) ; 10 exports sans référence (0 KiB) ; `Reorder` de `motion/react` dans le Worker pour une page d'admin (42,8 KiB).                                                                            | `src/components/ui/mono.tsx` ; `src/lib/studio/studio-core-messages.test.ts:51,81-104` ; `src/app/[locale]/admin/featured/featured-manager.tsx:4` | À reprendre seulement si le budget l'exige : la marge est de ≈ 730 KiB.                                                                            |
| 10  | **Observations de `next dev`** (sans effet sur la production) : pool Postgres « after calling end on the pool » avec plusieurs onglets connectés, et `R2.put(file.stream())` qui échoue sans longueur connue en local.                                                                                   | `src/db/index.pg.ts` ; `src/app/api/quote-upload/route.ts:41`                                                                                     | Si des essais d'envoi en local sont voulus : `await file.arrayBuffer()` hors production.                                                           |
| 11  | **Readout de la barre mobile du Studio à 320 px en allemand** : 10 px de débordement dans l'interstice, sans toucher le bouton.                                                                                                                                                                          | `src/components/studio/studio-app.tsx:654`                                                                                                        | `truncate` ou une taille plus petite à `max-xs:` si on veut descendre sous 375 px.                                                                 |

## 11. Environnement et réserves

- **Même passe, même machine** : les lots ont été mesurés par leurs agents sur d'autres processus ; les chiffres de ce
  document sont ceux de cette passe d'intégration (build et preview du build fusionné, outils dans le scratchpad de la
  session : `build.ps1`, `matrix.ts`, `journeys.ts`, `empty.ts`, `lab.ts`, `cls.ts`, `drift.ts`, `progress.ts`).
- **GPU réel** (RTX 5070, Edge `--use-angle=d3d11`) pour toutes les mesures de mouvement et de laboratoire : une machine de
  bureau, pas un téléphone ni un iGPU ; le CPU ×4 émulé ne remplace pas un appareil.
- **Aucun e-mail, aucun paiement, aucune écriture réelle** : `RESEND_API_KEY` vide, formulaires soumis vides ou
  invalides, honeypot du contact ; le panier est du `localStorage`.
- **Chemin de 41 caractères** pour toute mesure de taille (la longueur du chemin déplace le gzip de ±6 KiB).
- Rien n'a été poussé ; les ports (3175, 8799, 9339, 9375) sont libérés en fin de passe.

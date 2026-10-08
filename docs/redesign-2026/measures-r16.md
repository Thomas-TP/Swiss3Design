# R16 en C2 · Canvas ancré au document, DPR plafonné à 1,5 · Mesures

Branche `claude/redesign-2026--r16-c2`, créée depuis `claude/redesign-2026` (`6500590`), **08.10.2026**,
worktree isolé, rien poussé. Suite de `measures-r1.md` §5.3 et §6 (problèmes ouverts 1 et 3).
**Décision du propriétaire (08.10.2026)** : ancrer aussi le canvas en C2, avec un rapport de pixels
plafonné à 1,5 (comme C1), le clavier restant natif (Lenis n'intercepte aucune touche), sans plancher de
DPR.

## Résumé

| Critère                                                                                    | Résultat                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Écart DOM ↔ canvas en C2, DPR 1, tous gestes (molette, clavier, Page Bas, geste rapide)    | **≤ 0,71 px**, **0 image au-dessus de 1 px** (avant : 14,92 px au clavier, 171 images sur 288 au-dessus de 1 px)                                                            |
| Idem en DPR 2 (canvas rendu à 1,5, rééchantillonné ×1,33)                                  | **≤ 0,83 px**, **0 image au-dessus de 1 px** (avant : 9,93 px au clavier, 72 images sur 72 au-dessus de 1 px)                                                               |
| Studio collant (`/fr/studio/lavaux`, mode « live »), héros épinglé                         | **0 à 0,83 px** (canvas fixe, comme avant) ; le héros ne retient plus le canvas fixe une fois passé                                                                         |
| C1 inchangé (clavier, glissé tactile, Studio)                                              | **0 px** avant et après, mêmes nombres d'images                                                                                                                             |
| Bande vide en haut ou en bas pendant un Page Bas rapide                                    | **aucune** : marge de 450 px de chaque côté, jamais entamée au-delà de 34 px (410 à 450 px restants)                                                                        |
| Hauteur de page, défilement horizontal                                                     | **inchangés** : 9 711 → 9 711 px (`/fr`), 4 250 → 4 250 px (Studio), 0 px de défilement horizontal                                                                          |
| Tampon de dessin (1440 × 900)                                                              | DPR 1 : 1,30 → **2,56 Mpx** (×1,98) ; DPR 2 : 5,18 → **5,77 Mpx** (×1,11), 4 échantillons                                                                                   |
| Temps de frame au défilement (rAF, GPU de bureau)                                          | **inchangé** (≈ 8,3 ms, 120 Hz, aucune frame lente répétée) ; 0 dessin au repos                                                                                             |
| Netteté (DPR 2, vase du Studio)                                                            | **un peu plus douce, pas floue** : montée 10 à 90 % de l'arête 0,81 → 1,58 px physiques, énergie haute fréquence −24 % (§5)                                                 |
| Production (OpenNext + preview) : CSP, hydratation, contextes WebGL, moteur dans le Worker | **0 CSP, 0 hydratation, 1 contexte WebGL au plus, 0 signature de moteur** dans le Worker ; gzip 3 331,73 KiB (inchangé) ; mêmes écarts qu'en développement (≤ 0,75 px) (§7) |

## 1. Ce qui a changé

| Fichier                                             | Changement                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/motion/stage/stage-root.tsx`                   | Un seul montage, ancré, aux deux paliers (plus de lecture du palier). Commentaire réécrit : un montage, pourquoi, Lenis et natif collés tous deux. `createCanvas` ne pose plus de géométrie fixe (elle appartient à `mountAnchored`).                                                                      |
| `src/motion/stage/pixel-ratio.ts` (neuf)            | `stagePixelRatio(dpr)` = `min(dpr, 1,5)`, aux deux paliers, avec la raison (canvas de deux fenêtres) et la décision de ne pas ajouter de plancher. Remplace `pixelRatioFor(capability)`.                                                                                                                   |
| `src/motion/stage/stage.ts`                         | Utilise `stagePixelRatio` ; `ViewFrame.scrollY` donné aux scènes = position du haut du canvas dans le document (`scrollY − offsetY()`) ; une vue « live » éloignée ne force plus de frame au repos ; `applyCapability` ne réalloue plus le tampon (C2 → C1 ne change pas le rapport) ; en-tête mis à jour. |
| `src/motion/stage/view-tracker.ts`                  | Le calque est « live » (fixe) seulement si une vue `liveRect` est **proche** de la fenêtre (`near`, marge de 25 %) ; `syncAnchor()` rappelé à chaque changement de proximité.                                                                                                                              |
| `src/motion/stage/types.ts`, `ticker.ts`, `loop.ts` | Commentaires : C1 et C2, `ViewFrame.scrollY` redéfini.                                                                                                                                                                                                                                                     |
| Tests                                               | `pixel-ratio.test.ts` (neuf, 4 tests) ; `view-tracker.test.ts` : un `IntersectionObserver` pilotable, 2 tests remplacent l'ancien (vue live lointaine ⇒ ancré ; retirée ⇒ ancré).                                                                                                                          |
| Docs                                                | `DESIGN-BRIEF.md` (§4.4 : canvas ancré en C1 et C2, ligne « GPU » du tableau §4.11 : DPR ≤ 1,5, déclassement), `retours-j1-j2.md` (R16), `docs/codemap.md` (une ligne), ce fichier.                                                                                                                        |

**Pourquoi la vue « live » est devenue conditionnelle.** En C2 le héros de l'accueil (`print-hero` et
`contour-field` « heroField ») est `liveRect: true` tant que la page vit (`hero-visual.tsx:57`,
`field-view.tsx:56`), et `syncAnchor()` ne regardait que ce drapeau : un canvas « fixe » pour toute la
page d'accueil, donc aucun gain au clavier là où se trouve le Studio du chapitre 02. Désormais seul compte
« live **et** proche » ; une fois le héros passé, le calque est ancré.

**Pourquoi `ViewFrame.scrollY` change.** Le champ de courbes dessine en coordonnées page
(`page = pixel du canvas + uScroll`). Avec un canvas décalé de `offsetY()`, il faut lui donner la
position du haut du canvas dans le document, sinon son motif sauterait d'une demi-fenêtre quand le calque
passe du mode fixe au mode ancré. Sans effet en mode fixe (décalage 0).

## 2. Méthode

- **Machine** : Edge headless `--use-angle=d3d11` (RTX 5070), 24 cœurs, 1440 × 900 (1425 px utiles avec
  l'ascenseur), DPR 1 et 2 émulés ; C2 = tout l'équipement du bureau ; C1 = `hardwareConcurrency` forcé à 4. Serveur de développement Turbopack pour les écarts, le tampon et les frames (avant et après sur le
  même serveur, mêmes conditions) ; production pour la section 7.
- **Écart DOM ↔ canvas, dans la même image du compositeur.** Un liseré rouge de 4 px (DOM, absolu dans
  chaque vue) et un liseré peint dans le canvas (marqueur de couleur, après chaque dessin) partent du même
  coin de la vue ; on détecte le bord haut de chacun au sous-pixel (franchissement de 50 %) dans chaque
  image du screencast et l'écart est la différence. Ne dépend ni du `scrollOffsetY` des métadonnées ni
  d'une horloge. Les liserés sous le header (64 px) sont masqués par le DOM et exclus.
- **Gestes** : `mouseWheel` (Lenis), `ArrowDown` ×25, `PageDown` (animation de défilement du compositeur),
  glissé du pouce de l'ascenseur, geste synthétique `Input.synthesizeScrollGesture`. Départ choisi pour que
  la vue du Studio (chapitre 02) reste visible : 1 000 px de course.
- **Limites de la mesure.** (a) Dans ce banc, le glissé du pouce de l'ascenseur et le geste synthétique
  « souris » passent par le fil principal (0,56 à 0,74 px avant comme après) : seuls le **clavier** et
  **Page Bas** exercent le défilement du compositeur ; ce sont eux qui discriminent. (b) À DPR 2 le
  screencast rend des images de 1440 × 900 (rééchantillonnées de 2880 × 1800) : résolution de 0,5 px
  environ. (c) Une première version du banc (échantillon « plein » pris deux lignes sous le bord) donnait
  1,05 px à DPR 2 ; elle surestimait légèrement (la bande de 4 px du marqueur n'est pleine que sur 2,7 px
  une fois rééchantillonnée) ; les nombres ci-dessous sont ceux de la version corrigée.

## 3. Écart DOM ↔ canvas, avant et après

« Images » = images du compositeur où un liseré est visible hors du header ; « > 1 px » = images dont
l'écart dépasse 1 px. **Avant** = `claude/redesign-2026` (`6500590`), **Après** = cette branche.

### C2, DPR 1

| Page et geste                                   | Avant : max · images > 1 px | Après : max · images > 1 px |
| ----------------------------------------------- | --------------------------- | --------------------------- |
| `/fr` chapitre du Studio, molette (Lenis)       | 0,71 px · 0 / 61            | 0,71 px · 0 / 62            |
| `/fr` chapitre du Studio, **clavier** (flèches) | **14,92 px · 171 / 288**    | **0,71 px · 0 / 282**       |
| `/fr` chapitre du Studio, **Page Bas**          | **10,01 px · 1 / 31**       | **0,48 px · 0 / 44**        |
| `/fr` chapitre du Studio, pouce de l'ascenseur  | 0,56 px · 0 / 130           | 0,56 px · 0 / 75            |
| `/fr` chapitre du Studio, geste synthétique     | 0,71 px · 0 / 64            | 0,71 px · 0 / 61            |
| `/fr` héros épinglé, clavier                    | 0 px · 0 / 224              | 0 px · 0 / 213              |
| `/fr` héros épinglé, molette                    | 0 px · 0 / 235              | 0 px · 0 / 235              |
| `/fr/studio/lavaux` (collant), molette          | 0 px · 0 / 170              | 0 px · 0 / 177              |
| `/fr/studio/lavaux` (collant), clavier          | 0 px · 0 / 320              | 0 px · 0 / 320              |

### C2, DPR 2 (canvas rendu à 1,5, affiché ×1,33)

| Page et geste                               | Avant : max · images > 1 px | Après : max · images > 1 px |
| ------------------------------------------- | --------------------------- | --------------------------- |
| `/fr` chapitre du Studio, **clavier**       | **6,45 px · 89 / 99**       | **0,75 px · 0 / 102**       |
| `/fr` chapitre du Studio, geste synthétique | 0,73 px · 0 / 63            | 0,74 px · 0 / 45            |
| `/fr` héros épinglé, clavier                | 0,50 px · 0 / 229           | 0,83 px · 0 / 235           |
| `/fr/studio/lavaux` (collant), clavier      | 0 px · 0 / 233              | 0 px · 0 / 234              |

Au repos, le tampon à 1,5 laisse un décalage **statique** de 0 à 0,8 px entre le bord d'une vue et le
liseré (arrondi du viewport au pixel du tampon, ×1,33 à l'affichage) : le héros en DPR 2 (−0,75 px
constant). Il ne bouge pas, il ne se voit pas comme un saut.

### C1, inchangé (`hardwareConcurrency` = 4, DPR 1)

| Page et geste                      | Avant          | Après          |
| ---------------------------------- | -------------- | -------------- |
| `/fr` héros, clavier (300 → 1 220) | 0 px · 0 / 38  | 0 px · 0 / 38  |
| `/fr` héros, glissé tactile        | 0 px · 0 / 52  | 0 px · 0 / 47  |
| `/fr/studio/lavaux`, clavier       | 0 px · 0 / 243 | 0 px · 0 / 243 |

## 4. Couverture du canvas, hauteur de page

Pendant chaque geste, à chaque frame, marge du canvas au-dessus et au-dessous de la fenêtre (valeurs
lues dans la page) : **450 px** de chaque côté au repos ; la plus faible observée **au-dessous : 416 px**
(glissé du pouce, DPR 1, canvas en retard de 34 px sur le compositeur), 443 à 445 px au clavier, 430 à
450 px au Page Bas. Aucun bord n'est jamais entamé : pas de bande vide.

Hauteur du document avant → après le geste : `/fr` 9 711 → 9 711 px, Studio 4 250 → 4 250 px ; défilement
horizontal 0 px partout (le calque rogne, le canvas de deux fenêtres n'allonge pas la page).

## 5. Coût GPU et temps de frame

| 1440 × 900                                                     | DPR 1 avant | DPR 1 après      | DPR 2 avant   | DPR 2 après      |
| -------------------------------------------------------------- | ----------- | ---------------- | ------------- | ---------------- |
| Canvas (px CSS)                                                | 1 440 × 900 | 1 425 × 1 800    | 1 440 × 900   | 1 425 × 1 800    |
| Tampon de dessin                                               | 1 440 × 900 | 1 425 × 1 800    | 2 880 × 1 800 | 2 137 × 2 700    |
| Mégapixels                                                     | 1,30        | **2,56** (×1,98) | 5,18          | **5,77** (×1,11) |
| Échantillons (MSAA)                                            | 4           | 4                | 4             | 4                |
| Mémoire estimée (couleur + profondeur × 4, plus la résolution) | 44 Mo       | 88 Mo            | 178 Mo        | 198 Mo           |

Frames (rAF, 16 pas de molette ou 24 flèches, puis 1,5 s ; serveur de développement, Edge à 120 Hz, RTX 5070 :
le GPU de bureau ne sature pas, **la mesure ne dit rien d'un iGPU**) :

| DPR · geste | Avant : moy · p95 · max · > 20 ms | Après : moy · p95 · max · > 20 ms | Dessins/s avant → après |
| ----------- | --------------------------------- | --------------------------------- | ----------------------- |
| 1 · molette | 8,98 · 16,7 · 16,8 · 0            | 10,23 · 16,7 · 25,0 · 1           | 333 → 310               |
| 1 · clavier | 8,36 · 8,4 · 16,7 · 0             | 8,74 · 8,4 · 33,3 · 2             | 386 → 277               |
| 2 · molette | 8,66 · 8,5 · 25,0 · 1             | 8,60 · 8,4 · 16,7 · 0             | 418 → 532               |
| 2 · clavier | 8,32 · 8,4 · 8,5 · 0              | 8,32 · 8,4 · 8,5 · 0              | 396 → 470               |

Au repos : 0 dessin en 2 s, avant et après (rendu à la demande intact).

**Netteté** (`sharpness-dpr2-vs-1.5.png`, recadrage de 560 × 560 pixels physiques du vase `Lavaux`, DPR 2, scène
immobile : deux captures à 1,5 s d'intervalle sont identiques, pixel pour pixel) :

| Indice                                                               | Avant (DPR 2, 1:1) | Après (DPR 1,5, ×1,33) |
| -------------------------------------------------------------------- | ------------------ | ---------------------- |
| Montée 10 à 90 % de la frontière blanc → vert (médiane, 74 colonnes) | 0,81 px            | **1,58 px**            |
| Énergie moyenne du laplacien (haute fréquence)                       | 1,38               | **1,05** (−24 %)       |
| Gradient de Sobel moyen · 99ᵉ centile                                | 0,950 · 8,05       | 0,941 · 9,39           |

Jugement : **un peu plus doux, pas flou.** Les arêtes passent d'environ 0,8 à 1,6 pixel physique de large et
les petites marches de couche de la frontière sont plus lissées ; au rapport 1:1, côte à côte, on voit que la
version à 1,5 est moins mordante, sur un écran à DPR 2 ; à taille normale, sans comparaison, rien de gênant
(les dégradés, les ombres et les motifs larges sont identiques). Le gradient de Sobel moyen ne discrimine
pas (le 99ᵉ centile est même plus haut : motifs de marches différents) ; la montée d'arête et le laplacien
sont les bons indices. À DPR 1 ou 1,5, aucune différence : le plafond ne coupe rien.

## 6. Déclassement C2 → C1 en cours de session

Essayé en abaissant temporairement le seuil du moniteur de frames (22 → 1 ms dans `tier.ts`, rétabli
ensuite, rien commité) : sur `/fr`, à 1,6 s le canvas existe toujours (1 425 × 1 800), le calque est ancré,
les deux vues `contour-field` (C2 seulement) sont retirées, le héros (`print-hero`) reste prêt, aucune
erreur ; puis, le seuil restant à 1 ms, C1 → C0 à 2,0 s : canvas démonté, posters revenus, un seul contexte.
Le montage ne dépendant plus du palier, il n'y a plus de cas « canvas resté fixe après déclassement ».

**Conséquence à connaître** : C2 → C1 ne soulage plus le GPU en pixels (le plafond est le même et
l'antialiasing est fixé à la création du contexte) ; il retire le champ de courbes et rien d'autre.
Seul C1 → C0 libère le GPU.

## 7. Production (OpenNext + preview locale)

`bunx opennextjs-cloudflare build`, puis `preview -- --upstream-protocol https --port 8796`, Edge avec
GPU, 1440 × 900.

| Contrôle                               | Résultat                                                                                                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/fr`, `/fr/studio/lavaux`, `/fr/shop` | **0 violation de CSP, 0 erreur d'hydratation, 0 message de console (erreur ou avertissement), 0 réponse 4xx ou 5xx, 0 `MISSING_MESSAGE`**, 0 px de défilement horizontal                                                    |
| Contextes WebGL vivants                | **1** sur `/fr` et le Studio (2 créés : la sonde de détection du palier, puis le Stage) ; 0 sur la boutique (aucune vue 3D)                                                                                                 |
| `bun scripts/check-worker-bundle.ts`   | **OK : aucune signature three / gsap / lenis** dans le Worker                                                                                                                                                               |
| `wrangler deploy --dry-run`            | `Total Upload: 17305,02 KiB / gzip: 3331,73 KiB` (dossier de travail plus long que celui de la mesure de référence, 3 333,45 KiB à 41 caractères : le code est côté client, **la taille ne change pas** de façon mesurable) |
| Écart DOM ↔ canvas, `/fr`, DPR 1       | molette 0,71 px (0 / 61), **clavier 0,71 px (0 / 298)**, **Page Bas 0,59 px (0 / 47)**                                                                                                                                      |
| Idem DPR 2 · Studio collant            | **clavier 0,75 px (0 / 104)** · Studio DPR 1, clavier 0 px (0 / 209)                                                                                                                                                        |
| Marges du canvas · hauteur de page     | 450 px au-dessus, **447 px** au minimum au-dessous · 9 711 → 9 711 px et 4 250 → 4 250 px                                                                                                                                   |
| Frames (rAF, 120 Hz)                   | DPR 1 : molette 8,58 ms en moyenne, max 16,7 ; clavier 8,32, max 8,5. DPR 2 : molette 9,26, max 16,8 ; clavier 8,40, max 16,7. **Aucune frame au-dessus de 20 ms** ; 0 dessin au repos                                      |
| Tampon de dessin                       | identique au développement : DPR 1 1 425 × 1 800 (2,56 Mpx), DPR 2 2 137 × 2 700 (5,77 Mpx), 4 échantillons                                                                                                                 |

## 8. Limites, incertitudes et suites possibles

- **Écrans larges à DPR 1** : le coût en pixels double (rapport 1,98) dès que le DPR est ≤ 1,5 : 1 920 × 1 080
  à DPR 1 : 2,1 → 4,1 Mpx ; 2 560 × 1 440 : 3,7 → 7,4 Mpx ; 3 840 × 2 160 à DPR 1,5 (écran 4K à 150 %) :
  8,3 → 16,6 Mpx, multiéchantillonnés. Les écrans à DPR 2 ou plus n'y gagnent ni n'y perdent (+11 %).
  Mesuré seulement sur une RTX 5070 : un iGPU de bureau n'a pas été essayé. Pistes si le propriétaire le
  constate : marge de 0,25 fenêtre au lieu de 0,5 (canvas de 1,5 fenêtre, −25 % de pixels ; la marge
  observée n'a jamais été entamée de plus de 34 px), ou un plafond de pixels total.
- **Pas de plancher de DPR** (R12 optionnel) : non fait, comme décidé ; sur un écran à DPR 1 la scène du
  Studio reste à 1:1 avec MSAA.
- **Pas d'essai hors Edge/Chromium** (Safari, Firefox : `overflow: clip`, `lvh`, `translate3d`).
- **Le glissé réel du pouce de l'ascenseur** n'a pas pu être distingué du fil principal dans ce banc ;
  clavier et Page Bas servent de preuve du défilement par le compositeur.
- **Continuité du champ de courbes au passage fixe → ancré** : le test (images alignées avant et après la
  bascule, DOM masqué) est tombé à un endroit où le champ n'est pas visible (moyenne ≈ 0,02) ; la justesse
  repose sur l'analyse du code (`page = pixel du canvas + position du haut du canvas dans le document`,
  identique dans les deux modes) et n'a pas de mesure visuelle.

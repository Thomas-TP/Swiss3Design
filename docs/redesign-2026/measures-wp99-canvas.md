# WP-99 · Budget de pixels du canvas du Stage · Mesures

Branche `claude/redesign-2026--wp99-canvas`, créée depuis `claude/redesign-2026` (`2efa27e`), **09.10.2026**,
worktree isolé, rien poussé. Suite de `measures-r16.md` §8 (problème ouvert 1 : « écrans larges à DPR 1 : le
coût en pixels double » et, plus largement, un tampon qui croît avec la fenêtre). **Directive du propriétaire pour
WP-99** : réduire ce qui peut l'être, **sans rien retirer d'utile et sans changer le comportement ni le design**.

## Résumé

| Critère                                                                                          | Résultat                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tampon de dessin, fenêtres usuelles (1440 × 900 à 2560 × 1440, DPR 1 à 2)                        | **−20 % de pixels**, rapport de pixels inchangé : 1440 × 900 DPR 1 2,56 → **2,05 Mpx**, DPR 2 5,77 → **4,62 Mpx** ; 1920 × 1080 DPR 1 4,11 → 3,29 Mpx ; 2560 × 1440 DPR 1 7,33 → 5,86 Mpx                                                                                                                                  |
| Tampon de dessin, grands écrans à DPR > 1                                                        | **−46 à −51 %** : 4K à 150 % 16,49 → **8,00 Mpx** (rapport 1,5 → 1,168), 27 pouces Retina 14,89 → **8,00 Mpx** (rapport 1,5 → 1,229) ; c'est le seul endroit où la netteté change (§7)                                                                                                                                     |
| Écart DOM ↔ canvas (molette, clavier, Page Bas, Page Bas rapide, lancer tactile, DPR 1 et 2, C1) | **≤ 0,83 px, 0 image au-dessus de 1 px** sur 37 séries et 3 932 images mesurées (avant : ≤ 0,83 px, 0 sur 33 séries et 2 947 images) ; Studio et héros épinglés : 0 à 0,83 px                                                                                                                                              |
| Bande vide en haut ou en bas pendant un Page Bas / Page Haut rapide                              | **aucune à CPU normal** (0 image à nu sur 11 séries rapides vers le bas et le haut, marge côté avant ≥ 168 px) ; avec un CPU ralenti ×2 (cas de contrainte), 5 images à nu sur 11 séries de Page Bas et Page Haut contre 2 avant, au pire −170 px pendant une image (§5)                                                   |
| Hauteur de page, défilement horizontal                                                           | **inchangés** : 9 711 → 9 711 px (`/fr`), 4 250 → 4 250 px (Studio), 8 091 → 8 091 px (`/fr` en C1), 0 px de défilement horizontal dans toutes les séries                                                                                                                                                                  |
| Temps de frame au défilement (rAF 120 Hz ; sans plafond de vsync)                                | **inchangé dans le bruit** : 8,3 à 10,6 ms en moyenne avec ou sans le changement, pire frame 25 ms (une seule à 33,4 ms) ; sans plafond, 6,9 à 7,9 ms de part et d'autre (le bruit entre deux séries du même code atteint ±1 ms) ; le GPU de bureau du banc ne sature pas, **le gain en frame n'y est pas mesurable** (§6) |
| Déclassement C2 → C1 en cours de session                                                         | **réduit les pixels** : à 1440 × 900 DPR 2, 2 137 × 2 160 (4,62 Mpx) → **1 989 × 2 010 (4,00 Mpx)**, calque ancré, champ de courbes retiré, héros prêt, aucune erreur (§8)                                                                                                                                                 |
| Contrôles                                                                                        | `bun run lint` (0 avertissement), `typecheck`, `format:check`, `test` (882 réussis) verts                                                                                                                                                                                                                                  |

## 1. Ce qui a changé

| Fichier                                        | Changement                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/motion/stage/anchor-margin.ts` (neuf)     | Marge du canvas ancré : **0,3 fenêtre de chaque côté à la souris** (canvas de 1,6 fenêtre), **0,5 dès qu'un pointeur grossier existe** (`any-pointer: coarse`, inertie du lancer : rien ne change au doigt) ; **anticipation** : le canvas est décalé dans le sens du défilement de `vitesse × 0,1 s`, sans jamais manger plus de 80 % de la marge côté arrière (`createAnchorLead`, `anchorLead`).                   |
| `src/motion/stage/pixel-ratio.ts`              | `stagePixelRatio(dpr, taille, palier, tactile)` : plafond de 1,5 (inchangé), puis **budget de pixels du tampon** par palier, **8 Mpx en C2, 4 Mpx en C1**, jamais sous 1 (un canvas rendu plus petit que sa taille CSS serait flou à tout rapport d'écran) ; un appareil tactile garde le budget de C2 en C1 (son C1 est un état de départ, pas un déclassement). Commentaire : les écrans touchés et la sensibilité. |
| `src/motion/stage/stage-root.tsx`              | Hauteur du canvas = fenêtre + deux marges (`anchorCanvasViewports`) ; marge en pixels = sa part de la hauteur du canvas ; décalage d'anticipation passé à `anchorPlacement` ; remis à zéro au changement de mode ou de taille. Un seul montage, ancré aux deux paliers (comme R16) : la logique « live » (collant ou épinglé : calque fixe) est **intacte**.                                                          |
| `src/motion/stage/ticker.ts`                   | `anchorPlacement(scrollY, margin, dpr, lead = 0)` : `lead` décale le haut du canvas (arrondi au pixel physique, `top + offset = scrollY` toujours vrai).                                                                                                                                                                                                                                                              |
| `src/motion/stage/stage.ts`                    | Utilise le rapport budgété (constructeur, `resizeCanvas`) ; **`applyCapability` (C2 → C1) recalcule le rapport avec le budget de C1 et réalloue le tampon** si besoin ; `ViewFrame.scrollY` inchangé ; commentaires (en-tête, continuité du champ de courbes : « la marge du canvas », plus « une demi-fenêtre »).                                                                                                    |
| `src/motion/stage/materials/print-material.ts` | Commentaire périmé corrigé (option `side` : coques creuses à deux parois, `DoubleSide` par défaut ; les lignes fantômes `uGhost` restent sur la paroi extérieure ; le héros de l'accueil a son matériau à part, `FrontSide`). Aucun changement de code.                                                                                                                                                               |
| Tests                                          | `anchor-margin.test.ts` (neuf, 13 tests : marge selon le pointeur, anticipation bornée, mémoire de vitesse, placement) ; `pixel-ratio.test.ts` (réécrit, 11 tests : plafond, budget, plancher à 1, C2 → C1, tactile) ; `view-tracker.test.ts` : +1 test (`anchorPlacement` avec anticipation). Les tests de la vue « live » sont inchangés.                                                                           |

**Pourquoi trois leviers et pas un seul.** En R16 le canvas ancré fait deux fenêtres de haut (0,5 fenêtre de marge
de chaque côté) et la marge n'a jamais été entamée de plus de 34 px (`measures-r16.md` §4) : la moitié de cette
marge, côté arrière, ne sert à rien en défilement continu. Les deux premiers leviers récupèrent cette part
**sans réduire la marge utile** :

1. **Marge de base plus petite à la souris** (0,3 fenêtre, soit 270 px à 900 px de haut) : la souris n'a pas
   l'inertie d'un lancer tactile.
2. **Anticipation** : le canvas avance dans le sens du défilement. À vitesse soutenue (≥ 2 160 px/s) la marge
   **côté avant monte à 486 px** (270 + 216 ; avant : 450 px) et la marge côté arrière descend à 54 px (jamais en
   dessous : un demi-tour trouve toujours du canvas). À l'arrêt ou en défilement lent elle reste symétrique. Le
   décalage ne change que quand le défilement change : le canvas n'est jamais déplacé sans être redessiné dans
   la même tâche (`loop.ts`).
3. **Budget de pixels du tampon** (8 Mpx en C2, 4 Mpx en C1 à pointeur précis) : plafonne le coût des grands
   écrans à DPR > 1, que le plafond de 1,5 laissait croître avec la fenêtre.

Effet de bord utile : moins de vues hors fenêtre se retrouvent dans le canvas, donc moins de draw calls par
seconde pendant les gestes (1 014 contre 1 118 par seconde sans plafond à 1440 × 900, §6).

## 2. Méthode

Identique à `measures-r16.md` §2 (Edge headless `--use-angle=d3d11`, RTX 5070, 24 cœurs, 1440 × 900 sauf mention,
serveur de développement Turbopack, écart DOM ↔ canvas dans la même image du compositeur : liseré DOM de 4 px et
liseré peint dans le canvas, bords hauts détectés au sous-pixel), avec en plus :

- **Avant** = `claude/redesign-2026` (`2efa27e`, R16) **sur le même serveur, mêmes conditions**, en échangeant
  `src/motion/stage/` contre le code de la branche de base (HMR), jamais deux versions en même temps. **Après** =
  cette branche.
- **Deux gestes ajoutés** : `pagedownfast` (Page Bas toutes les 50 ms) et `tfling` (**vrai lancer tactile** :
  `Input.dispatchTouchEvent`, glissé du doigt à 6 000 ou 12 000 px/s puis lâcher, l'inertie est menée par le
  compositeur ; en C1, tactile, 1440 × 900 et téléphone 412 × 915 DPR 2).
- **Couverture du canvas** : à chaque événement `scroll` (déclenché avant la boucle du Stage, donc au pire du
  retard), marge du canvas au-dessus et au-dessous de la fenêtre ; une marge négative = une bande sans canvas.
  Séries répétées 3 à 5 fois ; CPU ralenti ×2 et ×4 (CDP) et tâche longue de 40 ms toutes les 250 ms (`JANK`)
  comme contraintes.
- **Temps de frame** : rAF capé (120 Hz, 16 pas de molette puis 24 flèches) et **sans plafond de vsync**
  (`--disable-gpu-vsync --disable-frame-rate-limit`, la page défile de ±40 px à chaque image : le temps de frame est
  alors le coût réel CPU + GPU), 3 tours après, 3 tours avant pour les fenêtres de référence, **plusieurs séries
  alternées avant / après** parce que la machine est partagée avec d'autres agents (§6).
- **Limites du banc** (reprises de R16) : le glissé du pouce de l'ascenseur et le geste synthétique « souris »
  passent par le fil principal ; seuls le **clavier**, **Page Bas** et le **tactile** exercent le défilement du
  compositeur, ce sont eux qui discriminent.

## 3. Tampon de dessin, avant et après

Mesuré (`drawingBufferWidth/Height`, `SAMPLES`), `/fr`, C2 (24 cœurs), 4 échantillons :

| Fenêtre · DPR                          | Avant : canvas CSS · tampon · Mpx | Après : canvas CSS · tampon · Mpx     | Rapport après |
| -------------------------------------- | --------------------------------- | ------------------------------------- | ------------- |
| 1440 × 900 · 1                         | 1425 × 1800 · 1425 × 1800 · 2,56  | 1425 × 1440 · 1425 × 1440 · **2,05**  | 1             |
| 1440 × 900 · 2                         | 1425 × 1800 · 2137 × 2700 · 5,77  | 1425 × 1440 · 2137 × 2160 · **4,62**  | 1,5           |
| 1920 × 1080 · 1                        | 1905 × 2160 · 1905 × 2160 · 4,11  | 1905 × 1728 · 1905 × 1728 · **3,29**  | 1             |
| 1920 × 1080 · 2 (4K à 200 %)           | 1905 × 2160 · 2857 × 3240 · 9,26  | 1905 × 1728 · 2857 × 2592 · **7,41**  | 1,5           |
| 1512 × 982 · 2 (MacBook Pro 14)        | 1497 × 1964 · 2245 × 2946 · 6,61  | 1497 × 1571 · 2245 × 2356 · **5,29**  | 1,5           |
| 1728 × 1117 · 2 (MacBook Pro 16)       | 1713 × 2234 · 2569 × 3351 · 8,61  | 1713 × 1787 · 2569 × 2680 · **6,88**  | 1,5           |
| 2560 × 1440 · 1                        | 2545 × 2880 · 2545 × 2880 · 7,33  | 2545 × 2304 · 2545 × 2304 · **5,86**  | 1             |
| 2560 × 1440 · 1,5 (**4K à 150 %**)     | 2545 × 2880 · 3817 × 4320 · 16,49 | 2545 × 2304 · 2972 × 2691 · **8,00**  | 1,168         |
| 2560 × 1300 · 2 (**27 pouces Retina**) | 2545 × 2600 · 3817 × 3900 · 14,89 | 2545 × 2080 · 3128 × 2557 · **8,00**  | 1,229         |
| 3840 × 2160 · 1 (4K à 100 %)           | 3825 × 4320 · 3825 × 4320 · 16,52 | 3825 × 3456 · 3825 × 3456 · **13,22** | 1             |

**C1** (appareil à pointeur précis seul, `hardwareConcurrency` = 4, sans échantillonnage multiple) :

| Fenêtre · DPR   | Avant (R16) | Après                                       |
| --------------- | ----------- | ------------------------------------------- |
| 1440 × 900 · 1  | 2,56 Mpx    | **2,05 Mpx**                                |
| 1440 × 900 · 2  | 5,77 Mpx    | **4,00 Mpx** (1 989 × 2 010, rapport 1,396) |
| 1920 × 1080 · 2 | 9,26 Mpx    | **4,00 Mpx** (2 099 × 1 904, rapport 1,102) |
| 2560 × 1300 · 2 | 14,89 Mpx   | **5,29 Mpx** (2 545 × 2 080, rapport 1)     |

Un appareil **tactile** garde exactement le tampon de R16 : 1440 × 900 DPR 2 en C1 tactile 5,77 Mpx, tablette de
12,9 pouces (1024 × 1366 DPR 2) 6,2 Mpx, marge de 0,5 fenêtre, budget de C2 (le budget de 8 Mpx ne l'atteint pas).

**Pourquoi 8 Mpx en C2.** C'est le plus gros tampon du canvas fixe d'**avant** R16 sur les écrans essayés
(4K à 150 % : 8,3 Mpx) : le budget ramène à ce niveau les écrans à DPR > 1 (à DPR 1 le rapport ne descend pas sous 1 :
un 4K à 100 % garde 13,2 Mpx, §9). 6 Mpx aurait ramené un 27 pouces
Retina à un rapport de 1,07 (rendu à peu près à la résolution CSS) pour un gain non mesurable ici (§6). Le budget
ne touche pas un portable (MacBook 14 et 16 pouces, 4K à 200 %), ni un écran à DPR 1 (le rapport y est déjà au
plancher de 1) : il ne mord que sur les grands écrans à DPR > 1 (4K à 150 %, 27 pouces Retina). **C'est une
constante** (`STAGE_PIXEL_BUDGET` dans `pixel-ratio.ts`).

Calculé avec le code réel (ascenseur de 15 px, canvas de 1,6 fenêtre), pour des fenêtres non mesurées :

| Fenêtre · DPR                    | Avant, Mpx (rapport) | Après C2, Mpx (rapport) | Après C1, Mpx (rapport) | Après / avant (C2) |
| -------------------------------- | -------------------- | ----------------------- | ----------------------- | ------------------ |
| 1280 × 720 · 1,5 (1080p à 150 %) | 4,10 (1,5)           | 3,28 (1,5)              | 3,28 (1,5)              | 0,80               |
| 1440 × 900 · 2 (MacBook Air 13)  | 5,77 (1,5)           | 4,62 (1,5)              | 4,00 (1,396)            | 0,80               |
| 5120 × 1440 · 1 (ultralarge)     | 14,70 (1)            | 11,76 (1)               | 11,76 (1)               | 0,80               |

(Les lignes mesurées du premier tableau coïncident avec ce calcul à 0,01 Mpx près.)

## 4. Écart DOM ↔ canvas, avant et après

« Images » = images du compositeur où un liseré est visible hors du header ; « > 1 px » = images dont l'écart
dépasse 1 px. « Marge min. » = la plus faible marge de canvas observée pendant le geste (haut / bas ; avant : 450 px
de chaque côté, jamais entamés au-delà de 34 px). **Avant** = R16, **Après** = cette branche.

| Page et geste                                        | Avant : écart max · images > 1 px / mesurées | Après : écart max · images > 1 px / mesurées | Marge min. haut / bas avant (px) | Marge min. haut / bas après (px) |
| ---------------------------------------------------- | -------------------------------------------- | -------------------------------------------- | -------------------------------- | -------------------------------- |
| /fr chap. 02, DPR 1 · molette                        | 0,72 px · 0 / 59                             | 0,71 px · 0 / 60                             | 450 / 450                        | 54 / 270                         |
| /fr chap. 02, DPR 1 · clavier                        | 0,71 px · 0 / 283                            | 0,72 px · 0 / 271                            | 450 / 444                        | 70 / 267                         |
| /fr chap. 02, DPR 1 · Page Bas                       | 0,57 px · 0 / 39                             | 0,60 px · 0 / 51                             | 450 / 450                        | 54 / 255                         |
| /fr chap. 02, DPR 1 · Page Bas rapide                | 0,48 px · 0 / 8                              | 0,01 px · 0 / 4                              | 450 / 450                        | 54 / 252                         |
| /fr chap. 02, DPR 1 · geste synthétique              | 0,71 px · 0 / 71                             | 0,71 px · 0 / 72                             | 450 / 450                        | 54 / 270                         |
| /fr chap. 02, 2 800 px, DPR 1 · Page Bas             | 0,51 px · 0 / 22                             | 0,56 px · 0 / 22                             | 450 / 429                        | 54 / 251                         |
| /fr chap. 02, 2 800 px, DPR 1 · clavier              | 0,71 px · 0 / 292                            | 0,71 px · 0 / 300                            | 450 / 442                        | 70 / 268                         |
| /fr héros épinglé, DPR 1 · clavier                   | 0,00 px · 0 / 220                            | 0,00 px · 0 / 223                            | calque fixe                      | calque fixe                      |
| /fr héros épinglé, DPR 1 · molette                   | 0,00 px · 0 / 230                            | 0,00 px · 0 / 258                            | calque fixe                      | calque fixe                      |
| Studio collant, DPR 1 · clavier                      | 0,00 px · 0 / 231                            | 0,00 px · 0 / 231                            | calque fixe                      | calque fixe                      |
| Studio collant, DPR 1 · molette                      | 0,00 px · 0 / 251                            | 0,00 px · 0 / 320                            | calque fixe                      | calque fixe                      |
| Studio collant, DPR 1 · Page Bas                     | 0,00 px · 0 / 79                             | 0,00 px · 0 / 73                             | calque fixe                      | calque fixe                      |
| Studio, DPR 1 · Page Bas rapide (le calque s'ancre)  | 0,00 px · 0 / 93                             | 0,00 px · 0 / 320                            | 450 / 450                        | 54 / 270                         |
| /fr chap. 02, DPR 2 · clavier                        | 0,75 px · 0 / 85                             | 0,74 px · 0 / 69                             | 450 / 446                        | 95 / 270                         |
| /fr chap. 02, DPR 2 · Page Bas                       | 0,66 px · 0 / 41                             | 0,55 px · 0 / 32                             | 450 / 431                        | 54 / 250,5                       |
| /fr chap. 02, DPR 2 · Page Bas rapide                | 0,17 px · 0 / 4                              | 0,17 px · 0 / 4                              | 450 / 431                        | 54 / 246,5                       |
| /fr chap. 02, DPR 2 · geste synthétique              | 0,74 px · 0 / 50                             | 0,74 px · 0 / 46                             | 450 / 450                        | 54 / 270                         |
| /fr héros épinglé, DPR 2 · clavier                   | 0,83 px · 0 / 228                            | 0,83 px · 0 / 173                            | calque fixe                      | calque fixe                      |
| Studio collant, DPR 2 · clavier                      | 0,00 px · 0 / 188                            | 0,00 px · 0 / 179                            | calque fixe                      | calque fixe                      |
| Studio, C1 · clavier                                 | 0,00 px · 0 / 235                            | 0,00 px · 0 / 231                            | calque fixe                      | calque fixe                      |
| /fr chap. 02, C1 tactile · glissé du doigt           | 0,46 px · 0 / 36                             | 0,46 px · 0 / 66                             | 450 / 368                        | 199 / 406                        |
| /fr chap. 02, C1 tactile, 2 800 px · glissé du doigt | 0,46 px · 0 / 30                             | 0,46 px · 0 / 31                             | 450 / 398                        | 167 / 406                        |
| /fr héros, C1 tactile · lancer de 6 000 px/s         | 0,00 px · 0 / 46                             | 0,00 px · 0 / 44                             | 450 / 450                        | 93 / 452                         |
| /fr héros, C1 tactile · lancer de 12 000 px/s        | 0,00 px · 0 / 42                             | 0,00 px · 0 / 45                             | 450 / 450                        | 90 / 454                         |
| /fr héros, téléphone DPR 2 · lancer de 7 000 px/s    | 0,50 px · 0 / 42                             | 0,17 px · 0 / 193                            | 457,5 / 345,5                    | 91,5 / 457,5                     |
| /fr héros, téléphone DPR 2 · glissé du doigt         | 0,50 px · 0 / 42                             | 0,50 px · 0 / 106                            | 457,5 / 412,5                    | 177,5 / 412,5                    |
| Studio, C1 tactile · glissé du doigt et lancer       | non mesuré                                   | 0,00 px · 0 / 188 et 0 / 320                 | ·                                | calque fixe                      |

Séries sans marqueur (l'objet du chapitre 02 est figé en image au repos en C1, `bakeWhenIdle`, ou hors champ sur
téléphone : il n'y a alors rien de peint dans le canvas à mesurer) : `/fr` chapitre 02 en C1 (clavier, molette, Page Bas,
lancers de 6 000 et 12 000 px/s, glissé), `/fr` chapitre 02 et Studio sur téléphone ; elles ne servent qu'à la
couverture (marges ci-dessus). Totaux : **avant 33 séries, 2 947 images, max 0,83 px, 0 au-dessus de 1 px ;
après 37 séries, 3 932 images, max 0,83 px, 0 au-dessus de 1 px** ; défilement horizontal 0 px dans toutes.

**Hauteur de page** (avant → après le geste, identique avant et après le changement) : `/fr` 9 711 → 9 711 px
(C1 8 091 → 8 091), Studio 4 250 → 4 250, téléphone 12 060 → 12 133 (contenu qui se charge pendant le geste, **le même
avant**).

Le « 0,83 px » du héros à DPR 2 est le décalage statique de R16 (le tampon à 1,5 laisse 0 à 0,8 px entre le bord
d'une vue et son liseré), pas un mouvement.

## 5. Couverture du canvas : la marge n'est jamais épuisée à CPU normal

Gestes répétés (`pagedown` ×3, `pagedownfast` ×3, flèches, lancers, Page Haut ×5), 1440 × 900 DPR 1 sauf
mention. « Avant » = marge côté avant du geste, « arrière » = côté d'où l'on vient (en px, plus bas = plus entamé) ;
« images à nu » = événements `scroll` où une bande de la fenêtre est sans canvas (marge négative).

| Scénario                                                      | Avant (R16, canvas de 2 fenêtres)                                         | Après                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Page Bas, CPU ×1                                              | avant min 300 · arrière min 451 · **0 image à nu** (3 séries)             | avant min 207 · arrière min 58 · **0 image à nu** (3 séries) |
| Page Bas rapide, CPU ×1                                       | avant min 166 · arrière min 451 · **0** (3 séries)                        | avant min 249 · arrière min 66 · **0** (3 séries)            |
| Flèches, CPU ×1                                               | avant min 424 · **0**                                                     | avant min 269 · **0**                                        |
| Page Haut et Page Haut rapide, CPU ×1                         | avant min 123 · **0** (5 séries)                                          | avant min 168 · arrière min 56 · **0** (5 séries)            |
| Page Bas rapide + **tâche longue de 40 ms toutes les 250 ms** | avant min −94 px · **2 images à nu** (3 séries)                           | avant min 58 · **0 image à nu** (3 séries)                   |
| Page Bas et Page Bas rapide, CPU **×2**                       | avant min 105 · **0 image à nu** (6 séries)                               | avant min −22 · **1 image à nu** (6 séries)                  |
| Page Haut et Page Haut rapide, CPU **×2**                     | avant min −113 · **2 images à nu** (5 séries)                             | avant min −170 · **4 images à nu** (5 séries)                |
| Fin (touche), CPU ×1 · ×2                                     | −680 · 6 images à nu ; −2 140 · 4 images à nu (6 000 px en 6 à 16 images) | −287 · 8 images à nu ; −2 260 · 4 images à nu                |
| Tactile 1440 × 900 C1, lancers 6 000 et 12 000 px/s           | avant min 354 et 258 · **0**                                              | avant min 357 et 265 · **0**                                 |
| Téléphone 412 × 915 DPR 2, lancers et Page Bas, CPU ×1        | avant min 235 · **0**                                                     | avant min 273 · **0**                                        |
| Téléphone, Page Bas, CPU **×4**                               | avant min −200 · **4 images à nu**                                        | avant min −11 · **1 image à nu**                             |

Lecture honnête : à CPU normal, **jamais de bande vide** ni avant ni après (marge côté avant au plus bas :
168 px après, 123 px avant) ; l'anticipation **corrige** les cas de fil principal chargé (tâche longue : 2 → 0
images à nu ; téléphone ralenti ×4 : 4 → 1). Avec un CPU ralenti ×2 et des touches enchaînées toutes les 50 ms
(une contrainte volontairement au-delà de l'usage), le nouveau canvas expose **un peu plus souvent** une bande
pendant une image (5 images sur 11 séries contre 2) : la marge côté avant monte à 486 px (contre 450) **une fois
la vitesse mesurée**, mais au tout début d'une rafale elle n'est que de 270 px ; la bande la plus profonde fait
170 px pendant une image (8 ms) alors que la page avance de 350 à 500 px par image ; avant, le même scénario
expose déjà des bandes de 100 px. **Fin / Début** (6 000 px en 6 à 16 images) dépasse n'importe quelle marge
avant comme après. Levier si le propriétaire veut revenir au comportement d'avant dans ce cas de contrainte :
`ANCHOR_MARGIN_FINE` à 0,35 (canvas de 1,7 fenêtre, −15 % de pixels au lieu de −20 %), non essayé ici.

## 6. Temps de frame

Machine partagée avec d'autres agents en parallèle : **deux séries du même code varient de ±1 ms** (par exemple
1440 × 900 DPR 1 sans plafond : 6,5 à 8,3 ms), d'où trois tours alternés avant / après (une série « après » en début
de session, perturbée, ressortait 10 % plus lente avant d'être répétée). Chaque cellule est la médiane de
tous les tours (3 séries sans plafond par tour) ; entre parenthèses l'étendue.

| Fenêtre · DPR        | Mpx avant → après | Frame au défilement, plafonnée 120 Hz (moy. molette · clavier, ms) avant · après | Pire frame (ms) avant · après | Sans plafond (moy. ms) avant · après | Draw calls/s sans plafond avant · après |
| -------------------- | ----------------- | -------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------ | --------------------------------------- |
| 1440 × 900, DPR 1    | 2,56 → 2,05       | 9,59 · 8,61 → 9,40 · 8,43                                                        | 25,1 · 25                     | 7,16 (6,9 à 7,5) · 7,86 (6,9 à 8,3)  | 1 118 · 1 014                           |
| 1440 × 900, DPR 2    | 5,77 → 4,62       | 9,15 · 8,33 → 9,31 · 8,35                                                        | 25,1 · 25                     | 7,73 (6,6 à 8,1) · 6,92 (6,5 à 9,9)  | 1 106 · 1 150                           |
| 1920 × 1080, DPR 1   | 4,11 → 3,29       | 9,79 · 8,43 → 10,03 · 8,47                                                       | 25 · 33,4                     | 7,28 (7,0 à 7,8) · 7,79 (7,1 à 11,0) | 1 108 · 1 018                           |
| 2560 × 1440, DPR 1   | 7,33 → 5,86       | 9,46 · 8,36 → 9,59 · 8,36                                                        | 25 · 25,1                     | 7,25 (6,8 à 7,4) · 7,68 (7,0 à 8,5)  | 1 112 · 1 034                           |
| 2560 × 1440, DPR 1,5 | 16,49 → 8,00      | 10,60 · 8,39 → 9,42 · 8,34                                                       | 25,1 · 25,1                   | 7,06 (6,8 à 7,4) · 7,33 (7,1 à 8,0)  | 1 130 · 1 084                           |
| 2560 × 1300, DPR 2   | 14,89 → 8,00      | 9,44 · 8,32 → 8,86 · 8,34                                                        | 16,8 · 16,8                   | 7,38 (7,0 à 7,5) · 7,30 (6,8 à 8,7)  | 1 076 · 1 092                           |

Lecture honnête : **à 120 Hz plafonné, rien ne bouge** (8,3 à 10,6 ms en moyenne des deux côtés, pire frame
25 ms, une seule à 33,4 ms) ; sans plafond, les médianes « après » sont 0,3 à 0,7 ms au-dessus de « avant » aux
fenêtres à DPR 1 et au même niveau ou en dessous à DPR 2, dans le bruit de ±1 ms ; un essai alterné **anticipation
éteinte / allumée** (3 tours, 1440 × 900 et 1920 × 1080 DPR 1) donne les mêmes moyennes (6,5 à 8,7 ms de part et
d'autre) : l'anticipation n'y est pour rien, et aucune cause d'un surcoût n'est apparue. Le GPU du banc (RTX 5070)
ne sature pas, même à 16,5 Mpx : **le gain en pixels (−20 %, −46 à −51 % aux grands écrans) ne se traduit pas ici
en temps de frame** ; il se lira sur un iGPU, non essayé (§9). Au repos : 0 dessin en 2 s, avant et après (rendu à
la demande intact). Le Studio redessine en continu quand sa vue « live » est proche (comportement de R16,
inchangé : 1 616 draw calls en 3 s à 4K 150 %, captures identiques à un niveau de couleur près).

## 7. Netteté aux écrans touchés par le budget

Recadrage de 560 × 560 pixels physiques du vase du Studio (`/fr/studio/lavaux?m=voronoi`), scène immobile ;
deux captures, l'une avec le canvas, l'autre sans, isolent les pixels du canvas ; montée 10 à 90 % des arêtes
(médiane, pixels physiques) et énergie du laplacien (haute fréquence) sur ces pixels :

| Fenêtre · DPR                      | Rapport avant → après | Montée d'arête avant → après (px physiques) | Laplacien avant → après    |
| ---------------------------------- | --------------------- | ------------------------------------------- | -------------------------- |
| 1440 × 900 · 2                     | 1,5 → 1,5             | 1,57 → 1,57                                 | 19,28 → 19,28              |
| 1920 × 1080 · 2 (4K à 200 %)       | 1,5 → 1,5             | 1,57 → 1,57                                 | 18,09 → 18,09              |
| 2560 × 1300 · 2 (27 pouces Retina) | 1,5 → 1,229           | 1,57 → **1,64** (+4 %)                      | 18,44 → **13,50** (−27 %)  |
| 2560 × 1440 · 1,5 (4K à 150 %)     | 1,5 → 1,168           | 1,62 → **2,06** (+27 %)                     | 123,45 → **54,89** (−56 %) |

Aux fenêtres que le budget ne touche pas, le recadrage est **identique au pixel près**. Aux deux écrans qu'il touche
la scène est **un peu plus douce** : le rendu est réétiré de 1,168 à 1,5 pixel physique par pixel de tampon à 4K
150 % (1,285 fois, d'où les 27 % d'arête en plus, comme prévu), de 1,229 à 1,5 au 27 pouces Retina. C'est le
prix du budget, **assumé par le choix de 8 Mpx** (6 Mpx : 1,07 au 27 pouces). Rien ne change à DPR 1 ni sur un
portable. La même scène sans réétirage reste la référence de R16 (`measures-r16.md` §5 : « un peu plus doux, pas
flou » déjà à 1,5 sur un écran à DPR 2).

## 8. Déclassement C2 → C1 en cours de session

Le moniteur de frames (médiane des 60 premières frames animées > 22 ms) ne déclasse pas sur ce GPU, ni avec un
CPU ralenti de ×8 à ×40 : pour **observer** le déclassement, le banc réécrit, **dans le navigateur** (interception
CDP `Fetch`), la réponse du fichier JS qui contient `thresholdMs = 22` et la porte à 1 ms. Aucun fichier du
dépôt n'est modifié. 1440 × 900, DPR 2, `/fr`, relevé toutes les 100 ms :

| Instant | Tampon (px) · Mpx                      | Calque | Vues `contour-field` / `print-hero` prêtes |
| ------- | -------------------------------------- | ------ | ------------------------------------------ |
| 0,7 s   | 2 137 × 2 160 · 4,62                   | ancré  | 0 / 0                                      |
| 0,8 s   | 2 137 × 2 160 · 4,62                   | fixe   | 2 / 1                                      |
| 1,5 s   | **1 989 × 2 010 · 4,00**               | fixe   | 0 / 0 (remises à zéro)                     |
| 1,6 s   | 1 989 × 2 010 · 4,00                   | ancré  | 0 / 1                                      |
| 2,1 s   | canvas démonté (C1 → C0, seuil à 1 ms) | ·      | posters                                    |

C2 → C1 **réalloue le tampon avec le budget de C1** (rapport 1,5 → 1,396, −13 % de pixels à ce DPR) et retire les
deux vues du champ de courbes, comme en R16 ; l'antialiasing, fixé à la création du contexte, reste. À DPR 1 le
rapport est déjà au plancher : rien à retirer (la correction de la phrase de `measures-r16.md` §6 : « C2 → C1 ne
soulage plus le GPU en pixels » n'est plus vraie à DPR > 1). Un appareil tactile garde le budget de C2 (son C1 est
un état de départ).

## 9. Limites, incertitudes et suites possibles

- **Pas d'iGPU** : le coût en pixels, mémoire et bande passante, est réduit de 20 % (46 à 51 % aux grands écrans à
  DPR > 1) mais **le temps de frame ne le montre pas** sur une RTX 5070 ; ce que cela vaut sur un iGPU de bureau
  (budget du brief §4.11 : ≤ 8 ms de GPU par frame sur un iGPU 2020) reste une estimation.
- **Budget et netteté** : le budget de 8 Mpx rend la scène un peu plus douce à 4K 150 % (+27 % d'arête) et au
  27 pouces Retina (laplacien −27 %). Si le propriétaire préfère la netteté de R16 à ces écrans, `STAGE_PIXEL_BUDGET[2]`
  à 14 000 000 la rétablit pour les deux (tampons de 13,2 et 11,9 Mpx, contre 16,5 et 14,9 avant et 8 aujourd'hui) ;
  à 10 000 000 un compromis (rapports de 1,31 au 4K à 150 % et de 1,37 au 27 pouces).
- **Écrans à DPR 1 très grands** : le rapport ne descend jamais sous 1, le budget n'y peut rien : 4K à 100 %
  13,2 Mpx (avant 16,5), 5120 × 1440 à DPR 1 11,8 Mpx (avant 14,7), soit seulement les −20 % de la marge.
- **CPU ralenti ×2 et touches enchaînées** : quelques images à nu de plus qu'avant (§5), jamais à CPU normal.
  Levier : `ANCHOR_MARGIN_FINE` 0,35.
- **Pas de plancher de DPR**, **pas d'essai hors Edge/Chromium** (Safari, Firefox : `overflow: clip`, `lvh`,
  `translate3d`), **pas de mesure sur un vrai appareil tactile** (les lancers sont des événements tactiles
  synthétiques du protocole, l'inertie est celle de Chromium).
- Le glissé du pouce de l'ascenseur reste indiscernable du fil principal dans ce banc (R16) ; clavier, Page Bas et
  tactile servent de preuve.
- Le **champ de courbes** (C2) n'apparaît pas dans les séries du chapitre 02 (marqueur magenta absent) : sa
  continuité fixe → ancré n'a pas de mesure visuelle nouvelle (R16 §8).
- `stage.ts` n'a pas de test d'intégration (WebGL) : le déclassement s'appuie sur le test du calcul
  (`pixel-ratio.test.ts`, C2 → C1) et sur la mesure du §8.

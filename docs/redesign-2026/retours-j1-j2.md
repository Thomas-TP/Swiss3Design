# Retours du propriétaire après J1 / J2 (01.10.2026)

Revue faite sur la preview déployée (`claude/redesign-2026` à `1d12e2b`,
https://swiss3design-preview.thomastp.workers.dev). Ces retours passent **avant WP-99** :
une vague de correctifs « R1 », puis une nouvelle revue du propriétaire sur la preview.
**Quota :** le propriétaire était à 97 % de sa limite hebdomadaire (remise à zéro le
07.10.2026 à 0 h 01). Rien n'est lancé avant cette date sans son accord.

## Décisions du propriétaire (01.10.2026, contraignantes)

| Sujet                                      | Décision                                                                                                                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verbe du Studio (« Régler », « réglable ») | **Personnaliser** / « personnalisable » partout (29 occurrences en français : catalog, landing, quote, shell, studio, studioCore, system) ; DE « personalisieren », IT « personalizzare », EN « customise » (de-CH sans ß) |
| Vue « 3/4 » du Studio                      | renommée **« 3D »** : « 3D · Plan · Élévation · Couches »                                                                                                                                                                  |
| Partie non imprimée du vase de l'accueil   | **silhouette pleine très discrète**, presque transparente, sans anneaux ni traits                                                                                                                                          |
| Cartes « À régler au Studio » et icône     | **aperçu de chaque objet** (vase, carte, sous-verre, porte-nom) en grand, dans ses couleurs, à la place du triangle ; cartes plus grandes ; même traitement sur la page Studio                                             |
| Budget du Worker                           | dépassement accepté (3 326 KiB), réduction en WP-99, cf. AGENTS.md règle 10                                                                                                                                                |
| Budget de JS initial de l'accueil          | peut être dépassé (non utilisé : 194 KiB)                                                                                                                                                                                  |

## Retours, du plus visible au plus technique

Chaque point : symptôme rapporté → piste et fichiers → critère de fin.

### Accueil

- **R01 · Anneaux gris de la suite de l'impression** (« pas très beau ») → remplacer les
  anneaux par la silhouette discrète décidée ci-dessus, **dans la scène et dans le poster SSR**
  (raccord au pixel poster → canvas) : `src/motion/stage/scenes/print-hero.ts`,
  `src/lib/studio/poster.ts` (poster « ghost » à 75 ellipses), `src/components/home/hero-poster.tsx`,
  `poster-svg.tsx`. Fin : aucune ligne visible au-dessus de la couche en cours, forme finale
  lisible, raccord poster → canvas toujours ≤ 0,5 px.
- **R02 · L'intro « bug » : les traits transparents apparaissent avant le scroll** → la partie
  fantôme surgit d'un coup pendant l'intro. Avec la silhouette (R01), la faire apparaître en
  fondu avec les premières couches, jamais avant : `src/motion/choreo/home.tsx`, `print-hero.ts`.
  Fin : aucune apparition brusque entre le premier paint et la fin de l'intro, en C1 et C2.
- **R03 · Tête d'impression pas belle** → la refaire, plus petite et crédible (bloc de chauffe,
  buse conique, matière mate, un détail rouge de la marque), ou la retirer si le rendu reste
  moyen : `print-hero.ts`.
- **R04 · Tour de purge inutile** → la retirer de la scène et des posters. Garder la masse de
  purge dans les statistiques (`computeStats`), c'est un vrai coût d'impression.
- **R05 · Message « Changement de filament → Blanc névé · couche 0541 » inutile** → le retirer
  (`src/components/home/hero-telemetry.tsx` et la clé de `messages/*/landing.json`).
- **R06 · Animations saccadées, notamment l'apparition des articles** (chapitre boutique).
  Le propriétaire précise qu'il n'y avait **aucun ralentissement** : la saccade est voulue par
  le code, pas un problème de performance. La révélation `.s3d-print` avance en
  **`steps(8, end)`** (`src/app/globals.css:297`), donc en 8 sauts visibles au lieu d'un
  glissement. Même cause au survol des cartes produit (`src/components/product-card.module.css:14`,
  `clip-path … steps(8, end)`). **Décision qui en découle : plus aucune animation par paliers
  sur le site** ; remplacer `steps(8, end)` par une courbe continue du système de mouvement
  (§3.2 du brief, par exemple la courbe de sortie de la marque). Si l'on veut garder l'idée des
  couches d'impression, la porter par un détail **statique** (un bord de découpe doux, de fines
  lignes de couche fixes) et jamais par un minutage en marches. Fin : la révélation et le survol
  glissent sans à-coup à 60 images/s, en mouvement complet ; rien ne change en mouvement réduit
  (déjà sans animation). Noter l'abandon des paliers au §3.2 et §3.4 du brief.
- **R14a · « Romanshorn » incompréhensible** (titre du chapitre 05 : « Livré de Genève à
  Romanshorn. ») → « Imprimé à Gland et à Pully. **Livré partout en Suisse.** » dans les 4
  langues (`messages/*/landing.json`, commentaire de `chapter-atelier.tsx`). Relire au passage
  les autres noms propres et le jargon visibles (gradins, pas, éclater, molasse…) et proposer
  des formulations plus simples là où le sens n'est pas évident.

### Transitions et défilement (tout le site)

- **R07 · Transition entre les pages saccadée** (« Coupe »). Même cause que R06, sans
  ralentissement : la nouvelle page « s'imprime » en **`steps(8, end)`**
  (`src/app/globals.css:432`, `s3d-print var(--dur-page) steps(8, end)`). Passer à une courbe
  continue (découpe de bas en haut qui glisse, éventuellement avec un léger fondu), même durée
  ou plus courte : règles `::view-transition-*` de `globals.css`, `src/components/ui/page-cut.tsx`,
  `site-link.tsx`. Fin : la transition glisse sans à-coup entre deux pages de `(site)` ; le retour
  arrière du navigateur reste sans animation ; le mouvement réduit reste sans animation.
- **R15 · Une navigation ne remet pas en haut de la page** → à l'arrivée sur une nouvelle page
  (pas une ancre), `scrollY` doit valoir 0. Piste : Lenis garde sa cible de défilement à travers
  la navigation ; dans `onRoute()` de `src/motion/runtime.tsx`, `lenis.scrollTo(0, { immediate:
true, force: true })` quand le chemin change sans ancre ; vérifier aussi hors `(site)` (sans
  Lenis) et en mouvement réduit, où le problème pourrait venir de la View Transition ou d'un
  `scroll={false}`. Fin : depuis le bas de `/fr`, un clic vers `/fr/shop` arrive en haut, dans
  les 3 modes (Lenis, natif, mouvement réduit), retour arrière compris (restauration native).
- **R16 · Les objets 3D sautent ou saccadent au défilement** → les vues du Stage (scissor) ont
  une image de retard sur le DOM : lire les rectangles dans la même frame, après `lenis.raf()`,
  ou calculer la position à partir de la valeur de défilement de Lenis plutôt que de rectangles
  mis en cache : `src/motion/stage/view-tracker.ts`, `loop.ts`, `ticker.ts`, `stage-root.tsx`.
  Fin : l'objet reste collé à son conteneur pendant un défilement rapide (souris, trackpad,
  tactile natif), mesuré par un écart DOM ↔ canvas ≤ 1 px image par image.

### Studio

- **R08 · Section « À régler au Studio. » de la boutique peu mise en valeur** →
  `src/components/catalog/studio-row.tsx` (`messages/*/catalog.json`, `studioRow`) : cartes plus
  grandes avec l'aperçu de l'objet (décision ci-dessus), titres « À personnaliser au Studio »,
  bouton « Personnaliser → ».
- **R09 · Icône du triangle pas top, aussi sur la page Studio** → remplacer l'icône par l'aperçu
  de chaque objet : posters SSR existants (`heroPoster`/posters Lavaux de `src/lib/studio/poster.ts`,
  `cartoucheTopView`/`reliefTopView`/`borneTopView` + `topViewToSvg`), sur la boutique et dans
  `src/components/studio/object-card.tsx` (index du Studio). Vérifier où d'autre l'icône sert
  (`src/components/ui/icons.tsx`).
- **R10 · L'aperçu 3D disparaît quand on fait défiler les réglages** (moitié gauche vide) →
  colonne de l'aperçu en `position: sticky` (sous le header, hauteur de la fenêtre moins le
  header) sur bureau : `src/components/studio/studio-app.tsx` et son CSS. Fin : à 1440 × 900,
  l'objet reste visible en faisant défiler toute la colonne des réglages.
- **R11 · Sélecteur de vue pas beau, pas cohérent avec le site ; « Éclater » devient
  transparent au clic** → reprendre le style des contrôles du site (primitive `Chip` /
  contrôle segmenté de `src/components/ui/`), renommer « 3/4 » en « 3D », et faire d'« Éclater »
  un vrai interrupteur (`aria-pressed`) avec un état actif lisible : `src/components/studio/view-switch.tsx`
  et les outils voisins.
- **R12 · Aperçu 3D de basse qualité** (facettes visibles sur Voronoï) → maillage d'affichage
  trop grossier ou palier C1 choisi à tort : après chaque geste, calculer dans le Worker un
  maillage plus fin (palier C2 ou proche de l'export) et l'échanger, normales lissées, DPR ≥ 1,5
  en C2, antialiasing : `src/motion/studio/geometry.worker.ts`, `engine.tsx`,
  `src/motion/stage/scenes/studio-object.ts`, niveaux de détail de `src/lib/studio/build.ts`.
  Fin : arêtes des cellules Voronoï lisses à 1440 px, glissé toujours ≤ 150 ms d'INP.
- **R17 · Studio sur mobile : l'aperçu 3D prend trop de place, la configuration est à
  l'étroit** → aperçu d'environ 40 % de la hauteur (réductible en bandeau collant), réglages sur
  le reste : `studio-app.tsx` et son CSS. Fin : à 375 × 812, au moins la moitié de l'écran pour
  les réglages, l'objet toujours visible.

### Favoris

- **R13 · Créations séparées des favoris par des onglets, boutons incohérents avec le site** →
  une seule liste avec un filtre (« Tout · Objets · Mes créations ») dans le style des puces du
  site : `src/app/[locale]/favorites/favorites-list.tsx`, `messages/*/system.json`.

### Technique, lié aux saccades

- **R18 · Coût du chemin WebGL au chargement** (TBT 2,6 à 5,7 s mesuré en rendu logiciel,
  `measures-wave2b.md`). **Sans lien avec les saccades R06/R07** : le propriétaire n'a constaté
  aucun ralentissement sur son matériel. Reste un point de mesure, pas un défaut : prendre un
  Lighthouse mobile sur un vrai téléphone, et seulement s'il confirme un TBT élevé,
  `renderer.compileAsync` avant le premier rendu (`print-hero.ts`, `studio-object.ts`) et
  montage du Stage après `load` + `requestIdleCallback` (`src/components/site-shell.tsx`).

## Découpage proposé pour la vague R1 (après le 07.10)

Trois agents parallèles, propriété disjointe, puis une vérification de production, un push sur
la preview et une nouvelle revue du propriétaire :

1. **Accueil** : R01 à R05, R14a.
2. **Studio** : R08 à R12, R17 (avec `catalog/studio-row.tsx` pour R08).
3. **Socle** : R06 et R07 (les `steps(8, end)` de `globals.css` et de `product-card.module.css`),
   R13, R15, R16, R18, et le vocabulaire « Personnaliser » dans les namespaces
   communs (`shell`, `system`, `quote`), les autres textes allant à leur propriétaire (landing à
   l'accueil, catalog et studio au Studio).

## Suivi R1 · Socle (07.10.2026)

Branche `claude/redesign-2026--r1-base`. Mesures faites avec Edge sur GPU (CDP : marqueurs peints
dans le canvas du Stage, images du compositeur, écart DOM ↔ canvas par image).

| Point                                            | État                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Personnaliser » (shell, system, quote)         | Fait dans les 4 langues. « Régler », « Réglez », « réglable » n'existent plus dans ces trois namespaces (le seul « réglé » restant est « Montant réglé », sur un ticket de caisse).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R06 · révélation `.s3d-print`, survol des cartes | Fait. `steps(8, end)` remplacé par `var(--ease-strate)` (`globals.css`, `product-card.module.css`). Vérifié dans le navigateur : les images-clés de la révélation portent `cubic-bezier(0.16, 0.84, 0.3, 1)`. Mouvement réduit : `animation-name: none`. Le survol de la 2ᵉ photo n'a pas pu être vu en direct (les produits de la preview n'ont qu'une image) ; la règle CSS servie est lue et ne contient plus de paliers.                                                                                                                                                                                                                                                                         |
| R07 · transition « Coupe »                       | Fait. `::view-transition-new(.s3d-coupe)` : 480 ms, images-clés `inset(100% 0 0 0)` → `inset(0)` en `cubic-bezier(0.16, 0.84, 0.3, 1)`. Le retour arrière ne déclenche aucune View Transition ; en mouvement réduit les durées sont à 0. Abandon des paliers noté au brief §3.1, §3.2, §3.4 ; `s3d.pas` reste enregistré comme alias de `s3d.strate` (une chorégraphie de l'Atelier l'appelle encore).                                                                                                                                                                                                                                                                                               |
| R13 · Favoris                                    | Fait. Une seule liste, filtre « Tout · Objets · Mes créations » en `ChipRadio` (puces du site), une même grille pour les deux sortes de cartes, étiquette « Création » sur la vignette, états vides par filtre. Vérifié avec des données semées (2 objets, 2 créations) dans les 4 langues, filtres et états vides compris.                                                                                                                                                                                                                                                                                                                                                                          |
| R15 · retour en haut de page à la navigation     | Fait. Cause : Next remet bien `scrollTop` à 0, mais ScrollTrigger gardait en cache la position d'avant la navigation (4 769 px par exemple) et la RESTAURAIT à chaque `refresh()` (mesuré : `scrollTo(0, 4769)`), si bien que la page d'arrivée s'ouvrait en bas, bornée à sa hauteur (accueil → Studio « Lavaux », page de 4 321 px : arrivée à 3 521). Correctif : `MotionRuntime.onRoute()` coupe l'interpolation de Lenis et réaligne ScrollTrigger sur la position réelle avant son refresh. Vérifié en Lenis, en natif et en mouvement réduit, depuis `(site)` et depuis une page légale : arrivée à 0, retour arrière restauré à quelques pixels près (l'inertie de Lenis au moment du clic). |
| R16 · objets 3D qui sautent au défilement        | Fait au palier C1 (tactile natif) ; limite connue au clavier et à la barre de défilement en C2. Voir ci-dessous.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| R18 · coût du chemin WebGL                       | Pas touché : attend la mesure sur un vrai téléphone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**R16 en détail.** L'hypothèse du retour (« une image de retard sur Lenis ») ne se vérifie pas : à
la molette, avec Lenis, l'écart DOM ↔ canvas est de 0,4 à 0,6 px au plus (accueil, héros épinglé
compris, et page Studio), parce que Lenis, le tracker et le Stage partagent la même frame. Ce qui
sépare le canvas de son conteneur, c'est le défilement **natif** (tactile, clavier, barre de
défilement) : le compositeur avance le DOM sans attendre le fil principal, et un canvas `fixed`
montre l'objet une ou deux frames plus tard. Mesuré au clavier, canvas fixe : jusqu'à 16 px
d'écart, 53 images sur 56 au-dessus de 1 px. Correctif au palier C1 : le canvas est ancré au
document (calque absolu rogné de la hauteur de la page, canvas de deux fenêtres de haut recalé à
chaque frame, `stage/stage-root.tsx`, `ticker.ts`, `loop.ts`, `view-tracker.ts`) ; il défile avec le
DOM côté compositeur. Mesuré : 0,8 px au clavier, 0,3 px au tactile (glissé rapide) et à la
molette, aucune image au-dessus de 1 px. Une vue « live » (Studio collant sur grand écran) garde
un canvas fixe. C2 ne change pas (le canvas ancré y coûterait trop de mémoire GPU avec
l'antialiasing) : au clavier et à la barre de défilement l'écart natif y subsiste, limite à
accepter ou à traiter par Lenis (touches) si le propriétaire le constate.

**À reprendre par d'autres paquets** (fichiers hors du socle) : `print-hero.ts` fait encore avancer
la vague de couleur en 30 paliers (`pas(30)`, lignes 113 et 759) : c'est un minutage par paliers,
à passer en courbe continue pour respecter la décision du propriétaire ; `choreo/about.tsx:121`
appelle `s3d.pas` (alias continu, à renommer en `s3d.strate`) ; le commentaire de
`checkout/success/page.tsx:76` parle encore de « 8 paliers ».

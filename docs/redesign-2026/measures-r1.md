# Vague R1 · Vérification et mesures

Vérification de la branche `claude/redesign-2026--verify-r1` : fusion des trois paquets de la
vague R1 (socle `r1-base`, accueil `r1-home`, Studio `r1-studio`) dans `claude/redesign-2026`
(`8afa945`), un correctif d'intégration (`4b2ad7f`), puis build OpenNext, preview de
production locale et contrôle de chaque point R01 à R18 de `retours-j1-j2.md`.
**08.10.2026**, worktree isolé, rien poussé. Base de comparaison : `measures-wave2b.md`
(Worker 3 326,10 KiB), brief §4.11.

Ce document s'écrit au fil des étapes : chaque section est commitée dès que sa mesure est faite.

## Résumé

| Critère                                                                                     | Résultat                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fusions des trois lots                                                                      | **propres**, aucun conflit                                                                                                                                                            |
| Lint, typecheck, tests, format                                                              | **verts** (856 tests passés, 15 ignorés sans URL de base, 65 fichiers)                                                                                                                |
| Worker gzip (dossier de 41 caractères)                                                      | **3 333,45 KiB** (vague 2b : 3 326,10 ; +7,35) : au-dessus de la cible WP-99 (≈ 3 250), plafond Cloudflare 10 MiB non menacé                                                          |
| 0 signature three / gsap / lenis dans le Worker                                             | **0**                                                                                                                                                                                 |
| 18 URL : 0 CSP, 0 hydratation, 0 MISSING_MESSAGE, 0 4xx inattendu, un contexte WebGL vivant | **0 / 0 / 0 / 0 / 1 au plus** ; clair, sombre et mouvement réduit ; 4 langues ; journal du serveur sans erreur ni 5xx                                                                 |
| Plus aucun `steps(` ; révélation, « Coupe » et survol continus                              | **oui** (0 dans `src` hors un commentaire, 0 dans le CSS et le JS construits) ; courbe `cubic-bezier(0.16, 0.84, 0.3, 1)`, 480 ms ; retour arrière et mouvement réduit sans animation |
| `scrollY` = 0 après navigation, retour restauré                                             | **oui** : Lenis, natif, mouvement réduit, mobile ; retour exact (8 274 → 8 274 px)                                                                                                    |
| Écart DOM ↔ canvas ≤ 1 px par image                                                         | **oui à la molette** (0,6 px `/fr`, 0 px Studio collant) et en C1 (0,2 à 0,6 px) ; **non au clavier et à la barre de défilement en C2 (10,4 px)** : limite connue, voir §6            |
| Héros : pas d'anneaux, silhouette discrète, pas de tour de purge, pas de message filament   | **oui** ; la silhouette apparaît en fondu continu avec les premières couches (C1 et C2)                                                                                               |
| Studio : colonne collante, vue « 3D », Éclater, Voronoï lisse, mobile 40 %                  | **oui** ; maillage fin en ≈ 1,9 s sous la CSP de production ; INP du glissé 80 à 96 ms à CPU × 4                                                                                      |
| Cartes avec aperçu (boutique, index du Studio) ; favoris filtrés                            | **oui**                                                                                                                                                                               |
| « Personnaliser » partout ; « Romanshorn » disparu                                          | **oui** dans le HTML servi des 4 langues (0 reste de « Régler » et équivalents)                                                                                                       |
| R18 (coût du chemin WebGL)                                                                  | **non traité**, attend une mesure sur un vrai téléphone                                                                                                                               |

**Verdict** : la vague R1 est intégrée et conforme à ce que les retours demandaient, **sauf**
(a) le défilement natif au clavier et à la barre de défilement en C2, limite connue du lot socle
qui reste à trancher par le propriétaire, (b) R18, (c) la cible de taille du Worker, qui relève
de WP-99. Rien de ce qui a été mesuré ici ne bloque une revue du propriétaire sur la preview.

## 1. Fusions et portes

| Fusion                                                                                                                                                                                             | Commit    | Conflits                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------- |
| `claude/redesign-2026--r1-base` (socle)                                                                                                                                                            | `be6ef73` | **aucun** (fusion `--no-ff` propre, `git diff-tree --cc` vide) |
| `claude/redesign-2026--r1-home` (accueil)                                                                                                                                                          | `c241ded` | **aucun**                                                      |
| `claude/redesign-2026--r1-studio` (Studio)                                                                                                                                                         | `93399ab` | **aucun**                                                      |
| Intégration : clé orpheline `studioCore.bands.change` (R05) retirée des 4 langues et de `studio-core-messages.test.ts` ; derniers « adjust » des surfaces agents (`llms.txt`, `configure-tool.ts`) | `4b2ad7f` | sans objet                                                     |

La propriété disjointe des trois lots a tenu : aucun fichier modifié des deux côtés. Les
points de contact signalés par les rapports se vérifient : `object-poster.tsx` (boutique et
index du Studio) lit toujours `getHeroPoster("final")` après le renommage « ghost » → « plate »
de l'accueil (les cartes affichent le vase, 76 tracés) ; le lot Studio a passé l'accroche de
Lavaux à « personnaliser » et le lot socle la devise du pied de page (« Personnalisez-le. On
l'imprime. »).

Portes (08.10.2026, `bun install` à neuf, 523 paquets), rejouées après les derniers correctifs
(§7) :

| Porte                  | Résultat                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| `bun run lint`         | **0 erreur**                                                         |
| `bun run typecheck`    | **0 erreur**                                                         |
| `bun run test`         | **856 passés**, 15 ignorés (sans URL de base), 65 fichiers, 1 ignoré |
| `bun run format:check` | **propre** (717 fichiers)                                            |

## 2. Build OpenNext et Worker

`bunx opennextjs-cloudflare build` : réussi (webpack, 32 pages statiques). Outils : Bun 1.4.2,
Next 16.3.6, `@opennextjs/cloudflare` 1.20.6, Node 26.8, Edge headless pour les essais.

| Mesure                                                 | Valeur                                                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Worker gzip, dossier de 41 caractères** (comparable) | **3 333,45 KiB** (`Total Upload` brut 16 986,52 KiB)                                                                       |
| Worker gzip, worktree (chemin de 77 caractères)        | 3 329,23 KiB (brut 17 259,49 KiB)                                                                                          |
| Vague 2b (41 caractères, base de comparaison)          | 3 326,10 KiB                                                                                                               |
| Écart R1 − vague 2b                                    | **+7,35 KiB** (répartition par lot non mesurée)                                                                            |
| Cible WP-99 (AGENTS.md règle 10)                       | ≈ 3 250 KiB : **non atteinte, WP-99 reste à faire** ; plafond Cloudflare 10 MiB non menacé                                 |
| `bun scripts/check-worker-bundle.ts`                   | **0 signature** three / gsap / lenis (1 582 fichiers dans le worktree), aussi dans le dossier de 41 caractères             |
| Chunks client (`chunk-report.ts`)                      | 209 chunks, 1 220,3 KiB gzip ; moteurs : three 83,4 + 65,6 + 8,1, gsap 27,8 + 19,5, lenis 7,0 KiB, tous hors du JS initial |
| JS initial `/fr` (accueil)                             | **194,1 KiB** gzip (vague 2b : 194,2) ; boutique 187,7 ; Studio index 189,4 ; **Studio objet 304,2** (302,7)               |

Le chemin de build change le gzip de ≈ 4 KiB (ici le dossier de 41 caractères pèse plus, 3 333,45
contre 3 329,23 pour le même code) : ne comparer que des chiffres de même longueur de chemin. Le
dossier `C:\s3d-matched-path-w2a-0123456789abcdefg` a été synchronisé par `robocopy` depuis le
worktree (même `package.json` et `bun.lock`, `node_modules` réutilisé) et reconstruit avec son
cache `.next` (78 s).

## 3. Preview de production : 18 URL

`bunx opennextjs-cloudflare preview -- --upstream-protocol https --port 8794 --inspector-port 9334`,
Edge headless piloté en CDP (port 9354, profil dédié, WebGL sur GPU réel via `--use-angle=d3d11`
sauf mention, consentement non donné), base Neon de la branche `preview`, clés de test, `RESEND_API_KEY`
vide. Crochets injectés avant la page : compte des contextes WebGL (créés et vivants), événements
`securitypolicyviolation`, erreurs et rejets.

| URL (thème clair)                                                                    | Statut | CSP | Hydratation | MISSING_MESSAGE | Contextes WebGL (créés / vivants) | Autre                                                                             |
| ------------------------------------------------------------------------------------ | ------ | --- | ----------- | --------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| `/fr`, `/de`                                                                         | 200    | 0   | 0           | 0               | 2 / 1                             |                                                                                   |
| `/fr/studio` (index)                                                                 | 200    | 0   | 0           | 0               | 1 / 0                             |                                                                                   |
| `/fr/studio/lavaux`, `cartouche`, `relief`, `borne`                                  | 200    | 0   | 0           | 0               | 2 / 1                             |                                                                                   |
| `/fr/shop`, `/fr/products/vase-spirale`, `/fr/custom`, `/fr/a-propos`, `/fr/contact` | 200    | 0   | 0           | 0               | 1 / 0                             |                                                                                   |
| `/fr/cart`, `/fr/checkout`, `/fr/favorites`, `/fr/account/login`, `/fr/legal/terms`  | 200    | 0   | 0           | 0               | 0 / 0                             | `/fr/checkout` : 49 messages Stripe attendus en local (http, Tracking Prevention) |
| `/fr/page-inconnue-xyz`                                                              | 404    | 0   | 0           | 0               | 0 / 0                             | le seul 4xx, attendu                                                              |

Deuxième et troisième passes : thème sombre sur `/fr`, `/fr/studio`, `/fr/studio/lavaux`,
`/de/studio/relief`, `/it`, `/en/shop`, et mouvement réduit sur `/fr`, `/fr/studio`,
`/fr/studio/lavaux`, `/fr/shop` : **0 CSP, 0 hydratation, 0 MISSING_MESSAGE, 0 4xx**, pas de
défilement horizontal. Le journal du serveur (921 requêtes) ne contient que ce 404. Un
contexte WebGL « créé » de plus que « vivant » est la sonde de capacité, libérée aussitôt ;
**un seul contexte est vivant à la fois**, y compris au fil d'une navigation côté client
accueil → Studio → objet → boutique → accueil → objet → retour → favoris → Studio (le canvas est
monté et démonté avec les pages qui portent une vue, 0 erreur, 0 CSP). Lenis et le canvas du
Stage n'existent que dans le groupe `(site)` : `html.lenis` sur `/fr`, shop, studio, custom,
a-propos, contact ; aucun sur cart, checkout, favorites, account, legal, track ni la 404.
En mouvement réduit, l'accueil n'a pas de canvas (poster statique) ; le viewer du Studio garde le sien.

## 4. Les points R01 à R18

| Point                                      | État                                                     | Preuve de la vérification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Personnaliser » (verbe du Studio)        | **fait**                                                 | HTML servi (texte visible et charge utile RSC) de 17 pages dans les 4 langues : 0 « Régler / Réglez / réglable », « einstellen / einstellbar », « regola / regolabile », « adjust / adjustable ». Les correspondances restantes sont sans rapport (clé `adjust` d'un message dont le texte est « Customise », « réglages » de l'écran de l'imprimante, « regolare » = régulière, « regola » = règle d'un article de loi, « adjust quantities » d'une erreur de stock). 202 / 123 / 125 / 145 occurrences de « Personnaliser » et dérivés (fr / de / it / en). `/llms.txt` : « customisable ». |
| R01 · anneaux gris                         | **fait**                                                 | Planches d'images du héros en clair et en sombre : silhouette pleine très discrète (7,5 % clair, 10 % sombre), aucun trait au-dessus de la couche en cours, poster SSR puis canvas à la même place (grille et plateau superposés). Le poster ne contient plus de « ghost » à 75 ellipses.                                                                                                                                                                                                                                                                                                     |
| R02 · intro qui « bug »                    | **fait**                                                 | Pixel dans la silhouette suivi image par image : 0 avant l'impression, puis 1 niveau (sur 16) par image au plus, montée continue en ≈ 540 ms au palier C2 (1 648 → 2 184 ms) et ≈ 270 ms en C1 (1 562 → 1 833 ms), en même temps que les premières couches. **Observation** : la première couche (le disque du fond du vase) apparaît en une image, c'est la nature d'un départ d'impression, pas la silhouette.                                                                                                                                                                              |
| R03 · tête d'impression                    | **fait**                                                 | Vue sur les planches (échelle réduite) : bloc graphite, un liseré rouge, discrète ; elle arrive sur le plateau avant la première couche. Le gros plan a été validé par le lot Accueil.                                                                                                                                                                                                                                                                                                                                                                                                        |
| R04 · tour de purge                        | **fait**                                                 | Aucune tour sur les planches ; `src` ne contient plus que `purgeGrams` (statistiques) ; test `hero-data.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| R05 · message « Changement de filament »   | **fait**                                                 | 0 occurrence dans le DOM et dans la charge utile RSC des 4 langues (`/`, `/shop`, `/studio`, objets…) ; clé orpheline retirée (`4b2ad7f`).                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| R14a · « Romanshorn »                      | **fait**                                                 | DOM vivant, titre du chapitre 05 : « Imprimé à Gland et à Pully. Livré partout en Suisse. » (fr), « Gedruckt in Gland und Pully. Geliefert in die ganze Schweiz. » (de), « Stampato a Gland e Pully. Consegnato in tutta la Svizzera. » (it), « Printed in Gland and Pully. Delivered across Switzerland. » (en). 0 « Romanshorn » dans les 4 langues.                                                                                                                                                                                                                                        |
| R06 · révélation et survol sans saccade    | **fait**                                                 | Voir §5.1. `steps(` : 0 dans `src` (un commentaire de `product-card.module.css:3`), 0 dans les 8 fichiers CSS et dans tout le JS de `.next/static`, 0 dans `public/`.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| R07 · transition « Coupe »                 | **fait**                                                 | Voir §5.1 : 480 ms, `cubic-bezier(0.16, 0.84, 0.3, 1)`, progression monotone, plus grand saut 0,05 (≈ 24 ms, une image tombée) au GPU ; aucune transition au retour arrière ; durées 0 en mouvement réduit.                                                                                                                                                                                                                                                                                                                                                                                   |
| R15 · retour en haut                       | **fait**                                                 | Voir §5.2 : arrivée à 0 et reste à 0 pendant 3,5 s, dans 3 modes et en mobile ; retour restauré exactement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| R16 · objets 3D collés au défilement       | **partiel**                                              | Voir §5.3 : molette et tactile conformes (≤ 0,6 px) ; clavier et barre de défilement en C2 : jusqu'à 10,4 px (limite du lot socle, à trancher).                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| R08 · cartes « À personnaliser au Studio » | **fait**                                                 | Voir §5.4 : 4 cartes avec l'aperçu de chaque objet, titre « À personnaliser au Studio. », bouton « Personnaliser → » (4 langues), tailles 316 px à 1440, 461 à 1024, 343 à 375, aucun défilement horizontal.                                                                                                                                                                                                                                                                                                                                                                                  |
| R09 · icône du triangle                    | **fait**                                                 | Vase = poster, sous-verre = image statique, carte et porte-nom = SVG ; 0 triangle (`anyTriangleIcon` faux) sur la boutique et l'index du Studio, 1440 / 1024 / 768 / 375 px.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R10 · aperçu collant                       | **fait**                                                 | À 1440 × 900, de 400 à 1 600 px de défilement : haut du bloc à 88 px, hauteur 676, bas à 764 px (< 900), taille constante ; il quitte la fenêtre seulement à la fin de la colonne des réglages (3 000 px).                                                                                                                                                                                                                                                                                                                                                                                    |
| R11 · sélecteur de vue et « Éclater »      | **fait**                                                 | Segmenté « 3D · Plan · Élévation · Couches » (aucun « 3/4 »), le bloc de style des puces du site. « Éclater » : `aria-pressed` bascule, actif = fond crème et texte sombre, y compris la souris partie ; second clic = inactif.                                                                                                                                                                                                                                                                                                                                                               |
| R12 · qualité de l'aperçu 3D               | **fait**, hors « DPR ≥ 1,5 en C2 » (optionnel, non fait) | `data-mesh-lod` : `display` à ≈ 1,0 s puis `fine` à ≈ 1,9 à 2,0 s, **sous la CSP de production** (le second Worker démarre) ; cellules Voronoï lisses sur la capture. **INP** (voir §5.5) : plus lente interaction 80 à 96 ms à CPU × 4 (24 ms sans limitation), 20 crans du curseur Hauteur sans événement de plus de 16 ms.                                                                                                                                                                                                                                                                 |
| R17 · Studio mobile                        | **fait**                                                 | 375 × 812 : colonne d'aperçu 273 px = 40 % du bloc (la toile 237 px), réglages 409 px = **50,4 %** de l'écran, barre d'action en bas, poignée « Réduire l'aperçu » (`aria-expanded`), pas de défilement horizontal.                                                                                                                                                                                                                                                                                                                                                                           |
| R13 · favoris                              | **fait**                                                 | Une liste, puces « Tout · Objets · Mes créations » (de : Alle · Objekte · Meine Kreationen) : 4 / 2 / 2 / 4 cartes selon le filtre, « Tout ajouter au panier » seulement pour les objets, états vides par filtre avec « Personnaliser un objet » ; liste vide à 390 px.                                                                                                                                                                                                                                                                                                                       |
| R18 · coût du chemin WebGL                 | **non traité**                                           | Attend un Lighthouse mobile sur un vrai téléphone ; aucune mesure ici (GPU de bureau).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### 5. Détail des mesures

#### 5.1 Révélation, « Coupe », survol

- Page À propos (10 éléments `.s3d-print`) et boutique (6) : `animation-timing-function` calculée
  `cubic-bezier(0.16, 0.84, 0.3, 1)`, animation `s3d-print` pilotée par `view()` ; les images-clés
  portent la même courbe (`inset(100% 0 0)` → `inset(0)`). Pendant un défilement lent, le `clip-path`
  d'un élément passe de 2,47 % à 0 % en quatre images (1,02 %, 0,29 %, 0,02 %) : glissement,
  pas de marche. Chapitre « Atelier » : `s3d-rise` est linéaire (pas de palier).
- « Coupe » accueil → boutique (GPU réel) : `::view-transition-new(.s3d-coupe)`, 480 ms, mêmes
  images-clés, 58 échantillons de progression 0 → 1, monotone, plus grand saut 0,05 ; `nav-mark` 280 ms.
  Au retour arrière : **0** animation de transition.
- Mouvement réduit : `animation-name: none`, `clip-path: none`, durées de la transition de page à 0,
  aucune animation `.s3d-coupe`.
- Survol de la deuxième photo des cartes produit : règle servie lue dans le CSS construit,
  `transition: clip-path var(--dur-page) var(--ease-strate)`. Aucun produit de la preview n'a de
  deuxième image, le survol n'a donc pas été vu en direct (comme dans le rapport du lot socle).
- `s3d.pas` : le dernier appelant (`choreo/about.tsx:121`) passe à `s3d.strate` (correctif §7).

#### 5.2 Retour en haut de page (R15)

Depuis le bas de `/fr` (clic sur un lien du pied de page, 3,5 s de `scrollY` échantillonné à
chaque image), puis `history.back()` :

| Mode                              | Cible                    | Arrivée | Maximum pendant 3,5 s | Retour arrière         |
| --------------------------------- | ------------------------ | ------- | --------------------- | ---------------------- |
| Lenis, molette                    | `/fr/shop`, `/fr/studio` | 0       | 0                     | 8 274 → 8 274          |
| Mouvement réduit (natif)          | `/fr/shop`, `/fr/studio` | 0       | 0                     | 6 834 → 6 834          |
| `window.scrollTo` (Lenis présent) | `/fr/shop`, `/fr/studio` | 0       | 0                     | 8 274 → 8 274          |
| Mobile 375 × 812 (tactile émulé)  | `/fr/shop`, `/fr/studio` | 0       | 0                     | 10 679 / 10 709 exacts |

#### 5.3 Écart DOM ↔ canvas (R16)

Marqueurs de couleur peints dans le canvas ; image par image, position du marqueur dans les
images du compositeur (screencast) comparée à celle que le DOM (`scrollOffsetY` des métadonnées)
prédit. Un écart de 1 px correspond à ce que l'œil perçoit comme un saut.

| Palier | Page et geste                                | Images comparées | Écart maximal | Images > 1 px |
| ------ | -------------------------------------------- | ---------------- | ------------- | ------------- |
| C2     | `/fr`, molette (Lenis), 2 300 → 4 100 px     | 34               | **0,6 px**    | 0             |
| C2     | `/fr/studio/lavaux`, molette, 100 → 1 660 px | 180              | **0 px**      | 0             |
| C2     | `/fr`, **clavier** (flèches), 2 300 → 3 900  | 127              | **10,4 px**   | **109**       |
| C1     | `/fr`, glissé tactile, 300 → 960 px          | 57               | **0,2 px**    | 0             |
| C1     | `/fr`, clavier, 300 → 1 220 px               | 39               | **0,6 px**    | 0             |
| C1     | `/fr/studio/lavaux`, molette                 | 193              | **0 px**      | 0             |

Position du canvas : C2 `fixed` (1 440 × 900) ; C1 `absolute` dans un calque de la hauteur de la page,
canvas de deux fenêtres de haut (1 425 × 1 800), sans allonger la page ; **Studio en C1** (4 cœurs,
1 440 et 1 024 px de large) : calque `fixed`, donc canvas immobile devant la vue collante, 0 px d'écart.

#### 5.4 Héros

Planches de 8 instants (700 ms à 7 s), clair et sombre : plateau du poster jusqu'à ≈ 1,7 s, tête
d'impression sur le plateau, silhouette qui monte en fondu avec la première couche (disque bleu),
vase imprimé de bas en haut sans anneau, sans tour de purge, sans message. En mouvement réduit et
sombre : poster final (vase imprimé, « Couche 0750 / 0750 »). Le fondu de la silhouette est
mesuré sur un pixel de l'intérieur du vase : 0 → 16 niveaux sans saut supérieur à 1 niveau
par image (C1 et C2). Une mesure grossière de « surface modifiée » est trompeuse ici (elle
franchit son seuil d'un coup à 15 niveaux) : elle ne signale pas d'apparition brusque.

#### 5.5 Studio

- Bureau 1440 × 900 (`?m=voronoi`) : vues « 3D / Plan / Élévation / Couches » ; le bloc collant
  garde `top` 88 px ; `data-mesh-lod` `null → display (≈ 1,1 s) → fine (≈ 2,0 s)`, 0 CSP, 0 erreur,
  1 contexte vivant.
- Mobile 375 × 812 (DPR 2, tactile émulé) : voir R17.
- **INP du glissé de la hauteur** (production, GPU réel, React de production, 20 crans de 150
  à 219 mm, maillage fin chargé) : à CPU × 4, plus lente interaction **80 à 96 ms** (le
  départ du glissé, `gotpointercapture`), les autres < 24 ms ; à CPU × 1, 24 ms. Aucun
  `pointermove` ne dépasse le seuil de 16 ms de l'API Event Timing. Image longue maximale (LoAF) :
  60 à 75 ms. **Critère ≤ 150 ms rempli**, avec les réserves de la section 8 (une machine, un GPU).
- Cartes du Studio (boutique et index) : voir R08, R09.

## 6. Problèmes ouverts

| #   | Problème                                                                                                                                                                                                                                                                                          | Où                                                                                            | Correctif recommandé                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **R16, C2 : au clavier et à la barre de défilement, le canvas retarde sur le DOM** (jusqu'à 10,4 px, 109 images sur 127 au-dessus de 1 px). À la molette et au trackpad (Lenis), 0,6 px au plus : si le propriétaire défile ainsi, il ne le verra pas ; au clavier ou en tirant l'ascenseur, oui. | `src/motion/stage/stage-root.tsx:186-187` (`capability === 1 ? mountAnchored(canvas) : null`) | Décision du propriétaire : soit faire gérer les touches (flèches, Espace, Pages, Début/Fin) par Lenis dans `src/motion/runtime.tsx` (risque d'accessibilité avec les widgets à flèches), soit ancrer aussi le canvas en C2 avec un plafond de DPR à 1,5 (le calque de 2 fenêtres de haut coûte de la mémoire GPU avec l'antialiasing). |
| 2   | **Taille du Worker au-dessus de la cible** : 3 333,45 KiB pour une cible de ≈ 3 250 (+7,35 depuis la vague 2b). La répartition par lot n'a pas été mesurée ; `src/lib/studio/poster.ts` a grossi (poster « plate ») alors que `home-data.generated.ts` a perdu 461 lignes.                        | `AGENTS.md` règle 10, brief §4.11                                                             | WP-99 (zod/mini, pas de copie RSC/SSR en double de `src/lib/studio/**`, messages du Studio par langue) ; remesurer dans un dossier de 41 caractères.                                                                                                                                                                                   |
| 3   | **R12, DPR plancher 1,5 en C2 non fait** : sur un écran à DPR 1 la toile du Studio reste à 1:1 (antialiasing MSAA × 4 actif).                                                                                                                                                                     | `src/motion/stage/stage.ts:78` (`pixelRatioFor`, `min(devicePixelRatio, 2)`)                  | Optionnel : `max(dpr, 1.5)` pour la scène `studio-object` en C2 (coût 2,25 × en pixels) ; à décider avec la décision 1.                                                                                                                                                                                                                |
| 4   | **R18 non traité** (TBT 2,6 à 5,7 s mesuré en rendu logiciel en vague 2b). Les mesures ci-dessus sont sur un GPU de bureau : elles ne disent rien du téléphone.                                                                                                                                   | `print-hero.ts`, `studio-object.ts`, `src/components/site-shell.tsx`                          | Un Lighthouse mobile sur un vrai téléphone ; seulement s'il confirme un TBT élevé, `renderer.compileAsync` avant le premier rendu et montage du Stage après `load` + `requestIdleCallback`.                                                                                                                                            |
| 5   | **Non testé hors Edge/Chromium** : canvas ancré en C1 (`overflow: clip`, `lvh`, `translate3d`, rubber-band) sur Safari iOS, Firefox. Le survol de la deuxième photo des cartes n'a pas été vu en direct (aucun produit de la preview n'a de 2e image).                                            | `src/motion/stage/stage-root.tsx:78` (`mountAnchored`), `product-card.module.css:14`          | Un passage sur un iPhone avant la mise en production ; ajouter une 2e image à un produit de démonstration pour voir le survol.                                                                                                                                                                                                         |
| 6   | Reliquats sans effet : `pas()` et l'alias `s3d.pas` de `gsap.ts` n'ont plus d'appelant ; commentaire périmé « anneaux fantômes » (le matériau sert toujours la silhouette).                                                                                                                       | `src/motion/gsap.ts:31`, `src/motion/stage/materials/print-material.ts:75`                    | À retirer lors de WP-99 (déjà inoffensif).                                                                                                                                                                                                                                                                                             |

## 7. Correctifs faits pendant la vérification

- `src/motion/choreo/about.tsx:121` : `ease: "s3d.pas"` → `"s3d.strate"` (même courbe, `s3d.pas` était
  déjà un alias) ; commentaire de `src/motion/gsap.ts` et de `checkout/success/page.tsx:76` (« 8 paliers »)
  mis à jour (`a193169`). **Ces trois retouches ont été faites après le build mesuré ci-dessus** : sans
  effet sur le comportement (alias de la même courbe, commentaires), non reconstruit.
- `AGENTS.md` règle 10 : taille du Worker remesurée (3 333 KiB, 08.10.2026).
- Les surfaces agents (`/llms.txt`, MCP, A2A) ne contiennent plus de « adjust » ni de « régler » ;
  `/llms.txt` dit « customisable ».

## 8. Environnement et réserves

- **Preview locale instable par le DNS.** Le serveur DNS local (192.168.0.25) échoue par moments
  (`getaddrinfo ENOTFOUND` sur l'hôte Neon ou `api.cloudflare.com`) et l'erreur non gérée du
  proxy Hyperdrive local de miniflare tue `opennextjs-cloudflare preview` (quatre arrêts en 25
  minutes, sans lien avec le code). Parade, uniquement pour les essais : un `NODE_OPTIONS=--require`
  qui garde chaque résolution réussie et la retente trois fois, plus une boucle de relance. Aucun
  réglage du système ni du dépôt n'a été touché.
- **GPU réel** (RTX 5070, Edge `--use-angle=d3d11`) pour toutes les mesures de mouvement et d'INP ;
  le rendu logiciel (SwiftShader) donne des images à ≈ 2 images par seconde et n'est pas
  représentatif (la « Coupe » n'y compte que 4 images).
- Une machine de bureau puissante : les paliers de capacité (C1 émulé avec
  `hardwareConcurrency = 4`) ne remplacent pas un téléphone.
- Captures : 9 sur 10 (planches du héros clair et sombre, Studio bureau clair et sombre, Studio
  mobile, boutique ×3 dont deux inutilisables (découpe mal placée), accueil sombre en mouvement
  réduit).
- Rien n'a été poussé ; le worktree et les ports (3144, 8794, 9334, 9354) sont libérés en fin de passe.

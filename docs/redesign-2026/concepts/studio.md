# Concept n° 3 — « Studio » : tout se règle, tout s'imprime

> Directeur artistique n° 3, 27.09.2026. Axe : **la personnalisation d'abord**. Sources : `research/*.md`,
> `AGENTS.md`, `docs/refonte-plateforme-2026.md`. Chiffres de contraste calculés (WCAG 2.x), budgets à
> mesurer sur prototype.

## 1. Nom et thèse

**Studio.** Le site ne _montre_ pas des objets. Il les **règle devant vous**, puis les envoie à l'atelier.
La scène d'accueil est un vrai configurateur en direct. Le vase qu'on y voit est le nôtre, il est
paramétrique et on le modifie au scroll. Chaque état naît du précédent : un motif devient un autre motif,
la couleur monte le long des couches, le vase se défait en filament qui se redépose en carte de visite
portant _votre_ nom.

Pourquoi c'est juste pour cette marque, et pas du « motion slop » :

- **La vérité du sujet.** Une impression FDM empile des couches de 0,2 mm et change de couleur à une
  hauteur donnée. Notre mouvement _est_ ce procédé : quantification par couche, bandes de couleur,
  dépôt par strates. Le mark (pic alpin, 6 strates) dit déjà la même chose.
- **N = 1 n'est plus un problème.** Le catalogue vivant, ce sont 4 objets procéduraux infinis. Le Vase
  spirale de Ian reste une vitrine honnête : montré, tourné, jamais modifié.
- **Personne ne le fait.** Gantri, Nagami et Zellerfeld n'ont aucun WebGL ; les configurateurs primés
  (Qudrix, Scout, iyO) vendent des voitures et des cabanes.
- **Ce qu'on garde de « La Forge »** : le sur-mesure comme outil plutôt que formulaire, l'attente
  narrée, _prix ferme ou indicatif_, le coût de purge affiché, « le serveur ne croit jamais le prix
  client », un seul CTA rouge par écran, les interdits (compte à rebours, faux « 3 personnes
  regardent », carrousels auto). **Reporté** : l'analyse de fichiers (`/forge`), `/matieres`, `/pro`.
  Le Studio est la Forge _de nos objets_ ; le fichier du client passe toujours par `/custom`. La double
  intention devient trois temps : **Régler**, **Acheter**, **Envoyer un fichier**.

## 2. Direction artistique

### 2.1 Palette (noms des jetons conservés : c'est un contrat avec 116 fichiers, dont l'admin)

| Jeton                             | Clair                       | Sombre          | Contraste (texte sur `paper`)               |
| --------------------------------- | --------------------------- | --------------- | ------------------------------------------- |
| `paper`                           | `#F7F4EF` papier chaud      | `#0E0C0B` encre | —                                           |
| `surface`                         | `#FFFFFF`                   | `#191614`       | —                                           |
| `elevated`                        | `#FFFFFF`                   | `#221E1B`       | —                                           |
| `ink`                             | `#1A1614`                   | `#F4EFE8`       | 16,4:1 / 16,8:1                             |
| `soft`                            | `#6B645C`                   | `#A39C92`       | 5,3:1 / 7,2:1                               |
| `line`                            | `#E6E0D8`                   | `#2A2622`       | décoratif                                   |
| `accent` (fonds, traits, ≥ 24 px) | `#E5231C`                   | `#E5231C`       | 4,2:1 / 4,3:1 : **jamais en texte courant** |
| **`accent-text`** (nouveau)       | `#C01D14` (= `accent-dark`) | `#FF5A4E`       | 5,6:1 / 6,3:1                               |
| `on-accent`                       | `#FFFFFF`                   | `#FFFFFF`       | 4,6:1 sur `#E5231C` (texte ≥ 16 px en 600)  |

Migration : les 107 `text-accent` passent en `text-accent-text` par codemod. Le rouge plein reste pour
les pastilles, les boutons, la buse et les ronds de ponctuation. `night` reste le panneau sombre constant.

**Palette filament du Studio** (données, pas jetons) : Blanc `#F5F5F4`, Noir `#1C1917`, Rouge
`#E5231C`, Bleu `#1D4ED8`, Ambre `#F59E0B`. Mention obligatoire « teintes indicatives, couleurs finales
selon bobines en stock » jusqu'à ce que le propriétaire fournisse l'inventaire réel.

### 2.2 Typographie (toutes via `next/font`, auto-hébergées)

- **Display : Bricolage Grotesque** (Google Fonts, OFL, variable `opsz 12–96`, `wdth 75–100`,
  `wght 200–800`) : grotesque joyeuse, sérieuse en 700 à `wdth 75` ; `wdth` s'anime au scroll.
- **UI : Geist** (conservée, ce qui préserve le couplage avec les iframes Stripe).
- **Télémétrie : Geist Mono** (hauteur, couches, grammes, temps, étiquettes de specs).
- **Cartes de visite (3D uniquement)** : Bricolage Grotesque ExtraBold, Geist Mono Medium, Instrument
  Serif (OFL). On les convertit en `typeface.json` par un script Bun au build (opentype.js en
  devDependency), sous-ensemble Latin-1 + Latin Ext-A (ÄÖÜ, àéèç, ł…), ~70 Ko chacune, dans
  `public/studio/fonts/`. Fichiers renommés si une police déclare un Reserved Font Name.
- **Alternative premium suisse (option)** : ABC Diatype Variable (Dinamo) pour display + UI, licence web
  à acheter par le propriétaire.

**Échelle fluide** (`text-wrap: balance`, `hyphens: auto` avec `lang`, testée en allemand) :
`display-xl clamp(3.25rem, 10.5vw, 11rem)/0.9` · `display clamp(2.5rem, 6vw, 6rem)/0.95` ·
`h2 clamp(1.75rem, 3.2vw, 3rem)/1.05` · `h3 clamp(1.25rem, 1.8vw, 1.625rem)/1.2` ·
`body 1rem–1.125rem/1.55` · `mono-s 0.75rem/1.3` (+0.04em, majuscules).

### 2.3 Grille, texture, iconographie, rendu, mark

- **Grille** : 12 colonnes (max 1440, gouttière 24, marges 48), 8 en tablette, 4 en mobile (marges 16),
  rythme de 8 px. **La « strate »** (3 filets de 1 px espacés de 4 px) sépare les sections et structure
  les tableaux de specs.
- **Texture** : grain papier (tuile SVG 160 px, 4 % clair, 6 % sombre) sur `body::after` ; dithering
  Bayer 4×4 léger dans les ombres du Stage. Header `paper/85` voilé par `--p`, pas de verre lourd.
- **Iconographie** : lucide-react 1,5 px + six pictos maison (buse, bobine, couche, purge, plateau,
  règle).
- **Rendu 3D** : fond `paper` ou `night`, jamais la pièce grise ni le parquet. `RoomEnvironment` + key
  light chaude, ombre de contact baked, PLA en `MeshPhysicalMaterial` (rugosité 0,5, sheen 0,3), lignes
  de couche en shader sur **nos** objets seulement. Toute image générée porte « Rendu » ou
  « Illustration ».
- **Mark** : le raster 480 px reste l'unique mark validé (28 px header, 64 px footer, jamais agrandi).
  **Option à valider** : redessin SVG des 6 strates, qui ouvrirait un mark 3D. D'ici là, aucun effet ne
  touche le mark.

## 3. Langage de mouvement

**Principes** : (1) **Un seul plan** : aucun crossfade, tout état découle du précédent (morph, masque,
dépôt). (2) **Couche par couche** : les révélations sont quantifiées (`steps()`), comme une imprimante.
(3) **Poids** : inertie et léger dépassement, jamais d'élasticité gratuite. (4) **Joie mesurée** : un seul
« pop » par écran.

**Courbes (CustomEase, `src/motion/gsap.ts`)** :

| Nom           | Chemin                       | Usage                                       |
| ------------- | ---------------------------- | ------------------------------------------- |
| `s3d.extrude` | `M0,0 C0.12,0.72 0.24,1 1,1` | entrées, morphs de paramètres               |
| `s3d.nozzle`  | `M0,0 C0.65,0 0.35,1 1,1`    | caméra, transitions longues                 |
| `s3d.pop`     | `M0,0 C0.3,1.32 0.55,1 1,1`  | pastille choisie, ajout panier              |
| `s3d.purge`   | `M0,0 C0.5,0 0.1,1 1,1`      | front de changement de couleur              |
| `s3d.layer`   | `steps(12)`                  | révélations quantifiées, transition de page |

**Durées** : micro 160 ms · UI 320 ms · section 700 ms · morph héros 1 200 ms. **Stagger** : bande de
couches 18 ms, caractères 24 ms, cartes 60 ms.

**Scroll** : Lenis (`lerp 0.1`, `autoRaf:false` sur `gsap.ticker`) uniquement dans le groupe `(site)`
(accueil, boutique, produit, studio _hors panneau de réglage_, à propos, contact). **Pas de Lenis** sur
cart, checkout, account, auth, oauth, agent, track, favorites, legal et admin. Une seule section pinnée
par page, `scrub: 0.8`, `ScrollTrigger.config({ ignoreMobileResize: true })`, unités `svh`.

**Hover et tactile** : aperçu de coloris au survol ↔ appui long 350 ms (+ `navigator.vibrate(8)`) ;
boutons magnétiques ↔ rien ; orbite souris ↔ glisser à un doigt (`touch-action: pan-y`) ; texte en
roulement ↔ statique.

**Transitions de page** (`<ViewTransition>`) : carte → page par morph `name="obj-{slug}"`
(`share="morph"`, `default="none"`) ; ailleurs, **« impression de page »** :
`::view-transition-new(root)` passe de `clip-path: inset(100% 0 0 0)` à `inset(0)` en `steps(12)` sur
480 ms, la nouvelle page monte en 12 couches par-dessus l'ancienne. Header ancré (`site-header`).
Pendant l'attente serveur, `useLinkStatus()` fait courir une buse rouge de 2 px sous le header.

**Son** : coupé par défaut, bouton « Son » (footer, Studio). Web Audio génératif sans fichier :
ronronnement pas à pas calé sur la vitesse des couches, « clac » à chaque changement de filament.
Jamais sur les pages transactionnelles.

**Reduced motion** (OS ou interrupteur du footer, classe posée par le script anti-FOUC déjà noncé) :
ni Lenis, ni pin, ni scrub, View Transitions à 0 ms ; le Stage rend une frame par changement de
paramètre, le configurateur reste complet, les odomètres sautent à la valeur finale.

## 4. Storyboard du héros

**Premier paint (LCP, 0 ms, sans JS)** : h1 SSR « Réglez-le. On l'imprime. » (display-xl), sous-titre,
deux CTA (« Ouvrir le Studio » en rouge, « Voir la boutique » en contour). À droite, **poster AVIF**
(`fetchpriority="high"`, 1600×2000 desktop, 1080×1350 mobile, ≤ 90 Ko) du Vase Strata 3 bandes.
Dessous, une **bande de télémétrie SSR** en mono, calculée par la même fonction pure que le client
(`src/lib/studio/stats.ts`, sans three) : « 180 mm · 900 couches · 0,20 mm · ≈ 58 g · ≈ 3 h 50 ».
Aucun overlay, aucun `opacity:0` sur le h1.

**Desktop** (section pinnée 320 vh, Stage chargé en idle quand le héros est visible) :

| Scroll   | Beat                                                                                                                                                                                                                  | Technique                                                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrivée  | Le canvas remplace le poster **au pixel près** (même caméra, mêmes paramètres : aucun fondu), puis une **vague de couleur** monte les couches.                                                                        | Ripple le long de Y (iyO) : `mix(colA, colB, smoothstep(front-0.02, front, yNorm))`, liseré émissif rouge au front                                                      |
| 0–25 %   | **Motif** : Nervures → Torsade → Voronoï → Vagues → Relief ; légende et grammes suivent.                                                                                                                              | Vertex shader : `r = profile(z) + Σ wᵢ·patternᵢ(θ,z)`, poids interpolés, normales par différences finies                                                                |
| 25–45 %  | **Taille** : 120 → 240 mm. Une règle graduée pousse, l'odomètre recompte les couches.                                                                                                                                 | Uniform `uHeight` + rescale du profil ; DOM mis à jour à 10 Hz au plus                                                                                                  |
| 45–65 %  | **Couleur** : 4 bandes de filament montent en vague, avec un flash de purge à chaque limite. Les pastilles s'allument.                                                                                                | Bandes = uniform `vec4 uBandTop` + `vec3 uBandCol[4]` ; `floor(y/0.2)` pour que la limite tombe sur une couche                                                          |
| 65–85 %  | **Filament** : le vase se défait en particules du haut vers le bas, qui retombent et se **déposent en strates** pour former une carte de visite.                                                                      | `Points` échantillonnés sur la surface (40 k), deux attributs `aFrom` (vase) et `aTo` (carte), progression par particule décalée selon Y, `aTo.y` quantifié par couches |
| 85–100 % | **Votre nom** : la carte pivote vers la caméra. Un vrai `<input>` SSR « Votre nom » apparaît sous le Stage. Chaque frappe réextrude le texte en direct. CTA « Continuer dans le Studio → » (le nom passe dans l'URL). | `TextGeometry` régénérée en debounce de 120 ms (≤ 5 ms), matériau texte ≠ matériau base (2 filaments)                                                                   |

**Mobile 375 px** : pin de 200 svh, 3 beats seulement (motif → couleur → carte), 8 k particules, DPR
1,5, pas de post-traitement. L'input du nom est **hors pin**, juste sous la section (le clavier iOS ne
doit pas redimensionner une section pinnée). Géométrie 96 × 180 segments.

**Reduced motion** : pas de pin. Poster plus trois vignettes SSR légendées (« Nervures », « 3 couleurs »,
« Votre nom »), chacune liée à son état dans le Studio.

**Bas de gamme** (sans WebGL2, `saveData`, `deviceMemory ≤ 2`, ou 60 premières frames > 22 ms) :
poster seul et CSS `steps()`. `webglcontextlost` rebascule sur le poster.

**Budgets** : chunk Stage (three + studio) ≤ 210 Ko gzip, chargé en idle ; chunk motion (gsap,
ScrollTrigger, SplitText, Flip, Lenis) ≈ 60 Ko ; **Worker +0 Ko**. Desktop : vase 192×360 segments
(≈ 138 k triangles), moins de 30 draw calls, GPU ≤ 8 ms par frame sur un iGPU récent. Mobile ≤ 35 k
triangles. Un seul contexte WebGL, rendu à la demande au repos, pause hors écran.

## 5. Le Studio (le configurateur)

### 5.1 Catalogue d'objets procéduraux (originaux Swiss3Design)

| Objet                              | Paramètres (plage, défaut)                                                                                                                                                                                                                                                                                                                                                                                                     | Géométrie                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vase Strata**                    | hauteur 100–240 (180) mm ; Ø max 60–140 (96) ; profil : Cylindre, Tulipe, Amphore, Galet, Colonne ; galbe 0–1 (0,45), col 0,3–1 (0,6), évasement 0–1 (0,2) ; motif : Lisse, Nervures (12–64, prof. 0–3 mm), Torsade (0–360°), Voronoï (8–40 cellules, graine), Vagues (fréq. 2–24, amp. 0–3 mm), Relief (terrasses topographiques, graine nommée d'après un sommet vaudois, ex. « Dent de Jaman ») ; 1–4 filaments, 1–8 bandes | `BufferGeometry` paramétrique maison (anneaux × segments). Profil Catmull-Rom sur 5 rayons, déplacement `d(θ,z)` calculé sur CPU (pour l'export) **et** en GLSL (pour le morph), avec un test unitaire qui compare les deux. Fond fermé, maillage étanche. Aucun préréglage ne reproduit la silhouette du Vase spirale (bouteille à 40 nervures torsadées). |
| **Carte Relief** (carte de visite) | 85 × 55 mm ; base 0,8–2,0 (1,2) mm ; relief 0,4–1,2 (0,6) mm, **en relief ou gravé** ; mises en page : Classique, Centrée, Monogramme, Grille suisse, QR (vCard) ; 3 polices ; rayon 0–6 mm ; nom ≤ 28 car., 3 lignes ≤ 40 car. ; 2–3 filaments                                                                                                                                                                                | `Shape` rectangle arrondi → `ExtrudeGeometry`. Texte : `FontLoader` + `TextGeometry` (`curveSegments 4`). **Gravé sans CSG** : la dalle du dessus prend les contours des glyphes comme `holes`, et les contrepoinçons (o, a, e…) sont rajoutés en îlots. QR : modules extrudés d'au moins 1,2 mm (version bornée, sinon avertissement).                     |
| **Étiquette Nom** (porte-clés)     | texte 1–14 car. ; forme : Pilule, Fanion, Étiquette ; anneau Ø 4–6 mm ; épaisseur 2–4 mm ; 2 filaments par hauteur                                                                                                                                                                                                                                                                                                             | `Shape` avec trou + texte extrudé fusionné                                                                                                                                                                                                                                                                                                                  |
| **Sous-verre Topo**                | Ø 90–110 (100) ; niveaux 4–12 (8) ; 2–4 filaments **teintés par altitude** (comme une carte nationale) ; terrain : graine procédurale (Tier A) ou relief réel swisstopo (Tier B, attribution)                                                                                                                                                                                                                                  | Heightmap 128², marching squares maison (~150 lignes), chaque niveau extrudé sur 0,6 mm (3 couches) : la démonstration idéale du multicolore par bandes                                                                                                                                                                                                     |
| _Plus tard_                        | Chevalet de bureau (texte sur socle incliné) ; abat-jour Lumen (LED seulement : le PLA ramollit vers 55–60 °C)                                                                                                                                                                                                                                                                                                                 | —                                                                                                                                                                                                                                                                                                                                                           |

### 5.2 Modèle multicolore par bandes de couches

Une configuration = des bandes contiguës `{fromMm, toMm, filamentId}` (8 au plus) calées sur les
couches de 0,2 mm. Sur la carte, l'étiquette et le sous-verre, **la couleur change à une hauteur**, ce
qui s'imprime même sans AMS, et on le dit. Chaque changement ajoute une purge estimée (paramètre
atelier, défaut 0,8 g et 70 s) : « 3 changements · purge ≈ 2,4 g ». UI : un **ruban vertical de
bandes** le long de la règle, à poignées, doublé de champs numériques.

### 5.3 Statistiques en direct (`src/lib/studio/stats.ts`, fonction pure partagée SSR et client)

- Couches = `ceil(H / 0,2)`. Grammes = (surface latérale × 0,45 mm + fond) × 1,24 g/cm³ ; pour les
  solides, volume signé du maillage × remplissage effectif. Temps = volume / (0,45 × 0,2 × v) +
  changements × 70 s. Fourchette ±15 %, `Intl.NumberFormat` par locale (`0,2` fr-CH, `0.2` de/it-CH).
- Badge **Imprimable** (surplomb ≤ 45°, paroi ≥ 0,8 mm, plateau 256³), avec la correction à faire en
  cas d'échec.
- **Prix** : v1 = « estimation atelier sous 24 h ». Si le propriétaire valide les coefficients de la
  Forge : « estimation indicative 28–34 CHF » en centimes, recalculée par le serveur à la soumission.

### 5.4 Parcours

- **Desktop** : `/studio` montre les 4 objets, chaque carte étant une vue ciselée (scissor) du même
  Stage. `/studio/vase` : scène sticky à gauche (60 %), onglets Forme, Motif, Couleurs, Texte à droite,
  télémétrie sous la scène ; Annuler/Rétablir (Ctrl+Z), « Surprenez-moi », « Copier le lien »,
  « Envoyer à l'atelier » (seul CTA rouge).
- **Mobile** : scène sticky de 52 svh, réglages dans une **feuille basse** à 3 crans
  (`data-lenis-prevent`) où se replie la BottomNav ; curseurs de 44 px, onglets défilants.
- **Commande réelle** : « Envoyer à l'atelier » génère le STL binaire dans un Web Worker
  (`STLExporter`, en mm ; Vase ≈ 7 Mo, sous la limite de 30 Mo de `/api/quote-upload`). Ensuite `POST`
  sur `/api/quote-upload` (flux existant), puis ouverture de `/custom` prérempli : `fileKey`/`fileName`,
  `dimensions` (« 96 × 96 × 180 mm »), `colors` (« Blanc 0–60 mm, Rouge 60–120 mm, Noir 120–180 mm »),
  `description` (résumé lisible + **lien de configuration**). **Aucun changement de schéma en v1.** En
  v2, un export 3MF multi-objets (via `fflate`, en JS pur, sans WASM) pour la carte et l'étiquette,
  directement lisible par Bambu Studio.
- **État dans l'URL** : `?c=v1.<base64url JSON compact>` (≤ 600 caractères), et `?nom=` en entrée
  depuis le héros. Canonical sur `/studio/{objet}` ; `Disallow: /studio/*?c=` dans robots. Bouton
  « Garder » : enregistre dans « Mes créations » (localStorage protégé par try/catch, visible dans
  Favoris). Outil WebMCP `studio_configure` qui renvoie un lien partageable.
- **Accessibilité** : uniquement des contrôles natifs (`range`, `radio`, `text`) étiquetés, avec
  `aria-valuetext` en unités (« 180 millimètres »), Maj + flèche pour ×10. Canvas `role="img"` et
  description vivante debouncée dans une région `aria-live="polite"` (« Vase, 180 mm, nervures 32,
  3 couleurs : blanc, rouge, noir »). Boutons d'orbite (gauche, droite, face, réinitialiser) et flèches au
  focus. Les couleurs portent toujours leur nom.

## 6. Plan page par page

- **Accueil** : héros Studio ; bande « Trois façons » (Régler, Acheter, Envoyer un fichier) ; chapitre
  « Couche par couche » (Gland et Pully, chiffres machines réels, sans pin) ; vitrine du Vase spirale
  (crédit Ian visible) ; bandeau livraison (seuil dynamique) ; FAQ courte.
- **Boutique N = 1** : vitrine sur socle (grande image + achat direct), rangée « À configurer » (4 objets
  Studio, badge « Sur devis »), lien sur mesure. **N = 50** : grille 3/2/1, puces de filtres sticky
  (liens SSR conservés), Flip au filtrage, seconde image révélée en `steps(8)` au survol.
- **Fiche produit** (vase-spirale), chapitres façon NODAL : 01 Objet (galerie + achat sticky),
  02 Tourner (vrai STL, **rotation seulement**, blanc et noir réellement vendus, aucun shader
  d'impression), 03 Fiche technique `<dl>` SSR, 04 **Crédit du design**, 05 Avis, puis « Un vase à
  vous ? » vers le Vase Strata (un objet à nous, pas un remix). **Bloc d'attribution** SSR en 4 langues :
  « Design : **Ian** — "Vase", sur MakerWorld (https://makerworld.com/fr/models/1262112-vase) · Licence
  **CC BY-ND 4.0** (lien vers le deed) · Imprimé par Swiss3Design sans modification du modèle. »
  Légende courte reprise sur la carte produit.
- **Studio** : `/studio` (indexable, SSR, FAQ, `webPageJsonLd`) + 4 routes objet, ajoutées à
  `STATIC_PAGES` et `llms.txt`.
- **Sur mesure** : même Server Action ; encart « Préparé dans le Studio » (vignette + paramètres) à
  l'arrivée du Studio, sinon zone de dépôt plus visible.
- **À propos** : schémas SVG des imprimantes éclatés au scroll (DrawSVG), FAQ `<details>` conservée.
  **Contact** : formulaire intact, carte « Gland · Pully » en courbes de niveau SVG.
- **Favoris** : onglets « Objets » et « Mes créations ». **Panier** : restyle léger. **Checkout** :
  jetons et polices seulement, ni Lenis, ni transform, ni canvas ; `stripeAppearance` resynchronisé.
  **Succès** : la confirmation s'« imprime » une fois en `steps(12)`.
- **Suivi, auth, compte** : jetons, `<main>` imbriqué corrigé, avatars en strates (à valider).
  **Légal** : typographie seulement (`.legal-prose` enfin définie).
- **404** : maintenir un bouton imprime « 404 » en strates (CSS en bas de gamme).
- **Header** (64 px) : Boutique · **Studio** (point rouge) · Sur mesure · À propos ; favoris, thème,
  langue, compte, panier. **BottomNav** : Accueil · Boutique · **Studio** (disque rouge central) · Panier
  · Compte ; trou `md`/`lg` corrigé.
- **Footer** : wordmark géant en strates CSS, interrupteurs « Réduire les animations » et « Son »,
  colonnes, paiements et Calyroc conservés. **Consentement** : même texte, mêmes positions, en étiquette
  d'impression mono.

## 7. Inventaire des composants et scènes du Stage

**SSR (bundle Worker)** : `StudioPoster`, `TelemetryStrip`, `StrataRule`, `ChapterIndex`,
`AttributionBlock`, `ObjectCard`, `ShowcasePlinth`, `FilterChips`, `BandRibbon`, `ParamSlider`,
`SwatchRadio`, `StudioSheet`, `StudioActions`, `PendingNozzle`, `MotionToggle`, `SoundToggle`,
`PrintLabelConsent`.

**Client seulement (`src/motion/**`, via `next/dynamic({ ssr:false })`, garde lint)** : `MotionRuntime`,
`SplitReveal`, `FlipGrid`, `StageRoot` (renderer unique, tiers, vues ciselées, rendu à la demande),
`geometry/{vase,card,tag,coaster}.ts`, `export/{stl,3mf}.worker.ts`, `glsl/*`, `audio/stepper.ts`.

**Scènes** : `hero-studio`, `studio-vase`, `studio-card`, `studio-tag`, `studio-coaster`,
`studio-thumbs`, `product-turntable` (vrai STL, sans effet), `nozzle-404`. `showroom-scene.ts` est
retiré.

## 8. Voix et exemples de titres (FR ; de-CH sans ß ; formats par locale)

Précise, pince-sans-rire, jamais criarde.

- « Réglez-le. On l'imprime. »
- « Quatre couleurs, une pièce, zéro colle. »
- « Votre nom en relief. Au sens propre. »
- « 900 couches. On les a comptées pour vous. »
- « Imprimé entre Gland et Pully. Livré de Genève à Romanshorn. »
- « Le Röstigraben ne passe pas par nos bandes de couleur. »
- « Plateau vide. Lancez une impression. »
- « Cette page n'a pas passé la première couche. »
- Studio : « Envoyer à l'atelier : un humain vérifie chaque pièce avant de vous répondre. »
- Pas de croix suisse ni de « Swiss made » (Swissness, LPM art. 47–49) : on écrit « imprimé en Suisse
  (VD) ».

## 9. Ce qu'on demande au propriétaire, et Tier A

**Tier A (sans rien de nouveau)** : jetons, polices Google et OFL, Stage, les 4 objets, héros,
transitions, toutes les pages. Poster héros et OG **générés par notre propre Stage** : route de dev
`/dev/poster` avec `canvas.toBlob("image/webp")`, fichier commité dans `public/`. **Aucun changement de
CSP** (pas de WASM, polices JSON et worker same-origin). Le Vase spirale garde ses 3 photos.

**Demandes minimales** :

1. L'inventaire des bobines (marque, nom, hex) : P0 pour des teintes honnêtes.
2. La validation de la palette, de `accent-text`, des polices et des avatars ; le mark vectoriel en
   option.
3. Les coefficients de prix, ou le choix « pas de prix affiché ».
4. Imprimer **2 pièces Studio réelles** (Vase Strata 3 bandes, Carte Relief) et les photographier sur
   papier : c'est la preuve multicolore (Tier B).
5. **Blender 5.2 + MCP** (le lancer et connecter l'add-on) pour :
   - (a) le poster héros Cycles du Vase Strata sur cyclorama papier (2400×3000 et 1080×1350) ;
   - (b) 7 images OG 1200×630 (accueil, Studio, 4 objets, produit) ;
   - (c) un turntable de 72 images du Vase spirale blanc et noir, **géométrie intacte**, pour le repli
     mobile ;
   - (d) une macro de la Carte Relief.
6. **ChatGPT (2 images d'ambiance seulement, étiquetées « Illustration »)** :
   - « Photographie éditoriale, aube sur le lac Léman vue depuis la rive de Gland, Alpes savoyardes dans
     une brume rose pâle, eau lisse, aucune personne, aucun bateau, aucun objet, palette papier chaud et
     encre, grain argentique fin, format 3:2, beaucoup d'espace négatif en haut. »
   - « Vue aérienne abstraite de courbes de niveau d'un massif alpin gravées sur du papier coton crème,
     lumière rasante, relief très léger, une seule ligne rouge vif #E5231C suivant une courbe, aucune
     typographie, format 16:9, minimaliste. »
7. Une preview dédiée à la refonte, avec le vase et `model_3d_url` réinjectés sur la branche Neon preview.

## 10. Risques et plan de construction

| Risque                                           | Parade                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Three ou GSAP qui fuient dans le Worker          | `src/motion/**` seul importeur, règle lint, `wrangler deploy --dry-run` à chaque phase      |
| INP et replays PostHog (mutations du DOM)        | DOM télémétrie ≤ 10 Hz, canvas sans mutation DOM, replay testé sur le prototype             |
| Objet configuré non imprimable (fausse promesse) | badge Imprimable, bornes des paramètres, validation atelier systématique, « estimation »    |
| Dérive CC BY-ND                                  | aucun effet ni remix sur le Vase spirale, bloc d'attribution SSR, préréglages distincts     |
| Texte libre abusif (nom, marque)                 | longueurs bornées, rendu en géométrie (pas de HTML injecté), revue atelier avant impression |
| Allemand trop long                               | `hyphens`, `balance`, tests DE sur chaque mise en page                                      |
| Stripe perturbé                                  | groupe `(site)` : aucun effet global sur le tunnel                                          |
| Mémoire iOS, perte de contexte                   | tiers, repli poster, un seul contexte                                                       |
| Scope                                            | phases courtes, validation propriétaire en fin de phase                                     |

**Phases** (chacune validée sur `bun run preview` puis par le propriétaire) : **P0** fondations (jetons,
polices, groupe `(site)`, MotionRuntime, Stage, garde lint, mesures) → **P1** Studio v1 (Vase + Carte,
stats, URL, STL vers `/custom`) : l'axe central d'abord → **P2** héros + transitions → **P3** boutique,
produit et attribution, Étiquette + Sous-verre, Mes créations → **P4** pages utilitaires, 404, footer →
**P5** Tier B (Blender, photos réelles, prix, son, 3MF, swisstopo).

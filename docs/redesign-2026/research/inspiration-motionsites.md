# Inspiration : motionsites.ai et galeries voisines

> Recherche du 2026-09-27, en lecture seule. Sources : WebFetch, WebSearch et un onglet de navigateur
> (motionsites.ai, oryzo.ai, landonorris.com inspectés en direct, avec détection des bibliothèques par JS).
> Pour : la refonte complète de Swiss3Design (branche `claude/redesign-2026`).

---

## 1. Ce qu'est vraiment motionsites.ai

**Ce n'est pas une galerie de vrais sites. C'est une bibliothèque de prompts payants** (« 500+ Premium
Website Design Prompts ») : on copie un prompt, on le colle dans Lovable, Claude ou Cursor, et l'outil
génère une landing page. Le site propose aussi :

- un **MCP** (`/mcp`) pour Claude, Cursor et Codex : 3 prompts gratuits, le reste payant ;
- une bibliothèque de **« Animated Backgrounds »** (`/backgrounds`) : des boucles vidéo générées par IA,
  à copier par URL ;
- des liens sortants limités à **Design Rocket** (un cours « AI design » basé sur Lovable et Figma) et à
  la chaîne YouTube `@ViktorOddy`. Il n'y a **aucun lien vers des galeries curatées** ; je les ai donc
  cherchées moi-même (Awwwards, GSAP showcase, Lenis showcase, Codrops, webgpu.com, utsubo, metabole).

**Observations techniques faites dans le DOM :**

- Toutes les vignettes sont servies par `images.higgs.ai`, avec des noms de fichiers `hf_2026…`. **Les
  visuels sont donc générés avec Higgsfield**, ce qui explique pourquoi le propriétaire cite Higgsfield.
- Les aperçus sont des **enregistrements d'écran MP4 de 5 à 7 s en boucle** (1920×1080 ou environ
  1470×1080), hébergés sur un bucket R2 public.
- Le code de la galerie ne contient ni GSAP, ni Lenis, ni Three.js : **le « motion » vient presque
  entièrement de vidéos IA plein écran**, pas d'interactivité temps réel.

**Les codes visuels de « l'esthétique motionsites » :**

1. Une boucle vidéo IA plein écran derrière le hero (planète, portail doré, île flottante, mannequin qui
   tend la main vers la caméra).
2. Un **objet héros unique** qui flotte dans un espace neutre (le cube de sucre vitreux de *KnowSugar*,
   le cube de *3D Story*).
3. Une grosse typo d'affichage : un serif éditorial en capitales (*OYLA* : « MEASURED PURITY ») ou une
   grotesque très grasse, souvent avec un dégradé dans le texte.
4. Un header en verre dépoli, des pilules ou badges (« FRESH DROPS EVERYDAY »), du grain et un fond
   sombre.
5. Une nav minimaliste façon mode, avec le panier noté `[BAG]`.

**Templates à retenir pour nous :**

| Template (URL `motionsites.ai/?prompt=…`) | Pourquoi                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **OYLA** (`oyla`, Ecommerce, 614 likes, le plus aimé) | Bijouterie : vidéo IA d'un geste vers la caméra, serif éditorial géant, nav `ABOUT / ≡ / [BAG]`. L'e-commerce traité comme une campagne de mode. |
| **KnowSugar** (Healthcare)                | Un seul objet translucide (un cube de sucre) en lévitation sur fond gris, avec un titre italique. C'est exactement la mise en scène d'un objet imprimé. |
| **Nebula Hero** / **Space planet**        | Planète à anneaux, flammes stylisées, violet et vert menthe : un diorama illustré plus qu'une photo.                     |
| **3D Portfolio** / **3D Character Studio** | Personnage 3D façon Pixar comme mascotte. À éviter pour nous (hors marque), mais c'est la preuve que le ton « jouet » plaît. |
| Fond **« île flottante »** (`/backgrounds`) | Une île miniature dans les nuages : l'esthétique diorama et tilt-shift qui correspond parfaitement à un objet imprimé posé sur un plateau. |

**Leçon de mise en œuvre, tirée d'un PR public qui a intégré une vidéo Higgsfield de motionsites
([crimznexus/multiagency-redesign#5](https://github.com/crimznexus/multiagency-redesign/pull/5)) :**

- La vidéo 1080p de 13,8 Mo a été réencodée en 720p : **WebM d'environ 300 Ko et MP4 d'environ 380 Ko**.
- **L'image poster sert d'élément LCP.** La vidéo se charge après l'hydratation, et en lazy dans le
  footer.
- La vidéo se met en pause hors du viewport et reste figée avec `prefers-reduced-motion`.
- La même vidéo remplit le wordmark du footer grâce à `mix-blend-mode: multiply`.
- **Header en verre piloté par une variable CSS `--p`** (progression du scroll, écrite une fois par
  frame) : du verre clair au verre sombre sur les 200 premiers pixels. `--p` fait varier la couleur, le
  blur, la saturation, le hairline et l'ombre.
- **Grain** : une tuile SVG de bruit de 160 px sur `body::after`.
- Résultat Lighthouse : **0,97 en performance**, LCP de 2,0 à 2,2 s, TBT de 0 ms, CLS de 0.

**Verdict.** motionsites donne le **plancher** de 2026 : vidéo IA, belle typo, verre et grain. C'est bon
marché et reproductible, donc de plus en plus banal. Pour atteindre « le top du top », il faut de
**l'interactivité temps réel sur nos vrais objets** (WebGL, scroll scrubbé, configurateur), ce que les
sites primés ci-dessous font et que motionsites ne fait pas.

---

## 2. Catalogue : 18 sites remarquables

Chaque fiche donne les techniques observées, puis une idée transposable à une boutique suisse d'objets
imprimés en 3D multicolores.

### 1. Oryzo (Lusion), <https://oryzo.ai/>

Un faux produit (un sous-verre en liège) vendu comme un iPhone.

- **Préloader « CAD »** : des cercles en pointillés avec leurs **poignées de Bézier orange** se
  dessinent et s'élargissent au fil du chargement. C'est le produit, dessiné comme dans un logiciel de
  modélisation.
- Un seul objet 3D en rendu inertiel, avec un défilement en profondeur (axe Z) et un easing qui imite la
  physique.
- Une interaction « TRY TO HOVER HAND », un encodeur de message, une copie absurde et drôle.
- Construit en Astro, avec 6 canvas WebGL.

**Idée pour nous : un préloader « slicer ».** Le mark rouge ou le produit se dessine en toolpath
(contours, puis remplissage, puis couche suivante), avec un compteur « Couche 142/300 ». On y ajoute un
ton d'humour suisse assumé dans la copie.

### 2. Igloo Inc (Abeto), <https://www.igloo.inc/>

Awwwards Site of the Year 2024, et une référence technique.

- **Cristaux de glace générés procéduralement** par un algorithme qui fait « pousser » la glace à
  l'intérieur d'une forme conteneur (cube, cylindre).
- **Toute l'UI est en WebGL** : les glitches de texte passent par des shaders, et le scramble des
  lettres échange des offsets de texture SDF sans provoquer de relayout DOM.
- **Footer en particules** : quand on survole un lien, les particules se regroupent en formes 3D
  différentes, et leur couleur dépend de leur vitesse (données de volume VDB compressées).
- Transitions avec aberration chromatique, dissolution givrée et caméra qui dérive.
- Stack : Three.js, Svelte, GSAP, Houdini, Blender.

**Idée pour nous :** l'objet **« pousse » couche par couche à l'intérieur de sa bounding box**, comme
une impression accélérée. Dans le footer, des particules de filament (rouge, puis les couleurs de la
collection) se regroupent en silhouette du produit ou de la catégorie survolée dans la nav.

### 3. Messenger (Abeto), <https://messenger.abeto.co/>

Awwwards Site of the Year 2025, catégorie développeur.

- Une **mini-planète sphérique** en WebGL, en cel-shading, où l'on joue un livreur.
- L'UI est rendue en WebGL, avec des glyphes générés en WebAssembly et rendus par le GPU.
- Physique, lumière et easter eggs (un alien, un OVNI).

**Idée pour nous : faire du suivi de colis un mini-monde.** Une petite Suisse en diorama « imprimé »
(cantons en couches colorées) où le colis voyage de l'atelier jusqu'au canton du client. La livraison
uniquement en Suisse devient un argument de marque.

### 4. Lando Norris (OFF+BRAND), <https://landonorris.com/>

Awwwards Site of the Year 2025, inspecté en direct.

- La classe `lenis` est présente sur `<html>` : **Lenis confirmé**. **Le runtime Rive est chargé**, la
  page compte **21 canvas**, et le site tourne sur Webflow avec du JS maison.
- Le hero est un portrait photo avec un **casque 3D en fil de fer** superposé sur la tête, sur un fond de
  **lignes topographiques ou de circuit**.
- Une seule couleur d'accent (lime), des bascules de couleur de section au scroll (du blanc à l'olive
  foncé) et une **signature tracée à la main** (trait lime qui se dessine).
- Les libellés sont dupliqués dans le DOM (« Store » et « STORE »), ce qui trahit un **hover en
  roulement vertical** du texte.
- Une section « Helmets Hall of Fame » propose des casques en rotation 3D.

**Idée pour nous :** photo réelle de l'objet, avec son **maillage ou toolpath en fil de fer rouge**
qui l'enveloppe et suit le curseur. En fond, les **courbes de niveau swisstopo** (topographie suisse)
remplacent les lignes de circuit. Le rouge #E5231C joue le rôle du lime : un seul accent, utilisé avec
discipline.

### 5. Cartier Watches & Wonders (Immersive Garden), <https://www.cartier.com/watchesandwonders>

- **Six alcôves 3D autonomes, une par montre**. Le scroll fait passer de salle en salle, pas simplement
  descendre une page.
- Les scènes **se chargent et se libèrent en mémoire à chaque passage** d'une alcôve à l'autre.
- Stack : Three.js avec GLSL, Blender, **GSAP et Lenis** synchronisés.
- Une **partition Web Audio** sert de fil narratif, et chaque scène cache des gestes à découvrir.

**Idée pour nous : chaque collection a sa salle.** Par exemple : lac et reflets pour les vases, roche
alpine pour les objets de bureau, néon urbain pour les pièces ludiques. On reprend le pattern de
chargement et de libération par scène pour tenir le budget GPU sur mobile.

### 6. Scout Motors (Locomotive), <https://www.scoutmotors.com/>

Awwwards E-commerce of the Year 2025.

- Exploration 3D du produit et **parcours de configurateur clair** jusqu'à la réservation.
- Le principe, tel que le formule metabole.studio : **« l'expérience immersive doit accélérer la
  décision, pas la retarder »**. Chaque scène doit mériter sa place sur le chemin du checkout.

**Idée pour nous : un configurateur multicolore.** On choisit une couleur par pièce ou par couche du
modèle 3D, le prix se met à jour en CHF (en centimes entiers), et le bouton d'ajout au panier reste
toujours visible. Pas de 3D « décorative » qui fait diversion.

### 7. Terminal Industries, SOTM septembre 2025 (via Awwwards)

- **Au scroll, les visuels 3D basculent en vues filaires** : le site montre la rigueur technique sans
  la crier. Les micro-animations restent sobres.

**Idée pour nous : une section « Anatomie d'une impression ».** Le scroll scrubbé fait passer par
cinq états : rendu photoréaliste, fil de fer, toolpath de la buse, lignes de couche, remplissage
gyroïde. On conclut par « imprimé à la commande en Suisse ».

### 8. Shopify Editions Spring '26, <https://www.shopify.com/editions/spring2026>

- Révélations séquencées par le scroll, **typo qui se disperse en particules**, panneaux en couches de
  profondeur, transitions chorégraphiées.
- Une **nav d'ancres sticky** sur 10 catégories permet de parcourir une page dense (150+ nouveautés).

**Idée pour nous :** des puces de catégories sticky sur la boutique. Les titres se dispersent en **brins
de filament** de couleur plutôt qu'en points.

### 9. Hubtown (Unseen Studio), <https://hubtown.co.in/>

- Un **monolithe 3D lumineux** au-dessus d'un paysage sombre et réfléchissant, animé avec GSAP.
- Une **interaction « mouse reveal »** : le curseur dévoile le détail géométrique caché.

**Idée pour nous : un curseur « rayon X ».** Au survol d'une fiche produit, une loupe circulaire montre
l'intérieur de l'objet (infill gyroïde, parois, lignes de couche) sous la surface brillante, via un
masque en shader.

### 10. Illoca (Unseen Studio), <https://illoca.unseen.co/>

Site mis en avant dans le GSAP Showcase.

- ScrollTrigger, **SplitText**, **CustomEase** et le hook React `useGSAP`.
- Une identité construite sur **le poids des dessins empilés, la chaleur des calques de papier-calque
  et le trait de crayon**.

**Idée pour nous :** des calques semi-transparents empilés qui évoquent les couches d'impression
(papier chaud, encre, un seul rouge). Les titres se révèlent ligne par ligne avec SplitText et une
CustomEase « mécanique », comme un mouvement de moteur pas à pas.

### 11. Lusion, <https://lusion.co/> (et l'étude de cas Awwwards)

- La **simulation de tissu est précalculée dans Houdini** : quatre directions stockées dans un
  ArrayBuffer d'environ **220 Ko gzip**, mélangées selon l'interaction de l'utilisateur.
- Le **buste de Beethoven** est rendu à partir de normal map, AO, épaisseur et deux éclairages diffus
  **précuits dans une texture**, combinés à des matcaps. On obtient ainsi un aspect translucide à
  deux états pour un coût quasi nul.

**Idée pour nous : précuire le rendu de nos objets.** Normal, AO, épaisseur et matcap permettent
d'imiter la brillance du PLA soie ou mat, le translucide du PETG et les lignes de couche (normal map)
sans éclairage temps réel coûteux. C'est une bonne manière de tenir le budget sur mobile.

### 12. Mat Voyce, <https://matvoyce.tv>

Awwwards SOTD, nominé GSAP Site of the Year 2025.

- Typo cinétique : **les lettres s'étirent, claquent et se recombinent au scroll**, via des timelines
  GSAP et des shaders WebGL. La typo déborde volontairement du viewport.
- Curseurs personnalisés.
- Résultat annoncé : **+45 % de durée de session, −30 % de rebond**.

**Idée pour nous :** le wordmark géant du footer, fait de **couches extrudées** qui s'empilent ou se
désempilent au scroll. Chaque lettre est « imprimée » par une buse virtuelle, puis se tord comme du
filament chaud.

### 13. Bruno Simon, <https://bruno-simon.com/>

Awwwards SOTM janvier 2026.

- Un monde 3D jouable : on conduit une petite voiture, avec Three.js et un moteur physique.

**Idée pour nous : un easter egg ou une page 404 jouable.** On pilote une tête d'impression au-dessus
du plateau pour « imprimer » le logo, ou on pousse des objets imprimés.

### 14. Explore Primland, <https://explore.ownprimland.com/>

- **Survol de terrain réel en 3D** avec brouillard atmosphérique et **caméra pilotée par le scroll**.
- Une couche audio optionnelle et une carte interactive.

**Idée pour nous : les Alpes suisses en carte topographique imprimée.** On part des données
d'altitude libres de swisstopo, rendues en **courbes de niveau extrudées** (l'esthétique d'une carte topo
imprimée en 3D). La caméra survole le massif au scroll, entre la page À propos et le hero.

### 15. Codrops « Pixel-to-Voxel Video Drop » (janvier 2026)

<https://tympanus.net/codrops/2026/01/05/how-to-create-a-pixel-to-voxel-video-drop-effect-with-three-js-and-rapier/>

- Une grille d'`InstancedMesh`, aplatie dans le vertex shader, dont les UV mappent une vidéo.
- Une onde de bruit « voxelise » progressivement la grille, puis **réveille des corps rigides Rapier**
  qui tombent.
- Coût CPU notable. Il existe aussi une version en CSS pur (« stacked grids », Codrops 2025).

**Idée pour nous : une transition de page ou un « drop » de collection.** La photo produit se pixelise
en voxels colorés qui tombent et **s'empilent en couches** pour former la page suivante. À utiliser
une fois, en effet signature, pas partout.

### 16. motionsites **OYLA** et **KnowSugar** (déjà décrits en §1)

- La campagne de mode appliquée à l'e-commerce, et l'objet unique en lévitation.

**Idée pour nous : des boucles vidéo produits** tirées de **vraies photos de nos objets** (image-to-video
avec Higgsfield). Ces boucles servent de fond de section et de remplissage du wordmark, avec le poster
comme LCP.

### 17. Gantri, <https://www.gantri.com/> (lampes imprimées en 3D, Californie)

- La référence directe du secteur. Mais le site est **lifestyle d'abord et quasi sans motion** : ni
  swatches, ni 3D, un récit « fabriqué à la commande et à base de plantes ».

**Leçon :** dans l'e-commerce d'objets imprimés, **personne ne fait de motion de premier plan**. Le
terrain est libre. On reprend chez eux la narration du procédé (made to order, matériaux), mais animée.

### 18. Nagami, <https://nagami.design/en> (mobilier imprimé en 3D, plastique recyclé)

- Hero vidéo avec la Echo Chair, vidéos de procédé paramétrique (Voxel Chair), collaborations
  (Zaha Hadid, Ross Lovegrove, Patricia Urquiola) et logos de confiance (V&A, Pompidou).

**Idée pour nous : des vidéos macro du procédé** (buse, changement de couleur de l'AMS, retrait du
plateau), en plans de 3 à 5 s scrubbés au scroll dans une section « L'atelier ».

**Mentions rapides :**

- **Apple** (pages produit) : séquences d'images sur canvas scrubbées au scroll, et **USDZ Quick Look
  en AR** sur iOS.
- **Nike** : les coloris se révèlent au survol de la carte produit. Pour nous, les couleurs de filament
  défileraient au hover d'une carte.
- **KidSuper World** : une boutique dans un monde R3F.
- **Active Theory**, **Obys** (morphing de lettres au scroll) et **Uncommon Studio** (des transitions GSAP
  pensées comme des mouvements de caméra).

---

## 3. Tendances 2026 (recoupées entre les sources)

1. **Le WebGL en garniture, pas en plat principal.** Un objet héros unique plutôt qu'une scène
   entière : Oryzo, Hubtown et KnowSugar le font, et c'est aussi ce qui réduit les draw calls.
2. **Une logique de scènes plutôt que de pages.** Le rythme vient du cinéma : révélations et temps
   calmes (Cartier, Igloo, Scout Motors).
3. **Lenis combiné à GSAP ScrollTrigger est devenu le standard** : Lando Norris, Cartier, Unseen, Netflix
   Jobs, GTA VI, entre autres. `lenis/snap` sert pour le snap.
4. **GSAP est 100 % gratuit depuis avril 2025**, y compris SplitText, ScrollSmoother, MorphSVG,
   DrawSVG, Inertia et CustomEase, et y compris pour un usage commercial.
5. **Rive** pour les motion graphics interactifs légers (Lando Norris).
6. **L'UI rendue en WebGL** (texte SDF, scramble) chez les meilleurs (Abeto). C'est coûteux : à réserver
   au hero.
7. **Du précuit plutôt que du temps réel** : lumière, simulations et AO précalculés (Lusion,
   « baked lighting, instancing, byte budgets »), compression Draco/Meshopt et KTX2.
8. **La typo cinétique géante** qui déborde du viewport (Mat Voyce, Obys, Lando Norris).
9. **Les boucles vidéo IA comme matière première** (motionsites avec Higgsfield). Accessible à tous,
   donc **à combiner avec de l'interactif** pour se distinguer.
10. **Un seul accent de couleur**, des bascules de couleur de section au scroll, du grain SVG et un
    header en verre piloté par une variable `--p`.
11. **Mobile d'abord** : détection de l'appareil, scènes allégées et fallbacks (metabole.studio).
12. **Une couche audio optionnelle** comme fil narratif (Cartier, Primland), coupée par défaut.
13. **WebGPU avec fallback WebGL** via les shaders TSL de Three.js (IVRESS).

---

## 4. Outils et services utiles (le propriétaire peut créer des comptes)

| Outil | Usage pour nous | Note |
| --- | --- | --- |
| **Higgsfield** (MCP hébergé à `https://mcp.higgsfield.ai`) | Boucles vidéo image-to-video **à partir de vraies photos produits**. Donne accès à Veo 3.1, Kling 3.0, Sora 2 et Seedance, avec plus de 70 presets de caméra (orbite, dolly, macro). | Compte à créer par le propriétaire. Il faut **héberger les vidéos nous-mêmes** (R2 ou `public/`), en 720p WebM d'environ 300 Ko. |
| **GSAP 3.13+** | ScrollTrigger, SplitText (révélations de titres en 4 langues), Flip (transitions de la grille vers la fiche), DrawSVG (toolpath), CustomEase. | Gratuit. Installé via npm, donc aucun problème de CSP. |
| **Lenis** (lenis.dev) | Scroll inertiel, `lenis/snap`, synchronisé avec le ticker GSAP. | Moins de 5 Ko. |
| **Three.js 0.186 / R3F + drei** (déjà installé) | Objet héros, configurateur, curseur rayon X, topographie. | Déjà chargé derrière `next/dynamic({ssr:false})` (voir `product-viewer-3d.tsx`). |
| **Rive** | Micro-animations interactives (mark, icônes, états du panier). | Le runtime WASM exige `'wasm-unsafe-eval'` dans le CSP. |
| **Unicorn Studio** | Fonds shader no-code (bruit, fluide, lumière volumétrique), environ 29 Ko de runtime, export en vidéo WebM/MP4 possible. | L'embed charge un CDN tiers, donc à ajouter au CSP. **L'export vidéo évite ce problème.** |
| **Blender / Houdini** | Précuisson de la lumière, de l'AO et des normal maps de lignes de couche. Export GLB Draco/Meshopt, textures KTX2. | |
| **swisstopo** (données d'altitude libres) | Courbes de niveau des Alpes pour l'idée topographique. | Données ouvertes. Vérifier la mention d'attribution. |
| **Codrops, madewithgsap.com, demos.gsap.com** | Recettes d'effets (voxel drop, galeries WebGL révélées au scroll, masques SVG). | madewithgsap coûte 20 à 25 €/mois. |

---

## 5. Contraintes Swiss3Design à respecter dans la refonte

- **Budget du bundle Worker** (règle d'or 10) : Three.js, Rapier, Rive et les shaders doivent rester
  **dans des chunks client** chargés par `next/dynamic({ ssr:false })`. Ne jamais importer une scène
  depuis un composant serveur. Aucune image ou vidéo via une convention de fichier Next : les médias
  vont dans `public/` ou R2.
- **CSP avec nonce** (règle d'or 4) : pas de script inline sans nonce. Les embeds tiers (Unicorn, Rive
  via CDN) sont à déclarer. Préférer les paquets npm, qui sont bundlés.
- **`prefers-reduced-motion`** : Lenis coupé, vidéos sur leur poster, scènes 3D figées au premier
  frame. Une version mobile allégée de chaque scène.
- **i18n fr/de/it/en** : SplitText doit couper des composés allemands longs et gérer les accents. On
  re-découpe après un changement de langue ou de breakpoint (`SplitText.create` avec `autoSplit`).
- **Performance** : poster en LCP, vidéos lazy et en pause hors écran, un seul canvas WebGL partagé si
  possible (pattern de « scroll rig » : un canvas fixe, des vues calées sur des éléments DOM).

---

## 6. Idées signature (audacieuses et concrètes)

1. **« L'objet s'imprime devant vous. »** Le hero en WebGL : un **plan de découpe (clipping plane)
   scrubbé par le scroll** fait monter l'objet couche par couche. Une buse rouge #E5231C trace le
   toolpath du dessus, et **la couleur change au milieu de l'impression** comme un changement de
   filament AMS, avec un clin d'œil à la tour de purge. À 100 %, l'objet se détache du plateau et
   tourne, prêt à être mis au panier.
2. **Préloader « slicer ».** Le mark est découpé en couches, et le chargement progresse couche par
   couche (« Couche 142/300 · 0,2 mm »), dans l'esprit du préloader CAD d'Oryzo.
3. **Topographie suisse vivante.** Des courbes de niveau swisstopo en fond, qui se déforment sous le
   curseur. En bas de page, **les Alpes deviennent un relief imprimé** en couches colorées que la caméra
   survole (façon Primland).
4. **Curseur rayon X.** Sur la fiche produit, une loupe circulaire dévoile l'infill gyroïde, les parois
   et les lignes de couche (le reveal de Hubtown, appliqué à la fabrication).
5. **Configurateur multicolore « réimpression ».** Quand on choisit une couleur, le changement se
   propage **de bas en haut, couche par couche**, via un shader qui balaie la hauteur. Le prix se met à
   jour en CHF et l'ajout au panier est immédiat (le principe de Scout Motors).
6. **Une salle par collection** (les alcôves de Cartier) : lac, roche, ville. Chaque scène se charge et
   se libère au passage, avec une ambiance sonore optionnelle (moteur pas à pas, couleur de lac).
7. **Typo « filament ».** Les titres sont découpés en caractères avec SplitText. Chaque lettre
   s'extrude en brins de filament colorés, puis se solidifie. Le wordmark géant du footer s'empile en
   couches au scroll (façon Mat Voyce).
8. **Transition « voxel drop ».** Au clic sur une carte, la photo se pixelise en voxels colorés qui
   tombent et s'empilent pour construire la fiche produit (Flip combiné au voxel drop de Codrops).
9. **Footer en particules de filament.** Au survol d'un lien de la nav, les particules se regroupent en
   silhouette de la catégorie (le footer d'Igloo).
10. **Suivi de colis en mini-Suisse.** La page de suivi devient un diorama de la Suisse « imprimée »
    où le colis voyage de l'atelier au canton du client. La livraison en Suisse uniquement est assumée
    comme un trait de marque (l'esprit de Messenger).
11. **Boucles vidéo Higgsfield honnêtes.** Image-to-video à partir de **nos vraies photos**, jamais d'un
    objet inventé : macro de la buse, rotation sur plateau, lumière rasante. Ces boucles remplissent aussi
    le wordmark du footer en `multiply`, avec le poster en LCP.
12. **Easter egg jouable.** Page 404 ou code Konami : on pilote une tête d'impression pour « imprimer »
    le logo (façon Bruno Simon), ce qui fait parler sur les réseaux.
13. **Le socle de finition** (repris de motionsites et du PR) : grain SVG, header en verre piloté par
    `--p`, bascule de couleur de section (papier, puis encre, puis rouge), texte en roulement vertical
    au hover, boutons magnétiques et un seul accent rouge.

---

## Sources

- <https://motionsites.ai/> ; `/backgrounds` ; `/mcp` ; `?prompt=oyla` ; `?prompt=nebula-hero`
- <https://github.com/crimznexus/multiagency-redesign/pull/5>
- <https://designrocket.io/>
- <https://oryzo.ai/> ; <https://www.utsubo.com/blog/best-threejs-websites-2026>
- <https://www.webgpu.com/showcase/igloo-inc-procedural-crystals/> ; <https://www.awwwards.com/igloo-inc-case-study.html>
- <https://www.webgpu.com/showcase/messenger/> ; <https://messenger.abeto.co/>
- <https://landonorris.com/> ; <https://www.itsoffbrand.com/our-work/lando-norris>
- <https://www.webgpu.com/showcase/cartier-watches-and-wonders-immersive-garden/>
- <https://www.scoutmotors.com/> ; <https://locomotive.ca/en/work/scout-motors> ; <https://metabole.studio/en/blog/immersive-website-examples>
- <https://www.awwwards.com/sites/terminal-industries>
- <https://www.shopify.com/editions/spring2026>
- <https://www.awwwards.com/sites/hubtown>
- <https://gsap.com/showcase/> ; <https://lenis.dev/>
- <https://www.awwwards.com/case-study-for-lusion-by-lusion-winner-of-site-of-the-month-may.html>
- <https://www.hontran.dev/blog/best-award-winning-websites-2026> ; <https://www.awwwards.com/case-study-mat-voyce-designing-a-digital-home-for-a-kinetic-creative.html>
- <https://schoolofmotion.com/blog/10-websites-with-great-animation-in-2026>
- <https://tympanus.net/codrops/2026/01/05/how-to-create-a-pixel-to-voxel-video-drop-effect-with-three-js-and-rapier/>
- <https://www.gantri.com/> ; <https://nagami.design/en>
- <https://webflow.com/blog/gsap-becomes-free> ; <https://higgsfield.ai/mcp> ; <https://www.unicorn.studio/docs/>

# Inventaire des matières premières : refonte 2026

> Recherche en lecture seule (27.09.2026) : repo `public/`, `scripts/seed.sql`,
> `src/db/schema.pg.ts`, API publique live `https://swiss3design.ch/api/v1/*`,
> pages live, en-têtes HTTP. Aucune modification du repo.

## 0. En bref

- **La prod n'a qu'un seul produit actif** : `vase-spirale` (CHF 24.00, PLA, blanc et noir).
  La refonte doit donc briller avec **un seul objet** aujourd'hui, et accueillir un catalogue plus tard.
  Une grille produits ne peut pas servir de héros.
- **Il n'y a qu'un seul modèle 3D réel** : le STL du vase (46 756 triangles, ~2,23 Mio, sur R2).
  C'est l'actif le plus précieux pour un site en motion : on peut le rendre en WebGL, le simuler
  couche par couche, le rendre dans Blender et l'utiliser comme référence pour la vidéo IA.
- **Les photos sont faibles** : 3 WebP de 1000 px de large, dont 2 photos au téléphone dans un
  intérieur (meuble en bois, mur, fouillis à droite sur la vue plongeante) et 1 rendu 3D.
  Seule la version **blanche** est photographiée. Il n'y a aucune photo de la version noire.
- **La promesse centrale (« jusqu'à 4 couleurs dans une seule pièce ») n'a aucune preuve visuelle.**
  Le seul produit live est monochrome. Le motif « 4 points AMS » (rouge, bleu, ambre, encre)
  est purement graphique.
- **Kit de marque** : le mark (pic en strates) n'existe **qu'en raster** (WebP 480 px, PNG 512 px).
  Il n'y a ni SVG, ni haute définition, ni fichier de wordmark (le wordmark est du texte Geist).
- **Aucune vidéo, aucun son, aucun GLB, aucune HDRI, aucune texture** dans le repo.
- **Deux pièges techniques bloquent la vidéo et le WebGL avancé en prod** (voir §2) :
  1. ni `public/` ni `/api/files` ne répondent aux requêtes `Range` (toujours `200`, jamais `206`),
     donc Safari et iOS ne lisent pas une `<video>` servie ainsi ;
  2. la CSP n'a pas de `media-src` et pas de `'wasm-unsafe-eval'` : les décodeurs Draco, meshopt,
     KTX2, Rive et dotLottie sont bloqués **en prod seulement** (en dev, `'unsafe-eval'` masque le problème).
- **Blender 5.2 est installé localement** (`C:\Program Files\Blender Foundation\Blender 5.2`), mais il
  **ne tourne pas**, donc le MCP Blender ne se connecte pas. La machine est très capable :
  RTX 5070, Ryzen 9 7900X3D, 63 Go de RAM. ffmpeg n'est **pas** installé ; `uvx` est présent.

---

## 1. Ce qui existe

### 1.1 Kit de marque (`public/brand/`)

| Fichier | Format / taille | Notes |
|---|---|---|
| `brand/webp/mark.webp` | WebP VP8X, 480×480, alpha, 23,8 Ko | **Le mark officiel**, rendu par `src/components/brand-mark.tsx` (`<img>`). Pic central et deux pics latéraux avec « neige » plus claire, sur **6 strates** (couches d'impression). Dégradés internes rouges (du clair ~#F07A6E au foncé ~#C9302A). Rouge uniquement. |
| `brand/logo.png` | PNG 512×512, 120 Ko | **Identique octet pour octet** à `brand/app/icon-512.png` (même hash). |
| `brand/app/icon.webp` | 512×512 alpha, 24 Ko | Favicon moderne. |
| `brand/app/icon-192.png`, `apple-icon.png` (180), `png/icon-64.png` | PNG | Jeu d'icônes. |
| `favicon.ico` | 48×48 | |
| `brand/social/og-image.png` | 1200×630, 94 Ko | Fond noir, mark + « Swiss**3Design** » (police de type Helvetica/Arial, **pas Geist**), bande rouge en bas. **Une seule OG pour tout le site.** |
| `brand/old-logo/**` | ~60 fichiers (SVG, PNG, WebP, JPG) | Ancien logo (cube isométrique encre et rouge), archivé et **jamais référencé**. Ne pas réutiliser. |

**Le mark n'existe en aucun format vectoriel.** `svg/logo.svg` (387 Ko) est l'**ancien** logo.
Le mark actuel plafonne donc à 512 px, ce qui est insuffisant pour un héros plein écran, un
morphing ou une extrusion 3D.

### 1.2 Typographie

- **Une seule famille : Geist** (Vercel), via `next/font/google` dans `src/app/[locale]/layout.tsx`,
  variable `--font-geist-sans`, sous-ensemble `latin`. Next l'auto-héberge : un seul woff2
  (`/_next/static/media/22a5144ee8d83bca-s.p.woff2`). Graisses utilisées : medium, semibold, bold.
- Le checkout recharge Geist depuis Google Fonts pour Stripe Elements (`checkout-flow.tsx:687`).
- Les e-mails utilisent la pile système (`-apple-system, Segoe UI, Roboto…`).
- **Il n'y a ni police display, ni monospace, ni serif.** L'OG image utilise une autre police que le site.

### 1.3 Palette

Tokens (`src/app/globals.css`) :

| Token | Clair | Sombre |
|---|---|---|
| `--paper` | `#fafaf9` | `#0b0a09` |
| `--surface` | `#ffffff` | `#1a1714` |
| `--elevated` | `#ffffff` | `#221e1b` |
| `--ink` | `#1a1614` | `#f4f1ed` |
| `--soft` | `#6f6962` | `#a39c92` |
| `--line` | `#e8e5e1` | `#2a2622` |

Constantes : `accent #e5231c`, `accent-dark #c01d14`, `night #121110`, `night-soft #a8a29b`,
`night-line #2c2825`, `swatch-ring #767676` (contraste de pastille WCAG réfléchi).

Motif « 4 couleurs AMS » (`multicolor-dots.tsx`) : `#e5231c #1d4ed8 #f59e0b #1c1917`
(`#fafaf9` à la place du noir sur fond sombre).

**Couleurs de filament réellement vendues (live)** : seulement **Blanc `#F5F5F4`** et **Noir `#1C1917`**.
La table `filament_colors` (par matériau) contient peut-être davantage, mais elle n'est pas publique :
le connecteur Neon demande une authentification. **Il faut demander l'inventaire réel des bobines**
(marque, nom exact et hex), pour que les rendus et les shaders reproduisent les vraies couleurs
et que le motif « 4 couleurs » corresponde à de vraies bobines.

### 1.4 Catalogue live (prod), vérifié via l'API

`GET /api/v1/products?limit=50` renvoie `count: 1`.

**vase-spirale** (`GET /api/v1/products/vase-spirale`)
- Prix CHF 24.00 (2400 centimes), `on_demand`, 3 jours de production, PLA, 79×79×209 mm, 120 g, aucune variante.
- Description : silhouette de bouteille, **40 nervures fines torsadées en spirale**, base galbée, col
  fin (~3,5 cm) évasé à l'ouverture. Imprimé à la pièce dans les ateliers de l'arc lémanique (Gland et Pully).
- Couleurs : Blanc `#F5F5F4`, Noir `#1C1917`.
- Images (R2 via `/api/files/products/…`, `Cache-Control: immutable`) :
  1. `b20511bf-….webp` : **1000×750**, VP8 avec perte. Photo : vase blanc sur un meuble en bois sombre, mur blanc cassé. Lumière correcte, rendu smartphone.
  2. `576697d9-….webp` : **1000×666**. Photo plongeante sur le col, fond meuble et parquet, objet parasite en bas à droite.
  3. `28115f06-….webp` : **1000×750**. **Rendu 3D** (fond gris-lilas, ombre portée dure), étiqueté « Rendu 3D » dans l'alt. C'est bien.
- Sur la home, la carte passe par Cloudflare Images : `/cdn-cgi/image/format=auto,width=600,quality=82,fit=cover`.
  Le transform existe donc déjà, mais **la source à 1000 px limite tout affichage héros ou Retina**.
- **Modèle 3D** : `model3dUrl = /api/files/products/abfb9f86-041a-405a-8642-5ae9d558f803.stl`
  (visible dans le payload RSC de la fiche, **absent de l'API v1**).
  STL binaire, **46 756 triangles**, taille ≈ 84 + 50×46 756 = **2 337 884 o (~2,23 Mio)**,
  `Content-Type: model/stl`, servi **sans `Content-Length`** (streaming chunked : pas de barre de progression possible).
  En-tête STL : `"MW 1.0 1262112 US"`. **À vérifier** : cela évoque un export via MakerWorld ou un
  outil tiers. Si le design vient d'une plateforme, il faut confirmer que la licence couvre la
  **vente** et l'**usage marketing** (rendus, vidéos IA, simulations).
- Catégories publiques : `deco`, `bureau`, `accessoires`. Seule `deco` a un produit.
- Boutique (`/api/v1/store`) : ateliers de **Gland (VD) et Pully (VD)**, TWINT, Visa, Mastercard,
  Google Pay, Poste suisse, 8.90 CHF de port, gratuit dès 60 CHF. Fichiers sur mesure acceptés : STL, 3MF, OBJ, STEP.

### 1.5 Catalogue démo (`scripts/seed.sql`, branche Neon preview uniquement)

Le fichier est en syntaxe SQLite/D1 (`INSERT OR REPLACE`, `unixepoch()`, booléens 0/1).
Il contient 6 produits, **aucun `model_3d_url`, aucune couleur liée**, et des images **SVG
placeholder 600×600** (fond `#f5f5f4`, formes orange et brun `#c2410c`/`#9a3412`, **hors charte**) :

| slug | prix | vente | matériau | dim. | multicolore |
|---|---|---|---|---|---|
| vase-spirale | 29.90 | stock | PLA | 120×120×220 | non |
| lampe-voronoi | 49.90 | sur demande, 5 j | PLA | 180×180×260 | non |
| organiseur-bureau | 24.90 | stock | PETG | 220×100×110 | **oui (3 couleurs)** |
| jardiniere-geometrique | 19.90 | stock | PETG | 150×150×130 | non |
| porte-cles-relief | 9.90 | stock | PLA | 60×30×4 | **oui (4 couleurs)** |
| support-casque | 34.90 | sur demande, 3 j | PETG | 120×100×280 | **oui (bicolore)** |

Ces produits **n'existent pas en prod**. Ne jamais les présenter comme réels sur le site live.
Ils peuvent servir de « contenu de test » pour éprouver les layouts de grille.

### 1.6 Schéma produit (`src/db/schema.pg.ts`)

- `products` : `model3dUrl` (une seule URL, `.stl` ou `.glb`), `multicolor` (booléen), `featured` et
  `featuredOrder`, `saleType`, `productionDays`, `material`, `dimensionsMm` (texte), `weightGrams`, `stock`.
- `product_images` : `url`, `alt`, `sortOrder`. **Pas de champ vidéo, pas de type de média, pas de poster,
  pas de largeur ni de hauteur.** Tout média de motion par produit (turntable, vidéo, séquence
  d'images) demandera donc une extension de schéma, ou une convention sur l'URL.
- `filament_colors` (nom et hex par matériau), relié aux produits via `product_colors`.
- `product_variants` : SKU, nom, prix et stock (aucune variante en prod).
- Le viewer (`showroom-scene.ts`) teinte **tout le modèle d'une seule couleur** : aucun support
  des pièces multi-matériaux.

### 1.7 Code motion et 3D existant (réutilisable comme « matière »)

- `hero-scene.tsx` : héros actuel, 100 % CSS et Motion. Portique d'imprimante qui dépose un vase en
  18 couches rouges. Une seule valeur `reveal` pilote le masque et la buse. La page d'accueil live
  montre ce vase stylisé rouge dans un cadre sombre.
- `showroom-scene.ts` : scène Three.js entièrement procédurale (parquet et mur peints sur canvas,
  socle, tapis rouge, `RoomEnvironment` en guise d'IBL, spot à ombres PCF). STLLoader et GLTFLoader
  en import dynamique. Le rendu reste daté (pièce grise et parquet), mais la chaîne de chargement est saine.
- `product-viewer-3d.tsx` : viewer et vignette, derrière `next/dynamic({ssr:false})` (règle bundle 10).
- `a-propos/printer-schematic.tsx` : **schémas SVG annotés** de la Bambu Lab P1S + AMS 2 Pro
  (atelier de Gland) et de la Creality K2 + CFS (atelier de Pully), avec cotes réelles et hotspots.
  C'est une excellente base pour un « exploded view » animé.
- Données machine réelles (textes de la page À propos) : P1S 256³ mm, couches de 0,08 à 0,28 mm,
  buse 0,4, AMS 2 Pro à 4 bobines ; K2 260³ mm, couches de 0,05 à 0,3 mm, 600 mm/s, CFS à 4 bobines.
  Ces paramètres servent aux simulations : **à 0,2 mm par couche, le vase de 209 mm fait environ 1045 couches.**

### 1.8 Divers

- `about/p1s-ams2-pro.jpg` : 1340×1420, rendu constructeur de la Bambu Lab P1S + AMS 2.
  **Orphelin (référencé nulle part).** C'est probablement une image de presse Bambu Lab : à ne pas
  réutiliser sans vérifier les droits.
- `credits/calyroc-logo.png` : 800×222, logo doré « Calyroc » (crédit en footer, lien calyroc.com).
- `avatars/a01…a10.svg` : 10 petits SVG (carré rouge et cube blanc) dans le **style de l'ancien logo**
  (cube), utilisés par le sélecteur d'avatar du compte. À redessiner dans la langue du nouveau mark.
- `products/*.svg` : les 6 placeholders du seed (hors charte, voir §1.5).
- `_headers` : seul `/_next/static/*` est `immutable`. **Les fichiers de `public/` sont servis sans
  `Cache-Control`** (seulement `CF-Cache-Status: HIT`).

---

## 2. Contraintes techniques qui décident où et comment livrer les assets

1. **Pas de requêtes Range, donc pas de vidéo sur Safari et iOS en l'état.** C'est vérifié avec
   `curl -r 0-99`. `https://swiss3design.ch/brand/social/og-image.png` renvoie `200` et le fichier
   entier (94 444 o). `/api/files/…stl` renvoie `200` en chunked. La route `src/app/api/files/[...path]/route.ts`
   fait un `env.R2.get(key)` puis renvoie le corps entier, sans `Content-Length`, `Accept-Ranges` ni `206`.
   Options :
   - (a) Ajouter la gestion `Range` à la route. R2 sait le faire : `get(key, { range: request.headers })`,
     puis renvoyer `206` avec `Content-Range`. Chaque octet passe alors par le CPU du Worker.
   - (b) **Recommandé pour la vidéo** : un bucket R2 public sur un sous-domaine
     (ex. `media.swiss3design.ch`). Range natif, cache CDN, zéro CPU Worker. Il faut ajouter le
     domaine à la CSP (`media-src`, `connect-src` si fetch).
   - (c) Cloudflare Stream (HLS adaptatif) : utile seulement pour un film long. Il faut un lecteur
     (hls.js ou iframe), plus des entrées CSP.
   - Toujours vérifier sur la preview avec `curl -r 0-99 -D -` : **`206` attendu**.
2. **CSP (`src/middleware.ts`)** :
   - Pas de `media-src`, donc repli sur `default-src 'self'` : vidéo et audio en same-origin
     uniquement, sauf ajout explicite.
   - `connect-src` limité (`'self'`, Stripe, PostHog, geo.admin…). Or GLTFLoader, STLLoader,
     KTX2 et les fetch de séquences d'images utilisent `fetch`, donc les modèles doivent être
     same-origin, ou le domaine média doit être ajouté.
   - **`script-src` (prod, avec nonce) n'a pas `'wasm-unsafe-eval'`.** Or meshopt (gltfpack `-cc`),
     Draco, le transcodeur Basis/KTX2, le runtime Rive et dotLottie compilent du WebAssembly :
     ils sont **bloqués en prod uniquement**, puisque le dev a `'unsafe-eval'`. C'est le même piège
     que la règle d'or 4. Il faut soit ajouter `'wasm-unsafe-eval'`, soit choisir des formats sans WASM
     (`KHR_mesh_quantization` seul, PNG/WebP au lieu de KTX2).
   - Les décodeurs doivent être **auto-hébergés** dans `public/` : DRACOLoader pointe par défaut vers gstatic.
   - `font-src 'self' fonts.gstatic.com` : les polices Fontshare ou de fonderie doivent être
     auto-hébergées via `next/font/local`.
   - `img-src https:` : les images peuvent venir de n'importe quel HTTPS. `worker-src blob:` convient
     à OffscreenCanvas et aux workers.
3. **Règle bundle 10** : aucun binaire ne doit passer par une convention Next ni par un `import`.
   Tout va dans `public/` (static assets, hors bundle) ou dans R2. Workers static assets limite
   chaque fichier à ~25 Mio (**à revérifier**). Au-delà, passer par R2.
4. **Préfixes R2 publics** : seuls `products/` et `newsletter/` sont servis par `/api/files`.
   Un futur `media/` (vidéos, GLB, séquences) demandera d'élargir `PUBLIC_PREFIXES` ou de passer
   par le bucket public (option b).
5. **Cloudflare Images** est déjà actif via `/cdn-cgi/image/…`. Il suffit d'uploader des originaux
   ≥ 3000 px et de laisser CF produire AVIF et WebP en largeurs responsives. Surveiller le quota de
   transformations uniques du plan.
6. `html { scroll-behavior: smooth }` dans `globals.css` entre en conflit avec Lenis et ScrollTrigger :
   à retirer au moment où on ajoute Lenis.
7. `images.unoptimized: true` (`next.config.ts`) : il n'y a pas de pipeline `next/image`, les
   tailles se gèrent via CF Images.

---

## 3. Manques et comment les combler

| # | Manque | Priorité | Comblement principal | Alternatives |
|---|---|---|---|---|
| G1 | **Séquence héros** « l'objet naît couche par couche » | P0 | **WebGL temps réel sur le vrai STL** : plan de coupe en Y piloté par le scroll, liseré émissif rouge à la ligne de coupe, buse qui suit, normales « lignes de couche » procédurales (§6). Aucun asset nouveau. | Boucle vidéo Blender (poster et fallback mobile ou reduced-motion) ; vrai timelapse filmé (§7) |
| G2 | **Vrai parcours d'outil** (G-code) | P0 | Le propriétaire tranche le vase dans Bambu Studio et exporte le G-code. Un script (Blender ou Bun) parse `G1 X Y Z E`, obtient une polyligne, décime et quantifie (Int16), produit un buffer binaire d'environ 0,5 à 1 Mo. En WebGL, `drawRange` suit le scroll : **la spirale continue du mode vase se dessine**. | Toolpath synthétique généré depuis le STL (tranches et contours) |
| G3 | **Macros des lignes de couche** | P0 | Photos macro réelles, lumière rasante (§7), sur le vase blanc **et** noir | Rendu macro Blender 4K (displacement 0,2 mm, profondeur de champ) ; shader procédural |
| G4 | **Preuve multicolore** (0 pièce multicolore réelle en photo) | P0 | Imprimer une **pièce-signature 4 couleurs** avec les vraies bobines (idéalement le **mark en 3D**, strates en tons rouges et encre) puis la filmer et la photographier | Rendus Blender d'une pièce multi-matériaux (3MF, puis GLB à 4 matériaux) ; animation « purge » et changement de filament en shader |
| G5 | **Photos produit haute définition** (≥ 3000 px, fonds maîtrisés, **version noire absente**) | P0 | Nouvelle séance : fond papier sans couture (papier, encre, rouge), charte gris, RAW | Rendus Blender fidèles au STL (étiquetés « rendu ») ; upscale IA des photos existantes en solution temporaire uniquement |
| G6 | **Mark vectoriel et 3D** | P0 | Retracer `mark.webp` en SVG (6 strates et 3 pics, formes simples), puis l'extruder dans Blender (strates = dalles) et exporter un GLB de quelques Ko. Sert au loader, au morphing, au footer 3D, à l'OG. **Validation propriétaire obligatoire** (règle de marque). | Vectorisation automatique puis nettoyage manuel |
| G7 | **GLB web optimisé** (le STL fait 2,23 Mio, sans `Content-Length`) | P1 | Import Blender, nettoyage, 2 à 3 LOD, export GLB, puis `gltfpack` (quantification, et meshopt si CSP wasm). Cible **200 à 450 Ko** (estimation). | `KHR_mesh_quantization` seul, sans WASM (~600 à 800 Ko) |
| G8 | **Turntables** (vues 360° par produit, par couleur) | P1 | Blender Cycles : 72 à 120 images en séquence WebP ou vidéo intra. Ou mieux : un viewer WebGL temps réel avec un meilleur éclairage studio que la pièce actuelle. | Photogrammétrie inutile (le STL existe) |
| G9 | **Ambiance atelier et Suisse** (Gland au bord du Léman, Pully, gens, mains, emballage) | P1 | Photos et vidéo du propriétaire (§7) | IA pour de l'atmosphère **non trompeuse** (lac à l'aube, crêtes dans le brouillard). Ne jamais générer un « faux atelier ». |
| G10 | **Imprimantes en image** (P1S : rendu constructeur orphelin ; K2 : rien) | P1 | Animer les schémas SVG existants (exploded view au scroll) et ajouter des vraies photos des machines | Modèles Blender stylisés (pas de modèle Sketchfab sous licence floue) |
| G11 | **Textures et matériaux** (PLA mat, sheen, grain papier, bois, lin) | P1 | Poly Haven (CC0, sans compte) : HDRI studio pour Blender, textures de mise en scène ; grain et bruit procéduraux en shader | Textures peintes au canvas (déjà pratiqué dans `showroom-scene.ts`) |
| G12 | **Topographie suisse** (clin d'œil alpin : courbes de niveau = couches d'impression) | P2 | **swisstopo swissALTI3D** (données OGD gratuites, attribution © swisstopo), puis `gdal_contour`, puis SVG ou heightmap statique. Le MNT d'une vue Léman-Alpes vaudoises se morphe en strates, puis en vase. | Copernicus DEM (30 m) si Mont-Blanc ou France |
| G13 | **Son** (optionnel, coupé par défaut) | P2 | Enregistrements réels : ronronnement des moteurs pas-à-pas, clac du changement AMS, purge, porte. Boucles Opus et AAC de moins de 200 Ko. | ElevenLabs Sound Effects (plan payant, usage commercial) ; Freesound filtré CC0 |
| G14 | **Typographie display et mono** | P1 | Garder Geist (UI), ajouter **Geist Mono** (télémétrie façon HUD : couche 412/1045, 0,20 mm, 220 °C) et une display variable (axe de graisse animable au scroll). Auto-hébergée. | Gratuites : Instrument Serif (contraste éditorial), Fontshare (General Sans, Satoshi, Clash Display, licence gratuite commerciale). Payantes suisses : Suisse Int'l (Swiss Typefaces), ABC Diatype ou Favorit (Dinamo), Neue Haas (Monotype). |
| G15 | **OG par page et par produit** | P2 | Pré-rendues (Blender ou Figma) et posées dans R2 ou `public/`. **Pas** de convention `opengraph-image` (règle 10). | Cloudflare Images (overlay) |
| G16 | **Avatars au style de l'ancien logo** | P3 | 10 variations du pic en strates (angles, nombre de strates) en SVG | — |
| G17 | **Placeholders du seed hors charte** (preview) | P3 | Rendus Blender procéduraux en charte, **preview uniquement** | — |
| G18 | **Métadonnées média** (pas de vidéo, poster, dimensions ni type dans `product_images`) | P1 | Étendre le schéma : `media_type`, `poster_url`, `width`, `height`, `turntable_url`. Ou une table `product_media`. | Convention d'URL |
| G19 | **Inventaire réel des filaments** (hex exacts) | P0 | Liste fournie par le propriétaire (marque, nom de couleur, hex). Photo des bobines comme référence colorimétrique. | — |

---

## 4. Pipeline Blender (local, via le MCP Blender)

**Prérequis** : ouvrir Blender 5.2 et activer l'add-on « MCP for Blender », puis démarrer la
connexion. Si l'add-on est obsolète : `uvx mcp-for-blender install-addon`.
Aujourd'hui, tous les appels MCP renvoient « Could not connect to Blender ». Le statut des
générateurs premium (Hyper3D, Hunyuan3D, Tripo) et de Poly Haven sera connu une fois Blender lancé.
Ces générateurs ne sont **pas nécessaires** tant que les vrais STL et 3MF existent.
Il faut aussi installer **ffmpeg** (ex. `winget install Gyan.FFmpeg`) pour encoder en AV1 et H.264,
et `gltfpack` (npm) pour compresser les GLB.

Matériel : RTX 5070 (OptiX), 12 cœurs, 63 Go de RAM. Ordres de grandeur, **à mesurer** :
1080p avec débruitage, entre 3 et 10 s par image ; turntable de 240 images, entre 15 et 40 min ;
still macro 4K, entre 30 et 90 s.

1. **Préparation** : importer le STL depuis R2, vérifier l'échelle (79×79×209 mm), fusionner les
   sommets, calculer les normales, décimer en 3 LOD (100 %, 40 %, 15 %), exporter en GLB.
2. **Matériaux fidèles** : PLA blanc (Principled, rugosité ~0,45 à 0,55, léger subsurface, sheen)
   et PLA noir mat. **Lignes de couche** par displacement ou bump procédural à pas de 0,2 mm sur Z,
   indispensables en macro.
3. **Studio** : HDRI studio Poly Haven (CC0), cyclorama papier, trois déclinaisons de fond
   (papier `#fafaf9`, encre `#0b0a09`, rouge `#e5231c`). Éviter la pièce grise et le parquet actuels.
4. **Simulation d'impression** :
   - (a) Geometry Nodes : masque en Z animé, bourrelet émissif rouge à la ligne de coupe, buse
     instanciée. Rendu en boucle vidéo.
   - (b) **Parcours d'outil réel** : parser le G-code exporté par le propriétaire (un script Python
     via `execute_blender_code` lit les `G1`), créer une courbe, animer le facteur de construction
     du bevel. **La vraie spirale du mode vase** apparaît.
   - Exports : boucle 6 à 10 s en 1920×1080 et en 1080×1350 portrait, plus une version « scrub »
     encodée intra, plus un poster AVIF.
5. **Turntables** : 72 à 120 images par couleur, à livrer en séquence WebP 1280 px (pour le scrub
   par drag) ou en vidéo.
6. **Stills héros et macro** : 4K, profondeur de champ réelle, lumière rasante sur les nervures.
   Sources Cloudflare Images.
7. **Mark 3D** : à partir du SVG retracé (G6), extruder les 6 strates et les 3 pics (épaisseur
   = une couche). Animer l'empilement strate par strate, qui sert de loader et d'intro. Export GLB
   (quelques Ko) et vidéo alpha (WebM VP9 alpha ou HEVC alpha) pour les fallbacks.
8. **Exploded views des imprimantes** : modèles stylisés à partir des cotes de `printer-schematic.tsx`,
   si l'on veut passer du SVG à la 3D.
9. **Pièce multicolore** : importer un 3MF multi-objets (un corps par filament), un matériau par
   couleur réelle, export GLB multi-matériaux. Le viewer devra alors **cesser de tout teinter d'une couleur**.

---

## 5. Pipeline IA (vidéo et image) et garde-fous

**Usages recommandés** :
- **Higgsfield** en image vers vidéo, avec ses presets de mouvements de caméra (dolly, orbit,
  crash zoom…). Première image : **une vraie photo ou un rendu Blender fidèle** du vase, pour
  obtenir des plans héros cinématiques (lente orbite, lumière qui glisse sur les nervures).
  Alternatives à comparer : Kling, Veo (Google Flow), Runway, Luma. **Vérifier le nombre de
  nervures (40) et le sens de torsion image par image** : les modèles déforment volontiers la géométrie.
- **B-roll d'atmosphère** : Léman à l'aube, crêtes alpines dans le brouillard, lumière rasante,
  « matière » abstraite (filament fondu stylisé, clairement graphique et non documentaire).
- **Transitions** : courbes de niveau vers strates vers vase (IA en appoint, mais un shader est
  préférable, cf. §6).
- **Images** : moodboards, fonds, mises en situation (vase avec fleurs séchées sur une table en bois
  clair, vue lac), via un modèle d'édition qui conserve l'objet (Flux Kontext, Gemini Image…).
  Toujours partir de la vraie photo.
- **Upscale** des trois photos existantes : solution **temporaire** uniquement, en attendant la séance photo.

**Garde-fous** :
- **Fidélité produit** : sur la fiche produit, seules de vraies photos ou des rendus fidèles au STL,
  étiquetés « rendu » (c'est déjà le cas dans l'alt). Aucune image IA ne doit montrer une forme,
  une couleur ou une finition qui n'existe pas. C'est un risque LCD (indications inexactes) et un
  risque de retours.
- **Aucun faux atelier, aucune fausse personne, aucun faux client.**
- **Licences** : usage commercial seulement sur plan payant chez la plupart des fournisseurs. Vérifier
  les CGU de chaque outil au moment de générer.
- **Règle de marque** : tout nouveau visuel doit être validé par le propriétaire avant usage.
- Sources maîtres (4K, ProRes, EXR, .blend) **hors du repo** : disque du propriétaire ou préfixe R2
  privé. Seuls les livrables optimisés vont dans `public/` ou dans R2 `media/`.

---

## 6. Shaders procéduraux (sans aucun asset)

- **Coupe d'impression** sur n'importe quel mesh : `discard` au-dessus de `uCutY`, bande émissive
  rouge `#e5231c` de ±0,3 mm à la coupe, léger bloom. `uCutY` est piloté par ScrollTrigger et Lenis.
- **Lignes de couche** : perturbation des normales `sin(worldY / 0.2mm · 2π)`, avec une amplitude
  qui augmente quand la caméra s'approche (effet « macro » gratuit).
- **Ruban de filament** : tube instancié le long du toolpath (G2), avec l'épaisseur de la buse (0,4 mm).
- **Changement de filament (preuve 4 couleurs)** : bandes de couleur par plage de Z. Transition
  « purge » quand la couleur change, avec les vraies couleurs de bobines (G19).
- **Courbes de niveau et strates** : isolignes animées depuis une heightmap swisstopo (G12), morph
  vers les tranches du vase.
- **Grain, bruit, halftone** : texture « papier » sur fond `paper` ou `night`. Une séparation en
  « 4 encres » (rouge, bleu, ambre, encre) peut servir de transition signature.
- **Particules vers mark** : points échantillonnés sur le SVG du mark (G6) qui s'assemblent en strates.
- Tous les shaders ont un fallback `prefers-reduced-motion` (image poster) et un fallback sans
  WebGL (poster AVIF).

---

## 7. Shot-list pour le propriétaire (le plus authentique, et le moins cher)

**Matériel** : smartphone récent (4K, mode macro), trépied, deux sources de lumière continue
(ou une fenêtre et un réflecteur), papier sans couture blanc, noir et rouge, charte gris.
Photos en RAW si possible.

**Photos** :
1. Vase blanc et vase noir sur fond papier, face, 3/4, plongée, ≥ 3000 px, en séries identiques pour les deux couleurs.
2. **Macros des nervures et des lignes de couche** en lumière rasante (latérale), blanc et noir, 5 à 10 plans.
3. Col et ouverture, base, détail de la torsion.
4. Bobines réelles alignées (toutes les couleurs disponibles) : référence colorimétrique et visuel « palette ».
5. AMS 2 Pro et CFS ouverts, bobines chargées ; buse et plateau PEI texturé.
6. Mains qui retirent la pièce du plateau, emballage, étiquette, colis Poste.
7. Ateliers de Gland et de Pully (ambiance, lumière du lac), sans visages sauf accord explicite.

**Vidéo** :
1. **Timelapse d'impression du vase** : caméra intégrée en mode « smooth » (tête garée à chaque
   couche, faible résolution, bien pour un encart) **et** smartphone 4K sur trépied devant la porte.
2. Plans macro de la buse qui dépose le filament (4K 60p, pour le ralenti), et du changement de filament AMS.
3. Plans produits lents (slider ou main stable) autour du vase, pour servir de première image à Higgsfield.

**Son** (optionnel) : enregistrer séparément en WAV 48 kHz, pièce calme : moteurs pendant
l'impression, changement AMS, porte, pose de la pièce sur la table.

---

## 8. Comptes et services (création par le propriétaire)

| Service | Pourquoi | Coût / remarque (à vérifier au moment voulu) |
|---|---|---|
| Higgsfield | Image vers vidéo et mouvements de caméra pour les plans héros et le B-roll | Crédits payants ; usage commercial selon le plan |
| Un 2e générateur vidéo (Kling, Veo via Google Flow, ou Runway) | Comparer la fidélité géométrique | Payant |
| Générateur ou éditeur d'image (Flux Kontext via Krea ou Freepik, Midjourney, Gemini) | Mises en situation depuis de vraies photos, moodboards | Payant pour l'usage commercial |
| ElevenLabs (Sound Effects) | SFX si l'on n'enregistre pas | Plan payant pour l'usage commercial |
| Poly Haven | HDRI et textures | Gratuit, CC0, sans compte |
| swisstopo (swissALTI3D) | Topographie réelle | Gratuit (OGD), attribution |
| Bucket R2 public sur `media.swiss3design.ch` | Vidéo avec Range, GLB, séquences | Compte Cloudflare existant ; sortie de données R2 gratuite |
| Cloudflare Stream (optionnel) | Seulement si film long | Facturé à la minute stockée et livrée |
| Licence de police (optionnel) | Display suisse premium | De quelques centaines à ~1000 CHF (licence web) |
| MCP for Blender Premium (optionnel) | Générateurs 3D Hunyuan, Tripo, Rodin | Inutile tant qu'on a de vrais STL et 3MF |

GSAP (ScrollTrigger, SplitText, MorphSVG…) est entièrement gratuit depuis 2025 ; Lenis est gratuit.
Aucun compte n'est nécessaire.

---

## 9. Formats et budgets cibles (estimations, à mesurer)

| Asset | Format | Budget |
|---|---|---|
| Boucle héros 6 à 10 s | AV1 (WebM ou MP4) avec repli H.264 ; 1920×1080 et 1080×1350 | 1,5 à 3 Mo (AV1), 3 à 5 Mo (H.264) |
| Vidéo pilotée au scroll | GOP court (keyint 1 à 10) pour un seek précis | ×3 à ×5 par rapport à une boucle, donc limiter à 4 à 6 s |
| Séquence d'images (scrub) | WebP ou AVIF 1280 px, 90 à 150 images, chargement progressif (1 image sur 4 d'abord) | 3 à 9 Mo au total : lourd, à réserver au desktop |
| Poster et stills | AVIF et WebP via CF Images, depuis un original ≥ 3000 px | 60 à 150 Ko affichés |
| GLB vase | gltfpack (quantification ± meshopt) | 200 à 450 Ko (contre 2,23 Mio en STL) |
| GLB mark | Géométrie simple | < 20 Ko |
| Toolpath | Buffer binaire Int16 quantifié | 0,5 à 1 Mo |
| HDRI web | Éviter : `RoomEnvironment` (procédural) ou HDR 1k | 0 à 1,5 Mo |
| Sons | Opus et AAC | < 200 Ko chacun ; coupés par défaut, geste utilisateur requis (iOS) |

Règles communes : tout va dans `public/` (avec des règles `_headers` immutables pour `/media/*`
et des noms hashés) ou dans R2, **jamais** dans le bundle Worker. Fallbacks
`prefers-reduced-motion` et sans WebGL. Vérifier le `206` sur la preview.

---

## 10. Questions ouvertes pour le propriétaire

1. Liste exacte des bobines et couleurs disponibles (marque, nom, hex), et matériaux (PLA, PETG…).
2. Origine et licence du design du vase (en-tête STL « MW 1.0 … ») : vente et usage marketing autorisés ?
3. Le vase est-il imprimé en mode vase (spirale continue) ? Peut-il exporter le G-code tranché (Bambu Studio) ?
4. Quels produits arrivent ensuite ? Dispose-t-il de leurs 3MF ou STL (surtout les pièces **multicolores**) ?
5. Accepte-t-il d'imprimer une **pièce-signature** (le mark en 3D, en tons rouges et encre) pour la filmer ?
6. Peut-il faire la séance photo et vidéo du §7 (ou préfère-t-il du 100 % rendu et IA au départ) ?
7. Budget pour les générateurs IA et une éventuelle police premium ?
8. Accord pour un sous-domaine `media.swiss3design.ch` (bucket R2 public) et pour les ajouts CSP
   (`media-src`, `'wasm-unsafe-eval'`) ?
9. Son sur le site : oui (coupé par défaut) ou non ?

---

## 11. Vérifications effectuées (reproductibles)

- `GET https://swiss3design.ch/api/v1/products?limit=50` : `count: 1` (vase-spirale).
- `GET /api/v1/products/vase-spirale` : 3 images, 2 couleurs, aucune variante, pas de `model3dUrl` dans l'API.
- Payload RSC de `/fr/products/vase-spirale` : `model3dUrl` = `/api/files/products/abfb9f86-041a-405a-8642-5ae9d558f803.stl`.
- En-têtes WebP lus : 1000×750 (VP8), 1000×666 (VP8X), 1000×750 (VP8X).
- En-tête STL : 46 756 triangles, `model/stl`, pas de `Content-Length`.
- `curl -r 0-99` sur `public/` et `/api/files` : `200` (pas de `206`, pas d'`Accept-Ranges`).
- Pages `/fr`, `/fr/shop`, `/fr/custom` et `/fr/a-propos` : seul le woff2 Geist est chargé ; seules
  les images du mark et du vase apparaissent ; aucune vidéo.
- MCP Blender : connexion impossible (Blender fermé). Blender 5.2 installé ; ffmpeg absent ; `uvx` présent.
- Matériel : NVIDIA RTX 5070, AMD Ryzen 9 7900X3D (12 cœurs), 63 Go de RAM.

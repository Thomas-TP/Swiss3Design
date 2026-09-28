# STRATES : concept de refonte Swiss3Design 2026 (directeur artistique n° 1)

> Direction : topographie suisse. Chaque impression est littéralement un relief : ses couches sont
> les courbes de niveau de la carte nationale. Le mark (pic alpin en 6 strates) est la graine.

---

## 1. Nom et thèse

**Strates.** Une imprimante FDM ne sculpte pas, elle **empile des altitudes**. À 0,2 mm par couche,
une pièce de 160 mm est un relief de 800 courbes de niveau, exactement comme une feuille swisstopo au
1:25 000. Le mark est déjà un pic stratifié. La thèse ne relève donc pas de la décoration : c'est la
**vérité physique du produit**, dite dans le langage graphique suisse (Style typographique
international, cartographie fédérale).

Contre le « motion slop » : chaque mouvement correspond à une unité réelle (mm, couche, changement
de filament). Rien ne flotte ni ne se dissout : tout **s'accumule de bas en haut**, par paliers, comme
une machine pas à pas. Le multicolore devient une **teinte hypsométrique** (lac, prairie, roche, neige
par tranches d'altitude), qui est aussi le modèle d'impression le plus honnête et le moins cher :
4 couleurs = 3 changements de filament, pas 300 purges.

**Ce que je garde de « La Forge »** (`docs/refonte-plateforme-2026.md`) : l'accueil à **double
intention** (« Composer » / « Acheter » + « J'ai un fichier »), le **prix indicatif ou ferme** (jamais
bloquer sans chiffre), l'**attente narrée**, le coût de **purge** affiché honnêtement, et ses règles
(1 CTA accent par écran, aucun compte à rebours, états vides utiles). J'écarte pour l'instant `/pro`,
la bibliothèque et le devis instantané sur fichier client : le Studio est la première brique
réaliste de la Forge.

---

## 2. Direction artistique

### 2.1 Palette : noms de tokens conservés (contrat de 116 fichiers), valeurs revues

Ratios WCAG calculés (formule de luminance relative).

| Token | Clair | Sombre | Usage et contraste |
|---|---|---|---|
| `paper` | `#F4F0E8` (papier carte) | `#0E0D0B` | fond |
| `surface` | `#FBF9F4` | `#1A1815` | cartes, panneaux |
| `elevated` | `#FFFFFF` | `#211E1A` | menus, sheets |
| `ink` | `#1A1614` | `#F2EDE4` | texte : 15,81 et 16,66:1 |
| `soft` | `#6A635A` | `#A39B8F` | texte secondaire : 5,21 et 7,07:1 |
| `line` | `#D8D1C4` | `#2E2A25` | hairlines de grille (décor, 1,34:1) |
| `accent` | `#E5231C` | `#E5231C` | **graphique seulement** : 4,03:1 sur papier, 4,24:1 sur nuit. Fond de bouton : blanc dessus 4,58:1 (AA) |
| **`accent-ink`** (nouveau) | `#B3170F` | `#FF5B4E` | **texte rouge** : 6,07:1 sur papier, 6,34:1 sur nuit |
| **`iso`** (nouveau) | `#C9C1B2` | `#3A352F` | courbes de niveau normales (décor) |
| **`iso-index`** (nouveau) | `#9C7650` (sépia carte) | `#8A6C4E` | courbe maîtresse toutes les 5 couches : 3,61 et 4,01:1 (≥ 3:1 non-texte) |
| **`glacier`** (nouveau) | `#3E7CB1` | `#3E7CB1` | 2ᵉ teinte cartographique (eau, glacier), 3,91:1 |
| `swatch-ring` | `#767676` | idem | bordures de champs et pastilles : 4,0:1 |

`text-accent` (107 usages) migre vers `accent-ink`. **Le sombre ne flashe jamais en blanc** : un
chapitre « inverse » vaut `ink` en clair, `elevated` + filet rouge en sombre. WebGL suit
`useIsDark()` ; `stripe-appearance.ts` est resynchronisé.

### 2.2 Typographie (toutes auto-hébergées par `next/font/google`, `font-src 'self'` inchangé)

- **Display : Archivo** (OFL, variable `wdth` 62–125 et `wght` 100–900). C'est la grotesque géante.
  L'axe `wdth` respire avec la vitesse de scroll (100 → 112, jamais plus).
- **UI et texte : Geist** (conservé : continuité du wordmark et couplage avec les iframes Stripe,
  donc aucun risque au checkout).
- **Mono : Geist Mono** pour la télémétrie, les cotes, les coordonnées, les compteurs de couches.
- **Alternative premium suisse** (licence web payante, validation propriétaire) : **Suisse Int'l +
  Suisse Int'l Mono** (Swiss Typefaces) ou **ABC Diatype** (Dinamo), via `next/font/local`.

Échelle fluide (base 16 px, ratio ~1,25 à 1,5) :
`--t-hero: clamp(3.25rem, 1.2rem + 9vw, 11rem)` (Archivo 800, wdth 88, interlignage 0,88,
tracking -0,035em) ; `--t-h2: clamp(2rem, 1.2rem + 3.6vw, 4.5rem)` ; `--t-h3: clamp(1.375rem, 1.1rem + 1.2vw, 2rem)` ;
`--t-body: 1rem/1.55` ; `--t-small: .875rem` ; `--t-mono: .75rem` (uppercase, +0,06em). Les nombres
passent toujours par `Intl.NumberFormat(locale)` : `0,2` en fr-CH, `0.2` en de-CH et it-CH,
séparateur de milliers `’`.

### 2.3 Grille, texture, iconographie

- **Grille visible** : 4 / 6 / 12 colonnes (gouttières 16 / 24 px, marges 16 à 64), base 4 px.
  Filets `line` de 1 px dessinés sur les chapitres éditoriaux, **jamais** sur les formulaires.
- **Cadre de carte** : graduations en marge, coordonnées mono (« 46°25′N 6°16′E · Gland »,
  « 46°31′N 6°40′E · Pully »), cartouche en pied de page.
- **Point rouge** de 0,22em à la place du point final des titres (« Relief. ») : seule décoration
  rouge permise.
- **Texture** : dithering Bayer 4×4 à 1–2 % dans le shader de fond ; jamais sur checkout, compte ou
  formulaires.
- **Icônes** : lucide-react (trait 1,5 px) + 6 symboles cartographiques SVG (point coté ▲ =
  nouveauté, borne, repère, courbe, lac, sommet).
- **Rendu 3D** : longue focale (fov 18–24°) ou orthographique, élévation 30°, **lumière du
  nord-ouest** (convention d'estompage suisse), cyclorama papier, ombre de contact précalculée, bloom
  seulement sur la buse.
- **Mark** : raster 480 px, jamais recoloré, animé seulement en opacité et échelle, 24 px minimum.
  **Option à valider** : redessin vectoriel des 6 strates (isolignes, mark 3D). En Tier A, les
  strates animées sont des bandes abstraites.

---

## 3. Langage de mouvement

**Principes.** (1) **Addition** : tout naît de bas en haut. (2) **Quantification** : les grands
mouvements avancent par paliers de couche. (3) **Unités vraies** : tout scrub s'exprime en mm et en
couches. (4) **Le trait avant la matière**. (5) **Le rouge, c'est la chaleur** (buse, état courant,
curseur), jamais un décor.

| CustomEase | Courbe | Usage, durée |
|---|---|---|
| `s3d.strate` | `M0,0 C0.16,0.84 0.3,1 1,1` | révélations de lignes, 0,7 à 0,9 s |
| `s3d.buse` | `M0,0 C0.45,0 0.55,1 1,1` | déplacements de caméra et de tête, 1,2 à 1,6 s |
| `s3d.pas` | ease maison `x ⇒ mix(x, round(x·n)/n, 0.85)` | compteurs, scrubs quantifiés |
| `s3d.purge` | `M0,0 C0.3,1.35 0.6,1 1,1` | pastilles et changement de filament, 320 ms |
| `s3d.carte` | `M0,0 C0.7,0 0.2,1 1,1` | bascule élévation ↔ plan, 1,4 s |

Durées : micro 120 à 180 ms, UI 240 à 320 ms, révélations 700 à 900 ms, chapitres 1,2 à 1,6 s.
Décalages : 40 ms par ligne (« une couche »), 12 ms par caractère, grilles `from: "end"` (de bas en
haut).

**Grammaire de scroll.** Rail de chapitres numérotés (« 01 · La couche »), filet de progression
rouge sous le header. 3 pins, tous sur l'accueil (héros, « La carte », Studio). Scrub lié à `uCutZ`
et aux compteurs ; `lenis/snap` en fin de chapitre. Lenis sur accueil, boutique, produit, studio,
atelier et contact ; **jamais** sur panier, checkout, compte, admin, oauth, agent, légal ni suivi.

**Survol ↔ tactile** : courbes resserrées sous le curseur ↔ onde au tap ; couleurs qui montent sur
une carte produit au survol ↔ balayage unique à l'entrée dans la vue ; réticule « cote » du Studio ↔
poignées de 44 px et `vibrate(5)` tous les 5 mm ; info-bulles de cotes ↔ cotes toujours visibles.

**Transitions de page** (`<ViewTransition>`) : « **Coupe** ». La page sortante est masquée de bas en
haut en 8 paliers de `clip-path` (des couches), avec un filet rouge qui monte, en 480 ms. La carte
produit se morphe vers la galerie (`name` par slug) et le header reste ancré. Un indicateur
`useLinkStatus` (compteur mono « Couche 12… ») couvre le TTFB. Sous Firefox, fondu seul.

**Son** : coupé par défaut, bouton « Son » ; Web Audio génératif (bourdon pas à pas, tic toutes les
5 couches), zéro fichier, jamais dans le tunnel.

**Reduced motion** : ni Lenis, ni pin, ni scrub ; états finaux, fondus de 150 ms, Stage non chargé
sur l'accueil (posters SVG). Interrupteur « Réduire les animations » posé avant le paint par le script
anti-FOUC existant (nonce), conforme WCAG 2.2.2.

---

## 4. Héros : storyboard

**Objet** : le vase Studio « Lavaux » dans une configuration d'exemple (160 mm, côtes torsadées,
3 bandes : Encre / Glacier / Signal), étiqueté « Objet Studio · configuration d'exemple · rendu temps
réel ». **Ce n'est jamais le vase d'Ian.**

**Premier paint (0 ms, SSR)** : fond papier, grille à filets, `<h1>` Archivo géant « Tout relief
commence par une couche. » (**élément LCP**, visible sans JS), sous-titre, 2 CTA et un **poster SVG
en élévation** : les isolignes du même vase, générées par le même code au build
(`public/hero/lavaux-iso.svg`, ~15 Ko, ratio réservé, donc CLS 0). Aucun overlay, aucun préloader.

| Beat | Desktop | Mobile 375 px | Reduced motion |
|---|---|---|---|
| B0, idle après hydratation | Chargement du Stage (`next/dynamic`, `requestIdleCallback`). Canvas en fondu, **calé au pixel sur le poster SVG** (même projection) : le dessin devient matière. | Tier bas : DPR 1,5, 96 segments, sans post-traitement. | Stage non chargé, le poster reste. |
| B1, intro 2,4 s (une fois par session) | Plateau en filets, buse (point rouge), impression de 0 à 18 %. Compteur mono « Couche 0144 / 0800 · z 28,8 mm ». | Impression complète autojouée en 3,2 s, puis arrêt. Bouton « Rejouer ». | — |
| B2, pin de 250 vh, scrub | 18 → 100 %. À chaque frontière de bande : flash rouge de 320 ms et étiquette « Changement de filament → Glacier · couche 312 ». Au-dessus de la coupe, isolignes fantômes : la carte avant le terrain. | Pas de pin (pas de conflit avec la barre iOS). Le compteur se termine au scroll via IntersectionObserver. | Valeurs finales affichées. |
| B3, bascule `s3d.carte` | Caméra en vue de dessus orthographique : les couches deviennent des cercles concentriques, qui s'étendent en **champ de courbes plein écran** (chapitre 02). | Fondu vers le champ statique. | SVG statique. |
| B4, CTA | « Composer le mien → » (rouge) · « Boutique » · « J'ai un fichier ». | Idem, empilés. | Idem. |

**Technique.** `MeshPhysicalMaterial` + `onBeforeCompile` : `discard` si `z > uCutZ` ; bande
émissive rouge de 0,3 mm à la coupe ; normale perturbée `sin(2π·z/uLayerH)` ; lignes maîtresses toutes
les 5 couches par `fwidth` anti-aliasé ; couleurs `uBandZ[3]` et `uBandColor[4]`. Le fond est un quad
plein écran : FBM, isolignes anti-aliasées, lignes maîtresses, `uVel = ScrollTrigger.getVelocity()`
lissé (les courbes se resserrent et s'épaississent) et dither Bayer.

**Budgets** : chunk Stage ≤ 190 Ko gzip, chunk motion ≤ 65 Ko, Worker +0 Ko. Géométrie générée
(0 octet téléchargé). ≤ 120 k triangles en desktop, 40 k en mobile. < 20 draw calls. **Un seul
contexte WebGL**. LCP ≤ 2,0 s (texte). INP ≤ 150 ms. Boucle en pause hors écran, rendu à la demande.

---

## 5. Le Studio (configurateur)

### 5.1 Modèle commun

- **Couleur par altitude** : 1 à 4 filaments, frontières de bandes **quantifiées à 0,2 mm**. Un
  seul STL suffit : l'atelier place les changements de filament « à la couche » dans Bambu Studio.
  C'est le workflow réel de l'AMS. Palette = inventaire réel des bobines (sinon « palette
  indicative »).
- **Génération** : fonctions pures TS en millimètres, **Z vers le haut** (rotation d'affichage vers
  Y en three), PRNG seedé (mulberry32), donc une même URL donne exactement le même objet. Maillages
  fermés et manifold, vérifiés par un test Vitest de propriété (chaque arête partagée par 2 triangles,
  sur 200 jeux de paramètres aléatoires).
- **Estimation** (`src/lib/studio/estimate.ts`, pur TS sans three, donc réutilisable côté serveur) :
  `g = (aire latérale × paroi + aire de fond × 0,8 mm) × 1,24 g/cm³ + (bandes − 1) × purge` ;
  `t = volume / débit effectif + couches × 1,5 s + changements × 150 s + 6 min`. Prix
  `max(plancher, forfait + g·CHF/g + h·CHF/h + changements·CHF)`, arrondi à 0,50, en **centimes
  entiers**, affiché en **fourchette ±8 %** : « Estimation CHF 31–36 · prix ferme confirmé par
  l'atelier sous 1 jour ouvré ». Coefficients calibrés sur le vase spirale (120 g, CHF 24) et validés
  par le propriétaire.

### 5.2 Catalogue d'objets (originaux Swiss3Design)

| Objet | Paramètres (plage · défaut) | Géométrie |
|---|---|---|
| **Vase « Lavaux »** (P2) | hauteur 80–240 · 160 mm ; Ø max 50–140 · 90 ; profil cylindre / bouteille / amphore / cône / galet ; col 30–100 % · 55 ; paroi 1,2–2,0 · 1,2 mm ; motif lisse / côtes (8–96 · 40, profondeur 0,5–4 mm) / torsion (0–360° · 120) / vagues (amplitude 0–4, fréquence 1–12) / voronoï (12–120 cellules, relief 0,5–3) / gradins façon terrasses de Lavaux (pas 1–10 mm) / facettes (3–12) ; 1–4 bandes | Grille paramétrique `r(θ,z) = profil(z) + motif(θ,z)` en `BufferGeometry`, bruit cellulaire périodique en θ (sans couture), fond fermé. Pente de profil bornée à 45° (imprimable sans support). Multicolore imprimé en mode standard (3 périmètres). Spirale seulement en monochrome, à valider par l'atelier. |
| **Carte de visite « Cartouche »** (P2) | 85×55 mm ; épaisseur 1,0–2,4 · 1,6 ; coins 0–6 · 3 ; nom ≤ 28 caractères, fonction ≤ 36, 2 lignes de contact ≤ 40 ; relief 0,4–1,2 · 0,6 ; mises en page Classique (grille suisse), Centrée, Cartouche (cadre et filet), Topo (courbes gravées en fond), QR (29 modules, 30 mm) ; 2–3 couleurs (plaque / relief / cadre) | `ExtrudeGeometry` (plaque arrondie) + `TextGeometry` avec police typeface JSON auto-hébergée (Archivo SemiExpanded Bold et Geist Mono, sous-ensemble latin étendu, ~70 Ko gzip chacune, chargées seulement dans le Studio). QR via le codeur de `qrcode.react` (déjà installé), modules extrudés. Garde-fous : hauteur de capitale ≥ 3 mm, trait ≥ 0,8 mm, sinon avertissement. |
| **Sous-verre « Relief »** (P4) | Ø 80–110 · 95 mm (ou carré) ; épaisseur 4–9 · 6 ; massif (seed) ; relief 0,8–3 mm ; strates 4–15 · 10 ; niveau du lac 0–40 % ; teintes lac / prairie / roche / neige ; gravure « Pointe [Nom] 2 431 m » (altitude fictive calculée) | FBM → marching squares (`d3-contour`, ISC, ~10 Ko) → un `Shape` extrudé par strate. **C'est littéralement une carte en courbes empilées.** |
| **Porte-nom « Borne »** (P4) | forme pilule / rectangle / pic générique / goutte ; longueur 40–80 · 60 ; épaisseur 3–5 · 4 ; texte 1–14 caractères ; anneau Ø 4–6 · 5 ; relief ou gravure ; 2–3 bandes | `ExtrudeGeometry` + texte + perçage (`Shape.holes`). **Pas de croix suisse ni d'armoiries** (loi sur la protection des armoiries). |
| **Plaque de bureau « Signal »** (P5) | prisme 120–220 × 30–50 mm, texte recto ou recto-verso, 2 couleurs | Prisme extrudé + texte. Clin d'œil aux panneaux de randonnée, sans copier leur norme. |

Le **« Vase spirale » d'Ian n'entre jamais dans le Studio**, qui ne contient que nos objets.

### 5.3 UX d'instrument

**Desktop** : rail des 5 « stations » à gauche ; scène centrale en vues Élévation (SVG 2D, aussi
repli sans WebGL) / Plan / 3/4 / Coupe ; panneau droit numéroté (01 Forme, 02 Motif, 03 Couleurs,
04 Texte, 05 Fiche). Les couleurs se règlent sur une **barre altimétrique** dont on glisse les
frontières (légende hypsométrique). En bas, une **bande de mesure** mono : « 160,0 mm · 800 couches ·
≈ 46 g · ≈ 3 h 10 · 2 changements · CHF 31–36 ». Réglettes graduées, maîtresses toutes les 5 unités.

**Mobile** : canvas sticky (46 svh), réglages en bottom sheet à onglets (paliers 35/72 %), BottomNav
remplacée par une barre Studio (retour, estimation, « Envoyer à l'atelier »).

**État partageable** : fragment `#c=v1.<base64url>` (`replaceState`, debounce 300 ms) : aucun rendu
Worker, aucun doublon SEO, canonical `/studio/<objet>`. « Mes configurations » en `localStorage`
(try/catch).

**Accessibilité** : `range` natifs couplés à un champ numérique avec unité, `aria-valuetext`
(« 160 millimètres, 800 couches »), Maj+flèche = ×10, `fieldset`/`legend`, motifs et couleurs en
radios nommées, `aria-live="polite"` (debounce 1 s), canvas avec description textuelle générée.

### 5.4 Parcours de commande réel (zéro changement de schéma en Tier A)

1. « Envoyer à l'atelier » → `STLExporter` binaire (Z en haut, mm, maillage d'export 240 × 400
   ≤ 12 Mo) → `File` → `POST /api/quote-upload` (30 Mo, 10/h ; vérifier `hasExpectedSignature`).
   Attente narrée.
2. `sessionStorage` (try/catch) ← `{fileKey, fileName, params, estimate}` → `/custom#studio`.
3. `QuoteForm` prérempli : PLA, couleurs (« Encre 0–42 mm, Glacier 42–118 mm, Signal 118–160 mm »),
   dimensions, description avec le **lien exact de la configuration** et l'estimation. Server Action
   existante, sans `redirect()`. `Quote Requested` + `source: "studio"`.
4. P4 : colonne `studio_config jsonb`, aperçu admin. P6 : commande directe, prix ferme recalculé
   serveur par `estimate.ts`. Téléchargement public du STL désactivé par défaut.

---

## 6. Plan page par page

- **Header** (64 px conservés : aucun offset `top-16` à réaligner) : mark + wordmark Geist, onglets
  à filet (Boutique, Studio, Sur mesure, Atelier), favoris, langue, thème, compte, « Panier (2) ».
  Filet de progression rouge sur les chapitres. **BottomNav** : Accueil, Boutique, Studio, Panier,
  Compte (trou `md`/`lg` du footer corrigé).
- **Accueil** : 00 Héros · 01 « La couche » (l'échelle de 0,2 mm face à un cheveu) · 02 « La carte »
  (vase → plan → massif en teintes hypsométriques = le vrai modèle AMS) · 03 Studio (4
  mini-instruments vivants) · 04 Collection · 05 Atelier (Gland · Pully, schémas SVG existants animés,
  seuil de port dynamique) · 06 « J'ai un fichier ».
- **Boutique** : à **N = 1**, une planche éditoriale (« Fiche d'identité » du vase spirale) suivie de
  la bande « À composer » (Studio). À **N = 50** : grille 1/2/3 colonnes, filtres SSR en **légende de
  carte**, cartes cotées en altitude (« Alt. 209 mm »), bascule grille ou liste. JSON-LD et facettes
  inchangés.
- **Fiche produit** (format NODAL) : viewer migré dans le Stage (cyclorama papier, sol en courbes),
  **rotation seulement** pour le vase d'Ian (ni coupe, ni teinte non vendue), chapitres Rendu →
  Matière → Fiche technique `<dl>` SSR → Commander. **Bloc d'attribution** : « Design : Ian — “Vase”,
  MakerWorld · Licence CC BY-ND 4.0 · imprimé sans modification », lien
  https://makerworld.com/fr/models/1262112-vase, repris dans la description. Tier A :
  `src/lib/attribution.ts` (slug → crédit) ; P4 : colonnes en base.
- **Studio** : `/studio` et `/studio/[objet]`, chacun avec h1, description, `<dl>` des paramètres,
  exemples et FAQ en SSR ; ajout à `STATIC_PAGES`, `llms.txt` et sitemap.
- **Sur mesure** : « fiche de commande » à filets, carte « Configuration Studio jointe », logique
  intacte. **Atelier** (ex-À propos, même URL) : FAQ SSR conservée, AboutNav en rail kilométrique.
  **Contact** : cartouche et deux points cotés.
- **Favoris** : objets et configurations. **Panier** : « Terrain vierge. », port gratuit en profil
  d'altitude. **Checkout** : jetons, typographie et `stripeAppearance` seulement (ni Lenis, ni Stage,
  ni transform autour de l'iframe). **Succès** : « Commande reçue. La buse chauffe. »
- **Suivi** : **profil altimétrique** de randonnée (Commande → Impression → Contrôle → Expédié →
  Livré). **Auth et compte** : papier calme, courbes statiques, `<main>` imbriqué corrigé, avatars en
  strates (P5). **Légal** : « Art. 1… », sans motion.
- **404** : « Point non coté. », point rouge « Vous êtes ici », « Altitude 404 m, 32 m au-dessus du
  Léman ».
- **Footer** : cartouche (Équidistance 0,2 mm · Échelle 1:1 · coordonnées), champ de courbes,
  interrupteurs « Réduire les animations » et « Son », paiements et crédits conservés.
  **Consentement** : « encart de légende » en bas à gauche, textes `consent.*` intacts.

---

## 7. Composants et scènes du Stage

**DOM (SSR)** : `Chapter`, `ChapterRail`, `GridHairlines`, `MapFrame` (graduations et coordonnées),
`RedDot`, `IsoPoster` (SVG), `SpecTable`, `MeasureBar`, `Ruler` (graduations), `BandEditor`,
`ParamSlider`, `PatternRadio`, `SwatchRadio`, `AttributionBlock`, `ElevationProfile` (suivi, port),
`LegendBox` (consentement, filtres), `Cartouche` (footer), `StudioSheet`, `LayerCounter`
(`Intl.NumberFormat`).

**Client-only** (`src/motion/**`, uniquement via `next/dynamic({ ssr:false })`, avec une règle oxlint
`no-restricted-imports`) : `MotionRuntime` (Lenis, ticker GSAP, matchMedia), `useChoreo`,
`PageCut` (transition), `SoundToggle`.

**Stage** (un renderer, des vues en scissor) : S1 `contour-field` (fond, footer) · S2 `print-hero` ·
S3 `studio-object` · S4 `product-viewer` (migration de `showroom-scene`) · S5 `plan-transition` ·
S6 `band-ripple` (une couleur monte couche par couche) · S7 `thumb-baker` (vignettes en dataURL, même
contexte) · S8 `relief-map` (générateur du sous-verre).

---

## 8. Voix et copie

Précise, sèche, un sourire en coin. Des chiffres avec leur unité. Aucun superlatif. « Nous »
d'atelier. Vouvoiement ; allemand avec « Sie », **sans ß** ; italien avec « Lei ». Pas de
« Swiss made » (seuil LPM de 60 %), mais « imprimé à Gland et à Pully ».

- « Tout relief commence par une couche. »
- « Équidistance : 0,2 mm. »
- « Quatre bobines. Une pièce. Zéro colle. »
- « Changez un chiffre, la pièce suit. »
- « Votre nom, en relief. Littéralement. »
- « Ici, les courbes de niveau tiennent debout. »
- « Imprimé à Gland et à Pully. Livré de Genève à Romanshorn. »
- « Estimation, pas promesse. L'atelier confirme sous un jour ouvré. »
- « Point non coté. »
- « Terrain vierge. »

---

## 9. Demandes au propriétaire (minimales) et Tier A

**Tier A (rien de nouveau)** : géométries procédurales, posters SVG générés, shaders, polices
`next/font`, photos existantes du vase spirale ; **ni CSP** (pas de WASM ni de média, STL en POST
same-origin) **ni schéma** modifiés.

**Demandes** : (1) inventaire réel des bobines (marque, nom, hex) ; (2) validation des coefficients
de prix et de purge ; (3) téléchargement public du STL, oui ou non ; (4) optionnel : redessin
vectoriel du mark, police suisse premium.

**Rendus Blender** (MCP, Blender ouvert par le propriétaire) : poster du héros Lavaux 2400×3000 AVIF ;
OG 1200×630 (accueil, studio, chaque objet, vase spirale non modifié) ; turntable de 72 images du vase
spirale blanc et noir (tier bas) ; macro de lignes de couche.

**Un seul prompt ChatGPT** (ambiance du chapitre Atelier, étiqueté « Illustration ») : *« Vue
aérienne à l'aube des terrasses viticoles de Lavaux au-dessus du lac Léman, brume basse, lumière
rasante du nord-ouest, rendue comme une gravure cartographique monochrome sépia sur papier crème,
courbes de niveau fines visibles, aucune personne, aucun bâtiment reconnaissable, aucun texte,
format 3:2 »*. Les cartes imaginaires (404, auth) sont générées en code.

---

## 10. Risques et plan de livraison

| Risque | Mitigation |
|---|---|
| three ou GSAP qui fuient dans le Worker | `src/motion/**` + garde oxlint + `wrangler deploy --dry-run` à chaque phase |
| LCP retardé par la motion | h1 et poster SSR, aucun SplitText sur l'élément LCP |
| Configurations non imprimables | Bornes de pente, épaisseurs minimales, test manifold, validation par l'atelier |
| Estimation perçue comme un prix | Fourchette, libellé « estimation », prix ferme par devis |
| Licence CC BY-ND | Vase d'Ian exclu du Studio, attribution visible, aucune coupe ni remix |
| Armoiries et Swissness | Aucune croix, aucun « Swiss made » |
| iOS, pins, perte de contexte | Pas de pin mobile, `ignoreMobileResize`, repli poster sur `webglcontextlost` |
| Taille des replays PostHog et INP | Masquer ou échantillonner le replay sur `/studio`, auditer les actions à sélecteurs |
| Longueurs en allemand | Tests de mise en page DE, `autoSplit` |
| Dérive de la branche | Noms de tokens conservés, livraison par route |

**Phases** (chacune validée sur une preview dédiée) : **P0** tokens, polices, `src/motion`, garde de
lint, exclusions par route · **P1** héros, champ de courbes, « Coupe », header et footer · **P2**
Studio Lavaux et Cartouche, export STL vers devis · **P3** boutique, fiche produit et attribution,
Atelier, 404 · **P4** Relief, Borne, `studio_config`, configurations sauvegardées · **P5** Blender et
OG, son, Signal, avatars · **P6** (hors refonte) commande directe à prix ferme.

# Concept n° 2 : « G1 » (Atelier / Toolpath)

> Direction artistique n° 2. Parti pris : **la vérité du procédé**. Le trancheur et la
> machine sont l'esthétique. Tout ce qui bouge est un trajet de buse, une couche ou une
> donnée d'impression. Aucune décoration.

---

## 1. Nom et thèse

**G1**, du nom de la commande G-code du déplacement linéaire avec extrusion
(`G1 X… Y… Z… E…`). C'est le geste de base de chaque objet vendu par Swiss3Design.

En 2026, les sites « motion » se ressemblent tous : vidéo IA en fond, verre dépoli,
grain, curseur magnétique. Swiss3Design a ce qu'ils n'ont pas : **un procédé montrable,
vrai et calculable**. Le mark est déjà une pile de 6 strates, le rouge de la marque est
la **buse chaude**, le papier chaud est le **plateau**, l'encre la **chambre de la
machine**. Le style international suisse (grilles, filets, chiffres alignés) et
l'interface d'un trancheur (tableaux de valeurs exactes) sont de la même famille.

Chaque animation a donc une cause physique :

- une ligne se dessine parce qu'une buse la dépose ;
- une couleur change parce qu'une bobine a été permutée, et la purge est affichée ;
- un chiffre défile parce qu'une couche a été ajoutée.

C'est la règle 4 de la Forge (« les animations signifient quelque chose ou n'existent
pas »), poussée jusqu'au bout.

**Ce que je garde de la Forge :**

- la formule de prix (matière + machine + **purge des couleurs** + préparation) ;
- la règle « le serveur ne fait jamais confiance au prix client » ;
- les attentes narrées ;
- les patterns interdits (compte à rebours, fausse rareté, pop-up) ;
- le suivi de fabrication honnête ;
- la page d'accueil à double intention, ici « Choisir un objet / Régler le sien ».

**Ce que je reporte :** l'upload arbitraire à prix ferme, `/matieres` et `/pro`. Le
**Studio** devient le premier devis « instantané », sur une géométrie **que nous
connaissons**, et dont nous garantissons qu'elle s'imprime.

---

## 2. Direction artistique

### 2.1 Palette

On garde les noms de jetons (un contrat avec 116 fichiers, dont l'admin). Seules les
valeurs changent, et on en ajoute trois.

| Jeton | Clair « Plateau » | Sombre « Chambre » | Usage |
|---|---|---|---|
| `paper` | `#F3F0EA` | `#0E0D0B` | fond |
| `surface` / `elevated` | `#FBFAF7` / `#FFFFFF` | `#171512` / `#1F1C18` | panneaux, tableaux |
| `ink` | `#16130F` (16,3:1) | `#EFEBE4` (16,4:1) | texte |
| `soft` | `#625B53` (5,9:1) | `#A39B90` (7,1:1) | secondaire, étiquettes |
| `line` | `#D9D3CA` | `#2E2A25` | filets 1 px décoratifs |
| `accent` | `#E5231C` | `#E5231C` | remplissages, traits, buse (4,0:1 et 4,2:1 : jamais de texte < 24 px) |
| **`accent-text`** (nouveau) | `#B8170F` (5,8:1 paper, 6,4:1 surface) | `#FF6B5E` (7,0:1 et 6,5:1) | liens et chiffres rouges |
| **`on-accent`** (nouveau) | `#FFFFFF` sur `#E5231C` (4,6:1) | idem | boutons rouges, ≥ 16 px semi-bold |
| **`toolpath`** (nouveau) | `#8A8176` | `#5E574F` | tracés fantômes du trancheur (non textuels, 3,4:1) |
| `night` | `#0E0D0B` | `#0E0D0B` | chapitres « dans la machine » |

**Règles d'usage**

- Un codemod migre les 107 usages de `text-accent` vers `accent-text`.
- Les bascules de chapitre vont de `paper` à `night`, jamais l'inverse. En thème sombre,
  les sections papier passent sur `surface`, ce qui évite tout flash.

**Filaments de démonstration** du Studio, étiquetés « teintes indicatives » tant que
l'inventaire réel manque :

| Teinte | Hex |
|---|---|
| Rouge S3D | `#E5231C` |
| Encre | `#1C1917` |
| Blanc | `#F5F5F4` |
| Bleu Léman | `#1D4ED8` |
| Ambre | `#F59E0B` |
| Béton | `#8C8A85` |

### 2.2 Typographie

Toutes les polices sont en OFL et chargées via `next/font`.

**Display et étiquettes : Martian Mono** (Google Fonts, variable `wght 100–800`,
`wdth 75–112.5`). C'est une mono de trancheur avec un axe de chasse.

- Titres : `wdth 112` / `wght 300`.
- Étiquettes : `wdth 87.5` / `wght 450`, 11–12 px, `letter-spacing .04em`.
- Au passage de la buse, `wdth` s'anime de 75 à 112 : la lettre « s'extrude ».

**Texte et UI : Geist, inchangée.** Le checkout et l'apparence Stripe restent intacts.

**Chiffres :** `tabular-nums slashed-zero`, formatés par `Intl.NumberFormat(locale)`, y
compris dans le canvas. On écrit `0,2 mm` en fr-CH, `0.2 mm` en de-CH et it-CH, et le
séparateur de milliers est `’`.

**Alternative premium suisse :** ABC Diatype + Diatype Mono (Dinamo), ou Suisse Int'l +
Suisse Int'l Mono.

**Échelle fluide** (375 → 1440 px) :

| Niveau | Valeur |
|---|---|
| `--t-mega` | `clamp(3.25rem, 1.6rem + 7vw, 8.5rem)` |
| `--t-h1` | `clamp(2.4rem, 1.5rem + 3.8vw, 5rem)` |
| `--t-h2` | `clamp(1.75rem, 1.3rem + 1.9vw, 3rem)` |
| `--t-h3` | `clamp(1.25rem, 1.1rem + .6vw, 1.6rem)` |
| `--t-body` | `1rem` |
| `--t-label` | `.75rem` |
| `--t-micro` | `.6875rem` (HUD) |

- Interligne : 1,02 pour la display, 1,55 pour le texte.
- On teste la mise en page avec les mots allemands longs (« Filamentwechsel »). Pas de ß
  en de-CH : « Grösse ».

### 2.3 Grille, texture, icônes, rendu, mark

**Grille « plateau »**

- 12 colonnes en desktop (gouttière 24 px), 4 en mobile (marge 16 px).
- Les chapitres techniques ont un quadrillage de plateau : repères tous les 8 px, trait
  majeur tous les 64 px, en `line` à 40 %.
- On utilise des tableaux à filets plutôt que des cartes à ombre.
- `rounded-card` passe à 4 px ; les boutons restent `rounded-full`.

**Texture** (pas de grain vidéo) :

- des **stries de couche** en `repeating-linear-gradient` sur les surfaces « imprimées » ;
- une **trame de Bayer 4×4** (shader et SVG) pour les ombres et les transitions.

**Icônes :** 16 pictogrammes maison tracés comme des toolpaths (monotrait, grille de 24,
trait de 1,5 px, extrémités carrées). Lucide sert de repli.

**Rendu 3D**

- PBR mat, PLA à `roughness 0.55`.
- Stries de couche en normales procédurales, au pas de 0,2 mm.
- `RoomEnvironment` et une lumière rasante.
- Plus de pièce grise ni de parquet.

**Mark**

- Le raster `mark.webp` reste le seul officiel. Le loader le **révèle par hachures** : un
  masque SVG de lignes à 45° le remplit comme un infill, sans jamais le redessiner.
- Option à faire valider (changement de marque) : vectoriser les 6 strates, ce qui
  permettrait un vrai toolpath du mark. Rien n'en dépend en Tier A.

---

## 3. Langage de mouvement

**Principes**

1. Un mouvement correspond à un geste de machine : déplacement, extrusion, couche,
   rétraction ou permutation.
2. Le contour précède le plein.
3. Le temps est quantifié : les apparitions avancent par paliers de couche.
4. Un plan continu : pas de fondu enchaîné générique.

**Courbes** (`CustomEase`, dans `src/motion/gsap.ts`)

| Nom | Définition | Usage |
|---|---|---|
| `g0` (rapide) | `M0,0 C0.7,0 0.2,1 1,1` | déplacements, panneaux, transitions |
| `g1` (extrusion) | `M0,0 C0.12,0 0.2,1 1,1` | tracés, DrawSVG |
| `retract` | `M0,0 C0.3,0 0.4,1.12 0.7,1.04 0.85,0.98 1,1` | fin de geste (boutons, compteurs) |
| `purge` | `M0,0 C0.2,1.6 0.45,0.9 1,1` | apparition d'une couleur |
| `layer` | `steps(n)` | couches, compteurs, lignes SplitText |

**Rythme**

- Durées en doublement : 120 / 240 / 480 / 960 ms.
- Décalage de 40 ms par « couche », plafonné à 12 éléments.

**Grammaire de scroll**

- Chapitres numérotés `01/06` en rail mono.
- Une **barre Z** de 1 px sous le header (`Z 0,0 → 209,0 mm`).
- Les pins sont réservés à l'objet : 250 vh au plus en desktop, 120 vh au plus en mobile,
  et aucun sous 768 px de hauteur d'écran.
- Les scrubs ne pilotent que des grandeurs physiques : hauteur imprimée, éclatement,
  coupe.
- Pas de snap.
- Lenis (`lerp 0.1`, `syncTouch false`) uniquement dans le groupe de routes `(site)`,
  avec `ignoreMobileResize` et des unités `svh`.

**Équivalents tactiles**

| Interaction | Souris / clavier | Tactile |
|---|---|---|
| Rayon X | suit le curseur | appui long puis glissé, ou bouton « Rayon X » |
| Soulignement des liens | se trace au survol, déjà tracé au focus clavier | idem au focus |
| Coloris | la couleur remonte les couches au survol | idem au tap |

Pas de bouton magnétique : il n'a pas de cause physique.

**Transitions de page (« travel »)**

1. Pendant l'attente serveur (`useLinkStatus`), la barre Z devient une buse rouge qui
   traverse l'écran (`g0`, 480 ms).
2. Au commit, `<ViewTransition>` : l'ancienne page se rétracte (120 ms), la nouvelle entre
   par `clip-path` en 12 paliers sur 480 ms.
3. Morph `share="morph"` entre la vignette produit et la galerie.
4. Firefox reçoit un fondu simple.

**Son :** coupé par défaut. Le bouton « Son » active un synthé Web Audio, sans aucun
fichier :

- le chant des moteurs pas à pas, dont la hauteur suit la vitesse de la buse ;
- un clic à chaque permutation de bobine.

**Mouvement réduit** (préférence de l'OS ou bouton du footer, classe posée par le script
anti-FOUC déjà doté du nonce) :

- états finaux, sans pin, sans scrub, sans Lenis ;
- simulations remplacées par un sélecteur « première / milieu / dernière couche » ;
- transitions à 0 ms ;
- WebGL réduit à une seule image.

---

## 4. Héros de l'accueil : « Couche 1 »

**L'objet : Onde n° 01**, un vase procédural Swiss3Design : 180 mm, 24 nervures torsadées
à 35°, trois bandes Encre / Rouge / Blanc. Ce n'est **pas** le Vase spirale (CC BY-ND),
qui n'est jamais tranché ni recoloré.

**Premier paint (SSR, sans JS)**

- H1 en Martian Mono : « Chaque objet commence par un trait. »
- Deux CTA.
- `<img fetchpriority="high" src="/stage/onde-01-toolpath.svg">` d'environ 35 Ko. Il est
  **généré au build par le même code géométrique** et montre l'aperçu du trancheur au
  cadrage exact de la caméra.
- HUD SSR : `Couche 900/900 · Z 180,0 · 3 filaments · 41 g · 2 h 50`.

Le LCP est le H1 ou le SVG. Il n'y a ni overlay ni opacité à 0.

**Storyboard par battement**

| Battement | Desktop | Mobile 375 px | Mouvement réduit |
|---|---|---|---|
| **B0** idle à +1,2 s | Le canvas se superpose au SVG au même cadrage (240 ms). Loader : le mark se remplit par hachures dans le header. | Identique, DPR 1,5 | SVG seul |
| **B1** scroll 0–60 % (pin 250 vh) | `uPrintHeight` scrubbé de 0 à 180 mm. PBR plein sous la coupe, **aperçu fantôme** au-dessus (un anneau sur 6, en LineSegments). Une buse suit la spirale, avec un liseré émissif rouge. Le HUD avance par paliers. | Pin de 120 vh, puis lecture automatique. Une **réglette Z** verticale (`input range`) permet de scrubber au pouce. | Sélecteur de couche 1 / 450 / 900 |
| **B2** changements de bobine | Pause de 120 ms, flash `purge`, la **tour de purge** gagne un palier. Libellé : « Changement 2/2 · purge 3,1 g ». | Identique | Tableau |
| **B3** 60–85 % | L'objet se décolle du plateau, pivote de ¾ et s'**éclate par filament** : les bandes s'écartent de 12 mm, chacune étiquetée (« PLA Encre · couches 1–300 · 14 g »). | Lecture automatique, étiquettes en liste | Image fixe + liste |
| **B4** 85–100 % | L'objet se réassemble. « Régler le mien » ouvre `/studio/vase` avec la même configuration. | CTA collant | Idem |

**Technique**

- `BufferGeometry` paramétrique : 256 × 360 en desktop (environ 92 000 sommets), 128 × 180
  en mobile.
- `MeshStandardMaterial` + `onBeforeCompile` :
  - `discard` au-dessus de la coupe ;
  - normale en `sin(y/0.2·2π)` ;
  - couleurs par bande (`uBand[4]`, `uBreak[3]`) ;
  - émissif à la ligne de coupe.
- Buse, plateau et tour de purge : 12 draw calls au plus.
- Pas de post-traitement en Tier A. Le palier haut ajoute SMAA et un bloom seuillé sur le
  rouge.

**Budgets**

| Poste | Budget |
|---|---|
| Stage | ≤ 190 KiB gzip |
| Chunk motion (GSAP + plugins + Lenis) | ≤ 65 KiB |
| Worker | **+0 KiB** |
| Cadence | 60 fps sur M1 et iPhone 12, déclassement automatique après 60 frames lentes |
| Rendu | à la demande, pause hors écran et onglet caché |

---

## 5. Le Studio (configurateur « slicer »)

### 5.1 Catalogue d'objets (originaux Swiss3Design)

**Onde** (vase, mode vase)

- Paramètres :

  | Paramètre | Plage | Défaut |
  |---|---|---|
  | Hauteur | 80–240 mm | 180 |
  | Diamètre | 50–140 mm | 90 |
  | Profil | droit, bouteille, amphore, cône | — |
  | Motif | nervures, torsade, vagues, voronoï, lisse | — |
  | Nombre de motifs | 6–60 | 24 |
  | Amplitude | 0–4 mm | 2 |
  | Torsion | −180° à 180° | 35° |
  | Bandes | 1–4 | — |

- Géométrie : surface paramétrique `r(θ,z) = profil(z)·(1 + motif(θ + torsion·z/h, z))`.
  Le voronoï est un relief cellulaire, sans trou. Le fond est plein (1,2 mm). La pente
  est limitée à 45° et l'amplitude bornée par le diamètre.

**Carte** (carte de visite en relief)

- Paramètres :
  - format 85×55 ou 90×50 ;
  - mise en page Centre, Colonne ou Monogramme ;
  - nom jusqu'à 28 caractères, deux lignes jusqu'à 36 caractères ;
  - relief de 0,6, 1,0 ou 1,4 mm ;
  - bordure oui ou non ;
  - 2 ou 3 couleurs.
- Géométrie : plaque `ExtrudeGeometry` de 1,2 mm, texte `TextGeometry`. Les polices
  **typeface JSON sont auto-hébergées** (Martian Mono et Geist Bold, Latin-1, environ
  80 Ko chacune, converties avec facetype.js, ce que l'OFL permet). Un trait de moins de
  0,8 mm est refusé.

**Étiquette** (porte-nom ou porte-clés)

- Paramètres : texte jusqu'à 14 caractères, forme pilule, drapeau ou pic, épaisseur de 3
  à 5 mm, anneau à gauche ou à droite, 2 couleurs.
- Géométrie : `Shape` avec un trou, extrudée. Le texte est en relief ou en creux.

**Relief** (dessous de verre topographique)

- Paramètres : diamètre 90–110 mm, graine 0–9999, relief de 1 à 6 mm, 3 ou 4 bandes,
  terrain Alpes, Jura ou Lac.
- Géométrie : bruit simplex (licence MIT) **quantifié en couches de 0,2 mm**, contours
  par marching squares. Les bandes d'altitude sont les bandes de couleur : la carte topo
  est littéralement un empilement de couches. Remplissage gyroïde à 15 %, visible au
  rayon X.

**Plus tard :** Chevalet de bureau, Abat-jour en treillis.

### 5.2 Le multicolore, sans mensonge

Une buse avec AMS change de couleur **par couche**. Chaque objet est donc décrit par une
liste `[{ filament, zDébut }]`, avec 4 filaments au maximum.

- Pour la Carte et l'Étiquette, les bascules tombent sur les hauteurs de relief.
- L'UI est une **réglette Z verticale** (comme la barre des couches de Bambu Studio), à
  poignées déplaçables et doublée de champs numériques.
- L'utilisateur ne peut configurer que ce que l'atelier sait réellement imprimer.

### 5.3 Rapport de tranchage (calculé dans un Web Worker)

| Donnée | Calcul |
|---|---|
| Couches | `ceil(h / 0,2)` |
| Grammes | volume extrudé × 1,24 g/cm³. Mode vase : aire × ligne de 0,45 mm. Objets pleins : 2 périmètres + 4 couches pleines + 15 % de remplissage |
| Temps | longueur du trajet / vitesse par type + 1,5 s par couche + 75 s par permutation |
| Purge | permutations × grammes par purge, avec la tour dessinée |

- Mention affichée : « estimation ±20 % ». On calibre sur 3 exports Bambu Studio.
- Les coefficients vivent dans `src/lib/studio/estimate.ts`, partagé entre client et
  serveur.
- **Prix :** une fourchette en CHF selon la formule de la Forge, affichée seulement si le
  propriétaire fournit ses coefficients. Sinon, on n'affiche que les grammes et le temps.

### 5.4 Parcours

**Desktop**

- « Plateau » sur 60 % de la largeur : le canvas et le bouton **Simuler** (×1, ×10 ou
  ×100), qui annonce la durée réelle.
- Panneau d'onglets `01 Forme · 02 Motif · 03 Couleurs · 04 Texte`.
- Rapport collé en bas, avec le CTA « Envoyer à l'atelier » toujours visible.

**Mobile**

- Canvas collant à 52 svh.
- Bottom sheet à 3 hauteurs.
- Le rapport tient sur une ligne mono.
- La BottomNav est masquée dans le Studio.

**Pendant un réglage :** la géométrie est recalculée en basse résolution à chaque frame,
puis en haute résolution 150 ms après le relâchement.

### 5.5 Vers une vraie commande (Tier A, backend inchangé)

« Envoyer à l'atelier » ouvre un tiroir : e-mail prérempli, quantité, remarque. À l'envoi :

1. `STLExporter` produit un STL binaire (300 000 triangles au plus), sous forme de `Blob`.
2. `POST /api/quote-upload` renvoie un `fileKey`. La limite de taille reste à vérifier :
   le vase pèse environ 5 Mo.
3. La Server Action existante `submitQuoteRequest` reçoit :
   - une description (paramètres en clair + URL de configuration) ;
   - le matériau PLA ;
   - les couleurs ;
   - les dimensions ;
   - le `fileKey`.
4. L'événement `Quote Requested {source:"studio", object}` est envoyé.
5. L'atelier fixe le prix, et le client paie dans `account/quotes/[id]/pay` (Payment
   Element existant).

**Tier B :** une colonne `studio_config jsonb`, la géométrie et le prix recalculés côté
serveur, puis « Ajouter au panier » à prix ferme.

### 5.6 URL partageable et accessibilité

**URL d'état.** Exemple :
`/fr/studio/vase?h=180&d=90&p=bottle&m=ribs&n=24&a=2&t=35&f=1C1917.E5231C.F5F5F4&z=0.60.140`

- Les paramètres sont validés par zod avec des bornes.
- `replaceState` est appelé en debounce de 300 ms.
- La canonical ne porte pas les paramètres, qui sont ajoutés à `robots.txt` et à
  `KEPT_PARAMS`.
- **Les textes personnels n'entrent jamais dans l'URL** (nLPD). « Partager » transmet la
  forme et les couleurs avec un texte d'exemple.

**Contrôles**

- Contrôles natifs (`range`, `radio`, `select`, `text`), chacun avec son `<label>` et un
  `<output>` formaté.
- Le formulaire SSR fonctionne sans JS : il envoie en GET et affiche le poster. Le lien
  « Demander » ouvre `/custom` prérempli.
- Le canvas est `aria-hidden`. Un résumé en `aria-live="polite"` le remplace
  (« Onde, 180 mm, 900 couches, 3 couleurs, 41 g »).
- Les poignées Z ont des champs numériques équivalents.

---

## 6. Plan page par page

**Accueil**

1. `01` Héros.
2. `02` « Deux façons d'entrer ».
3. `03` « Dans la machine », en `night` : rayon X sur Relief qui révèle le gyroïde.
4. `04` « L'objet du moment » : le Vase spirale, avec son attribution.
5. `05` « Imprimé à Gland et à Pully » : les schémas SVG des imprimantes, éclatés au
   scroll.
6. `06` Réassurance en tableau : Suisse, 8,90 CHF ou port offert dès 60 CHF, TWINT.

**Boutique « Registre »** : un tableau à filets (Réf., vignette, nom, matière, dimensions,
couches, prix) avec une bascule vers une grille.

- **N = 1** : le vase occupe une grande ligne, suivie du bloc « Au Studio : 4 objets à
  régler », où les lignes `S-01` à `S-04` sont marquées « configurable, sur devis ». Aucun
  faux produit.
- **N = 50** : chips de filtres en SSR, index des catégories collant, grille de 3
  colonnes. Le JSON-LD et les facettes ne changent pas.

**Fiche produit** (format NODAL)

- Chapitres :
  - `01 Objet` : viewer pinné, en orbite seulement, avec les coloris réellement vendus ;
  - `02 Matière` : loupe de stries sur les photos ;
  - `03 Fiche` : `<dl>` en SSR ;
  - `04 Provenance` ;
  - `05 Commander`.
- **Bloc d'attribution** : « Design : Ian · Licence CC BY-ND 4.0 · Modèle original sur
  MakerWorld ↗ (https://makerworld.com/fr/models/1262112-vase) · Imprimé par Swiss3Design,
  sans aucune modification. » Il est repris en JSON-LD (`isBasedOn` + `license`).
- Pour cet objet : ni coupe, ni simulation, ni Studio.

**Autres pages**

- **Studio** : `/studio`, un index de 4 fiches avec posters, et `/studio/[objet]`. À
  ajouter à `STATIC_PAGES` et à `llms.txt`.
- **Sur mesure** : « Votre propre fichier ». Le formulaire existant est habillé en fiche de
  tranchage, avec un aperçu du STL sur un plateau (viewer existant) et un volume et une
  bbox indicatifs.
- **Atelier** (À propos) : machines éclatées, « 6 gestes G-code », matières, engagements,
  FAQ en SSR, contact.
- **Contact** : fiche à deux colonnes, formulaire et honeypot inchangés.
- **Favoris** : « Pièces épinglées », punaise rouge.
- **Panier** : « File d'impression ». Chaque ligne est un job avec son délai. La barre du
  port offert devient la barre Z. L'opt-in de relance reste décoché.
- **Checkout** : jetons et libellés `01 Contact / 02 Paiement`. **Ni Lenis, ni transform,
  ni WebGL.** On resynchronise `stripeAppearance`.
- **Succès** : « Job en file », avec un ticket mono façon reçu et le questionnaire
  d'attribution.
- **Suivi** : les statuts forment une pile de couches qui s'imprime jusqu'à l'état
  courant.
- **Auth et compte** : jetons, mono, filets, pas de motion. On corrige le `<main>`
  imbriqué. Avatars en variantes du pic, en option.
- **Légal** : sections numérotées. Contenu intouché.
- **404** : « G28 : retour à l'origine ». Une buse revient à l'origine, avec le message
  « Cette page n'a jamais été tranchée. »

**Éléments globaux**

- **Header** : 64 px, wordmark et mark raster. Nav : `Boutique · Studio · Sur mesure ·
  Atelier`. La barre Z sert d'indicateur de progression.
- **BottomNav** : Accueil, Boutique, **Studio** (à la place de Sur mesure, accessible
  depuis le Studio et le footer), Panier, Compte. On corrige le trou `md`/`lg`.
- **Footer** : wordmark géant **en texte**, tracé en contour puis rempli de hachures. On y
  trouve la langue, le thème, « Réduire les animations », « Son », les paiements et
  Calyroc.
- **Bandeau de consentement** : une notice mono façon trancheur. Texte et comportement
  inchangés.

---

## 7. Inventaire

**Composants**

| Famille | Composants |
|---|---|
| Structure et navigation | `ChapterRail`, `ZBar`, `DrawLink`, `LayerReveal` (paliers de clip-path) |
| Données | `SpecTable`, `SliceReport`, `HudReadout` |
| Tracé | `ToolpathSvg` (SSR), `HatchReveal` |
| Studio | `FilamentSwatch`, `BandSlider`, `StudioPanel`, `StudioSheet`, `SendToWorkshop` |
| Catalogue | `AttributionBlock`, `RegistryTable`, `ProductGrid` |
| Commande et suivi | `PrintQueueLine`, `LayerTimeline` |
| Préférences | `SoundToggle`, `MotionToggle` |
| Moteur | `StageMount` (`dynamic` avec `ssr: false`), `MotionRuntime` |

Tout le code motion vit sous `src/motion/**`, protégé par une règle oxlint
`no-restricted-imports`. Le groupe `(site)` exclut du Stage et de Lenis le checkout, le
compte, l'admin, `oauth` et `agent`.

**Scènes du Stage** (un seul renderer, avec des vues en scissor)

| Scène | Contenu |
|---|---|
| `hero-print` | coupe, fantôme, buse, tour de purge, éclatement |
| `xray-relief` | coque et gyroïde, masque sous le pointeur à basse résolution |
| `studio-bed` | 4 générateurs, simulation par `drawRange` |
| `product-turntable` | STL réel du vase, orbite seulement |
| `machines-exploded` | optionnelle, repli en SVG |
| footer | SVG pur |

**Vrais toolpaths.** Ces objets sortent de notre code, donc nous calculons leur trajet
réel dans le Worker :

- pour Onde, la spirale continue du mode vase ;
- pour les autres objets, les périmètres (contours de couche) et un remplissage à 45 °
  (intersections ligne-polygone).

---

## 8. Voix et copie

Des verbes d'atelier, des chiffres exacts, un humour qui tient dans la précision.

- « Chaque objet commence par un trait. »
- « 0,2 mm à la fois. »
- « Réglez-le. On l'imprime. »
- « Quatre bobines. Zéro pinceau. »
- « Ici, la purge est comptée. »
- « Dessiné par Ian. Imprimé par nous. Pas retouché d'un dixième. »
- « Plateau vide. Lancez quelque chose. »
- « Cette page n'a jamais été tranchée. »
- « Imprimé à Gland et à Pully. Livré en Suisse, point. »
- « Estimation ±20 %. L'atelier confirme sous 24 h ouvrées. »
- DE : « Schicht für Schicht. », « Grösse anpassen ». IT : « Uno strato alla volta. »

---

## 9. Demandes au propriétaire et Tier A

**Tier A (rien à fournir)**

- Les 4 objets, les shaders et les SVG sont entièrement procéduraux.
- Les posters du héros et du Studio sont **générés au build** par
  `scripts/gen-stage-posters.ts`. Ce script Bun réutilise les générateurs géométriques purs
  (sans three) et écrit des SVG isométriques dans `public/stage/`.
- Les teintes sont indicatives, et aucun prix n'est affiché.
- Le mark est révélé par hachures.
- Les photos existantes servent à la loupe.

**Demandes, par ordre d'impact**

1. Valider la palette, Martian Mono et le nom « Studio ».
2. Fournir les coefficients de prix (CHF/g, CHF/h, forfait) et l'inventaire des bobines
   (nom et hex).
3. Imprimer une vraie Onde n° 01 et une Carte, puis les photographier. Ce sera la première
   preuve multicolore et l'étalonnage des grammes et du temps.
4. En option : vectoriser le mark.
5. Rendus Blender (Cycles, via le MCP) :
   - un poster photoréel d'Onde n° 01 en Tier B (2400×1600 et 1080×1350, AVIF) ;
   - 7 images OG ;
   - le Vase spirale en blanc et en noir, 3 vues fidèles étiquetées « rendu » ;
   - un éclaté par filament.
6. Deux images ChatGPT, d'ambiance seulement :
   - (a) « Photographie documentaire, aube brumeuse sur le Léman vue depuis Pully, Alpes
     savoyardes en silhouette, lumière rasante froide, horizon bas, grand ciel neutre à
     gauche pour du texte, grain argentique fin, sans bateau ni personne, 3:2. » Elle sert
     au chapitre Atelier.
   - (b) En option : « Vue du dessus, papier coton blanc cassé chaud légèrement gaufré,
     lumière latérale douce, aucun objet ni inscription, 4:3. »

---

## 10. Risques et phasage

| Risque | Parade |
|---|---|
| Géométrie lente au réglage | Basse résolution par frame, Worker, budget de 8 ms |
| Objet non imprimable | Bornes, validateur en direct, relecture par l'atelier |
| Chiffres trompeurs | Mention « estimation », étalonnage, pas de CHF sans coefficients |
| Licence du Vase spirale | Viewer seul, attribution, aucun traitement de la géométrie, test e2e du bloc |
| Texte offensant | Le devis impose une modération humaine |
| Données personnelles dans l'URL | Textes exclus |
| Taille de l'upload | Vérifier `/api/quote-upload`, plafonner à 300 000 triangles |
| Stripe | Groupe `(site)` |
| LCP | H1 et SVG en SSR, canvas superposé |
| Contextes WebGL | Un seul renderer |
| Replays PostHog | Exclure `[data-stage]` |
| Longueur des textes en DE | Tests dédiés, `wdth` réductible |
| Firefox | Fondu simple, repli en JS |

**Phases** (preview dédiée, validation du propriétaire à chaque jalon)

| Phase | Contenu |
|---|---|
| **P0** | Jetons, polices, `accent-text`, groupe `(site)`, `MotionRuntime`, garde-fou oxlint, Worker à +0 KiB |
| **P1** | Générateur Onde, posters au build, `hero-print`, accueil |
| **P2** | Studio Onde : rapport, simulation, URL, envoi à l'atelier |
| **P3** | Carte, Étiquette et Relief, polices JSON, rayon X |
| **P4** | Registre (N = 1 et N = 50), fiche NODAL, attribution |
| **P5** | Pages secondaires, transitions, footer, 404, son |
| **P6** | Tier B : `studio_config`, prix serveur, panier direct, rendus et photos |

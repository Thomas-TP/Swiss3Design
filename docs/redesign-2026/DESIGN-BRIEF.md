# Swiss3Design · Refonte 2026 « Strates » · Brief de design définitif

> **Statut** : brief d'exécution v1.0 (28.09.2026), branche `claude/redesign-2026`.
> **Auteur** : direction artistique de la refonte, à partir de `research/*.md`, des trois concepts
> (`concepts/strates.md`, `concepts/atelier.md`, `concepts/studio.md`), des trois verdicts
> (`concepts/judge-*.md`) et de vérifications faites dans le dépôt (chemins cités).
> **Langue** : français. Identifiants de code en anglais. Chemins relatifs à la racine du dépôt
> `C:/Perso/github/swiss3design/Swiss3Design`.
>
> Ce document est **contraignant** pour tous les agents. Ordre de priorité en cas de conflit :
> (1) les règles d'or d'`AGENTS.md` ; (2) décisions du propriétaire (§1.5) ; (3) ce brief ;
> (4) les notes de recherche et les concepts. La refonte est une fonctionnalité en plusieurs
> phases : comme le prévoit déjà `AGENTS.md` (« Multi-phase features »), elle n'est fusionnée dans
> `main` qu'une fois toutes les phases approuvées ; la consigne générale « auto-push to main » ne
> s'applique donc pas aux packages de la refonte.

---

## Sommaire

0. Mode d'emploi et faits vérifiés
1. Direction retenue (thèse, mécanique héros, motifs, Forge, décisions du propriétaire, voix)
2. Système visuel (couleurs, typographie, grille, texture, 3D, mark, `globals.css` complet)
3. Système de mouvement (courbes, durées, scroll, transitions, reduced motion, paliers, son)
4. Architecture (frontière `src/motion`, groupe `(site)`, MotionRuntime, Stage, contrats, garde-fous, paquets, CSP, i18n, analytics, budgets)
5. Héros (géométrie, shader d'impression, storyboard, contrôles, posters, budgets)
6. Studio, le configurateur (objets, algorithmes, multicolore, estimation, UX, état, export, commande)
7. Plans de page (chrome global et chaque page publique, avec tout ce qui doit survivre)
8. Inventaire des composants
9. Work packages pour agents parallèles (graphe, propriété des fichiers, étapes, critères)
10. Critères d'acceptation communs
11. Décisions et assets demandés au propriétaire (prompt ChatGPT, plan Blender)
12. Risques et parades
13. Annexes (GLSL, formules, banque de textes en 4 langues)

---

## 0. Mode d'emploi et faits vérifiés

### 0.1 Pour les agents

- Lisez §1 à §4 en entier, puis la fiche de votre package (§9.3) et les plans de page qui vous
  concernent (§7). Le vocabulaire est normatif : **DOIT**, **NE JAMAIS**, **PEUT**.
- Un package n'édite **que** les fichiers de sa colonne « Possède » (§9.2). Lire et importer
  ailleurs est permis. Si un changement hors périmètre est indispensable, ne le faites pas :
  décrivez-le dans la section « Demandes » de votre compte rendu.
- Travaillez dans votre worktree et votre branche (`claude/redesign-2026--wp-xx`), fusionnez
  dans `claude/redesign-2026` dans l'ordre du graphe (§9.1). **NE JAMAIS pousser sur `main`**
  pendant la refonte : la mise en ligne se fait en une fois, après validation du propriétaire
  sur la preview (§11).
- Pour construire ou prévisualiser dans un worktree, copiez `.env.local` et `.dev.vars` depuis
  le checkout principal (fichiers ignorés par git, jamais commités). `next build` a besoin de
  `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` (voir `AGENTS.md`, Commands).
- Next 16 n'est pas le Next de vos souvenirs : lisez le guide concerné dans
  `node_modules/next/dist/docs/` avant d'utiliser une API (View Transitions, `Link`, `dynamic`,
  polices).

### 0.2 Faits vérifiés pendant la rédaction (ne pas les re-vérifier, mais ne pas les contredire)

| Fait                                                                                                                                                                                                                                                                        | Conséquence dans ce brief                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `oxlint` (version du dépôt) : `no-restricted-imports` signale **aussi les `import()` dynamiques** ; `import type` passe avec `allowTypeImports: true` ; `overrides` par `files` fonctionne (testé dans le scratchpad).                                                      | Les `import("@/motion/…")` ne sont permis que dans `src/gates/**` (§4.6).                           |
| schema.org : `isBasedOn` n'a pour domaine que `CreativeWork` (pas `Product`).                                                                                                                                                                                               | L'attribution de Ian passe par un nœud `3DModel` séparé, relié au `Product` par `subjectOf` (§7.9). |
| woff2 latin servis par Google Fonts : Archivo axes complets **88 Ko**, Archivo `wdth` figé à 112,5 + `wght` 500–900 **35 Ko**, Geist **28,7 Ko**, Geist Mono **22,6 Ko**.                                                                                                   | Archivo auto-hébergé par `next/font/local`, largeur figée (§2.2).                                   |
| Contrastes WCAG calculés par script (luminance relative).                                                                                                                                                                                                                   | Valeurs du §2.1, à ne pas « arrondir ».                                                             |
| Versions npm au 28.09.2026 : `gsap@3.15.0`, `@gsap/react@2.1.2`, `lenis@1.3.26`, `three@0.186.1`, `@types/three@0.186.0`, `d3-contour@4.0.2`, `@types/d3-contour@3.0.6`, `earcut@3.2.3` (types inclus), `fflate@0.8.3`, `postprocessing@6.39.5`, `opentype.js@1.3.4`.       | Versions exactes au §4.7.                                                                           |
| `POST /api/quote-upload` : 30 Mo max, **10 envois/h/IP**, extensions `stl 3mf obj step stp`, signature STL binaire `84 + 50 × n = taille`, stockage privé `quotes/<uuid>-<nom>`, cookie propriétaire `s3d-upload-owner` (httpOnly, 24 h).                                   | Export STL binaire strict, réutilisation du `fileKey` par configuration (§6.9).                     |
| `submitQuoteRequest` (`custom/actions.ts`) : 5 envois/10 min, zod `email`, `description` 10–4000, `material ≤ 100`, `colors ≤ 200`, `dimensions ≤ 200`, `fileKey` préfixé `quotes/` **et** appartenant au même cookie, `locale`. Aucun `redirect()`.                        | Le Studio réutilise cette Server Action telle quelle (§6.9).                                        |
| PostHog (`src/lib/analytics.ts`) : `defaults: "2026-08-30"` retire déjà les ancres `#…` des URL capturées ; `maskAllInputs: true` ; `.ph-mask` masque le texte ; seuls les paramètres de `KEPT_PARAMS` survivent.                                                           | L'état du Studio vit dans le fragment, jamais de texte personnel dedans (§6.8).                     |
| `src/app/[locale]/layout.tsx` est le layout racine (pas de `src/app/layout.tsx`) ; il enveloppe aussi `/admin`, `/checkout`, `/account`. Seul `contact/page.tsx` importe `../a-propos/contact-form` ; seul `sitemap.xml/route.ts` importe `../[locale]/legal/legal-layout`. | Déplacement sûr des pages vitrine dans `(site)` (§4.2).                                             |
| La fiche produit charge le STL du Vase spirale (46 756 triangles, ~2,23 Mio, servi sans `Content-Length`). Le catalogue live compte **1** produit.                                                                                                                          | N = 1 → 50 prévu partout ; chargement du STL différé (§7.9).                                        |
| `custom.intro` promet aujourd'hui « un devis personnalisé sous 48 h ».                                                                                                                                                                                                      | Le Studio reprend « sous 48 h », rien de plus ambitieux sans accord (§6.9).                         |
| `messages/de.json` contient « Schließen » (ß).                                                                                                                                                                                                                              | Corrigé par WP-00 ; test anti-ß (§4.9).                                                             |

> **Note du 30.09.2026 (correctif vague 1)** : la ligne « `src/app/[locale]/layout.tsx` est le layout racine (pas de `src/app/layout.tsx`) » n'est plus vraie. `src/app/layout.tsx` existe (seul `<html>`/`<body>`, script anti-flash, JSON-LD, métadonnées par défaut) et `[locale]/layout.tsx` ne porte plus que l'habillage (`LocaleShell`). Motif et conséquences au §7.18.

---

## 1. Direction retenue

### 1.1 Verdict

La direction est **« Strates »** (82, 79 et 79 points chez les trois juges, premier partout),
avec les greffes exigées par les juges. Le tableau dit d'où vient chaque pièce.

| Pièce                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Provenance      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Thèse « une couche = une courbe de niveau ; le multicolore = une teinte hypsométrique » ; bascule élévation → plan ; poster d'isolignes calé sous le canvas (« le dessin devient matière ») ; ease quantifiée `s3d.pas` (abandonnée le 07.10.2026, §3.1) ; transition de page « Coupe » ; cadre de carte, coordonnées, cartouche, point rouge ; voix (« Point non coté ») ; physique juste (multicolore en mode standard, spirale seulement en monochrome) ; générateur pur TS partagé ; test de variété (manifold) | Strates         |
| Personnalisation **dans** le héros (gestes Palette et Motif) ; « Votre nom » hors pin ; vague de couleur le long des couches ; outils du configurateur (Annuler/Rétablir, « Surprenez-moi », badge Imprimable avec correction, Copier le lien, Garder) ; Studio en disque rouge au centre de la BottomNav ; silhouette du Vase spirale interdite par test ; STL écrit dans un Web Worker ; outil WebMCP `studio_configure` ; Studio livré avant le héros                                                            | Studio          |
| Aucun texte personnel dans l'URL ; tiroir « Envoyer à l'atelier » sur la même Server Action ; tour de purge et commande « Éclater » ; formulaire Studio SSR fonctionnel sans JS (GET) ; simulation ×1/×10/×100 et réglette Z verticale ; LOD de régénération en Worker ; aucun pin sous 768 px de haut ; groupe de routes `(site)` ; vue « Registre » de la boutique ; attribution en données structurées ; aucun CHF avant validation des coefficients                                                             | G1 (Atelier)    |
| Correctifs d'ingénierie : jamais d'axe `wdth` lié au scroll ; 4 scènes + un service au lieu de 8 scènes ; champ de courbes WebGL réservé à l'accueil (SVG ailleurs) ; relief du champ précalculé en texture ; polices 3D en instances statiques sans chevauchement ; pas vertical adaptatif (STL de 1 à 3 Mo) ; budget INP mesuré                                                                                                                                                                                   | Juge ingénierie |
| Correctifs commerce : surtitre SSR explicite ; zone d'achat collante au chapitre 01 de la fiche ; métaphore bornée (l'unité réelle d'abord) ; modération humaine des textes ; gestion du 429 ; fourchette ±15 % avant calibration                                                                                                                                                                                                                                                                                   | Juge commerce   |

### 1.2 Thèse

Une imprimante FDM ne sculpte pas : **elle empile des altitudes**. À 0,2 mm par couche, un vase
de 150 mm est un relief de 750 courbes de niveau, une carte nationale au 1:25 000 posée debout.
Le mark de la marque, un pic alpin en six strates, le disait déjà. Swiss3Design devient le site
où l'on **règle soi-même le relief d'un objet** (sa forme, son motif, ses teintes par altitude,
son nom en relief), puis où l'atelier de Gland ou de Pully l'imprime. Le multicolore y est
présenté comme sur une carte : **une couleur par tranche d'altitude**. C'est aussi le
fonctionnement réel de l'AMS (quatre bobines, trois changements, et non trois cents purges) et
donc le modèle le plus honnête et le moins cher.

**Six principes, applicables à chaque écran :**

1. **Addition.** Tout naît de bas en haut, par couches. Rien ne se dissout, rien ne flotte.
2. **Quantification** (_abandonnée en tant que minutage le 07.10.2026, retours R06/R07 : voir
   §3.1, 3_). La couche reste dans les **chiffres** (mm, couches comptées) et dans des détails
   statiques ; les mouvements, eux, glissent sur une courbe continue.
3. **Unités vraies.** Tout scrub et tout compteur s'expriment en mm, en couches, en grammes, en
   minutes. Un chiffre affiché est calculé, jamais décoratif.
4. **Le trait avant la matière.** On dessine (isolignes) avant de remplir (matière).
5. **Le rouge, c'est la chaleur.** Rouge = buse chaude, état courant, action principale. Jamais
   un décor.
6. **Régler d'abord.** Chaque écran d'intérêt offre un geste de réglage ou un chemin d'un clic
   vers le Studio. C'est l'axe imposé par le propriétaire.

### 1.3 Une seule mécanique héros, trois motifs de soutien, le reste plus tard

**Mécanique héros unique : « L'impression réglable ».** Un objet dessiné par nous (le vase
« Lavaux », motif « gradins », trois bandes) s'imprime couche par couche sous les yeux du
visiteur, avec une buse chaude et de vrais changements de filament. Le visiteur peut
**le régler pendant qu'il s'imprime** : changer la palette fait monter une vague de couleur le
long des couches, changer le motif fait réimprimer l'objet depuis le plateau. Au scroll
(desktop), l'impression se termine et la caméra bascule en vue de plan : les couches deviennent
une carte en courbes de niveau. La même machinerie (matériau d'impression, bandes, vague,
réimpression, réglette Z) sert ensuite **telle quelle** dans le Studio.

**Motifs de soutien (et rien d'autre) :**

| Motif                              | Où il vit                                                                                                                                                                                                          | Règle                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **M1 · Isolignes et coupe**        | Poster SSR du héros, bascule en plan, champ de courbes (accueil seulement, WebGL), isolignes SVG statiques (footer, 404, contact), transition de page « Coupe » (découpe continue), révélations `s3d-print`        | Trois moments de champ plein écran au plus (fin du héros, footer, 404). Jamais en papier peint sur les pages transactionnelles. |
| **M2 · La buse et le point rouge** | Liseré chaud à la ligne de coupe, point rouge final des titres, filet de progression sous le header, buse d'attente pendant le TTFB, soulignement actif de la nav, disque Studio de la BottomNav, bouton principal | Un seul bouton rouge par écran. Le rouge ne remplit jamais une grande surface décorative.                                       |
| **M3 · La bande de mesure**        | Télémétrie mono du héros et du Studio (« 150,0 mm · 750 couches · ≈ 80 g · ≈ 2 h 45 · 2 changements »), réglettes graduées, fiches techniques `<dl>`, étiquettes de l'éclaté                                       | Toujours `Intl.NumberFormat` ; unité réelle d'abord, clin d'œil ensuite.                                                        |

**Plus tard (hors v1, ne pas construire)** : son génératif ; plaque de bureau « Signal » ;
abat-jour « Lumen » ; export 3MF multi-objets (fflate) ; QR code sur la carte ; relief suisse
réel swisstopo pour le sous-verre ; commande directe au panier à prix ferme recalculé par le
serveur (colonne `studio_config jsonb`) ; « plateau vivant » à 4 objets sur l'index du Studio ;
vue en coupe avec bouchons (stencil) ; rayon X sur le remplissage ; particules ; voxel drop ;
boutique en plateau déplaçable ; alcôves par collection ; diorama de suivi de colis ; Rive ;
boucles vidéo IA ; AR Quick Look ; avatars en strates ; redessin vectoriel et mark 3D ;
images OG par page ; restyle des e-mails et des pages de désinscription ; `/forge` (analyse de
fichier client), `/matieres`, `/aide`, `/pro` ; post-traitement (bloom, SMAA) ; WebGPU/TSL ;
Stage en OffscreenCanvas ; bottom sheet à crans pour le Studio mobile ; `lenis/snap` ; axe
`wdth` animé sur des titres non LCP.

### 1.4 « La Forge » (`docs/refonte-plateforme-2026.md`) : ce qu'on garde, ce qu'on reporte

**Gardé (et appliqué dans ce brief) :**

- l'accueil à **double intention**, ici trois entrées : **Régler** (Studio), **Acheter**
  (boutique), **J'ai un fichier** (sur mesure) ;
- « **jamais bloquer sans chiffre** » : le Studio affiche toujours grammes, durée et changements ;
  les CHF s'affichent dès que le propriétaire valide les coefficients (§6.5) ;
- l'**attente narrée** (« Préparation du fichier · 58 420 triangles »), le **coût de purge
  affiché honnêtement**, la règle « **le serveur ne croit jamais le prix client** » (aucun prix
  n'est encaissé en v1 : devis) ;
- les règles d'interaction : retour < 100 ms, **un seul CTA accent par écran**, animations
  porteuses de sens, états vides utiles, prix toujours via `formatChf` ;
- les **patterns interdits** : pop-up newsletter, bannière cookie envahissante, carrousels
  automatiques, comptes à rebours, fausse rareté (« 3 personnes regardent »), chat proactif ;
- le suivi de fabrication honnête (visuel seulement en v1, §7.16).

**Reporté** : devis instantané sur fichier client arbitraire (`/forge`), vérificateur de
fichier, `/matieres`, `/aide`, `/pro`, bibliothèque et re-commande, synchro panier en base. Le
Studio est **la première brique réaliste de la Forge** : un devis quasi instantané sur une
géométrie que nous connaissons et dont nous garantissons qu'elle s'imprime.

### 1.5 Décisions du propriétaire (contraignantes) et faits durs

1. **La personnalisation est l'axe central.** Quatre objets originaux Swiss3Design, générés en
   code, réglables en direct en 3D : vase « Lavaux », carte de visite « Cartouche », sous-verre
   topographique « Relief », porte-nom « Borne ». Une configuration finie débouche sur une vraie
   commande : export STL côté client, envoi par `/api/quote-upload`, puis la Server Action de
   devis existante avec les paramètres. Une fourchette de prix s'affiche une fois les
   coefficients validés. La simulation d'impression couche par couche s'applique à ces objets.
2. **Vase spirale de Ian (MakerWorld, CC BY-ND 4.0).** Vendre des impressions est permis.
   **Attribution obligatoire** (nom, licence, lien `https://makerworld.com/fr/models/1262112-vase`).
   **Aucune œuvre dérivée** : jamais de changement de géométrie, de taille ni de motif, jamais
   dans le Studio, jamais de coupe, de shader d'impression ni de teinte non vendue. On le montre
   et on le fait tourner, rien d'autre. **Aucun de nos objets ne doit ressembler à sa silhouette**
   (bouteille, col fin évasé, ~40 nervures fines torsadées) : garde testée (§6.6).
3. **Assets.** Tout en code d'abord (3D procédurale, shaders, SVG). Pas de vidéo IA payante.
   ChatGPT seulement pour de l'ambiance, jamais pour montrer un produit (§11.3). Blender 5.2 +
   MCP pour les rendus qui aident vraiment (OG, turntable, éditorial), pas pour le LCP (§11.4).

**Faits durs** : un seul produit live (le design passe de N = 1 à N = 50) ; aucune photo
multicolore réelle ; le mark n'existe qu'en raster 480 px (un redessin vectoriel est un
changement de marque, optionnel, §11.2) ; rouge `#E5231C` sur encre et papier chauds (texte
rouge < 4,5:1, d'où le jeton `accent-text`) ; checkout, Stripe, compte et auth restent robustes
(refresh visuel seulement, ni Lenis ni transform autour des iframes Stripe) ; tout le contenu
est SSR et lisible par les moteurs et les agents ; Three, GSAP et Lenis sont client-only
(§4.1) ; CSP sans `unsafe-eval` ni WASM, médias same-origin ; reduced motion, mobile et bas de
gamme dès le premier jour ; LCP visible au premier paint (aucun préloader bloquant) ; chaque
chaîne en 4 langues (de-CH sans ß).

### 1.6 Nommage, voix, lexique

**Noms publics.**

| Élément         | FR                           | DE                       | IT                      | EN                        | URL                          |
| --------------- | ---------------------------- | ------------------------ | ----------------------- | ------------------------- | ---------------------------- |
| Boutique        | Boutique                     | Shop                     | Negozio                 | Shop                      | `/shop` (inchangée)          |
| Configurateur   | Studio                       | Studio                   | Studio                  | Studio                    | `/studio` (nouvelle)         |
| Sur mesure      | Sur mesure                   | Nach Mass                | Su misura               | Custom                    | `/custom` (inchangée)        |
| À propos        | **Atelier** (libellé de nav) | Atelier                  | Atelier                 | Workshop                  | `/a-propos` (inchangée, SEO) |
| Vase            | Vase « Lavaux »              | Vase «Lavaux»            | Vaso «Lavaux»           | "Lavaux" vase             | `/studio/lavaux`             |
| Carte de visite | Carte « Cartouche »          | Visitenkarte «Cartouche» | Biglietto «Cartouche»   | "Cartouche" business card | `/studio/cartouche`          |
| Sous-verre      | Sous-verre « Relief »        | Untersetzer «Relief»     | Sottobicchiere «Relief» | "Relief" coaster          | `/studio/relief`             |
| Porte-nom       | Porte-nom « Borne »          | Namensschild «Borne»     | Portanome «Borne»       | "Borne" name tag          | `/studio/borne`              |

Les slugs d'objet sont des noms propres, identiques dans les 4 langues. Palettes : **Léman**,
**Molasse**, **Signal**, **Uni**. Motifs : **Gradins**, **Vagues**, **Voronoï**, **Nervures**,
**Lisse**. Profils : **Cylindre**, **Galet**, **Amphore**, **Cône**, **Tulipe** (pas de
« bouteille », §6.6). Chapitres de l'accueil : 00 Relief · 01 La carte · 02 Votre sommet ·
03 Le Studio · 04 La boutique · 05 L'atelier · 06 Votre fichier.

**Voix.** Précise, sèche, un sourire en coin. Des chiffres avec leur unité. Aucun superlatif,
aucun « révolutionnaire », aucun point d'exclamation. « Nous » d'atelier. Vouvoiement ; allemand
avec « Sie », **sans ß** (« Grösse », « Schliessen », « Mass ») et en vocabulaire suisse
(« Offerte » plutôt qu'« Angebot », « Velo » n'apparaît pas mais l'esprit oui) ; italien avec
« Lei » ; anglais américain, comme le reste du site (« color »). **Métaphore bornée** : sur les
cartes produit, le panier, le suivi et le checkout, l'information réelle vient d'abord
(« Hauteur 209 mm »), le clin d'œil cartographique ensuite et en petit. Jamais « Swiss made »,
jamais de croix suisse ni d'armoiries (LPM art. 47–49, loi sur la protection des armoiries) : on
écrit « imprimé à Gland et à Pully » ou « imprimé en Suisse (VD) ». Toute image générée ou rendue
porte « Illustration » ou « Rendu ».

**Lexique imposé** (à utiliser tel quel dans les 4 langues) :

| FR                       | DE (CH)                       | IT                         | EN                       |
| ------------------------ | ----------------------------- | -------------------------- | ------------------------ |
| couche                   | Schicht                       | strato                     | layer                    |
| hauteur de couche        | Schichthöhe                   | altezza dello strato       | layer height             |
| changement de filament   | Filamentwechsel               | cambio di filamento        | filament change          |
| bande (de couleur)       | Farbzone                      | fascia (di colore)         | color band               |
| bobine                   | Spule                         | bobina                     | spool                    |
| purge                    | Spülmenge                     | spurgo                     | purge                    |
| buse                     | Düse                          | ugello                     | nozzle                   |
| plateau                  | Druckplatte                   | piatto                     | build plate              |
| estimation               | Schätzung                     | stima                      | estimate                 |
| sur devis                | auf Offerte                   | su preventivo              | on quote                 |
| imprimable               | druckbar                      | stampabile                 | printable                |
| en relief / gravé        | erhaben / graviert            | in rilievo / inciso        | embossed / engraved      |
| Envoyer à l'atelier      | Ans Atelier senden            | Invia all'atelier          | Send to the workshop     |
| Réglez-le. On l'imprime. | Sie stellen ein. Wir drucken. | Lei regola. Noi stampiamo. | You set it. We print it. |

La banque de textes des titres principaux, dans les 4 langues, est en annexe C. Les agents
rédigent le reste en respectant ce lexique ; le propriétaire valide les accroches (§11.2).

---

## 2. Système visuel

### 2.1 Couleurs

Les **noms** des jetons existants sont un contrat avec ~116 fichiers (dont 27 de l'admin) : on
les garde et on change leurs valeurs. On ajoute cinq jetons. Contrastes calculés (WCAG 2.x).

| Jeton                               | Clair                           | Sombre    | Chapitre « encre » (clair / sombre) | Usage                                                                                               | Contrastes vérifiés                                                                                              |
| ----------------------------------- | ------------------------------- | --------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `paper`                             | `#F4F0E8` papier carte          | `#0E0D0B` | `#1A1614` / `#211E1A`               | fond de page                                                                                        | —                                                                                                                |
| `surface`                           | `#FBF9F4`                       | `#1A1815` | `#221E1B` / `#2A2622`               | cartes, panneaux, footer                                                                            | —                                                                                                                |
| `elevated`                          | `#FFFFFF`                       | `#211E1A` | `#2A2521` / `#322D28`               | menus, tiroir, champs                                                                               | —                                                                                                                |
| `ink`                               | `#1A1614`                       | `#F2EDE4` | `#F2EDE4`                           | texte                                                                                               | 15,81 (paper clair) · 16,66 (paper sombre) · 15,41 / 14,19 (encre)                                               |
| `soft`                              | `#6A635A`                       | `#A39B8F` | `#B0A89C`                           | texte secondaire                                                                                    | 5,21 · 5,63 (surface) · 7,07 (sombre) · 7,64 / 7,03 (encre)                                                      |
| `line`                              | `#D8D1C4`                       | `#2E2A25` | `#3A342E` / `#3D3731`               | filets 1 px décoratifs                                                                              | 1,34 (non textuel, décor)                                                                                        |
| `accent`                            | `#E5231C`                       | `#E5231C` | idem                                | **graphique seulement** : boutons, points, liseré chaud, pastilles, texte ≥ 24 px (ou ≥ 19 px gras) | 4,03 (paper clair) · 4,24 (paper sombre) · 3,63 (elevated sombre)                                                |
| `accent-dark`                       | `#C01D14`                       | `#C01D14` | idem                                | survol des boutons rouges                                                                           | blanc dessus 6,13                                                                                                |
| **`accent-text`** (nouveau)         | `#B3170F`                       | `#FF5B4E` | `#FF5B4E`                           | **tout texte rouge < 24 px** (liens, erreurs, prix rouges)                                          | 6,07 (paper) · 6,55 (surface) · 6,89 (blanc) · 6,34 (paper sombre) · 5,79 (surface sombre) · 5,87 / 5,40 (encre) |
| **`on-accent`** (nouveau)           | `#FFFFFF`                       | `#FFFFFF` | idem                                | texte sur `accent` (≥ 15 px, 600)                                                                   | 4,58 (AA texte normal)                                                                                           |
| **`iso`** (nouveau)                 | `#C9C1B2`                       | `#3A352F` | `#3A342E`                           | isolignes ordinaires, lignes fantômes (décor)                                                       | 1,57 (décor)                                                                                                     |
| **`iso-index`** (nouveau)           | `#9C7650` sépia carte           | `#8A6C4E` | `#9C7650`                           | courbe maîtresse, graduations majeures                                                              | 3,61 (≥ 3:1 non textuel) · 4,01 (sombre) · 4,38 (encre)                                                          |
| **`glacier`** (nouveau)             | `#3E7CB1`                       | `#5B95C8` | —                                   | 2ᵉ teinte cartographique (eau), jamais pour du texte courant                                        | 3,91 · 6,08 (sombre)                                                                                             |
| `swatch-ring`                       | `#767676`                       | `#767676` | idem                                | contour des pastilles et des champs                                                                 | 4,00 (paper) · 3,90 (surface sombre)                                                                             |
| `night`, `night-soft`, `night-line` | `#121110`, `#A8A29B`, `#2C2825` | idem      | —                                   | conservés pour l'existant (panneaux constants)                                                      | —                                                                                                                |

**Règles d'usage.**

- `text-accent` (107 usages, 59 fichiers) est remplacé par `text-accent-text` par un **codemod
  unique** fait dans WP-00 (§9.3), y compris `hover:`, `group-hover:`, `md:` et les modificateurs
  d'opacité (`/80`). `bg-accent`, `border-accent`, `ring-accent`, `fill-accent`, `stroke-accent`
  restent (usage graphique).
- **Un seul bouton `accent` par écran.** Les autres actions sont en contour (`ink`) ou en texte.
- **Un chapitre « encre » ne flashe jamais en blanc** : en thème sombre il devient `elevated`
  avec un filet rouge haut et bas (§2.5, `[data-tone="ink"]`). Une section « papier » en thème
  sombre est simplement `paper` sombre.
- Le halo radial rouge actuel du `body` est **supprimé** (le rouge n'est pas un décor).
- Les couleurs de statut existantes (émeraude pour les succès des formulaires) restent.

**Palette de filaments du Studio (données, pas jetons)** : `src/lib/studio/filaments.ts`,
marquée `indicative: true` tant que le propriétaire n'a pas fourni l'inventaire réel (§11.2).
L'UI affiche alors « Teintes indicatives, couleur finale selon les bobines en stock ».

| id             | Nom FR       | Hex (indicatif) | Réalité aujourd'hui |
| -------------- | ------------ | --------------- | ------------------- |
| `blanc-neve`   | Blanc névé   | `#F5F5F4`       | vendu (« Blanc »)   |
| `encre`        | Encre        | `#1C1917`       | vendu (« Noir »)    |
| `rouge-signal` | Rouge Signal | `#E5231C`       | à confirmer         |
| `bleu-leman`   | Bleu Léman   | `#2E6A9E`       | à confirmer         |
| `vert-lavaux`  | Vert Lavaux  | `#5E7F3A`       | à confirmer         |
| `gris-molasse` | Gris molasse | `#8C8A85`       | à confirmer         |
| `ambre`        | Ambre        | `#D98E1F`       | à confirmer         |
| `glacier`      | Glacier      | `#9CC3DA`       | à confirmer         |

Palettes prêtes (du bas vers le haut) : **Léman** = bleu-leman / vert-lavaux / blanc-neve ;
**Molasse** = encre / gris-molasse / blanc-neve ; **Signal** = encre / blanc-neve / rouge-signal ;
**Uni** = blanc-neve (0 changement, la moins chère). Les noms de filaments sont traduits dans le
namespace `studioCore` (§4.9).

### 2.2 Typographie

| Rôle                                             | Famille                                                                    | Chargement                                                                                                         | Poids                               | Notes                                                                                                                                                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Titres (h1, titres de chapitre, grands chiffres) | **Archivo SemiExpanded** (largeur figée 112,5, graisse variable 500–900)   | `next/font/local`, fichier `src/fonts/archivo-sx-latin.woff2` (35 Ko), `preload: true`                             | 800 (titres), 700 (titres de carte) | OFL. Le fichier est le woff2 latin servi par Google Fonts pour `Archivo:wdth,wght@112.5,500..900`, recopié dans le dépôt (auto-hébergé, `font-src 'self'`).                                                       |
| Texte et interface                               | **Geist** (inchangée)                                                      | `next/font/google`, `--font-geist-sans`                                                                            | 400, 500, 600, 700                  | **Conservée pour Stripe** : `checkout-flow.tsx` et `stripe-appearance.ts` chargent Geist dans les iframes. Aucun changement au tunnel. Le wordmark « **Swiss**3Design » reste en Geist partout (c'est la marque). |
| Télémétrie, étiquettes, cotes                    | **Geist Mono**                                                             | `next/font/google`, `--font-geist-mono`, `preload: false`                                                          | 500                                 | Majuscules, `letter-spacing: 0.06em`, `tabular-nums slashed-zero`, 12 px minimum (jamais de HUD en 11 px).                                                                                                        |
| Texte en relief (objets 3D)                      | **Archivo SemiExpanded Black** (instance statique 900, contours fusionnés) | JSON de glyphes maison `public/studio/glyphs/s3d-relief-v1.json`, chargé seulement par le Studio et le chapitre 02 | 900                                 | §6.3.3 : pourquoi Black (trait ≥ 0,8 mm).                                                                                                                                                                         |

**Mise en place exacte** (WP-00, nouveau fichier `src/app/fonts.ts`, importé par
`src/app/[locale]/layout.tsx`) :

```ts
// src/app/fonts.ts
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";

// Interface et texte : Geist, inchangée (aussi chargée dans les iframes Stripe).
export const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

// Télémétrie mono : jamais un élément LCP, donc pas de préchargement.
export const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

// Titres : Archivo, largeur figée à 112,5 (SemiExpanded), graisse variable 500–900.
// 35 Ko au lieu de 88 Ko pour l'axe wdth complet. Source Google Fonts (OFL), recopiée
// telle quelle : https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@112.5,500..900
// (bloc « latin »). Jamais animer font-stretch ou font-variation-settings sur le h1 (LCP).
export const archivo = localFont({
  src: "../fonts/archivo-sx-latin.woff2",
  weight: "500 900",
  style: "normal",
  variable: "--font-archivo",
  display: "swap",
  preload: true,
  fallback: ["Arial", "Helvetica", "sans-serif"],
  adjustFontFallback: "Arial",
});
```

Dans le layout : `className={`${geist.variable} ${geistMono.variable} ${archivo.variable} antialiased`}`.
Ajouter `src/fonts/OFL-Archivo.txt` (licence) à côté du woff2.

**Échelle fluide** (base 16 px, de 375 à 1440 px ; utilitaires Tailwind générés par `@theme`,
§2.5) :

| Utilitaire                  | Valeur                                        | Interligne | Chasse   | Graisse     | Usage                                        |
| --------------------------- | --------------------------------------------- | ---------- | -------- | ----------- | -------------------------------------------- |
| `text-hero`                 | `clamp(3.25rem, 1.2rem + 9vw, 11rem)`         | 0,88       | −0,035em | 800         | h1 de l'accueil seulement                    |
| `text-display`              | `clamp(2.5rem, 1.35rem + 4.9vw, 6rem)`        | 0,94       | −0,03em  | 800         | h1 des autres pages, titres de chapitre (h2) |
| `text-title`                | `clamp(1.5rem, 1.2rem + 1.4vw, 2.25rem)`      | 1,08       | −0,02em  | 700         | h2 de contenu, titres de carte               |
| `text-subtitle`             | `clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem)`    | 1,2        | —        | 600 (Geist) | h3                                           |
| `text-lead`                 | `clamp(1.125rem, 1.05rem + 0.35vw, 1.375rem)` | 1,45       | —        | 400 (Geist) | chapeaux                                     |
| `text-base`                 | `1rem`                                        | 1,55       | —        | 400         | texte courant                                |
| `text-sm`                   | `0.875rem`                                    | 1,5        | —        | 400/500     | UI                                           |
| `text-label` / `.s3d-label` | `0.75rem`                                     | 1,3        | +0,06em  | 500 (mono)  | étiquettes, télémétrie                       |

- Titres : `font-display` (Archivo) + `text-wrap: balance`. Texte : `text-wrap: pretty`,
  65 caractères de large au plus.
- **Allemand** : `:lang(de)` réduit `--text-hero` à `clamp(2.875rem, 1rem + 8vw, 9.75rem)` et
  `--text-display` à `clamp(2.25rem, 1.2rem + 4.3vw, 5.25rem)` ; `hyphens: auto` sur les
  paragraphes et les h2/h3 (l'attribut `lang` est posé sur `<html>`). Tester chaque mise en page
  avec « Filamentwechsel », « Schichthöhe », « Versandkostenfrei ».
- **Chiffres** : toujours `Intl.NumberFormat(`${locale}-CH`, …)` (comme `formatChf`), y compris
  dans les textes de canvas : `0,2 mm` en fr-CH, `0.2 mm` en de-CH/it-CH/en-CH, séparateur de
  milliers géré par ICU. Helpers dans `src/lib/studio/format.ts` (§6.5).
- **Point rouge** : le point final d'un titre d'affichage devient un disque rouge de 0,22em
  (`<span class="s3d-dot">.</span>`, le caractère reste dans le texte pour le SEO et les lecteurs
  d'écran). Helper `DotTitle` (§8). Pas de point rouge sur les titres qui finissent par « ? ».
- **Polices premium (option du propriétaire, §11.2)** : Suisse Int'l + Suisse Int'l Mono (Swiss
  Typefaces) ou ABC Diatype + Diatype Mono (Dinamo), licence web à acheter, via `next/font/local`.
  Le reste du brief ne change pas.

### 2.3 Grille, espacements, rayons, filets, calques

- **Conteneur** : `.s3d-page` = largeur max 90rem (1440 px), marges `--spacing-margin`
  (`clamp(1rem, 0.4rem + 2.6vw, 4rem)`). L'ancien `max-w-6xl` reste valable dans les pages non
  refondues.
- **Grille** : `.s3d-grid` = 4 colonnes (< 640 px), 8 (640–1023 px), 12 (≥ 1024 px), gouttière
  `--spacing-gutter` (`clamp(1rem, 0.6rem + 1.1vw, 1.5rem)`). Rythme vertical de base 4 px.
- **Espacement de section** : `--spacing-section` = `clamp(4.5rem, 3rem + 6vw, 10rem)`
  (utilitaires `py-section`, `mt-section`). Échelle interne : 4, 8, 12, 16, 24, 32, 48, 64.
- **Rayons** : `rounded-hair` 2 px (étiquettes), `rounded-field` 4 px (champs, boutons),
  `rounded-card` **6 px** (avant 20 px ; le jeton change de valeur partout, admin compris),
  `rounded-sheet` 14 px (haut des tiroirs mobiles). `rounded-full` seulement pour pastilles,
  points, avatars et le disque Studio.
- **Filets** : 1 px `line` sur les chapitres éditoriaux, les tableaux de specs et le footer ;
  **jamais** de grille de filets sur les formulaires, le panier, le checkout ou le compte.
  Le style `.s3d-hairlines` (colonnes de la grille dessinées en fond, accueil et Atelier) a été
  prévu puis jamais employé ; **retiré par WP-99** (09.10.2026).
- **Cadre de carte** (`MapFrame`) : graduations fines en marge (repère tous les 8 px, majeur tous
  les 64 px, `iso-index`), coordonnées mono « 46°25′N 6°16′E · Gland », « 46°31′N 6°40′E ·
  Pully ». Desktop, héros de l'accueil et footer seulement.
- **Calques (z-index)** : canvas du Stage `-1` (porté dans `document.body`, §4.4) ; contenu
  `auto` ; favori sur carte `10` ; menus `20` ; AboutNav/ChapterRail `30` ; header `40` ;
  bandeau de consentement `40` ; barre d'action Studio mobile `45` ; BottomNav et skip link
  `50` ; tiroirs et dialogues dans le _top layer_ (`<dialog>.showModal()`). Header à 64 px
  (inchangé : `top-16`, `top-24`, `scroll-mt-32` restent justes).

### 2.4 Texture, iconographie, rendu 3D, mark

- **Texture** : aucune texture globale (pas de grain sur `body`, qui toucherait le checkout). Un
  tramage de Bayer 4×4 à 1–2 % existe **uniquement** dans le shader du champ de courbes (accueil).
- **Icônes** : `lucide-react`, trait 1,5 px dans les nouveaux composants. Un picto maison en SVG
  inline (grille 24, trait 1,5, extrémités carrées) : `StrataIcon` (trois strates, disque
  Studio). `NozzleIcon`, `LayerIcon` et `SummitIcon` (le triangle coté, refusé en R09) avaient été
  prévus ; jamais importés, **retirés par WP-99** (09.10.2026). Aucun pictogramme de croix.
- **Rendu 3D** : longue focale (fov 18–22°), élévation 20–25°, **lumière du nord-ouest**
  (convention d'estompage suisse : en haut à gauche), `RoomEnvironment` (procédural, rien à
  télécharger) + une directionnelle NO, tone mapping `NeutralToneMapping` (fidélité des teintes
  de filament), ombre de contact précalculée (texture canvas), aucun post-traitement en v1. Fond
  papier ou encre, jamais la pièce grise ni le parquet de `showroom-scene.ts` (retiré).
- **Mark** : raster `public/brand/webp/mark.webp`, jamais recoloré, jamais déformé, 24 px
  minimum, zone de protection de 0,5 × sa hauteur, animé seulement en opacité et en échelle.
  Option de polish (WP-00) : révélation du mark par un masque CSS de hachures à 45° au premier
  chargement complet (le mark final est intact : aucune validation de marque nécessaire). Le
  redessin vectoriel (mark 3D, toolpath du mark) est **optionnel et soumis à validation** (§11.2).

### 2.5 `src/app/globals.css` complet (collable par WP-00)

Le fichier remplace l'actuel. Les blocs `.faq-item` et `.schematic-*` existants sont conservés
tels quels (ils servent la page Atelier). Le contenu exact de `node_modules/lenis/dist/lenis.css`
(version installée) est recopié dans la section Lenis : on ne l'importe pas depuis un chunk
dynamique.

```css
@import "tailwindcss";

/* ── Variantes ────────────────────────────────────────────────────────────
   Thème : classe .dark sur <html> (script anti-FOUC du layout + ThemeManager).
   Mouvement : data-motion="reduce" | "full" sur <html>, posé AVANT le paint par
   le même script (préférence OS ou interrupteur « Réduire les animations »). */
@custom-variant dark (&:where(.dark, .dark *));
@custom-variant motion-off (&:where([data-motion="reduce"], [data-motion="reduce"] *));
@custom-variant motion-on (&:where([data-motion="full"], [data-motion="full"] *));

/* ── Jetons thémables (noms = contrat, valeurs = direction « Strates ») ──── */
:root {
  --paper: #f4f0e8;
  --surface: #fbf9f4;
  --elevated: #ffffff;
  --ink: #1a1614;
  --soft: #6a635a;
  --line: #d8d1c4;
  --accent-text: #b3170f;
  --iso: #c9c1b2;
  --iso-index: #9c7650;
  --glacier: #3e7cb1;

  --dur-micro: 150ms;
  --dur-ui: 280ms;
  --dur-reveal: 800ms;
  --dur-chapter: 1400ms;
  --dur-page: 480ms;

  color-scheme: light;
}

.dark {
  --paper: #0e0d0b;
  --surface: #1a1815;
  --elevated: #211e1a;
  --ink: #f2ede4;
  --soft: #a39b8f;
  --line: #2e2a25;
  --accent-text: #ff5b4e;
  --iso: #3a352f;
  --iso-index: #8a6c4e;
  --glacier: #5b95c8;
  color-scheme: dark;
}

/* Chapitre « encre » : inverse sans jamais flasher en blanc. Les composants à
   l'intérieur lisent les mêmes jetons, redéfinis localement. */
[data-tone="ink"] {
  --paper: #1a1614;
  --surface: #221e1b;
  --elevated: #2a2521;
  --ink: #f2ede4;
  --soft: #b0a89c;
  --line: #3a342e;
  --accent-text: #ff5b4e;
  --iso: #3a342e;
  --iso-index: #9c7650;
  color-scheme: dark;
  background-color: var(--paper);
  color: var(--ink);
}
.dark [data-tone="ink"] {
  --paper: #211e1a;
  --surface: #2a2622;
  --elevated: #322d28;
  --line: #3d3731;
  border-block: 1px solid var(--color-accent);
}

@theme inline {
  --color-paper: var(--paper);
  --color-surface: var(--surface);
  --color-elevated: var(--elevated);
  --color-ink: var(--ink);
  --color-soft: var(--soft);
  --color-line: var(--line);
  --color-accent-text: var(--accent-text);
  --color-iso: var(--iso);
  --color-iso-index: var(--iso-index);
  --color-glacier: var(--glacier);

  /* Constantes de marque (les deux thèmes) */
  --color-accent: #e5231c;
  --color-accent-dark: #c01d14;
  --color-on-accent: #ffffff;
  --color-swatch-ring: #767676;
  --color-night: #121110;
  --color-night-soft: #a8a29b;
  --color-night-line: #2c2825;

  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-display:
    var(--font-archivo), var(--font-geist-sans), ui-sans-serif, sans-serif;
  --font-mono:
    var(--font-geist-mono), ui-monospace, "SFMono-Regular", Menlo, monospace;
}

@theme {
  --breakpoint-xs: 30rem;

  --radius-hair: 0.125rem;
  --radius-field: 0.25rem;
  --radius-card: 0.375rem;
  --radius-sheet: 0.875rem;

  --text-hero: clamp(3.25rem, 1.2rem + 9vw, 11rem);
  --text-hero--line-height: 0.88;
  --text-hero--letter-spacing: -0.035em;
  --text-hero--font-weight: 800;
  --text-display: clamp(2.5rem, 1.35rem + 4.9vw, 6rem);
  --text-display--line-height: 0.94;
  --text-display--letter-spacing: -0.03em;
  --text-display--font-weight: 800;
  --text-title: clamp(1.5rem, 1.2rem + 1.4vw, 2.25rem);
  --text-title--line-height: 1.08;
  --text-title--letter-spacing: -0.02em;
  --text-title--font-weight: 700;
  --text-subtitle: clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem);
  --text-subtitle--line-height: 1.2;
  --text-lead: clamp(1.125rem, 1.05rem + 0.35vw, 1.375rem);
  --text-lead--line-height: 1.45;
  --text-label: 0.75rem;
  --text-label--line-height: 1.3;
  --text-label--letter-spacing: 0.06em;

  --ease-strate: cubic-bezier(0.16, 0.84, 0.3, 1);
  --ease-buse: cubic-bezier(0.45, 0, 0.55, 1);
  --ease-purge: cubic-bezier(0.3, 1.35, 0.6, 1);
  --ease-carte: cubic-bezier(0.7, 0, 0.2, 1);

  --spacing-gutter: clamp(1rem, 0.6rem + 1.1vw, 1.5rem);
  --spacing-margin: clamp(1rem, 0.4rem + 2.6vw, 4rem);
  --spacing-section: clamp(4.5rem, 3rem + 6vw, 10rem);
}

/* Allemand : mots longs. Les utilitaires lisent var(--text-*) : on redéfinit. */
:lang(de) {
  --text-hero: clamp(2.875rem, 1rem + 8vw, 9.75rem);
  --text-display: clamp(2.25rem, 1.2rem + 4.3vw, 5.25rem);
}
:lang(de) p,
:lang(de) h2,
:lang(de) h3 {
  hyphens: auto;
}

/* ── Base (hors @layer, comme l'existant, pour garder la même priorité) ──── */
html {
  /* Pas de smooth scroll global : Lenis le gère dans (site) ; ailleurs, le
     retour en haut de page à la navigation doit être instantané. */
  scroll-behavior: auto;
}

body {
  background-color: var(--color-paper);
  color: var(--color-ink);
  font-family: var(--font-sans);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3 {
  text-wrap: balance;
}
p {
  text-wrap: pretty;
}

::selection {
  background: var(--color-accent);
  color: #fff;
}

:focus-visible {
  outline: 2px solid var(--color-ink);
  outline-offset: 2px;
}

/* ── Composants CSS partagés ──────────────────────────────────────────── */
@layer components {
  .s3d-page {
    width: 100%;
    max-width: 90rem;
    margin-inline: auto;
    padding-inline: var(--spacing-margin);
  }
  .s3d-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: var(--spacing-gutter);
  }
  @media (width >= 40rem) {
    .s3d-grid {
      grid-template-columns: repeat(8, minmax(0, 1fr));
    }
  }
  @media (width >= 64rem) {
    .s3d-grid {
      grid-template-columns: repeat(12, minmax(0, 1fr));
    }
  }
  .s3d-label {
    font-family: var(--font-mono);
    font-size: var(--text-label);
    line-height: 1.3;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-variant-numeric: tabular-nums slashed-zero;
  }
  .s3d-num {
    font-variant-numeric: tabular-nums slashed-zero;
  }
  /* (`.s3d-hairlines`, colonnes de la grille en fond : jamais employé, retiré
     par WP-99.) */
  /* Point rouge final des titres : le « . » reste dans le texte (SEO, a11y). */
  .s3d-dot {
    position: relative;
    color: transparent;
  }
  .s3d-dot::after {
    content: "";
    position: absolute;
    left: 0.02em;
    bottom: 0.1em;
    width: 0.22em;
    height: 0.22em;
    border-radius: 999px;
    background: var(--color-accent);
  }
}

/* ── Révélations CSS au scroll (zéro JS, zéro INP) ──────────────────────
   Jamais sur un h1 ni sur l'élément LCP. Un élément déjà visible au
   chargement est dans son état final (plage « entry » dépassée). */
@supports (animation-timeline: view()) {
  html[data-motion="full"] .s3d-rise {
    animation: s3d-rise linear both;
    animation-timeline: view();
    animation-range: entry 5% cover 28%;
  }
  /* Courbe continue, jamais par paliers (retour R06, 07.10.2026, §3.2). */
  html[data-motion="full"] .s3d-print {
    animation: s3d-print var(--ease-strate) both;
    animation-timeline: view();
    animation-range: entry 10% cover 35%;
  }
}
@keyframes s3d-rise {
  from {
    opacity: 0;
    translate: 0 1.5rem;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
/* « S'imprime » de bas en haut : le bord de la découpe monte d'un geste continu
   (la courbe est posée par l'appelant). */
@keyframes s3d-print {
  from {
    clip-path: inset(100% 0 0 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}

/* ── Stage WebGL (un seul canvas, porté dans <body>, derrière le contenu) ── */
.s3d-stage {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100lvh;
  z-index: -1;
  pointer-events: none;
}
[data-stage-view] {
  position: relative;
}
[data-stage-view] > .s3d-poster {
  transition: opacity 240ms var(--ease-strate);
}
[data-stage-view][data-stage-ready="true"] > .s3d-poster {
  opacity: 0;
}
/* Une vue qui couvre une section tonale peint elle-même le fond de la section. */
[data-tone]:has(> [data-stage-view][data-stage-ready="true"]) {
  background-color: transparent;
}
.s3d-baked {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* ── Header : filet de progression et buse d'attente ──────────────────── */
.s3d-progress {
  position: absolute;
  inset-inline: 0;
  bottom: -1px;
  height: 1px;
  background: var(--color-accent);
  transform-origin: 0 50%;
  transform: scaleX(var(--s3d-progress, 0));
}
.s3d-pending {
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 24px;
  height: 2px;
  background: var(--color-accent);
  animation: s3d-nozzle 900ms var(--ease-buse) infinite;
}
@keyframes s3d-nozzle {
  from {
    translate: -24px 0;
  }
  to {
    translate: 100vw 0;
  }
}

/* ── Lenis : recopier ici le contenu exact de node_modules/lenis/dist/lenis.css
   (version installée). Il gère html.lenis, [data-lenis-prevent] et
   .lenis-stopped. Lenis ne tourne jamais sur les pages avec iframe Stripe. ── */

/* ── Transitions de page « Coupe » (React <ViewTransition>, §3.4) ─────── */
::view-transition {
  pointer-events: none;
}
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
}
::view-transition-group(site-header) {
  animation: none;
  z-index: 100;
}
::view-transition-old(site-header) {
  display: none;
}
::view-transition-new(site-header) {
  animation: none;
}
::view-transition-group(.s3d-coupe) {
  z-index: 2;
}
::view-transition-new(.s3d-coupe) {
  animation: s3d-print var(--dur-page) var(--ease-strate) both;
}
::view-transition-old(.s3d-coupe-out) {
  animation: none;
}
::view-transition-group(nav-mark) {
  animation-duration: var(--dur-ui);
  animation-timing-function: var(--ease-strate);
}

/* ── Existant conservé : .faq-item et .schematic-* (page Atelier) ──────
   (recopier les blocs actuels sans modification) */

/* ── Mouvement réduit : préférence OS (sauf choix explicite « full ») et
   interrupteur du footer. Coupe animations, transitions et View Transitions. */
@media (prefers-reduced-motion: reduce) {
  html:not([data-motion="full"]) *,
  html:not([data-motion="full"]) *::before,
  html:not([data-motion="full"]) *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  html:not([data-motion="full"])::view-transition-group(*),
  html:not([data-motion="full"])::view-transition-old(*),
  html:not([data-motion="full"])::view-transition-new(*) {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
  }
}
html[data-motion="reduce"] *,
html[data-motion="reduce"] *::before,
html[data-motion="reduce"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
html[data-motion="reduce"]::view-transition-group(*),
html[data-motion="reduce"]::view-transition-old(*),
html[data-motion="reduce"]::view-transition-new(*) {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
}
```

Notes de mise en œuvre : `@theme inline` fait pointer les utilitaires directement vers
`var(--paper)` & co., ce qui permet la redéfinition locale par `[data-tone]` (comportement déjà
utilisé aujourd'hui). Les styles propres à un package vont dans des **CSS Modules colocalisés**
(`*.module.css`) : **aucun package n'édite `globals.css` après WP-00**.

---

## 3. Système de mouvement

### 3.1 Principes

1. **Chaque mouvement a une cause physique** : une couche déposée, une bobine changée, une buse
   qui se déplace, une caméra qui bascule. Pas de bouton magnétique, pas de parallaxe gratuite,
   pas de texte qui roule au survol.
2. **Un seul plan continu** : chaque état naît du précédent (réimpression, vague, bascule). Jamais
   de fondu enchaîné générique, de flou d'entrée, de flip 3D ni de particules.
3. ~~**Quantifié** : les apparitions avancent par paliers (`steps(8)`, `s3d.pas`).~~
   **Abandonné le 07.10.2026** (retours R06/R07 du propriétaire, décision contraignante) : plus
   aucune animation par paliers sur le site. Le propriétaire n'a constaté aucun ralentissement ;
   la saccade venait des `steps(8, end)` eux-mêmes (huit sauts visibles au lieu d'un glissement).
   Les apparitions glissent sur `s3d.strate` / `--ease-strate`. L'idée des couches ne survit que
   dans des détails **statiques** (bord de découpe doux, filets de couche fixes), jamais dans un
   minutage en marches.
4. **Le mouvement ne retient jamais le contenu** : texte et posters sont visibles au premier
   paint, le mouvement enrichit un DOM déjà complet. Jamais `opacity: 0` sur un élément SSR en
   attendant le JS, jamais sur le h1.
5. **Un moteur par propriété** : GSAP pour tout ce qui est lié au scroll, les timelines et les
   uniforms WebGL ; CSS (transitions, `@starting-style`, `animation-timeline: view()`) pour l'UI
   et les révélations simples. **Motion (framer) ne reçoit plus de nouvel usage côté vitrine**
   (il reste pour l'admin, `Reorder`) ; le pill `layoutId` du header et `Reveal`/`HeroScene`
   disparaissent.

### 3.2 Courbes, durées, décalages

| Nom           | CustomEase (GSAP)                              | CSS                                                       | Usage                                                                                        | Durée                   |
| ------------- | ---------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------- |
| `s3d.strate`  | `M0,0 C0.16,0.84 0.3,1 1,1`                    | `var(--ease-strate)` = `cubic-bezier(0.16, 0.84, 0.3, 1)` | révélations de lignes et de blocs, soulignements, tiroirs                                    | 0,7–0,9 s (UI : 280 ms) |
| `s3d.buse`    | `M0,0 C0.45,0 0.55,1 1,1`                      | `var(--ease-buse)`                                        | déplacements de caméra et de buse, éclaté                                                    | 1,2–1,6 s               |
| `s3d.purge`   | `M0,0 C0.3,1.35 0.6,1 1,1` (léger dépassement) | `var(--ease-purge)`                                       | pastille choisie, flash de changement de filament, ajout au panier                           | 320 ms                  |
| `s3d.carte`   | `M0,0 C0.7,0 0.2,1 1,1`                        | `var(--ease-carte)`                                       | bascule élévation → plan, grands changements d'état                                          | 1,4 s                   |
| ~~`s3d.pas`~~ | ~~fonction `pas(n, k)` (ci-dessous)~~          | ~~`steps(8, end)`~~                                       | **abandonnée le 07.10.2026** (ci-dessous) ; « Coupe » et `.s3d-print` passent à `s3d.strate` | 480 ms (« Coupe »)      |

**Note du 07.10.2026 (retours R06/R07, §3.1, 3).** Aucune animation visible n'avance plus par
paliers : `.s3d-print` (révélation au défilement, `animation-timeline: view()`), la transition
de page « Coupe » (`::view-transition-new(.s3d-coupe)`, 480 ms) et le survol des cartes produit
(`clip-path`) utilisent `var(--ease-strate)`. Dans `src/motion/gsap.ts`, le nom `s3d.pas` reste
enregistré pour que les chorégraphies qui l'appellent encore (dessin des schémas de l'Atelier)
ne plantent pas, mais il désigne désormais la courbe continue `s3d.strate` ; la fonction `pas()`
subsiste pour les tests, jamais pour un mouvement visible. Le mouvement réduit ne change pas
(déjà sans animation).

**Durées** : micro 120–180 ms (`--dur-micro` 150), UI 240–320 ms (`--dur-ui` 280), révélations
700–900 ms (`--dur-reveal` 800), chapitres 1,2–1,6 s (`--dur-chapter` 1400), page 480 ms
(`--dur-page`). **Décalages** : 40 ms par ligne (« une couche »), 12 ms par caractère (rare),
60 ms par carte, au plus 12 éléments décalés ; les grilles apparaissent `from: "end"` (de bas en
haut).

`src/motion/gsap.ts` (WP-00), seul point d'entrée GSAP :

```ts
// src/motion/gsap.ts — seul module qui importe les paquets gsap. Tout src/motion importe d'ici.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";
import { CustomEase } from "gsap/CustomEase";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip, CustomEase);

CustomEase.create("s3d.strate", "M0,0 C0.16,0.84 0.3,1 1,1");
CustomEase.create("s3d.buse", "M0,0 C0.45,0 0.55,1 1,1");
CustomEase.create("s3d.purge", "M0,0 C0.3,1.35 0.6,1 1,1");
CustomEase.create("s3d.carte", "M0,0 C0.7,0 0.2,1 1,1");

/** Ease quantifiée : avance par paliers de 1/n (une « couche »), adoucie par k. Monotone. */
export function pas(n = 12, k = 0.85) {
  return (p: number) => p + (Math.round(p * n) / n - p) * k;
}
gsap.registerEase("s3d.pas", pas(12));

gsap.defaults({ ease: "s3d.strate", duration: 0.8 });
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, SplitText, Flip, CustomEase, useGSAP };
```

Les plugins à usage unique (`DrawSVGPlugin` pour les schémas de l'Atelier) sont enregistrés
dans la chorégraphie qui les utilise (`src/motion/choreo/about.tsx`), jamais ailleurs.

### 3.3 Grammaire de scroll

- **Lenis** seulement sous `(site)` (§4.2), `lerp: 0.1`, `syncTouch: false` (le tactile reste
  natif), piloté par `gsap.ticker`. Jamais `ScrollTrigger.normalizeScroll()`.
- **Un seul pin sur tout le site** : le héros de l'accueil, uniquement si
  `(min-width: 1024px) and (min-height: 768px)`, mouvement complet et capacité C2 (§3.6).
  Longueur 180 % de la hauteur d'écran, `scrub: 0.6`. Lien d'évitement « Passer l'animation »
  (visible au focus) vers le chapitre 01. Aucun pin sur mobile ni sous 768 px de haut.
- **Les scrubs ne pilotent que des grandeurs physiques** : hauteur imprimée, bascule de caméra,
  écartement de l'éclaté.
- **Chapitres** : sections `data-chapter="01"`, `ChapterRail` (desktop ≥ 1536 px depuis le 30.09.2026, ≥ 1280 px à l'origine : numéros mono,
  point rouge sur le chapitre courant, IntersectionObserver, pas de GSAP), filet rouge de
  progression sous le header (`--s3d-progress`, écrit par le runtime).
- **Révélations** : par défaut CSS (`.s3d-rise` pour les blocs de texte, `.s3d-print` pour images
  et cartes). Titres de chapitre : SplitText `type: "lines"`, `mask: "lines"`, `autoSplit: true`,
  animation retournée par `onSplit`, décalage 40 ms, `s3d.strate` 0,8 s, une fois. Le texte reste
  dans le HTML SSR (SplitText pose `aria-label` sur le parent et `aria-hidden` sur les
  fragments). **Jamais sur le h1** ni sur un élément au-dessus de la ligne de flottaison.
- **Compteurs** : tweens quantifiés (`s3d.pas`), écritures DOM limitées à 10 Hz, nœuds marqués
  `ph-no-capture`.
- **Arrivée en haut de page (R15, 07.10.2026).** Une navigation vers un nouveau chemin (hors
  ancre) arrive à `scrollY = 0`, dans les trois modes (Lenis, natif, mouvement réduit) ; le
  retour arrière du navigateur garde sa restauration native. Next remonte la page
  (`scrollTop = 0`), mais ScrollTrigger gardait en cache la position d'avant la navigation et la
  restaurait à chaque `refresh()` : `MotionRuntime.onRoute()` invalide ce cache
  (`resyncScroll`) et coupe l'interpolation de Lenis avant de rafraîchir.
- Pas de snap, pas de section horizontale, pas de détournement de la molette hors Lenis.
- `ScrollTrigger.refresh()` après le montage de chaque page, après `document.fonts.ready` et après
  le chargement des images au-dessus de la ligne de flottaison. Hauteurs mobiles en `svh`.
- **Ancres** : Lenis `anchors: { offset: -80 }` (header 64 + 16). L'AboutNav et les liens
  internes appellent `bridge.scroll.to()` quand il existe, sinon `scrollIntoView` avec
  `behavior: "auto"` en mouvement réduit.

### 3.4 Grammaire des transitions

- **« Coupe » (transition de page)** : chaque page de `(site)` enveloppe son contenu dans
  `<PageCut>` (§8), un `<ViewTransition>` de React 19.3 :
  `enter={{ "s3d-coupe": "s3d-coupe", default: "none" }}`,
  `exit={{ "s3d-coupe": "s3d-coupe-out", default: "none" }}`, `default="none"`. Les liens de
  navigation principaux (`SiteLink`) portent `transitionTypes={["s3d-coupe"]}`. La nouvelle page
  monte de bas en haut en une découpe de `clip-path` **continue** (480 ms, `--ease-strate`,
  jamais par paliers depuis le 07.10.2026, retour R07) par-dessus l'ancienne,
  qui ne bouge pas ; le header est ancré (`view-transition-name: site-header`). Sans type
  (bouton retour du navigateur, Firefox qui ignore les types) : pas d'animation. Mouvement
  réduit : durée 0. CSS au §2.5. Le canvas du Stage n'a **pas** de `view-transition-name` : il
  fait partie des instantanés de la racine.
- **Morph carte → fiche** : l'image de `ProductCard` et l'image principale de la galerie portent
  `<ViewTransition name={`product-${slug}`} share="morph" default="none">`.
- **Soulignement de nav** : l'élément « actif » (2 px rouge) porte
  `view-transition-name: nav-mark` et glisse d'un onglet à l'autre pendant la transition.
- **Attente serveur** (pages dynamiques, `prefetch = false`) : `useLinkStatus()` dans `SiteLink`
  signale `navPending` au bridge ; le header affiche une **buse rouge** de 24 px qui parcourt son
  bord inférieur (`.s3d-pending`) jusqu'au commit. Pas de `loading.tsx` (il casserait les paires
  de View Transitions).
- **Tiroirs et dialogues** : `<dialog>` natif (`showModal()`, top layer), entrée par
  `@starting-style` + transition 280 ms `s3d.strate`, depuis le bas (mobile) ou la droite
  (desktop). Lenis est arrêté pendant l'ouverture (`bridge.scroll.lock(true)`).
- **Changements d'état dans le Stage** : vague de couleur (palette), réimpression (motif ou
  géométrie), bascule de caméra, éclaté. Toujours en continuité, jamais de fondu.

### 3.5 Micro-interactions et équivalents tactiles

| Interaction                 | Souris                                         | Tactile                                                                    | Clavier                                               |
| --------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| Soulignement d'un lien      | se trace de gauche à droite (280 ms)           | déjà tracé à l'état actif                                                  | déjà tracé au focus                                   |
| Pastille de filament        | aperçu de la vague au survol (desktop Studio)  | vague au tap                                                               | flèches dans le groupe radio                          |
| Carte produit               | la 2ᵉ image monte d'un geste continu           | balayage unique à l'entrée dans la vue                                     | rien (focus visible)                                  |
| Rotation 3D (Studio, fiche) | glisser                                        | glisser à un doigt dans la vue (`touch-action: none` sur la vue seulement) | flèches quand la vue a le focus + boutons « Tourner » |
| Zoom 3D                     | boutons +/− (la molette fait défiler la page)  | pincer                                                                     | boutons                                               |
| Réglages Studio             | curseurs natifs, Maj + flèche = ×10            | curseurs de 44 px, réglette Z verticale au pouce                           | idem                                                  |
| Ajout au panier             | pastille `s3d.purge` sur le compteur du header | idem + `navigator.vibrate(5)` si disponible                                | annonce `aria-live` existante                         |

### 3.6 Mouvement réduit et paliers d'appareil

**Deux axes** : la **préférence** (`reduced`, depuis `data-motion`) et la **capacité** (C0–C2).

- **C0** si : pas de contexte WebGL2, `navigator.connection.saveData`, `navigator.deviceMemory ≤ 2`,
  une perte de contexte déjà survenue dans la session (`sessionStorage`), ou déclassement depuis C1.
- **C1** si : `(pointer: coarse)`, ou largeur < 1024 px, ou `hardwareConcurrency ≤ 4`.
- **C2** sinon.
- **Déclassement automatique** : médiane des 60 premières frames rendues > 22 ms → C2 devient C1
  (LOD mobile, champ WebGL coupé ; le DPR est plafonné à 1,5 aux deux paliers depuis le
  08.10.2026, donc inchangé) ou C1 devient C0 (Stage libéré, posters).
- La détection vit dans `src/lib/motion-bridge/tier.ts` (léger, sans import lourd), après
  l'hydratation. Côté serveur, tout le monde reçoit les posters (état C0).

| Élément                       | C2 · complet                                  | C1 · complet                                                                 | C0 (tout mouvement)                               | Mouvement réduit (toute capacité)                                                  |
| ----------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Lenis                         | oui                                           | oui (molette seulement ; tactile natif)                                      | non                                               | non                                                                                |
| Chorégraphies GSAP, SplitText | oui                                           | oui, allégées                                                                | CSS seulement                                     | non (états finaux)                                                                 |
| Pin du héros                  | oui (≥ 1024 × 768)                            | non                                                                          | non                                               | non                                                                                |
| Héros                         | impression animée, contrôles, bascule en plan | impression autojouée 0 → 100 % en 4,2 s, réglette Z                          | poster SVG final, contrôles qui recolorent le SVG | poster SVG final, contrôles instantanés                                            |
| Champ de courbes (accueil)    | WebGL                                         | SVG statique                                                                 | SVG statique                                      | SVG statique                                                                       |
| Studio 3D                     | oui                                           | oui (scène collante : son rectangle ne bouge pas au scroll, pas de décalage) | vue Élévation SVG, export et devis complets       | 3D **rendue à la demande** (sans vague, sans autorotation, sans simulation animée) |
| Viewer produit (Vase spirale) | oui                                           | oui, figé au repos                                                           | photos seulement                                  | oui, sans autorotation                                                             |
| Transition « Coupe »          | oui                                           | oui                                                                          | oui (CSS)                                         | non                                                                                |
| Révélations CSS               | oui                                           | oui                                                                          | oui                                               | non                                                                                |
| Compteurs                     | animés                                        | animés                                                                       | valeur finale                                     | valeur finale                                                                      |

**Interrupteur « Réduire les animations »** (footer, `MotionToggle`) : écrit
`localStorage["s3d-motion"] = "reduce" | "full"` (try/catch), pose `data-motion` sur `<html>` et
émet `s3d-motion-change`. Le script anti-FOUC du layout (déjà doté du nonce CSP) lit cette clé
avant le paint (§4.3). Cela couvre WCAG 2.2.2 (mettre en pause un contenu animé) ; aucune
animation automatique ne dure plus de 5 s de toute façon (intro 3,2 s, autoplay mobile 4,2 s).

### 3.7 Son

**Aucun son en v1.** Si le propriétaire le demande plus tard : coupé par défaut, bouton explicite
« Son », Web Audio génératif sans fichier (ronronnement pas à pas, clic de changement de bobine),
jamais sur panier, checkout, compte, suivi ou légal.

---

## 4. Architecture technique

### 4.1 Couches et frontière du bundle

```
Serveur (Worker OpenNext)                 Navigateur
─────────────────────────                 ────────────────────────────────────────────────────
Pages RSC + composants SSR  ──── SSR ───▶ DOM complet : textes, posters SVG, formulaires, liens
  src/app/**, src/components/**           │
  src/lib/motion-bridge/** (léger)        ├── hydratation : bridge (store, hooks, <StageView>)
  src/lib/studio/**        (pur TS)       │
                                          └── src/gates/*.tsx ── next/dynamic({ ssr: false }) ──▶ src/motion/**
                                                                                         gsap, lenis, three,
                                                                                         scènes, Worker du Studio
Interdits : import de gsap / lenis / three / postprocessing hors src/motion/** ;
            import (statique OU dynamique) de @/motion/** hors src/gates/** et src/motion/**.
```

- **`src/motion/**`** : seul endroit qui importe `gsap`, `gsap/*`, `@gsap/react`, `lenis`,
  `three`, `three/*`, `postprocessing`. Atteint **uniquement** par `next/dynamic(() => import(...),
{ ssr: false })` déclaré dans un fichier de `src/gates/**`. Avec `ssr: false`, le transform de
  Next retire l'import du build serveur : le Worker ne voit jamais ces paquets. (Un simple
  `await import("three")` dans un effet d'un composant rendu côté serveur **reste** dans le
  Worker, voir `research/critique.md` §2.2 : c'est interdit.)
- **`src/gates/**`** : un fichier par package (`runtime.tsx`, `home.tsx`, `studio.tsx`,
  `product.tsx`, `about.tsx`), `"use client"`, ne contient que des déclarations
  `dynamic(() => import("@/motion/…").then((m) => m.X), { ssr: false })` au niveau module.
- **`src/lib/motion-bridge/**`** : léger, SSR-safe, importable partout. Store externe, hooks,
  types, préférence de mouvement, détection de capacité. Le côté lourd importe le bridge,
  jamais l'inverse.
- **`src/lib/studio/**`** : géométrie, statistiques, estimation, codecs d'URL, posters SVG, écriture
  STL. **Pur TypeScript, sans three**, utilisable par le SSR, le client, le Worker du Studio et le
  Stage (qui ne fait qu'envelopper les `Float32Array` dans des `BufferGeometry`).
- **Communication** : le DOM passe des _props_ (snapshots immuables) aux vues ; le côté lourd
  renvoie des états (couche courante, prêt, statistiques d'export) par le bridge ou par des
  callbacks. Les chorégraphies pilotent les scènes par des **contrôleurs** (objets JS à propriétés
  animables) exposés par le Stage.

### 4.2 Groupe de routes `(site)` (WP-00, par `git mv`)

```
src/app/[locale]/
  layout.tsx                 racine : <html>, polices, script anti-FOUC (thème + mouvement), Header, Footer,
                             BottomNav, ConsentBanner, WebMcpTools — inchangé dans sa structure
  not-found.tsx, error.tsx   hors (site) : statiques, sans Lenis ni Stage
  [...rest]/page.tsx         inchangé (notFound())
  (site)/                    NOUVEAU groupe (absent de l'URL)
    layout.tsx               <SiteShell>{children}</SiteShell> : MotionRuntime + StageRoot, persistants entre pages vitrine
    page.tsx                 accueil         (déplacé)
    shop/…                   boutique        (déplacé)
    products/[slug]/…        fiche produit   (déplacé)
    studio/…                 Studio          (nouveau, WP-STUDIO)
    custom/…                 sur mesure      (déplacé)
    a-propos/…               Atelier         (déplacé, avec contact-form, actions, about-content…)
    contact/…                contact         (déplacé ; son import relatif ../a-propos/contact-form reste valide)
  cart/  checkout/  track/  favorites/  account/  oauth/  agent/  legal/  admin/   restent hors (site)
```

- Quitter `(site)` démonte `SiteShell` : Lenis détruit, renderer libéré (`dispose()` +
  `forceContextLoss()`). **Stripe, compte, admin, OAuth, suivi et légal ne voient jamais ni Lenis
  ni canvas.**
- Le déplacement ne change aucune URL, aucun `generateMetadata`, aucune action. WP-00 vérifie
  après coup : `bun run typecheck`, navigation des 8 routes, `sitemap.xml` identique.
- `/custom` est dans `(site)` : page publique indexée, sans iframe Stripe ; la carte « Configuration
  Studio jointe » y affiche une image précalculée, pas de WebGL.

### 4.3 MotionRuntime (WP-00, `src/motion/runtime.tsx`)

Chargé par `SiteShell` via `src/gates/runtime.tsx` après l'hydratation
(`requestIdleCallback`, délai max 1 200 ms), seulement si `reduced === false` et capacité ≥ C1.

Responsabilités :

1. Créer Lenis : `{ autoRaf: false, lerp: 0.1, smoothWheel: true, syncTouch: false, anchors: { offset: -80 }, stopInertiaOnNavigate: true, allowNestedScroll: true, prevent: (n) => !!n.closest?.("[data-lenis-prevent], dialog[open]") }`.
2. Une seule boucle : `gsap.ticker.add((t) => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`,
   `lenis.on("scroll", ScrollTrigger.update)`.
3. Écrire `--s3d-progress` (0–1) sur `<html>` et la vitesse lissée dans le bridge.
4. Exposer `bridge.scroll = { to(target, { offset, immediate }), lock(on) }`.
5. À chaque changement de `pathname` : `lenis.resize()` puis `ScrollTrigger.refresh()` à la frame
   suivante, puis après `document.fonts.ready`.
6. Écouter `s3d-motion-change` et `matchMedia("(prefers-reduced-motion)")` : détruire ou recréer
   Lenis.
7. Au démontage : retirer le ticker, `lenis.destroy()`, effacer `--s3d-progress`,
   `bridge.scroll = null`.

**Script anti-FOUC du layout** (le seul script inline ; il porte déjà le nonce) : remplacer son
contenu par la version ci-dessous (thème inchangé + mouvement) :

```js
(function () {
  try {
    var r = document.documentElement;
    var t = localStorage.getItem("theme");
    var d = t
      ? t === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    r.classList.toggle("dark", d);
    r.style.colorScheme = d ? "dark" : "light";
    var m = null;
    try {
      m = localStorage.getItem("s3d-motion");
    } catch (e) {}
    var rm = m
      ? m === "reduce"
      : matchMedia("(prefers-reduced-motion: reduce)").matches;
    r.dataset.motion = rm ? "reduce" : "full";
  } catch (e) {}
})();
```

### 4.4 Stage : un seul renderer WebGL persistant (WP-00 pour le cœur)

- **Canvas** : un seul `<canvas class="s3d-stage" aria-hidden="true">` créé par `StageRoot` et
  **porté dans `document.body`** (calque `z-index: -1`, au-dessus du fond racine et sous tout le
  contenu). Le DOM reste au-dessus : les titres peuvent chevaucher un objet 3D.
- **Renderer** : `new WebGLRenderer({ canvas, antialias: capacity === 2, alpha: true, powerPreference: "high-performance", stencil: false })`,
  `setPixelRatio(min(devicePixelRatio, capacity === 2 ? 2 : 1.5))`, `autoClear = false`,
  `setScissorTest(true)`, `outputColorSpace = SRGBColorSpace`, `toneMapping = NeutralToneMapping`,
  environnement `RoomEnvironment` via `PMREMGenerator` (partagé), aucun post-traitement.
- **Vues** : un composant DOM `<StageView>` (§8) enregistre son élément dans le bridge
  (`useStageView`). Une vue = `{ id, scene, element, props, clear, liveRect, bakeWhenIdle, interactive }`.
  Chaque vue a sa propre instance de scène (géométries partagées par un cache module).
- **Règle de composition** : une vue **couvre toute la section qui l'héberge** ou vit dans une
  section transparente. Quand la vue est prête, l'élément reçoit `data-stage-ready="true"` : son
  poster (enfant `.s3d-poster`) s'efface en 240 ms et une section tonale devient transparente
  (CSS `:has`, §2.5) ; la vue peint alors le fond de ton (`clear: "tone"`, couleur lue dans
  `--paper` calculé sur la section). Aucune vue n'est placée sous un fond DOM opaque.
- **Rectangles** : cache des positions document (`getBoundingClientRect + scrollY`) recalculé par
  `ResizeObserver`, `resize`, `ScrollTrigger` `refresh` et `document.fonts.ready` ; pendant le
  scroll, `top = docTop − scrollY` (aucune lecture de layout). Exception : `liveRect: true`
  (vue dans une section pinnée ou transformée) → `getBoundingClientRect()` par frame, pour
  une ou deux vues au plus.
- **Boucle** : sur `gsap.ticker` quand le runtime est là, sinon `requestAnimationFrame`. Par frame :
  pour chaque vue visible (IntersectionObserver, marge 25 %) → `setViewport` / `setScissor` en
  pixels physiques (`y` compté depuis le bas du canvas), `clear` selon la vue, `scene.render()`.
  **Rendu à la demande** : on ne rend que si une vue a bougé (scroll), si ses props ou le thème ont
  changé, ou si sa scène demande une frame (animation). Pause sur `document.hidden`.
- **Mobile (C1) : « bake » au repos** : sur mobile, le scroll natif est composité hors du fil
  principal, alors que le canvas fixe se redessine une frame plus tard : une vue qui défile
  « nage » légèrement. Une vue marquée `bakeWhenIdle` (héros mobile après l'autoplay, sous-verre du
  chapitre 02, viewer de la fiche) et sans interaction ni changement de props depuis 800 ms est
  donc rendue une fois dans un render target, copiée en image (`blob:` URL, autorisé par
  `img-src`) dans l'élément (`<img class="s3d-baked">`) puis mise en sommeil : le scroll déplace
  une vraie image, sans décalage. Le moindre changement de props ou `pointerdown` la réveille.
  Les vues collantes (Studio) n'en ont pas besoin. Sur desktop, c'est le canvas ancré (point
  suivant) qui règle le décalage, au clavier et à la barre de défilement comme à la molette.
- **Canvas ancré au document (C1 le 07.10.2026, C2 le 08.10.2026, retour R16 « les objets 3D
  sautent au défilement »).** Mesuré (compositeur d'Edge avec GPU, marqueurs peints dans le canvas,
  écart DOM ↔ canvas par image) : le défilement de Lenis (molette, trackpad) est mené par le fil
  principal dans la même frame que le dessin, donc l'écart est de 0,4 à 0,6 px ; mais dès que le
  compositeur défile seul (tactile, clavier : flèches, Espace, Pages, Début et Fin ; barre de
  défilement) un canvas `fixed` montre l'objet une ou deux frames en retard : jusqu'à 16 px au
  clavier en C1, 10,4 px en C2 (109 images sur 127 au-dessus de 1 px), y compris pour une vue qui se
  redessine (non figée). `StageRoot` monte donc, **aux deux paliers**, le canvas dans un calque
  absolu de la hauteur de la page, rogné (`overflow: clip`, pour ne jamais allonger la page),
  derrière le contenu : un canvas de **1,6 fenêtre de haut à la souris** (0,3 fenêtre de marge de
  chaque côté ; **deux fenêtres** dès qu'un pointeur grossier existe), décalé dans le sens du
  défilement (anticipation : vitesse × 0,1 s, jamais plus de 80 % de la marge ; WP-99,
  `stage/anchor-margin.ts`) que la boucle recale à chaque frame (`CanvasAnchor.follow`, `stage/ticker.ts`,
  `translate3d` arrondi au pixel physique), dans la même tâche que le dessin. Entre deux frames du
  fil principal le canvas défile avec le DOM, côté compositeur : il reste collé à son conteneur,
  quel que soit le geste (molette Lenis, tactile, clavier, barre de défilement). Le clavier reste
  natif (accessibilité) : Lenis n'en intercepte aucune touche. `ViewTracker.rect()` rend des
  rectangles **relatifs au canvas** (fenêtre décalée de `offsetY()`), le Stage n'en sait rien ;
  `ViewFrame.scrollY` donne aux scènes la position du haut du canvas dans le document (le champ de
  courbes dessine en coordonnées page).
  Une vue « live » (`liveRect` : Studio collant, héros épinglé en C2) **proche de la fenêtre**
  (IntersectionObserver, marge 25 %) redonne un calque fixe, de la fenêtre : un élément collant ou
  épinglé reste en place pendant que le compositeur défile le document. Dès qu'elle s'éloigne (le
  héros de l'accueil, passé), le calque redevient ancré (`ViewTracker.syncAnchor`) : le héros
  reste « live » tant que la page vit, il aurait sinon gardé le canvas fixe pour tout le reste de
  l'accueil et le clavier y aurait gardé l'écart natif. Un déclassement C2 → C1 en cours de session
  ne change pas le montage.
  **Décision du propriétaire du 08.10.2026 : ancrer aussi en C2, avec un rapport de pixels plafonné
  à 1,5** (`stage/pixel-ratio.ts`, 1,5 aux deux paliers ; avant, 2 en C2). Un canvas de deux
  fenêtres à 1,5 porte à peu près la même surface que l'ancien canvas fixe d'une fenêtre à 2
  (1440 × 900 : 5,8 Mpx contre 5,2 Mpx, multiéchantillonnée en C2 : 4 échantillons). **Pas de
  plancher** (R12 optionnel « DPR ≥ 1,5 ») : sur un écran à DPR 1 le canvas de deux fenêtres porte
  déjà deux fois les pixels de l'ancien canvas fixe (2,6 Mpx contre 1,3 Mpx) ; un plancher à 1,5
  les multiplierait par 4,5. Mesures, netteté comparée et limites : `measures-r16.md`.
  **WP-99 (09.10.2026)** : budget de pixels du tampon, 8 Mpx en C2 et 4 Mpx en C1 à pointeur
  précis (4K à 150 % : 16,5 → 8,0 Mpx ; 1440 × 900 DPR 2 : 5,77 → 4,62 Mpx) ; C2 → C1 réalloue le
  tampon avec le budget de C1. Mesures : `measures-wp99-canvas.md`.
- **Vignettes** : service `bake(scene, props, { width, height }) → Promise<Blob>` (render target,
  `readRenderTargetPixels`, canvas 2D, `toBlob("image/webp", 0.86)`), exposé au DOM par
  `bridge.stage.bake` (« Mes créations », pièce jointe du devis).
- **Perte de contexte** : `webglcontextlost` → `preventDefault()`, capacité C0 pour la session
  (`sessionStorage["s3d-webgl-lost"] = "1"`), libération, posters réaffichés (on retire
  `data-stage-ready`).
- **Thème** : le Stage s'abonne à la classe `.dark` (même mécanisme que `useIsDark`) et repasse les
  couleurs de fond et de ligne aux scènes.
- **Chargement** : `SiteShell` ne monte `StageRoot` (gate) que si au moins une vue est enregistrée,
  capacité ≥ C1 et pas de perte de contexte. Une page sans vue (contact, sur mesure) ne télécharge
  jamais three.
- **Scènes v1 (4) et un service** : `print-hero` (accueil : héros et éclaté du chapitre 01),
  `contour-field` (accueil, C2 seulement), `studio-object` (Studio, chapitre 02 de l'accueil),
  `product-viewer` (fiche du Vase spirale) ; service `bake`. Registre
  `src/motion/stage/scenes/index.ts` (WP-00) : `{ "print-hero": () => import("./print-hero"), … }` ;
  WP-00 avait livré un module **stub** par scène (un cube papier) ; chaque package a remplacé le
  sien et WP-99 a retiré la scène témoin (`stub-cube.ts`).

### 4.5 Contrats TypeScript (figés : ajouts permis, ruptures interdites)

```ts
// src/lib/motion-bridge/types.ts (WP-00)
export type Capability = 0 | 1 | 2;
export type SceneId =
  "print-hero" | "contour-field" | "studio-object" | "product-viewer";

export interface StageViewDescriptor<P = unknown> {
  id: string; // useId()
  scene: SceneId;
  element: HTMLElement; // conteneur transparent qui couvre sa section
  props: P; // snapshot immuable : on remplace, on ne mute pas
  clear: "transparent" | "tone";
  liveRect?: boolean; // true si dans une section pinnée ou transformée
  bakeWhenIdle?: boolean; // C1 seulement : figer en image au repos (vues qui défilent avec la page)
  interactive?: boolean; // orbite, pointeur
  priority?: number; // ordre de rendu (croissant)
}

export interface MotionBridgeState {
  capability: Capability; // 0 côté serveur
  reduced: boolean;
  runtimeReady: boolean;
  stageReady: boolean;
  contextLost: boolean;
  navPending: boolean;
  velocity: number; // px/frame lissée, écrite par le runtime
  scroll: {
    to(
      target: number | string | HTMLElement,
      o?: { offset?: number; immediate?: boolean },
    ): void;
    lock(on: boolean): void;
  } | null;
  stage: {
    bake(
      scene: SceneId,
      props: unknown,
      size: { width: number; height: number },
    ): Promise<Blob>;
  } | null;
}
```

```ts
// src/lib/motion-bridge/store.ts (WP-00) — store externe minimal (useSyncExternalStore)
export const motionBridge: {
  get(): MotionBridgeState;
  set(patch: Partial<MotionBridgeState>): void;
  subscribe(listener: () => void): () => void;
  views: {
    register(view: StageViewDescriptor): void;
    update(id: string, props: unknown): void;
    unregister(id: string): void;
    list(): StageViewDescriptor[];
    subscribe(listener: () => void): () => void; // n'émet que sur ajout / retrait / props
  };
};
export function useMotionBridge<T>(select: (s: MotionBridgeState) => T): T;

// src/lib/motion-bridge/use-stage-view.ts (WP-00)
export function useStageView<P>(
  ref: React.RefObject<HTMLElement | null>,
  scene: SceneId,
  props: P,
  opts?: Pick<
    StageViewDescriptor,
    "clear" | "liveRect" | "bakeWhenIdle" | "interactive" | "priority"
  >,
): { id: string; ready: boolean };
```

```ts
// src/motion/stage/types.ts (WP-00) — côté lourd uniquement
export interface StageContext {
  renderer: import("three").WebGLRenderer;
  envMap: import("three").Texture;
  capability: Capability;
  reduced: boolean;
  theme: {
    dark: boolean;
    paper: string;
    ink: string;
    iso: string;
    isoIndex: string;
  };
}
export interface ViewFrame {
  rect: DOMRectReadOnly;
  dpr: number;
  time: number;
  dt: number;
  scrollY: number;
  velocity: number;
}
export interface StageScene<P, C = unknown> {
  mount(ctx: StageContext, view: StageViewDescriptor<P>): Promise<void> | void;
  update(props: P): void;
  render(ctx: StageContext, frame: ViewFrame): boolean; // true = « rends-moi encore »
  controller?: C; // propriétés animables par GSAP
  dispose(): void;
}
export type SceneModule<P, C = unknown> = {
  default: (ctx: StageContext) => StageScene<P, C>;
};

// src/motion/stage/controllers.ts (WP-00) — les chorégraphies retrouvent le contrôleur d'une vue
export function getController<C>(viewId: string): C | undefined;
export function onController<C>(viewId: string, cb: (c: C) => void): () => void;
```

Contrats de données partagés (créés par WP-00, **implémentés et testés** par WP-00, car petits et
utilisés par plusieurs packages) :

```ts
// src/lib/studio/types.ts (WP-00 crée le contrat ; WP-01 et WP-02 l'étendent sans rupture)
export type StudioObjectId = "lavaux" | "cartouche" | "relief" | "borne";
export type FilamentId =
  | "blanc-neve"
  | "encre"
  | "rouge-signal"
  | "bleu-leman"
  | "vert-lavaux"
  | "gris-molasse"
  | "ambre"
  | "glacier";
export interface Band {
  filament: FilamentId;
  toMm: number;
} // bandes contiguës depuis z = 0 ; la dernière finit à la hauteur totale
export interface StudioTexts {
  name?: string;
  role?: string;
  line1?: string;
  line2?: string;
  peak?: string;
  text?: string;
} // JAMAIS dans l'URL
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  side?: Float32Array; // 0 = paroi extérieure, 1 = intérieure (lignes fantômes)
  groups: { start: number; count: number; band: number }[];
  bbox: [number, number, number, number, number, number]; // mm, Z vers le haut
  triangles: number;
}
// Les unions LavauxConfig | CartoucheConfig | ReliefConfig | BorneConfig (§6.2.1), StudioStats et Printability (§6.5) complètent ce fichier.

// src/lib/studio/creations.ts (WP-00) — « Mes créations », localStorage, try/catch partout
export interface Creation {
  id: string;
  object: StudioObjectId;
  fragment: string;
  texts?: StudioTexts;
  thumbnail?: string;
  label: string;
  savedAt: number;
}
export function listCreations(): Creation[];
export function saveCreation(
  c: Omit<Creation, "id" | "savedAt">,
): Creation | null; // 12 max (FIFO), vignette ≤ 60 Ko sinon omise
export function removeCreation(id: string): void;
export function subscribeCreations(cb: () => void): () => void; // événement storage + événement local

// src/lib/quote-handoff.ts (WP-00) — passage Studio → /custom, sessionStorage["s3d-quote-handoff-v1"]
export interface QuoteHandoff {
  v: 1;
  source: "studio";
  object: StudioObjectId;
  link: string; // lien de configuration SANS texte personnel
  prefill: {
    description: string;
    material: "PLA";
    colors: string;
    dimensions: string;
  };
  attachment?: { key: string; name: string; bytes: number; triangles: number };
  thumbnail?: string;
  createdAt: number; // expire après 24 h (durée du cookie propriétaire)
}
export function writeQuoteHandoff(h: QuoteHandoff): boolean;
export function readQuoteHandoff(): QuoteHandoff | null;
export function clearQuoteHandoff(): void;

// src/lib/studio/texts-store.ts (WP-00) — textes saisis, sessionStorage["s3d-studio-texts-v1"]
// Écrit par l'accueil (chapitre 02) et par le Studio, lu par le Studio. Jamais dans l'URL.
export function readStudioTexts(object: StudioObjectId): StudioTexts;
export function writeStudioTexts(
  object: StudioObjectId,
  texts: StudioTexts,
): void;
export function clearStudioTexts(object?: StudioObjectId): void;
```

Le contrat de vue `StudioObjectViewProps` et l'entrée `studio` du bridge (export STL) sont
définis au §9.2 : ils permettent à l'accueil d'afficher un objet Studio sans attendre WP-STUDIO.

### 4.6 Garde-fous automatiques

**`.oxlintrc.json`** (WP-00 ; conserve plugins, règles et `ignorePatterns` actuels) :

```jsonc
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": [
    "eslint",
    "typescript",
    "unicorn",
    "oxc",
    "react",
    "jsx-a11y",
    "nextjs",
    "vitest",
  ],
  "rules": {
    "react/rules-of-hooks": "error",
    "nextjs/no-img-element": "off",
    // Bundle du Worker (règle d'or 10) : moteurs motion et 3D seulement sous src/motion/**.
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "three",
            "message": "three : uniquement sous src/motion/**. Types : import type.",
            "allowTypeImports": true,
          },
          {
            "name": "gsap",
            "message": "gsap : uniquement sous src/motion/** (via @/motion/gsap).",
          },
          {
            "name": "@gsap/react",
            "message": "@gsap/react : uniquement sous src/motion/**.",
          },
          {
            "name": "lenis",
            "message": "lenis : uniquement sous src/motion/**.",
          },
          {
            "name": "postprocessing",
            "message": "postprocessing : uniquement sous src/motion/** (non installé en v1).",
          },
        ],
        "patterns": [
          {
            "group": ["three/*", "gsap/*", "lenis/*", "@gsap/*"],
            "message": "Moteur motion : uniquement sous src/motion/**.",
            "allowTypeImports": true,
          },
          {
            "group": ["@/motion", "@/motion/*"],
            "message": "src/motion n'est atteint que depuis src/gates/** par next/dynamic({ ssr: false }).",
            "allowTypeImports": true,
          },
        ],
      },
    ],
  },
  "overrides": [
    { "files": ["src/motion/**"], "rules": { "no-restricted-imports": "off" } },
    {
      "files": ["src/gates/**"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "paths": [
              {
                "name": "three",
                "message": "Les gates n'importent que @/motion/** par next/dynamic.",
                "allowTypeImports": true,
              },
              {
                "name": "gsap",
                "message": "Les gates n'importent que @/motion/** par next/dynamic.",
              },
              {
                "name": "@gsap/react",
                "message": "Les gates n'importent que @/motion/** par next/dynamic.",
              },
              {
                "name": "lenis",
                "message": "Les gates n'importent que @/motion/** par next/dynamic.",
              },
            ],
            "patterns": [
              {
                "group": ["three/*", "gsap/*", "lenis/*", "@gsap/*"],
                "message": "Les gates n'importent que @/motion/**.",
                "allowTypeImports": true,
              },
            ],
          },
        ],
      },
    },
    // (Une entrée temporaire désactivait la règle pour l'ancien viewer, supprimé par
    // WP-SHOP ; elle a été retirée par WP-99.)
  ],
  "ignorePatterns": [
    ".claude/**",
    "drizzle/**",
    "drizzle-pg/**",
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "public/**",
    "workers/**",
    "cloudflare-env.d.ts",
    "next-env.d.ts",
    "src/app/icon.svg",
  ],
}
```

**`src/gates/boundary.test.ts`** (Vitest, WP-00) : pour chaque fichier de `src/gates/`,
(a) aucun import statique non-type de `@/motion` ; (b) chaque `import("@/motion/…")` est
l'argument d'un appel `dynamic(` dont les options contiennent `ssr: false` ; (c) le fichier
commence par `"use client"`. Et pour tout `src/**/*.{ts,tsx}` hors `src/motion` et `src/gates` :
aucune occurrence de `@/motion`, `from "three`, `from "gsap`, `from "lenis`.

**`scripts/check-worker-bundle.ts`** (Bun, WP-00) : après `bunx opennextjs-cloudflare build`,
parcourt `.open-next/server-functions/**/*.{js,mjs}` et échoue si l'une de ces signatures apparaît :
`WebGLRenderer`, `GreenSock`, `lenis-smooth`, `ScrollTrigger`, `NeutralToneMapping`. Imprime aussi
la taille totale. **`scripts/chunk-report.ts`** : liste les 15 plus gros chunks de
`.next/static/chunks` (taille gzip) et signale ceux qui contiennent three, gsap ou lenis, pour
vérifier les budgets clients (§4.11).

### 4.7 Paquets (versions exactes, `bun` uniquement)

```bash
# WP-00, en une fois (aucun autre package ne touche package.json ni bun.lock)
bun add gsap@3.15.0 @gsap/react@2.1.2 lenis@1.3.26 d3-contour@4.0.2 earcut@3.2.3
bun add three@0.186.1 --exact
bun add -d @types/three@0.186.0 @types/d3-contour@3.0.6 opentype.js@1.3.4 @types/opentype.js@1.3.10 --exact
```

- `three` est bloqué à `0.186.1` (Dependabot : refuser les montées sans revue du Stage).
- **Non installés en v1** : `postprocessing` (pas de post-traitement), `fflate` (3MF plus tard),
  `@react-three/*`, `ogl`, runtime Spline, Rive, Lottie, `detect-gpu` (CDN).
- Licences : GSAP « Standard no-charge license » (gratuite y compris en commercial, pas MIT : WP-99
  l'ajoute aux crédits de `LICENSE.md`/README) ; Lenis, three, d3-contour, earcut (ISC), opentype.js :
  MIT/ISC ; Archivo et Geist : OFL (fichier de licence à côté des polices et des glyphes).

### 4.8 CSP : aucun changement en v1

| Besoin                                             | Couvert par la CSP actuelle                                                                                          | Changement |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------- |
| Scripts gsap, lenis, three, Worker du Studio       | `script-src 'self' 'nonce-…'`, `worker-src 'self' blob: data:` (chunks bundlés, Worker servi depuis `/_next/static`) | aucun      |
| Styles inline de GSAP, SplitText, View Transitions | `style-src 'unsafe-inline'`                                                                                          | aucun      |
| Glyphes JSON, STL produit, posters SVG             | `connect-src 'self'` (fetch same-origin)                                                                             | aucun      |
| Upload STL du Studio                               | `POST /api/quote-upload` same-origin                                                                                 | aucun      |
| Vignettes et « bake » (`blob:`, `data:`)           | `img-src 'self' data: blob: https:`                                                                                  | aucun      |
| Polices                                            | `next/font` auto-hébergées (`font-src 'self'`)                                                                       | aucun      |
| WASM, `eval`                                       | non utilisés (earcut, d3-contour, opentype.js sont du JS pur ; pas de Draco, KTX2, Rive)                             | aucun      |

**Ajouts futurs possibles, chacun à valider par le propriétaire** : `connect-src blob:` le jour où
l'on charge un GLB texturé (bug connu `GLTFLoader`/`ImageBitmapLoader`) ; `media-src` si une
vidéo arrive (servie same-origin avec requêtes `Range`) ; `'wasm-unsafe-eval'` seulement pour un
décodeur indispensable (Meshopt, KTX2), jamais pour du confort. Chaque package vérifie la CSP de
production par `bun run preview` (la CSP de dev autorise `unsafe-eval` et masque les problèmes).

### 4.9 i18n : fichiers par package, fusion au chargement

**Règle** : `messages/{fr,de,it,en}.json` ont été **gelés** pendant la refonte (seul WP-00 y a
corrigé le ß ; seul WP-99 a retiré les clés devenues inutiles : 76 clés dans les 4 langues,
09.10.2026). **Le gel est levé depuis WP-99** : ces fichiers se modifient de nouveau, mêmes clés
dans les 4 langues. Chaque package a écrit ses textes dans **ses propres fichiers**
`messages/<locale>/<namespace>.json`, fusionnés au chargement par `src/i18n/request.ts`.

```ts
// src/i18n/namespaces.ts (WP-00)
// Un namespace = un fichier messages/<locale>/<ns>.json = un package propriétaire (§9.2).
export const NAMESPACES = [
  "shell",
  "studioCore",
  "landing",
  "studio",
  "quote",
  "catalog",
  "atelier",
  "system",
  "accountUi",
] as const;
export type Namespace = (typeof NAMESPACES)[number];
```

```ts
// src/i18n/request.ts (WP-00)
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { NAMESPACES } from "./namespaces";

type Messages = Record<string, unknown>;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  const [base, ...parts] = await Promise.all([
    import(`../../messages/${locale}.json`).then((m) => m.default as Messages),
    ...NAMESPACES.map((ns) =>
      import(`../../messages/${locale}/${ns}.json`).then(
        (m) => m.default as Messages,
      ),
    ),
  ]);
  const messages: Messages = { ...base };
  NAMESPACES.forEach((ns, i) => {
    if (ns in base)
      throw new Error(
        `[i18n] « ${ns} » existe déjà dans messages/${locale}.json`,
      );
    messages[ns] = parts[i];
  });
  return { locale, messages };
});
```

| Namespace    | Package         | Contenu                                                                                                                                                                                                                     |
| ------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shell`      | WP-00           | libellés de nav ajoutés (`studio`, `atelier`), BottomNav, footer (cartouche, préférences), `MotionToggle`, attente de navigation, textes des vues 3D (« Vue 3D indisponible sur cet appareil »), bouton principal générique |
| `studioCore` | WP-01 (+ WP-02) | noms des objets, profils, motifs, palettes, filaments, unités et formats de durée, gabarit du sommet (« Pointe {name} »), messages d'imprimabilité                                                                          |
| `landing`    | WP-HOME         | accueil : héros, chapitres, SEO de l'accueil                                                                                                                                                                                |
| `studio`     | WP-STUDIO       | pages Studio, contrôles, outils, tiroir d'envoi, erreurs d'export, FAQ, SEO                                                                                                                                                 |
| `quote`      | WP-QUOTE        | `/custom` : nouveaux textes, carte « Configuration Studio jointe », erreurs 429/413/415                                                                                                                                     |
| `catalog`    | WP-SHOP         | boutique (planche N = 1, vue Registre, rangée Studio), fiche (chapitres, attribution, viewer), réassurance (copie de `home.trust*` pour découpler)                                                                          |
| `atelier`    | WP-ABOUT        | nouveaux textes d'À propos et de contact                                                                                                                                                                                    |
| `system`     | WP-UTILITY      | panier, succès, suivi, favoris (« Mes créations »), 404, erreur                                                                                                                                                             |
| `accountUi`  | WP-ACCOUNT      | seulement si un texte nouveau est nécessaire (sinon `{}`)                                                                                                                                                                   |

- WP-00 crée les 36 fichiers (`{}` sauf `shell`), le test de parité et la correction du ß.
- **Test `src/i18n/messages.test.ts`** (WP-00) : pour chaque namespace et pour les fichiers
  historiques, les 4 locales ont exactement les mêmes clés (chemins imbriqués) et les mêmes
  arguments ICU (`{name}`, `{count, plural…}`) ; aucun `ß` dans `de` ; aucune valeur vide.
- `NextIntlClientProvider` continue de transmettre tous les messages au client : budget
  **≤ 25 Ko de textes nouveaux par locale** au total.
- SEO : titre complet ≤ 60 caractères (le gabarit ajoute « · Swiss3Design »), description 110–160.
- Liens et navigation : `@/i18n/navigation` (`Link`, `useRouter`, `usePathname`), jamais
  `next/link` nu (sauf `useLinkStatus`, qui s'importe de `next/link`).

### 4.10 Analytics et vie privée

**Événements conservés, noms et propriétés inchangés** : `Product Viewed`, `Products Searched`,
`Product List Filtered`, `Product Added` (`source`), `Product Added to Wishlist`,
`Product Removed from Wishlist`, `Cart Viewed`, `Product Removed`, `Checkout Started`,
`Checkout Step Viewed`, `Coupon Applied`, `Coupon Denied`, `Payment Info Entered`,
`Payment Failed`, `Order Completed` (`onceKey`, `revenue`), `Attribution Survey Answered`,
`Signed Up`, `Page Not Found`, `trackException`. **`Quote Requested`** garde
`{ material, has_file, signed_in }` et gagne `source: "form" | "studio"` et `object?`.

**Nouveaux événements** (jamais de texte saisi dans une propriété) :

| Événement            | Propriétés                                                                                           | Quand                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `Hero Customized`    | `palette`, `pattern`                                                                                 | premier geste dans le héros (une fois par session) |
| `Studio Viewed`      | `object`                                                                                             | `<TrackEvent>` sur `/studio/[objet]`               |
| `Studio Configured`  | `object`, `control`                                                                                  | premier réglage par objet et par session           |
| `Studio Sent`        | `object`, `bands`, `triangles`, `bytes`, `estimate_low`, `estimate_high` (CHF décimaux, si affichés) | upload réussi, avant la Server Action              |
| `Studio Link Copied` | `object`                                                                                             | « Copier le lien »                                 |
| `Studio Saved`       | `object`                                                                                             | « Garder »                                         |

**Règles** : aucun texte personnel (nom, fonction, contact, sommet) dans l'URL, le fragment, un
événement ou un attribut non masqué. Le texte vit en mémoire et dans
`sessionStorage["s3d-studio-texts-v1"]` jusqu'à l'envoi ; il n'est transmis qu'à la Server Action
de devis (finalité déclarée). Tout élément qui affiche ce texte porte `.ph-mask` ; les compteurs
animés et les conteneurs de chorégraphie décoratifs portent `ph-no-capture` (taille des replays,
INP). `sanitizeUrl` (WP-00) retire aussi tout fragment `#c=` (défense en profondeur, PostHog le
retire déjà). **Stockage local ajouté** : `s3d-motion`, `s3d-creations-v1` (localStorage) ;
`s3d-studio-texts-v1`, `s3d-studio-upload-v1`, `s3d-quote-handoff-v1`, `s3d-webgl-lost`
(sessionStorage). Mention dans la politique de confidentialité : décision du propriétaire (§11.2).

### 4.11 Budgets et mesures

| Poste                                                                                  | Budget                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Mesure                                                                                                                                         |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker (gzip)                                                                          | base mesurée par WP-00 (≈ 2 946 KiB au 27.09) ; **+20 KiB** pour WP-00, **+10 KiB** par package ensuite ; total **≤ 3 185 KiB** (décision du propriétaire du 30.09, au lieu de +60 KiB soit 3 125 : 3 109 après la vague 1 ; WP-99 récupère textes et code morts) ; **dépassement accepté le 01.10** après le Studio (3 326 KiB : rendu serveur complet du formulaire, des stats et des posters), à condition que WP-99 réduise sans changer le comportement (zod/mini, plus de copies RSC/SSR en double de `src/lib/studio/**`, messages du Studio par langue), cible ≈ 3 250 KiB, **tenue par WP-99 le 09.10 : 2 456 KiB** (hook `webpack()` de `next.config.ts`, un seul exemplaire de chaque module par couche : −876 KiB) ; **0** signature three/gsap/lenis | `bunx opennextjs-cloudflare build` puis `bunx wrangler deploy --dry-run` (ligne `Total Upload … gzip`) et `bun scripts/check-worker-bundle.ts` |
| JS initial de l'accueil (hors chunks motion et Stage)                                  | ≤ actuel + 15 KiB gzip                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `bun scripts/chunk-report.ts`                                                                                                                  |
| Chunk runtime (gsap + ScrollTrigger + SplitText + Flip + CustomEase + Lenis + runtime) | ≤ 65 KiB gzip, après l'hydratation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | idem                                                                                                                                           |
| Chunk Stage (three + cœur + matériau d'impression)                                     | ≤ 200 KiB gzip ; scènes ≤ 15 KiB chacune                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | idem                                                                                                                                           |
| Moteur Studio + Worker                                                                 | ≤ 40 KiB (moteur) + ≤ 60 KiB (Worker, avec générateurs, d3-contour, earcut)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | idem                                                                                                                                           |
| Glyphes 3D                                                                             | ≤ 45 KiB gzip, chargés seulement par le Studio et le chapitre 02                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | onglet Réseau                                                                                                                                  |
| LCP (p75 mobile 4G)                                                                    | ≤ 2,0 s ; élément LCP = h1 ou poster SSR, visible au premier paint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Lighthouse mobile sur `bun run preview`, puis PostHog web vitals sur la preview                                                                |
| INP                                                                                    | ≤ 150 ms : glissé d'un curseur, frappe dans un texte, clic « Envoyer à l'atelier », changement de palette                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | DevTools Performance, CPU ×4 + profil mobile (et un Android moyen 2023 si disponible)                                                          |
| CLS                                                                                    | ≤ 0,05 (ratios réservés, polices avec métriques de repli)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Lighthouse                                                                                                                                     |
| GPU                                                                                    | 1 contexte WebGL par page ; DPR ≤ 1,5 sous un budget de pixels du tampon (8 Mpx en C2, 4 Mpx en C1 à pointeur précis, jamais sous un rapport de 1 ; canvas ancré de 1,6 fenêtre à la souris, 2 fenêtres au doigt : décision du propriétaire du 08.10.2026, réglé par WP-99, `stage/pixel-ratio.ts` et `stage/anchor-margin.ts`, `measures-wp99-canvas.md`) ; < 20 draw calls ; ≤ 120 k triangles (C2), ≤ 40 k (C1) visibles ; ≤ 8 ms de GPU par frame sur un iGPU 2020                                                                                                                                                                                                                                                                                            | Spector ou `renderer.info` en dev                                                                                                              |
| Mémoire                                                                                | géométries du Stage ≤ 20 Mo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `renderer.info.memory`                                                                                                                         |

> **Note du 01.10.2026 (vérification de la vague 2a, `measures-wave2a.md`)** : **mesurer le Worker
> toujours dans un dossier dont le chemin absolu fait 41 caractères** (celui du checkout
> principal). Les manifestes du Worker embarquent des chemins absolus : un build dans un dossier de
> 77 caractères pèse 520 KiB de brut en plus, et le gzip du même code varie de ±6 KiB d'un build à
> l'autre (3 138 à 3 150 KiB sur quatre builds de WP-02). Relevé de référence en 41 caractères, même
> `node_modules` : fin de la vague 1 (`ac9d0a5`)
> **3 110,61 KiB**, après `fix-w1` **3 150,19**, après WP-02 **3 145,30** (la hausse vient de `fix-w1`,
> WP-02 n'ajoute rien au Worker). Marge restante sur 3 185 : **≈ 40 KiB** pour WP-HOME, WP-STUDIO et
> WP-99. JS initial de l'accueil : 231,4 KiB pour 233,7 (marge 2,3 KiB).

> **Note du 09.10.2026 (WP-99, `measures-wp99.md` et `measures-wp99-worker.md`)** : Worker mesuré
> en 41 caractères à **2 456,33 KiB gzip** (12 881,63 KiB bruts), contre 3 333,53 avant : **−877 KiB
> (−26,3 %)**, cible ≈ 3 250 et plafond 3 185 tenus avec une grande marge. Levier retenu : le hook
> `webpack()` de `next.config.ts` (modules compilés une fois et non une fois par couche
> `rsc` / `action-browser` / `ssr`, plus de découpage sans seuil), qui ne change que la répartition
> des modules dans `.next/server`. **Levier (c) zod/mini abandonné** : better-auth,
> `@better-auth/core`, oauth-provider, passkey et better-call importent le zod complet (112
> imports), il resterait dans le Worker. **Levier (b) messages du Studio par langue sans objet** :
> le Worker sert les 4 langues (18,5 KiB gzip pour `studio` + `studioCore` en 4 langues, une seule
> copie dans le bundle). Nettoyage du code et des messages morts : −4 à −7 KiB. JS client inchangé
> (209 chunks, 1 220,6 KiB gzip ; `/fr` 194,1 KiB).

---

## 5. Héros : « L'impression réglable »

### 5.1 Composition et premier paint (SSR, sans JS)

**Desktop (≥ 1024 px)** : section `data-hero` de `100svh` (min 640 px), `.s3d-page` + `.s3d-grid`.

- Colonnes 1–7 : surtitre mono (`.s3d-label`) « Impression 3D multicolore · Gland & Pully (VD) » ;
  **h1** `text-hero font-display` « Tout relief commence par une couche. » (point final en
  point rouge) ; chapeau `text-lead` ; contrôles **Palette** et **Motif** (§5.6) ; CTA :
  **« Régler un objet »** (seul bouton rouge, vers `/studio/lavaux#c=…` avec la configuration
  courante), « Boutique » (contour, `/shop`), « J'ai un fichier » (lien texte, `/custom`).
- Colonnes 7–12 : boîte visuelle `aspect-[4/5]`, hauteur `min(78svh, 820px)` = `<StageView
scene="print-hero">` avec, en enfants, les deux posters SVG inline (§5.7), l'étiquette
  d'honnêteté en bas à gauche (« Objet Studio · configuration d'exemple · rendu temps réel ») et la
  **bande de mesure** en bas (§5.5).
- Cadre de carte (`MapFrame`) sur les bords gauche et bas de la section ; coordonnées en haut à
  droite (« 46°25′N 6°16′E · Gland — 46°31′N 6°40′E · Pully »).
- Sous la section : bande de réassurance mono sur une ligne : « Livraison offerte dès
  {formatChf(freeOverCents)} · Imprimé à Gland et à Pully · TWINT, cartes, Google Pay ».

**Mobile (< 1024 px)** : surtitre, h1, chapeau, boîte visuelle `aspect-square` pleine largeur
(réglette Z verticale sur son bord droit en C1), étiquette et bande de mesure dessous, contrôles
en puces défilables horizontalement, CTA empilés (le rouge en pleine largeur).

**LCP** : le h1 (texte SSR, aucune animation d'entrée, pas de SplitText). Les posters sont des SVG
inline, donc non candidats au LCP. Aucun overlay, aucun préloader, aucun `opacity: 0`.

### 5.2 L'objet : `HERO_CONFIG` (dans `src/lib/studio/presets.ts`, WP-01)

```ts
export const HERO_CONFIG: LavauxConfig = {
  object: "lavaux",
  h: 150,
  d: 96, // mm (d = diamètre de l'enveloppe, motif compris)
  profile: "galet",
  belly: 0.5,
  neck: 0.72,
  lip: 0.08,
  pattern: { kind: "gradins", step: 5, depth: 1.4 },
  wall: 1.6,
  bands: [
    { filament: "bleu-leman", toMm: 42 }, // couches 1–210
    { filament: "vert-lavaux", toMm: 108 }, // couches 211–540
    { filament: "blanc-neve", toMm: 150 }, // couches 541–750
  ],
};
export const HERO_PATTERNS = {
  gradins: { kind: "gradins", step: 5, depth: 1.4 },
  vagues: { kind: "vagues", wavelength: 14, amplitude: 1.2, lobes: 5 },
  voronoi: { kind: "voronoi", cells: 48, relief: 1.2, seed: 4812 },
} as const; // jamais « nervures » dans le héros
export const HERO_PALETTES = {
  leman: ["bleu-leman", "vert-lavaux", "blanc-neve"],
  molasse: ["encre", "gris-molasse", "blanc-neve"],
  signal: ["encre", "blanc-neve", "rouge-signal"],
  uni: ["blanc-neve"], // 1 bande, 0 changement
} as const;
```

750 couches de 0,2 mm, deux changements de filament (couches 211 et 541). Profil galet (ventre
large, col à 72 %), gradins horizontaux, aucune nervure, aucune torsion : l'objet est loin de la
silhouette du Vase spirale (vérifié par `nearVaseSpirale`, §6.6). Géométrie : §6.3.1. LOD : C2
`display` 160 segments × ~180 anneaux (≈ 115 k triangles), C1 96 × ~100 (≈ 38 k).

> **Note du 30.09.2026 (WP-01)** : les chiffres du héros que le brief donne (« ≈ 80 g · ≈ 2 h 45 »,
> §6.5 et §6.7) sont des estimations d'avant le code. Calculés par `computeStats(HERO_CONFIG)`
> (`src/lib/studio/stats.ts`), ils valent **92,1 g et 3 h 01** (750 couches, 2 changements). **WP-HOME
> lit `computeStats(HERO_CONFIG)` et ne recopie jamais ces valeurs en dur** (bande de mesure, étiquettes de
> l'éclaté, texte du chapitre 01) : un chiffre affiché à l'écran doit sortir de la même fonction pure que
> dans le Studio, sinon les deux divergent au premier réglage du brief ou des coefficients.

### 5.3 La scène `print-hero` (WP-HOME, `src/motion/stage/scenes/print-hero.ts`)

- **Plateau** : carré arrondi 180 × 180 × 1 mm, teinte `surface`, quadrillage `iso` tous les
  10 mm (texture canvas 512² générée au montage) ; ombre de contact précalculée (dégradé radial
  sur un plan).
- **Vase** : `MeshData` → `BufferGeometry` (attribut `side`), matériau d'impression partagé
  (§5.4). Objet tourné de −90° autour de X (Z-up du générateur → Y-up de three) ; le shader lit la
  hauteur **en espace modèle** (`position.z`).
- **Buse** : cône (Ø 4,4 → 0,8 mm sur 5 mm) + bloc de chauffe 14 × 10 × 9 mm teinte `encre` +
  sprite additif rouge de 6 mm à la pointe. Position : rayon `r(θn, zCut) + 0,6 mm`, hauteur
  `zCut + 0,25 mm`, `θn` avance à 2,4 rad/s pendant l'impression, ralentit en `s3d.buse` à l'arrêt.
  En fin d'impression, elle se lève de 10 mm et se range à droite (0,8 s).
- **Tour de purge** : prisme 16 × 16 mm à (70, −55) mm sur le plateau, même matériau (elle
  prend les mêmes teintes aux mêmes hauteurs, comme en vrai), hauteur `min(zCut, zDernierChangement + 1)`.
- **Caméra** : `PerspectiveCamera` fov vertical 20°, élévation 22°, azimut −28°, l'objet occupe
  78 % de la hauteur de la vue. Le cadrage est calculé par `src/lib/studio/camera.ts` (pur TS,
  partagé avec les posters) : même projection que le SVG, donc raccord exact.
- **Lumières** : `RoomEnvironment` (intensité 0,6) + directionnelle du nord-ouest (direction
  (−1 ; 1,4 ; 0,8) normalisée, intensité 1,6), sans shadow map.
- **Contrôleur** (animé par la chorégraphie) :

```ts
export interface PrintHeroController {
  progress: number; // 0–1 → uCutZ = quantize(progress × h, 0.2)
  tilt: number; // 0 = élévation 22°, 1 = vue de plan (90°, fov 12°), uIsoMode = tilt
  explode: number; // 0–1 → écartement des bandes (12 mm au maximum), mode « éclaté » du chapitre 01
  ghost: 0 | 1; // lignes fantômes au-dessus de la coupe
  ripple(palette: FilamentId[]): void; // vague de couleur, 0,9 s
  reprint(pattern: LavauxPattern): void; // réimpression depuis le plateau, 1,2 s
  onLayer?: (layer: number, zMm: number, band: number) => void; // ≤ 10 Hz
  onBandCross?: (band: number, layer: number, filament: FilamentId) => void;
}
```

- **Pré-génération** : les trois maillages des motifs du héros sont générés en idle après la
  première frame ; un changement de motif est donc instantané (aucune tâche longue au clic).

### 5.4 Le matériau d'impression (WP-00, `src/motion/stage/materials/print-material.ts`)

`MeshPhysicalMaterial` (rugosité 0,52, `sheen` 0,25, `sheenRoughness` 0,8) + `onBeforeCompile`,
`customProgramCacheKey = () => "s3d-print-v1"`. Partagé par `print-hero` et `studio-object`.
Code GLSL en annexe A. Uniforms :

| Uniform                                       | Type                              | Rôle                                                                                   |
| --------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| `uCutZ`                                       | float (mm)                        | hauteur imprimée ; au-dessus : `discard` ou ligne fantôme                              |
| `uHeight`                                     | float (mm)                        | hauteur totale de l'objet                                                              |
| `uLayerH`                                     | float                             | 0,2 mm                                                                                 |
| `uBandTop[3]`, `uBandCount`                   | float[3], int                     | frontières des bandes (mm)                                                             |
| `uBandColor[4]`, `uBandColorFrom[4]`          | vec3[4]                           | teintes actuelles et précédentes (vague)                                               |
| `uRippleZ`, `uRippleActive`                   | float                             | front de la vague de couleur, liseré rouge                                             |
| `uReprintZ`, `uReprintSide`, `uReprintActive` | float                             | front de réimpression (ancien maillage garde le dessus, nouveau le dessous)            |
| `uHot`, `uFlash`, `uHotColor`                 | float, float, vec3                | liseré chaud à la coupe (0,3 mm, au moins 1,5 px) et flash de changement de bobine     |
| `uGhost`, `uGhostStep`, `uGhostColor`         | float, float (2 mm), vec3 (`iso`) | lignes fantômes : anneaux de la paroi extérieure tous les 2 mm                         |
| `uIsoMode`, `uIsoIndexColor`                  | float, vec3 (`iso-index`)         | mode carte : courbe maîtresse toutes les 10 couches, teintes à plat                    |
| `uLayerRelief`, `uUpView`                     | float, vec3                       | lignes de couche en normales, atténuées quand elles passent sous le pixel (anti-moiré) |

### 5.5 Storyboard

| Temps                        | Desktop C2 (≥ 1024 × 768)                                                                                                                                                                                                                                                                                                                                                                                                                    | Mobile / C1                                                                                                                                                                                            | C0                                                                                                                          | Mouvement réduit                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **B0**, 0 ms (SSR)           | Papier, cadre de carte, h1, **poster « dessin »** : anneaux fantômes du vase tous les 2 mm en `iso`. Bande de mesure SSR : « 150,0 mm · 750 couches · 3 filaments · ≈ 80 g · ≈ 2 h 45 ».                                                                                                                                                                                                                                                     | Idem, empilé                                                                                                                                                                                           | Idem                                                                                                                        | **Poster « final »** (strates colorées), même bande de mesure |
| **B1**, idle (≈ 0,3 à 1,2 s) | Le Stage rend une première frame **identique au poster** (coupe à 0, fantômes partout, buse sur le plateau) ; le poster s'efface en 240 ms. Intro : `progress` 0 → 0,38 en 3,2 s (linéaire, quantifié à la couche). À la couche 211 (≈ 2,4 s) : flash 320 ms, étiquette « Changement de filament → Vert Lavaux · couche 0211 » (1,6 s), la tour de purge gagne sa première bande. Compteur « Couche 0284 / 0750 · z 56,8 mm · Vert Lavaux ». | Même raccord ; autoplay 0 → 100 % en 4,2 s quand le héros est visible à 50 % ; deux changements visibles ; la vue est ensuite figée en image (bake). Réglette Z : scrub au pouce de la couche 0 à 750. | Après détection, le poster « dessin » laisse place au poster « final » (fondu de 240 ms : le dessin devient matière, en 2D) | Rien ne bouge                                                 |
| **B2**, pin 0 → 110 %        | `progress` 0,38 → 1 (scrub). Couche 541 : second changement (flash, étiquette). La tour s'arrête à 109 mm. À 100 %, la buse se lève et se range.                                                                                                                                                                                                                                                                                             | —                                                                                                                                                                                                      | —                                                                                                                           | —                                                             |
| **B3**, pin 110 → 180 %      | `tilt` 0 → 1 (`s3d.carte`) : la caméra passe en vue de plan, fov 20° → 12°, les couches deviennent des cercles concentriques, les teintes deviennent des aplats hypsométriques ; le **champ de courbes** (`contour-field`) s'ouvre autour et remplit la section. Le titre du chapitre 01 entre (SplitText).                                                                                                                                  | Pas de B3 : le chapitre 01 montre le champ en SVG statique                                                                                                                                             | SVG statique                                                                                                                | SVG statique                                                  |
| **B4**, sortie               | Le pin se relâche ; le champ continue sous le chapitre 01 (les deux vues partagent des coordonnées « page », sans couture).                                                                                                                                                                                                                                                                                                                  | —                                                                                                                                                                                                      | —                                                                                                                           | —                                                             |

Clavier : Espace et Page suivante font défiler normalement ; le lien d'évitement « Passer
l'animation » mène au chapitre 01. Aucune animation automatique ne dépasse 5 s.

### 5.6 Les contrôles du héros (le geste de personnalisation)

- Deux `fieldset` SSR : **Palette** (4 radios : Léman, Molasse, Signal, Uni ; chaque puce montre
  ses 3 bandes) et **Motif** (3 radios : Gradins, Vagues, Voronoï ; pictos SVG). Natifs, étiquetés,
  navigables aux flèches.
- **Palette** → `controller.ripple(palette)` : `uBandColorFrom` ← anciennes teintes,
  `uBandColor` ← nouvelles, `uRippleZ` monte de 0 à 150 mm en 0,9 s (`pas(30)`), liseré rouge
  au front ; les noms de filaments de la bande de mesure changent quand le front passe.
- **Motif** → `controller.reprint(pattern)` : le nouveau maillage « s'imprime » depuis le plateau
  par-dessus l'ancien (front `uReprintZ` en 1,2 s, la buse suit le front), puis l'ancien est libéré.
- Le CTA rouge suit la configuration (`/studio/lavaux#c=…`) : on continue exactement ce qu'on vient
  de régler. Événement `Hero Customized` (une fois par session).
- Mouvement réduit et C0 : le poster « final » est recalculé côté client (`poster.ts`), instantané.

### 5.7 Posters SSR et raccord au pixel

- `HeroPoster` (composant serveur, WP-HOME) rend **deux SVG inline** calculés par
  `src/lib/studio/poster.ts` (WP-01) avec `HERO_CAMERA` : `ghost` (75 ellipses, trait `var(--color-iso)`,
  `vector-effect: non-scaling-stroke`, ≤ 6 Ko) et `final` (75 ellipses pleines empilées de bas en
  haut aux teintes des bandes, filet plus sombre, ≤ 8 Ko). Un seul `viewBox` 4:5 sert aux deux
  cadrages (`preserveAspectRatio="xMidYMid meet"`, fov vertical fixe, objet centré), comme la
  caméra du Stage.
- Choix sans flash : CSS `html[data-motion="full"] .hero-final { display: none }` et
  `html[data-motion="reduce"] .hero-ghost { display: none }` (l'attribut est posé avant le paint).
  En C0 avec mouvement complet, la classe `is-static` bascule vers `final` après détection.
- Les SVG utilisent les jetons (`var(--color-iso)`) : corrects dans les deux thèmes sans fichier
  supplémentaire. Le poster LCP n'est **pas** un rendu Blender : un rendu ne serait ni aligné, ni
  thémé, ni aussi léger.

### 5.8 Budgets et critères propres au héros

- Chunk `print-hero` ≤ 15 KiB gzip (hors cœur du Stage) ; premier rendu ≤ 1,5 s après
  l'hydratation sur desktop en 4G ; ≤ 120 k triangles (C2), ≤ 40 k (C1) ; < 12 draw calls.
- h1 = élément LCP dans Lighthouse (mobile et desktop) ; CLS ≤ 0,05 ; aucune frame où le poster et
  le canvas sont tous deux invisibles.
- Intro ≤ 3,2 s (desktop), autoplay ≤ 4,2 s (mobile), puis arrêt.
- Changement de palette ou de motif : INP ≤ 100 ms.

---

## 6. Le Studio (configurateur)

### 6.1 Principes

- **Nos objets seulement**, conçus en code, bornés pour être imprimables sur une P1S (256³ mm) ou
  une K2 (260³ mm) en PLA, buse 0,4, couches de 0,2 mm, **mode standard** (périmètres), jamais en
  mode vase/spirale (qui n'admet pas de changement de filament).
- **Multicolore = changements de filament à des hauteurs données**, jusqu'à 4 filaments : c'est ce
  que l'atelier règle réellement dans Bambu Studio (« changement de couleur à la couche »), avec
  ou sans AMS. Le site le dit.
- **Tout chiffre est calculé** par la même fonction pure côté serveur (SSR) et côté client.
- **Rien ne part sans un humain** : chaque configuration aboutit à une demande de devis relue par
  l'atelier (prix ferme sous 48 h). Pas de paiement en v1.

### 6.2 Catalogue v1 (quatre objets originaux Swiss3Design)

Les contrôles sont natifs : `range` couplé à un `number` avec unité, `radio` pour les listes,
`text` pour les textes. Maj + flèche = ×10.

**Vase « Lavaux »** (`lavaux`)

| Paramètre                                    | Clé                | Plage                                                  | Défaut          | Pas           | Contrôle                                  |
| -------------------------------------------- | ------------------ | ------------------------------------------------------ | --------------- | ------------- | ----------------------------------------- |
| Hauteur                                      | `h`                | 80–240 mm                                              | 150             | 1             | curseur + nombre                          |
| Diamètre (enveloppe)                         | `d`                | 50–140 mm                                              | 96              | 1             | curseur + nombre                          |
| Profil                                       | `p`                | cylindre, galet, amphore, cone, tulipe                 | galet           | —             | radios (pictos)                           |
| Galbe                                        | `b`                | 0–1                                                    | 0,5             | 0,01          | curseur                                   |
| Col (rayon du haut / rayon max)              | `n`                | **0,5**–1                                              | 0,72            | 0,01          | curseur                                   |
| Lèvre                                        | `l`                | 0–0,3                                                  | 0,08            | 0,01          | curseur                                   |
| Motif                                        | `m`                | lisse, gradins, vagues, voronoi, nervures              | gradins         | —             | radios                                    |
| Gradins : pas / profondeur                   | `gs` / `gd`        | 2–12 mm / 0,4–3 mm (≤ 0,5 × pas)                       | 5 / 1,4         | 0,2 / 0,1     | curseurs couplés                          |
| Vagues : longueur d'onde / amplitude / lobes | `wl` / `wa` / `wk` | 6–40 mm (≥ 4 × amp.) / 0,4–3 mm / 0–12                 | 14 / 1,2 / 5    | 0,5 / 0,1 / 1 | curseurs                                  |
| Voronoï : cellules / relief / graine         | `vc` / `va` / `vs` | 12–120 / 0,4–2,5 mm / 0–9999                           | 48 / 1,2 / 4812 | 1 / 0,1 / 1   | curseurs + « Surprenez-moi »              |
| Nervures : nombre / profondeur / torsion     | `rn` / `ra` / `rt` | 8–48 / 0,4–3 mm / −180–180°                            | 16 / 1,2 / 0    | 1 / 0,1 / 5   | curseurs (garde §6.6)                     |
| Paroi                                        | `w`                | 1,2 · 1,6 · 2,0 · 2,4 mm                               | 1,6             | —             | radios (multiples de la largeur de ligne) |
| Bandes                                       | `bd`               | 1–4, frontières quantifiées à 0,2 mm, épaisseur ≥ 2 mm | Léman, 3 bandes | —             | barre altimétrique                        |

**Carte « Cartouche »** (`cartouche`), 85 × 55 mm (format suisse)

| Paramètre                                  | Clé         | Plage                                                                      | Défaut                                            | Contrôle                  |
| ------------------------------------------ | ----------- | -------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------- |
| Épaisseur de plaque                        | `t`         | 1,2–2,4 mm (pas 0,2)                                                       | 1,6                                               | curseur                   |
| Coins                                      | `r`         | 0–6 mm (pas 0,5)                                                           | 3                                                 | curseur                   |
| Mode                                       | `mo`        | relief, gravure                                                            | relief                                            | radios                    |
| Hauteur du relief ou profondeur de gravure | `e`         | 0,4–1,2 mm (pas 0,2)                                                       | 0,6                                               | curseur                   |
| Mise en page                               | `ly`        | classique (grille suisse), centree, cartouche (cadre et filet), monogramme | classique                                         | radios (vignettes)        |
| Couleur de plaque / du texte               | `fp` / `ft` | filaments                                                                  | blanc-neve / encre                                | pastilles                 |
| Nom                                        | texte       | ≤ 24 caractères                                                            | exemple « Léa Dubois »                            | champ (jamais dans l'URL) |
| Fonction                                   | texte       | ≤ 30                                                                       | exemple « Architecte »                            | champ                     |
| Ligne 1, ligne 2                           | texte       | ≤ 30 chacune                                                               | exemples « lea@exemple.ch », « +41 21 000 00 00 » | champs                    |

**Sous-verre « Relief »** (`relief`)

| Paramètre            | Clé          | Plage                                   | Défaut                                               | Contrôle                    |
| -------------------- | ------------ | --------------------------------------- | ---------------------------------------------------- | --------------------------- |
| Forme                | `sh`         | rond, carre                             | rond                                                 | radios                      |
| Diamètre ou côté     | `s`          | 90–110 mm                               | 100                                                  | curseur                     |
| Socle                | `ba`         | 2,4–4 mm (pas 0,2)                      | 3                                                    | curseur                     |
| Relief               | `re`         | 1,2–4 mm (pas 0,2)                      | 3,2                                                  | curseur                     |
| Strates              | `lv`         | 4–12                                    | 8                                                    | curseur                     |
| Massif (graine)      | `sd`         | 0–9999                                  | 1291                                                 | curseur + « Surprenez-moi » |
| Niveau du lac        | `lk`         | 0–40 %                                  | 18                                                   | curseur                     |
| Teintes par altitude | `bd`         | 2–4 bandes (lac, prairie, roche, neige) | bleu-leman / vert-lavaux / gris-molasse / blanc-neve | barre altimétrique          |
| Étiquette du sommet  | `lb` + texte | oui/non ; nom ≤ 12 caractères           | oui, exemple « Léa »                                 | interrupteur + champ        |

**Porte-nom « Borne »** (`borne`)

| Paramètre                  | Clé         | Plage                                                                        | Défaut             | Contrôle         |
| -------------------------- | ----------- | ---------------------------------------------------------------------------- | ------------------ | ---------------- |
| Forme                      | `sh`        | pilule, etiquette, goutte, pic (triangle générique, ni le mark ni une croix) | pilule             | radios           |
| Texte                      | texte       | 1–14 caractères                                                              | exemple « Léa »    | champ            |
| Hauteur des lettres        | `c`         | 5–10 mm                                                                      | 7                  | curseur          |
| Épaisseur                  | `t`         | 3–5 mm (pas 0,2)                                                             | 4                  | curseur          |
| Anneau                     | `rg` / `rd` | gauche, droite, aucun / Ø 4–6 mm                                             | gauche / 5         | radios + curseur |
| Mode                       | `mo`        | relief (0,8 mm), gravure (0,8 mm)                                            | relief             | radios           |
| Couleur de base / du texte | `fb` / `ft` | filaments                                                                    | encre / blanc-neve | pastilles        |

La longueur du porte-nom suit le texte (40–80 mm) ; au-delà, les lettres rétrécissent jusqu'à
5 mm, puis erreur « Texte trop long ».

#### 6.2.1 Types de configuration (ajoutés à `src/lib/studio/types.ts`)

Les objets TypeScript portent des noms longs ; le codec d'URL (`url-state.ts`) les traduit vers
les clés courtes du tableau ci-dessus (fragment et paramètres GET). Les textes n'y figurent jamais.

```ts
export type LavauxPattern =
  | { kind: "lisse" }
  | { kind: "gradins"; step: number; depth: number }
  | { kind: "vagues"; wavelength: number; amplitude: number; lobes: number }
  | { kind: "voronoi"; cells: number; relief: number; seed: number }
  | { kind: "nervures"; count: number; depth: number; twistDeg: number };

export interface LavauxConfig {
  object: "lavaux";
  h: number;
  d: number;
  profile: "cylindre" | "galet" | "amphore" | "cone" | "tulipe";
  belly: number;
  neck: number;
  lip: number;
  pattern: LavauxPattern;
  wall: 1.2 | 1.6 | 2 | 2.4;
  bands: Band[];
}
export interface CartoucheConfig {
  object: "cartouche";
  thickness: number;
  corner: number;
  mode: "relief" | "gravure";
  depth: number;
  layout: "classique" | "centree" | "cartouche" | "monogramme";
  plate: FilamentId;
  ink: FilamentId; // texte : StudioTexts.name, role, line1, line2
}
export interface ReliefConfig {
  object: "relief";
  shape: "rond" | "carre";
  size: number;
  base: number;
  relief: number;
  levels: number;
  seed: number;
  lake: number;
  bands: Band[]; // 2 à 4, calées sur les sommets de strates
  label: boolean; // texte : StudioTexts.peak
}
export interface BorneConfig {
  object: "borne";
  shape: "pilule" | "etiquette" | "goutte" | "pic";
  cap: number;
  thickness: number;
  ring: "gauche" | "droite" | "aucun";
  ringD: number;
  mode: "relief" | "gravure";
  base: FilamentId;
  ink: FilamentId; // texte : StudioTexts.text
}
export type StudioConfig =
  LavauxConfig | CartoucheConfig | ReliefConfig | BorneConfig;

export type IssueCode =
  | "overhang"
  | "base-narrow"
  | "plate"
  | "band-thin"
  | "pattern-coupling"
  | "text-stroke"
  | "text-fit"
  | "text-char"
  | "near-vase-spirale";
```

### 6.3 Algorithmes géométriques (pur TS, `src/lib/studio/**`, mm, Z vers le haut, PRNG `mulberry32`)

Même entrée = même maillage, au bit près (déterminisme testé). Sorties : `MeshData` (§4.5).

#### 6.3.1 Lavaux (WP-01)

- **Profil** : `t = z / h`. Rayons relatifs aux points de contrôle `t = 0, 0.2, 0.5, 0.8, 1` :
  cylindre `[0.94, 0.98, 1.00, 0.99, n]` ; galet `[0.66, 0.92, 1.00, 0.90, n]` ; amphore
  `[0.58, 0.90, 1.00, 0.78, n]` ; cône `[1.00, 0.93, 0.84, 0.76, n]` ; tulipe
  `[0.64, 0.74, 0.86, 0.97, max(n, 0.9)]`. Galbe : pour les 4 premiers points,
  `rᵢ' = clamp(1 + (rᵢ − 1) × 2b, 0.4, 1)` (b = 0,5 redonne la famille ; b = 0 donne un cylindre).
  Interpolation **cubique monotone (Fritsch–Carlson)**, qui ne dépasse jamais (pas de bosse
  imprévue, donc pas de surplomb caché). Lèvre : `+ l × smootherstep((t − 0.92) / 0.08)`.
  `R(z) = (d/2 − A) × P(t)` où `A` est l'amplitude maximale du motif, pour que l'enveloppe fasse
  exactement `d`.
- **Motifs** `δ(θ, z) ≥ 0` (vers l'extérieur, mm) :
  - gradins : `u = fract(z / gs)`, `δ = gd × u³(u(6u − 15) + 10)` : montée douce (pente max
    1,875 × gd / gs ≤ 0,94), puis **retrait net vers l'intérieur** au changement de palier
    (corniche horizontale imprimable) ;
  - vagues : `δ = wa × (0.5 + 0.5 sin(2π (z / wl + 0.12 sin(wk θ))))` (anneaux ondulés, pas une
    torsade) ;
  - voronoï : germes sur une grille cylindrique à jitter (colonnes `C = max(3, round(√(vc × 2πR̄ / h)))`,
    lignes `⌈vc / C⌉`, jitter 0,8, distance périodique en θ), `e = F2 − F1`,
    `δ = va × smoothstep(0, w, e)` avec `w = max(1.5, 1.2 × va)` mm (cellules en relief, joints en
    creux, sans trou) ;
  - nervures : `φ = θ + rt × z / h`, `δ = ra × (0.5 + 0.5 cos(rn φ))^1.5` ;
  - lisse : `δ = 0`.
- **Surfaces** : extérieure `r_o = R(z) + δ(θ, z)` ; intérieure `r_i = r_o − w / cos(α)`
  (α = pente locale, `cos α ≥ 0.5`), de z = 1,6 mm à h ; lèvre plate (couronne horizontale) à z = h ;
  fond plein de 1,6 mm (8 couches) : disque extérieur à z = 0 et plancher intérieur à z = 1,6.
  Couture en θ = 0 partagée (indices modulo S), donc aucune arête ouverte.
- **Anneaux** : réguliers en LOD `drag` (64 × 80) et `display` (C2 160 × ~180, C1 96 × ~100) ;
  **adaptatifs en `export`** : pas de base 0,8 mm, raffinés tant que l'erreur de corde
  `|∂²r/∂z²| × Δz² / 8 > 0,05 mm`, plus deux anneaux au même z à chaque retrait de gradin (la
  corniche) et un anneau à chaque frontière de bande. Segments angulaires : gradins 180, vagues 240,
  voronoï 360, nervures `max(180, 10 × rn)`, lisse 128. Cible 1–3 Mo de STL, plafond 200 k
  triangles.
- **Normales** : différences centrées de la surface paramétrique (extérieur vers l'extérieur,
  intérieur vers l'intérieur). **Attribut `side`** : 0 paroi extérieure, 1 le reste.
- **Groupes par bande** (anneaux dupliqués aux frontières) et **bouchons** en couronne générés
  seulement pour l'éclaté d'affichage (jamais dans l'export).

> **Note du 30.09.2026 (WP-01, écarts assumés au brief)** :
>
> 1. **Gradins** : la profondeur est bornée par `gd ≤ paroi − 0,2 mm` **en plus de** `gd ≤ 0,5 × pas`
>    (`gradinsDepthMax`, `schemas.ts`). La paroi intérieure suit l'extérieure (`r_i = r_o − w / cos α`) ;
>    au retrait net de chaque palier, l'étage du dessus ne recouvre donc celui du dessous que de
>    `w − gd`. À `gd = w` les deux tubes se touchent en un cercle (arête à quatre triangles, pièce non
>    variété), au-delà ils se séparent (anneau flottant) ; le héros (1,4 pour 1,6) garde 0,2 mm.
> 2. **Voronoï** : `e = (F2 − F1) / 2` (la demi-différence, égale à la distance au joint pour des germes
>    alignés) et rampe `W = max(2,4 ; 3 × relief)` mm, au lieu de `e = F2 − F1` et
>    `w = max(1,5 ; 1,2 × va)`. Pente maximale du motif `1,5 × va / W = 0,5` ; avec la formule
>    littérale elle atteint 2,5 (68°) et le héros en voronoï serait « non imprimable ». Le couplage
>    `w ≥ 1,2 va` du §6.6 reste vrai par construction.
> 3. **Profil** : `P(t)` est normalisé par son maximum (`Pmax`) avant `R(z) = (d/2 − A) × P(t)`. Sans
>    cela, une lèvre sur un col de 1,0 (cylindre) monte à `P = 1,08` et l'enveloppe dépasse `d` de 8 %.
>    Identique au brief quand `Pmax = 1` (le héros).
> 4. **Export** : pas maximal de **4 mm** (et non un pas de base de 0,8 mm, qui donnait ≈ 8,6 Mo pour
>    le héros) ; pour les motifs de révolution (gradins, lisse, vagues sans lobes) le nombre de segments
>    angulaires vient de la même tolérance de corde **0,05 mm** au rayon maximal, plancher **72**
>    (`EXPORT_LIMITS`, `objects/lavaux.ts`). Les motifs non axisymétriques gardent les segments du brief
>    (vagues 240, voronoï 360, nervures `max(180, 10 × rn)`). Le héros exporte **52 k triangles,
>    2,6 Mo** de STL, dans la cible 1–3 Mo du §6.9.

#### 6.3.2 Noyau commun (WP-01)

`kernel/rng.ts` (mulberry32), `kernel/noise.ts` (simplex 2D/3D et FBM, portage MIT d'Ashima/Gustavson,
variante périodique), `kernel/monotone.ts`, `kernel/mesh.ts` (constructeur, normales, fusion de
coques, boîte, **volume signé**, **aire**, **test de variété** : chaque arête partagée par
exactement deux triangles d'orientations opposées, par composante connexe), `kernel/extrude.ts`
(polygones avec trous → faces par `earcut`, parois, coque fermée), `kernel/simplify.ts`
(Douglas–Peucker), `camera.ts` (mat4 et projection identiques à three), `format.ts`
(`formatMm`, `formatGrams`, `formatDuration`, `formatLayers` via `Intl.NumberFormat(`${locale}-CH`)`).

#### 6.3.3 Texte en relief (WP-02)

- **Police** : Archivo SemiExpanded **Black** (wdth 112,5, wght 900), instance statique
  **contours fusionnés** (sinon la détection des trous casse) :
  `uvx --from "fonttools[pathops]" fonttools varLib.instancer Archivo[wdth,wght].ttf wdth=112.5 wght=900 --remove-overlaps -o build/archivo-sx-black.ttf`
  (fichier source OFL du dépôt Google Fonts ; le téléchargement est à confirmer par le
  propriétaire si l'agent le demande). Pourquoi Black : à 0,4 mm de buse, un trait imprimable
  fait ≥ 0,8 mm ; le fût d'une graisse Black (~22 % de la hauteur de capitale) atteint 0,8 mm dès
  3,6 mm de capitale, une Bold (~15 %) seulement vers 5,5 mm.
- **Format maison** `public/studio/glyphs/s3d-relief-v1.json` (script `scripts/fonts/build-glyphs.ts`,
  opentype.js) : `{ v: 1, family: "S3D Relief", unitsPerEm, ascender, descender, capHeight, stem,
glyphs: { "A": { adv, d: "M…L…Q…C…Z" } } }`, jeu U+0020–007E, U+00A0–00FF, U+0100–017F, plus
  ’ – — ; famille renommée (clause RFN de l'OFL), `OFL.txt` à côté. ≤ 45 Ko gzip.
- **Chaîne** : chemins → polylignes (quadratiques 6 segments, cubiques 8, adaptatifs à la
  longueur) → classement extérieur/trou par inclusion → mise en page (hauteur de capitale en mm,
  approche = `adv × échelle + 0,02 em`, pas de crénage, alignement gauche/centre) → ajustement
  automatique (réduction jusqu'au minimum, sinon erreur) → extrusion.
- **Contrôles** : caractères hors jeu → erreur « Caractère non imprimable : ✦ » ; trait
  `stem × échelle` < 0,8 mm → avertissement, < 0,6 mm → erreur ; hauteur de capitale minimale
  3,6 mm (4 mm pour le nom).

> **Note du 01.10.2026 (WP-02, anticollision des glyphes)** : « pas de crénage » reste vrai (aucune
> paire n'est resserrée, `AV` et `VA` gardent leur largeur), mais sans garde-fou **923 paires du jeu
> de 322 caractères se chevauchaient** (« Tî », « gî », « 7ï », ď, ľ…) : l'accent ou le crochet d'un
> glyphe entre dans la boîte de chasse du voisin, ce qui ouvre la coque de gravure (la condition de la
> gravure sans CSG est que les formes d'encre restent disjointes). Correctif : une table
> `GLYPH_HOOKS` (≈ 27 glyphes dont l'encre dépasse de leur boîte : î, ï, ĩ, ď, ľ, j…, générée avec
> les métriques dans `text/glyph-metrics.ts`) et `pairExtraUnits(a, b)` (`text/layout.ts`), qui ajoute
> à l'approche **seulement** l'espace que réclame le dépassement, et seulement contre un voisin dont
> l'encre monte ou descend à la même hauteur. C'est le même calcul pour la mesure (SSR, sans
> contours) et pour le maillage, donc les chiffres affichés restent ceux de la pièce. Test des
> 322 × 322 paires (`text/text.test.ts`, outil `text/overlap.ts`) : aucun chevauchement, écart
> minimal positif.

#### 6.3.4 Cartouche, Relief, Borne (WP-02)

- **Cartouche** : plaque = rectangle arrondi extrudé ; **relief** : glyphes extrudés de `e` sur la
  plaque (coques séparées posées sur la plaque, que les trancheurs unissent) ; **gravure sans CSG** :
  dalle basse pleine (0 → t − e) + dalle haute (t − e → t) = plaque percée des contours des
  glyphes, les contrepoinçons (o, a, e…) redevenant des îlots. Mises en page (marges 5 mm) :
  classique = nom en haut à gauche (capitale 5,2 mm), fonction dessous (4 mm), deux lignes en bas
  à gauche (3,6 mm), disque de 3 mm en haut à droite ; centree ; cartouche = cadre de 1 mm à 4 mm
  du bord + filet sous le nom ; monogramme = initiales (capitale 18 mm) à gauche, texte à droite.
  Bandes : relief → `[{fp, t}, {ft, t + e}]` ; gravure → `[{ft, t − e}, {fp, t}]` (les lettres
  gravées révèlent la couleur du dessous : incrustation par changement de hauteur).
- **Relief** : carte d'altitude 128² sur le disque (bord de 3 mm), FBM (5 octaves, persistance 0,5,
  lacunarité 2) + terme de crête `0,35 × (1 − |bruit|)²` + chute radiale `1 − (ρ/R)^2.2`, normalisée ;
  sous le lac (`lk`) : 0 ; zone d'étiquette plate de 60 × 10 mm en bas si `lb`. Seuils
  `t_k = lk + (1 − lk) × k / lv` ; contours par `d3-contour` (polygones avec trous), convertis en mm,
  simplifiés à 0,15 mm ; épaisseur de strate `Δ = max(0.4, round(re / lv / 0.2) × 0.2)` ; chaque
  niveau k extrudé de `ba + (k − 1)Δ` à `ba + kΔ`. Bande 1 (lac) couvre le socle ; l'étiquette
  « POINTE LÉA · 3 107 M » est en relief de 0,6 mm dans la zone plate, donc dans la teinte de la
  bande 2. **Altitude fictive** = `1800 + (fnv1a(nom normalisé) mod 2600)` m, affichée comme telle.
- **Borne** : contour (pilule = rectangle à rayons h/2 ; etiquette = rectangle à coin coupé ; goutte ;
  pic = triangle arrondi générique) dimensionné sur le texte, trou d'anneau (`Shape.holes` au sens
  earcut), extrusion `t`, texte en relief ou gravé de 0,8 mm. **Jamais de croix suisse ni
  d'armoiries** ; la forme « pic » n'est pas le mark.

> **Note du 01.10.2026 (WP-02, écarts assumés au brief)** :
>
> 1. **Strates du Relief** : la strate k (k = 1 à `lv`) est la zone au-dessus du seuil `t_{k−1}`
>    (et non au-dessus de `t_k`), sinon la strate du sommet (seuil 1) serait vide.
> 2. **Cartouche** : les lignes sont empilées d'après l'**encre réelle** (plafonds d'accents 1,29 de
>    capitale, queues 0,31, écart 0,8 mm, filet à 1,2 mm) et non sur la grille fixe ci-dessus ; les
>    initiales du monogramme sont calées par le sommet de l'encre. La mise en page ne bouge pas à la
>    saisie d'un é, seulement pour Å (1,37) ou Ģ (−0,56). Avant : l'accent d'une ligne touchait la
>    queue d'un nom et ouvrait la gravure (cas n° 164 du tirage aléatoire).
> 3. **Monogramme** : deux initiales ne tiennent pas à 18 mm dans 28 mm : elles rétrécissent
>    (« LD » ≈ 12 mm) et le nom rétrécit à son tour (≈ 4,3 mm avec « Léa Dubois ») ; une seule initiale
>    reste à 18 mm.
> 4. **Borne** : la hauteur du corps est calculée sur l'encre du texte (mêmes plafonds) ; largeur et
>    profondeur annoncées = celles du contour réel ; la pointe du pic est compensée pour que le
>    porte-nom mesure 40 mm au moins.
> 5. **Pic** : c'est un triangle, donc seuls les mots courts (≈ 3 à 5 lettres à 5 mm) y tiennent en
>    80 mm ; au-delà l'erreur `text-fit` apparaît.
> 6. **Étiquette du massif** : « POINTE LÉA · 3 107 M » est **illustrative**. L'altitude réelle est
>    `peakAltitude(nom)` ; pour « Léa » elle vaut **2 566 m** (le libellé produit est
>    « POINTE LÉA · 2 566 M », contrôlé le 01.10.2026). **WP-HOME (chapitre 02) doit appeler
>    `peakLabel(name, locale)`** (ré-exporté par `objects/relief.ts`) et ne jamais figer le texte.
> 7. **`ranges.ts`** (nouveau) : plages, bornage et aides de strates sortis de `schemas.ts`, qui les
>    ré-exporte en entier (aucun importeur à changer). Les générateurs, les statistiques, les
>    garde-fous et `poster-flat` n'embarquent plus zod (Worker de géométrie : 26,7 Kio gzip au lieu de
>    48,5 ; budget du brief : 60).

#### 6.3.5 Test de variété (WP-01 pour Lavaux, WP-02 pour les autres)

`src/lib/studio/manifold.test.ts` : pour chaque objet, **200 configurations aléatoires valides**
(graine fixe) en LOD `export` : chaque coque est fermée et orientée (arêtes partagées exactement
par 2 triangles opposés), aucun triangle d'aire < 1e−6 mm², volume signé > 0, boîte dans 250³ mm.
Plus : `writeBinaryStl` produit exactement `84 + 50 × n` octets, un en-tête qui ne commence pas par
« solid », des normales unitaires.

### 6.4 Modèle multicolore

- Une configuration porte `bands: Band[]` contiguës depuis z = 0 (1 à 4 bandes ; au plus 4
  filaments distincts), frontières **quantifiées à 0,2 mm**, épaisseur minimale 2 mm (10 couches).
- **Changements** = nombre de frontières où le filament change. Chaque changement coûte une purge
  (paramètre atelier, défaut 0,8 g) et du temps (défaut 110 s) ; la tour de purge est affichée.
- L'**éclaté** écarte les bandes de 12 mm, chacune étiquetée : « Vert Lavaux · couches 211–540 ·
  42,0–108,0 mm · ≈ 31 g ».
- Pour Cartouche et Borne, les bandes découlent de la plaque et du texte ; pour Relief, elles se
  calent sur les sommets de strates.
- Palette = inventaire réel quand le propriétaire l'a fourni ; sinon « teintes indicatives ».

### 6.5 Statistiques et estimation (`stats.ts`, `estimate.ts`, `pricing-params.ts`, WP-01)

`computeStats(config, texts?) → StudioStats` est **analytique et rapide** (≤ 2 ms sur le fil
principal, intégration sur une grille grossière 64 × 120 pour Lavaux, aires exactes des polygones
pour les objets plats), identique en SSR et côté client :

```ts
export interface StudioStats {
  heightMm: number;
  widthMm: number;
  depthMm: number;
  layers: number; // layers = ceil(h / 0.2)
  volumeCm3: number;
  grams: number;
  minutes: number;
  changes: number;
  purgeGrams: number;
  printable: Printability;
  estimate?: { lowCents: number; highCents: number } | null; // null tant que PRICING.validated = false
}
export type Printability =
  | { status: "ok" }
  | {
      status: "warn" | "error";
      issues: {
        code: IssueCode;
        atMm?: number;
        value?: number;
        fix?: Partial<StudioConfig>;
      }[];
    };
```

- **Volume** : Lavaux = ∫∫ (r_o² − r_i²) / 2 dθ dz + fond ; plats = somme des aires × épaisseurs ;
  objets pleins de plus de 3 mm (Relief, Borne) : coque de 0,8 mm pleine + remplissage 15 %
  (`V_coque = min(V, A × 0,8)`, `V = V_coque + 0,15 × (V − V_coque)`).
- **Masse** = `V × 1,24 g/cm³ (PLA) + changes × purgeGrams`.
- **Durée** = `V(mm³) / 8 mm³/s + layers × 1,5 s + changes × 110 s + 6 min`.
- **Prix** (seulement si `PRICING.validated`) :
  `prix = max(plancher, préparation + g × CHF/g + h × CHF/h + changes × CHF/changement) × marge`,
  fourchette ±15 % (±8 % après calibration sur 3 pièces pesées), bornes arrondies à 0,50 CHF,
  **centimes entiers**, affichage `formatChf`. Libellé obligatoire : « Estimation · prix ferme
  confirmé par l'atelier sous 48 h ».

```ts
// src/lib/studio/pricing-params.ts — valeurs à valider par le propriétaire (§11.2)
export const PRICING = {
  validated: false, // false : aucun CHF affiché, seulement grammes, durée, changements
  floorCents: 900,
  setupCents: 400,
  centsPerGram: 8,
  centsPerHour: 300,
  centsPerChange: 60,
  margin: 1.0,
  rangePct: 15,
  roundToCents: 50,
  densityGcm3: 1.24,
  flowMm3PerS: 8,
  layerOverheadS: 1.5,
  changeSeconds: 110,
  purgeGrams: 0.8,
  setupMinutes: 6,
} as const;
```

Contrôle de cohérence : avec ces valeurs, le Vase spirale (120 g, ≈ 3,9 h) donne ≈ CHF 25 pour un
prix réel de CHF 24 ; le vase du héros ≈ 80 g, ≈ 2 h 45, CHF 17–23 ; une Cartouche touche le
plancher (CHF 9–10.50). Le serveur ne recalcule rien en v1 (aucun paiement) ; en P6 (plus tard),
`estimate.ts` servira au prix ferme côté serveur.

> **Note du 30.09.2026 (WP-01)** : le vase du héros n'est pas « ≈ 80 g, ≈ 2 h 45 » mais **92,1 g et
> 3 h 01** (750 couches, 181 min, purge 1,6 g ; `computeStats(HERO_CONFIG)`). La fourchette « CHF 17–23 »
> du héros suit le même décalage, mais `PRICING.validated` vaut `false` : `estimate` est `null` et aucun
> CHF ne s'affiche. Les mêmes « ≈ 80 g · 2 h 45 » du §6.7 (barre Studio mobile, durée réelle, bande de
> mesure) sont des exemples de format, pas des valeurs : l'interface les calcule. Voir la note du §5.2 :
> WP-HOME lit `computeStats(HERO_CONFIG)`, jamais un chiffre recopié.

### 6.6 Garde-fous (`guards.ts`)

| Code                | Règle                                                                                         | Correction proposée (bouton « Corriger »)                                         |
| ------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `overhang`          | pente vers l'extérieur ≤ 45° partout (`∂r_o/∂z ≤ 1`)                                          | galbe réduit, profondeur de motif réduite, ou hauteur augmentée (valeur calculée) |
| `base-narrow`       | rayon du pied ≥ 20 mm et ≥ 35 % du rayon max                                                  | profil « cylindre » ou galbe ≤ 0,4                                                |
| `plate`             | boîte ≤ 250 × 250 × 250 mm                                                                    | réduire la dimension en cause                                                     |
| `band-thin`         | bande < 2 mm                                                                                  | fusion avec la voisine                                                            |
| `pattern-coupling`  | gradins `gd ≤ 0,5 gs` ; vagues `wl ≥ 4 wa` ; voronoï `w ≥ 1,2 va` (bornes couplées dans l'UI) | valeur bornée                                                                     |
| `text-stroke`       | trait ≥ 0,8 mm (avertissement), ≥ 0,6 mm (erreur)                                             | agrandir les lettres à la taille calculée                                         |
| `text-fit`          | le texte tient à la taille minimale                                                           | raccourcir le texte                                                               |
| `text-char`         | caractère hors du jeu de glyphes                                                              | retirer le caractère                                                              |
| `near-vase-spirale` | **bloquant** : `m = nervures` et `28 ≤ rn ≤ 56` et `                                          | rt                                                                                | ≥ 45°`et`n ≤ 0,6` | « Cette combinaison rappelle le Vase spirale de Ian (licence sans modification). Réduisez la torsion ou le nombre de nervures. » |

- **Pas de profil « bouteille »**, col ≥ 0,5 : la silhouette d'Ian est exclue par construction ;
  `nearVaseSpirale()` est **testée** : `false` pour `HERO_CONFIG`, les 12 variantes du héros, tous
  les préréglages et 1 000 tirages de « Surprenez-moi ».
- **Textes** : bornés en longueur, rendus en géométrie (jamais en HTML injecté), relus par un
  humain avant impression. Message affiché à côté des champs et dans le tiroir : « Un humain de
  l'atelier relit chaque texte avant l'impression. Nous refusons les marques de tiers, les injures
  et les contenus illicites. »
- « Envoyer à l'atelier » est désactivé tant qu'il reste une erreur.

> **Note du 30.09.2026 (WP-01, sévérités)** : le brief ne fixe que celles du trait des textes ; WP-01
> a tranché (`guards.ts`, en-tête du fichier). `error` bloque « Envoyer à l'atelier », `warn` affiche
> « À vérifier ».
>
> - `overhang` : **avertissement entre 45° et 60°** (une petite rampe s'imprime), **erreur au-delà de
>   60°** (pente `dr/dz > 1,7`, `OVERHANG_ERROR_SLOPE`). Tolérance de mesure de **6 %** sur les 45°
>   (`OVERHANG_TOLERANCE`) : le héros culmine à 1,01 (45,3°) vers z = 7,5 mm et doit rester
>   « imprimable » ; les corrections, elles, visent la pente exacte de 45°.
> - `plate` (boîte > 250 mm) et `near-vase-spirale` (silhouette du Vase spirale) : **erreur**.
> - `base-narrow`, `band-thin`, `pattern-coupling` : **avertissement** (imprimable, mais à regarder).
>   Exception : un gradin aussi profond que la paroi (`gd ≥ paroi`) est une erreur.

### 6.7 Expérience

**Desktop (≥ 1024 px)** :

```
Studio › Vase « Lavaux »      [Annuler] [Rétablir] [Surprenez-moi] [Copier le lien] [Garder]
┌───────────── colonnes 1–7 (collant, top 88) ─────────────┬───── colonnes 8–12 (flux) ─────┐
│ [3/4] [Plan] [Élévation] [Couches]        [Éclater]       │ h1 Vase « Lavaux »             │
│   StageView studio-object (aspect 1/1)                    │ 01 Forme                       │
│   objet sur le plateau 256 × 256 (quadrillage iso)       ▮│ 02 Motif                       │
│   barre altimétrique : bandes + frontières glissables    ▮│ 03 Couleurs (bandes)           │
│   réglette Z et « Simuler ×1 ×10 ×100 » (vue Couches)    ▮│ 04 Texte (objets à texte)      │
│ bande de mesure mono (collante en bas de colonne)         │ 05 Fiche (<dl>, badge)         │
│                                                           │ [Envoyer à l'atelier]  ← rouge │
└───────────────────────────────────────────────────────────┴────────────────────────────────┘
```

**Mobile (< 1024 px)** : scène collante sous le header (`top: 64px`, hauteur `46svh`) avec le
sélecteur de vue en surimpression ; dessous, onglets **Forme · Motif · Couleurs · Texte · Fiche**
dans le flux ; **barre Studio fixe** en bas (remplace la BottomNav sur `/studio/<objet>`) : à gauche
« ≈ 80 g · 2 h 45 » ou « CHF 17–23 », à droite « Envoyer à l'atelier ». Le bandeau de
consentement se place au-dessus, comme avec la BottomNav.

**Éléments** :

- **Vues** : 3/4 (orbite : glisser, boutons +/−, flèches ; molette = défilement de page) ; Plan
  (vue de dessus) ; **Élévation** (SVG 2D exact, seule vue en C0) ; **Couches** (réglette Z
  verticale de la couche 0 à la dernière, libellé « Couche 0412 / 0750 · z 82,4 mm · Vert Lavaux » ;
  « Simuler » ×1 / ×10 / ×100 annonce la durée réelle : « Durée réelle ≈ 2 h 45 · à ×100 : 1 min 39 »).
- **Éclater** : bandes écartées de 12 mm (vase) ou plaque et texte séparés (objets plats), avec
  étiquettes DOM.
- **Barre altimétrique** : à côté de la scène (desktop) ou horizontale dans l'onglet Couleurs
  (mobile) ; règle graduée (repère tous les 10 mm, cote tous les 50 mm) ; chaque frontière est un
  `input type="range"` vertical (`writing-mode: vertical-lr; direction: rtl`), zone de prise de
  44 px, `aria-valuetext` « Changement 1 à 42,0 mm, couche 211 » ; sous la barre, la liste des
  bandes avec un sélecteur de filament (radios nommées) et « Ajouter une bande » / « Retirer ».
- **Bande de mesure** : « H 150,0 mm · Ø 96,0 mm · 750 couches · ≈ 80 g · ≈ 2 h 45 · 2 changements
  · purge ≈ 1,6 g · CHF 17–23 » (CHF seulement si validé, sinon « Prix confirmé sous 48 h »).
- **Badge Imprimable** : « ✓ Imprimable » (encre), « ! À vérifier » (ambre), « ✕ Non imprimable »
  (`accent-text`), première anomalie en clair et bouton « Corriger ».
- **Outils** : Annuler/Rétablir (Ctrl/⌘ + Z, Maj + Ctrl/⌘ + Z, pile de 50 états, un état par
  geste terminé) ; « Surprenez-moi » (tirage dans des bornes « belles », teintes voisines
  contrastées, garde vérifiée, 10 essais max) ; « Copier le lien » (sans texte, toast « Lien copié :
  le texte n'est pas inclus ») ; « Garder » (« Mes créations » dans Favoris, vignette `bake`).
- **États** : chargement (poster SSR + « Préparation du Studio… ») ; pas de WebGL (Élévation +
  « Vue 3D indisponible sur cet appareil : l'aperçu 2D est exact au dixième de millimètre. ») ;
  erreur du Worker (message + « Réessayer ») ; lien partagé invalide (réglages par défaut + toast).
- **Vague de couleur** sur chaque changement de pastille (même mécanique que le héros) ;
  **réimpression** (front qui monte) sur chaque changement de motif ou de profil.

### 6.8 État, URL et stockage

- **Fragment** `#c=v1.<base64url(JSON compact)>` (clés du §6.2, `bd` =
  `[["bleu-leman",42],["vert-lavaux",108],["blanc-neve",150]]`), ≤ 600 caractères,
  `history.replaceState` en debounce de 300 ms. Validé par le schéma zod de l'objet
  (`schemas.ts`) : invalide → défaut + toast. **Aucun texte personnel.**
- **Paramètres GET** (formulaire sans JS) : mêmes clés, bandes en `bd=bleu-leman:42,vert-lavaux:108,blanc-neve:150`.
  Au chargement du JS, ils sont convertis en fragment et retirés de l'URL.
- **Textes** : en mémoire + `sessionStorage["s3d-studio-texts-v1"] = { [objet]: StudioTexts }`
  (try/catch). Au partage, le destinataire voit le texte d'exemple.
- **Envois** : `sessionStorage["s3d-studio-upload-v1"] = { [hash]: { key, name, bytes, triangles, at } }`,
  `hash` = FNV-1a 64 du JSON canonique (configuration + textes). Réutilisé 24 h.
- **Mes créations** : `src/lib/studio/creations.ts` (§4.5), 12 au plus.
- **SEO** : les URL à fragment ne créent aucun doublon ; `Disallow: /*/studio/*?` couvre les URL
  à paramètres ; canonical `/studio/<objet>`.

### 6.9 Export STL et chemin de commande réel

1. **« Envoyer à l'atelier »** ouvre un tiroir (`<dialog>`, Lenis arrêté) : vignette (`bake`
   512² WebP, ou SVG Élévation en C0), nom de l'objet, dimensions, bandes (noms de filaments, mm,
   couches), grammes, durée, changements, estimation si validée ; récapitulatif des textes et note
   de modération ; puis le **formulaire partagé** `QuoteRequestForm` (WP-QUOTE, §7.10) en variante
   `drawer` : e-mail (prérempli si session), quantité (1–20), remarque facultative.
2. À l'envoi, **attente narrée** : « 1/3 Préparation du fichier · 58 420 triangles » (Worker :
   maillage `export`, STL binaire) → « 2/3 Envoi à l'atelier · 2,9 Mo · 42 % » (XHR pour la
   progression, `POST /api/quote-upload`, champ `file`, nom `s3d-lavaux-<hash8>.stl`,
   type `model/stl`) → « 3/3 Enregistrement de la demande » (Server Action `submitQuoteRequest`).
3. **STL** : en-tête de 80 octets ASCII `Swiss3Design Studio v1 lavaux <hash8>` complété d'espaces
   (**ne commence jamais par « solid »**), `uint32` du nombre de triangles, puis par triangle :
   normale et 3 sommets en `float32` little-endian, `uint16` à 0 ; mm, Z vers le haut ;
   `84 + 50 × n` octets (assertion) ; cible 1–3 Mo, plafond 200 k triangles.
4. **Payload de la Server Action** (inchangée) : `email` ; `description` (≤ 4000) = résumé lisible
   dans la langue du client + ligne machine ; `material` = « PLA » ; `colors` (≤ 200) =
   « Bleu Léman 0–42 mm · Vert Lavaux 42–108 mm · Blanc névé 108–150 mm » ; `dimensions`
   (≤ 200) = « 96 × 96 × 150 mm » ; `fileKey` et `fileName` issus de l'upload ; `locale`.

```
[Studio] Vase « Lavaux » · configuration v1
Lien : https://swiss3design.ch/fr/studio/lavaux#c=v1.eyJ…
Dimensions : 96 × 96 × 150 mm · 750 couches · paroi 1,6 mm · profil galet
Motif : gradins (pas 5 mm, profondeur 1,4 mm)
Couleurs (changements à la couche) : Bleu Léman 0–42,0 mm (couches 1–210) · Vert Lavaux 42,0–108,0 mm (211–540) · Blanc névé 108,0–150,0 mm (541–750)
Estimation affichée : ≈ 80 g · ≈ 2 h 45 · 2 changements · CHF 17–23 (indicatif)
Textes à imprimer : —
Quantité : 1
Remarque : —
S3D-STUDIO v1 lavaux h=150 d=96 p=galet b=0.5 n=0.72 l=0.08 m=gradins gs=5 gd=1.4 w=1.6 bd=bleu-leman:42,vert-lavaux:108,blanc-neve:150
```

5. **Succès** : « Reçu. L'atelier vérifie votre pièce et vous répond sous 48 h avec un prix ferme. »
   - « Continuer dans le Studio » / « Voir la boutique » ; événements `Studio Sent` puis
     `Quote Requested { source: "studio", object, has_file: true, signed_in }`. Le client suit sa
     demande dans `account/quotes` et paie par le Payment Element existant (`quotes/[id]/pay`).
6. **Erreurs** : 429 à l'upload → « Trop d'envois depuis cette connexion (10 par heure). Réessayez
   plus tard ou écrivez à contact@swiss3design.ch. » ; 413/415 → message dédié ; erreur de la
   Server Action → « Réessayer » (le fichier déjà envoyé est réutilisé, pas de second upload).
7. **Repli** : lien « Ouvrir dans le formulaire complet » → `writeQuoteHandoff(…)` (avec la pièce
   jointe si elle est déjà envoyée) → `/custom#studio`, où la carte « Configuration Studio jointe »
   prérempli le formulaire (§7.10). C'est aussi le chemin sans JS : le formulaire GET du Studio
   propose « Demander un devis » vers `/custom` avec la description à compléter.

### 6.10 Accessibilité

- Uniquement des contrôles natifs étiquetés ; `aria-valuetext` en unités (« 150 millimètres, 750
  couches ») ; `fieldset`/`legend` par section ; couleurs toujours nommées (jamais une pastille
  seule).
- La vue 3D est décorative pour les lecteurs d'écran (`aria-hidden` sur le canvas) ; un résumé
  vivant `aria-live="polite"` (debounce 1 s) la remplace : « Vase Lavaux, 150 mm, gradins, 3
  couleurs : Bleu Léman, Vert Lavaux, Blanc névé ; imprimable ». Il porte `.ph-mask` s'il contient
  un texte saisi.
- Vue interactive : `tabIndex=0`, `aria-label` « Aperçu 3D : flèches pour tourner », boutons
  Tourner à gauche/droite, Vue de face, Réinitialiser.
- Tous les états (erreur d'envoi, succès, badge) sont annoncés. Le formulaire GET sans JS
  fonctionne jusqu'au devis.

### 6.11 Performance

- **Worker** (`src/motion/studio/geometry.worker.ts`, WP-STUDIO) : importe `src/lib/studio/**`,
  charge les glyphes à la demande, renvoie des `Float32Array`/`Uint32Array` **transférables**.

```ts
type ToWorker =
  | { t: "glyphs"; url: string }
  | {
      t: "build";
      id: number;
      config: StudioConfig;
      texts: StudioTexts;
      lod: "drag" | "display";
    }
  | {
      t: "export";
      id: number;
      config: StudioConfig;
      texts: StudioTexts;
      name: string;
    };
type FromWorker =
  | { t: "mesh"; id: number; mesh: MeshData; ms: number }
  | {
      t: "stl";
      id: number;
      buffer: ArrayBuffer;
      triangles: number;
      bytes: number;
      ms: number;
    }
  | {
      t: "error";
      id: number;
      code: "glyphs" | "build" | "export";
      message: string;
    };
```

- Pendant un glissé : au plus une construction `drag` par frame (les réponses périmées sont
  ignorées par `id`) ; 150 ms après le relâchement : construction `display`. Budget fil principal
  ≤ 8 ms par événement d'entrée (état React, stats analytiques, envoi au Worker) ; télémétrie DOM
  ≤ 10 Hz ; mise à jour des buffers GPU sans réallocation quand la taille ne change pas.
- Cibles : `drag` ≤ 8 ms dans le Worker, `display` ≤ 40 ms (desktop) / ≤ 90 ms (mobile), export
  ≤ 400 ms ; INP ≤ 150 ms sur les trois gestes du §4.11.

### 6.12 SSR, SEO et routes

- `/[locale]/studio` : h1 « Le Studio », chapeau « Réglez-le. On l'imprime. », quatre cartes (h2,
  une ligne, stats du défaut, « Sur devis » ou fourchette, poster SSR), comment ça marche en 4
  étapes, FAQ SSR (`<details>`), lien vers `/custom`. JSON-LD `webPageJsonLd` + `faqJsonLd` +
  `breadcrumbJsonLd`.
- `/[locale]/studio/[objet]` (`lavaux`, `cartouche`, `relief`, `borne` ; autre → `notFound()` avant
  tout) : h1, description, **formulaire SSR complet en GET** (contrôles natifs, valeurs par défaut
  ou issues de la requête), poster Élévation SSR, bande de mesure SSR (`computeStats`), `<dl>` des
  paramètres, FAQ, JSON-LD comme l'index. Pas de JSON-LD `Product` (pas de prix fixe, pas de fiche
  marchande trompeuse).
- Métadonnées : `pageMetadata({ path: "/studio" })` et `pageMetadata({ path: `/studio/${objet}` })`,
  titres ≤ 60 caractères avec le gabarit, descriptions 110–160, textes dans le namespace `studio`.
- `src/app/sitemap.xml/route.ts` : ajouter `/studio`, `/studio/lavaux`, `/studio/cartouche`,
  `/studio/relief`, `/studio/borne` à `STATIC_PAGES`. `robots.txt` : `Disallow: /*/studio/*?`.
  `llms.txt` : section « Studio » (4 objets, principe, lien vers `/custom`).

### 6.13 WebMCP `studio_configure` (WP-STUDIO, dans `src/components/webmcp-tools.tsx`)

```ts
{
  name: "studio_configure",
  title: "Configure a Studio object",
  description: "Builds a shareable Studio link for one of Swiss3Design's own configurable objects " +
    "(lavaux vase, cartouche business card, relief coaster, borne name tag) and returns its stats. " +
    "Personal texts (names, contacts) are never accepted here: the human types them on the page.",
  inputSchema: {
    type: "object",
    properties: {
      object: { enum: ["lavaux", "cartouche", "relief", "borne"] },
      params: { type: "object", description: "Numeric or enum parameters using the fragment keys; clamped to valid ranges." },
      palette: { type: "array", items: { enum: [/* ids de filaments */] }, maxItems: 4 },
      open: { type: "boolean", description: "Navigate the tab to the link." }
    },
    required: ["object"]
  },
  annotations: { readOnlyHint: true },
}
// → { link, stats: { height_mm, layers, grams, minutes, changes, estimate_chf? }, printable, note }
```

---

## 7. Plans de page

Chaque fiche liste ce qui **doit survivre** (données, actions, SEO, JSON-LD, analytics, surfaces
agents, a11y). « Inchangé » veut dire : même comportement, mêmes clés, même logique ; seul
l'habillage change. Toute page de `(site)` enveloppe son contenu dans `<PageCut>`.

### 7.1 Header (WP-00, `src/components/header.tsx`)

- **Structure** : 64 px (inchangé), fond `paper/85` + `backdrop-blur`, filet bas `line`,
  `style={{ viewTransitionName: "site-header" }}`. À gauche : mark 28 px + wordmark
  « **Swiss**3Design » en Geist (inchangé). Au centre (≥ lg) : **Boutique · Studio · Sur mesure ·
  Atelier** en texte 14 px ; actif = encre + soulignement rouge 2 px (`view-transition-name:
nav-mark`) ; survol = soulignement qui se trace. À droite : thème, langue, favoris (cœur +
  compteur), compte (≥ md), panier (≥ md) « Panier » + compteur.
- **Bord inférieur** : filet de progression `.s3d-progress` (pages de `(site)`), buse d'attente
  `.s3d-pending` pendant `navPending`.
- **Retiré** : le pill `motion` `layoutId="nav-pill"` (plus d'import de `motion` dans le header).
- **À préserver** : `hasSession` (cookie, sans requête DB) → `SessionAvatar` ; compteurs `useCart()`
  et `useFavorites()` ; `aria-current="page"` ; `aria-label` des icônes (`nav.favorites`,
  `nav.account`, `nav.cart`) ; wordmark masqué < 360 px ; `ThemeToggle`, `LocaleSwitcher`
  (listbox clavier, `router.replace` avec `search` et `hash`) ; liens `@/i18n/navigation` ;
  `z-40` ; hauteur 64 (offsets `top-16`, `top-24`, `scroll-mt-32`).
- **i18n** : `nav.*` existants + `shell.nav.studio`, `shell.nav.atelier`.

### 7.2 BottomNav (WP-00, `src/components/bottom-nav.tsx`)

- **5 entrées** : Accueil · Boutique · **Studio** (disque rouge 44 px au centre, `StrataIcon`
  blanc, libellé dessous) · Panier (badge) · Compte (avatar si session). « Sur mesure » sort de
  la BottomNav (accessible depuis l'accueil, le Studio et le footer).
- **Masquée** sur `/studio/<objet>` (la barre Studio la remplace) ; inchangée ailleurs.
- **À préserver** : `fixed bottom-0 z-50`, `lg:hidden`, `env(safe-area-inset-bottom)`, filet
  actif, badge du panier, `SessionAvatar variant="bottom"`. **Corriger le trou md/lg** : le footer
  passe de `pb-24 md:pb-0` à `pb-24 lg:pb-0`.
- **i18n** : `nav.*` + `shell.nav.studio`.

### 7.3 Footer (WP-00, `src/components/footer.tsx`, composant serveur + îlot client)

- **Cartouche** (bloc titre de carte) : mark + wordmark Geist (pas de nouveau wordmark), tagline,
  légende mono « Équidistance 0,2 mm · Échelle 1:1 », coordonnées Gland et Pully, isolignes SVG
  statiques en fond (`public/posters/field-footer-{light,dark}.svg` en `background-image` par
  thème ; placeholder de WP-00, régénéré par WP-01).
- **Colonnes** : Boutique (boutique, **Studio**, sur mesure, favoris, suivi) ; Compte et aide
  (compte, atelier, contact) ; Informations (CGV, confidentialité, livraison et retours).
- **Préférences** : `MotionToggle` (« Réduire les animations », îlot client).
- **Barre basse inchangée** : copyright `footer.copyright`, « Site créé par » + logo Calyroc
  (lien externe), « Paiement sécurisé » + TWINT, Visa, Mastercard, Google Pay.
- `position: relative; z-index: 1` ; fond `surface`.
- **À préserver** : toutes les clés `footer.*`, `footer.madeIn`, liens existants, rendu serveur.
- **i18n** : `footer.*` + `shell.footer.*` (légende, préférences).

### 7.4 Bandeau de consentement (WP-00, `src/components/consent-banner.tsx`)

- Restyle en « encart de légende » (filet, titre mono), **mêmes textes** (`consent.*`), **mêmes
  positions** (au-dessus de la BottomNav, en bas à gauche dès lg), **même logique** (« OK » /
  « Refuser », `setAnalyticsOptOut`, masqué sur `/checkout` et `/admin`). Bouton « OK » en encre
  (pas de rouge : le CTA rouge de l'écran reste celui de la page).

### 7.5 Accueil `/[locale]` (WP-HOME, `src/app/[locale]/(site)/page.tsx`)

- **Objectif** : comprendre l'offre en 5 s, faire un premier réglage, s'orienter (Régler /
  Acheter / J'ai un fichier).
- **Chapitres** (desktop : `ChapterRail` ≥ 1536 px ; note du 30.09.2026 : 1280 px à l'origine, le rail recouvrait le cœur des favoris sous 1536 px, la marge droite de la page ne le contenant pas) :

| #   | Titre (FR)                                                | Contenu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Mouvement (complet)                                                                                   | Réduit / C0                                                     |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 00  | Tout relief commence par une couche.                      | Héros (§5), puis bande de réassurance                                                                                                                                                                                                                                                                                                                                                                                                                                                  | §5.5                                                                                                  | poster final                                                    |
| 01  | Une couleur par altitude.                                 | Le même vase **éclaté** (`print-hero` en mode `exploded`), une étiquette par bande calculée par `bandStats(config)` (« Bleu Léman · couches 1–210 · 0–42,0 mm · ≈ 21 g »), ligne de purge (« 2 changements · purge ≈ 1,6 g · + ≈ 4 min : c'est tout ce que coûte la couleur, et on vous le montre »), texte sur la teinte hypsométrique. Fond : champ de courbes. Suit la palette et le motif choisis dans le héros (contexte client `HomeConfig`).                                    | éclatement de 1,2 s à l'entrée (`s3d.buse`), étiquettes en `.s3d-rise` ; champ WebGL en C2, SVG sinon | poster « éclaté » SVG                                           |
| 02  | Votre nom, en relief. Littéralement.                      | Ton **encre**. Sous-verre « Relief » (`studio-object`) ; champ SSR « Nommez votre sommet » (12 caractères, **hors de toute section pinnée**), note « Le texte reste dans votre navigateur jusqu'à l'envoi à l'atelier. » ; l'étiquette « POINTE LÉA · 3 107 M » se réimprime à chaque frappe (debounce 120 ms) ; bande de mesure ; CTA rouge « Continuer dans le Studio » (`/studio/relief#c=…`, texte via `sessionStorage`). Glyphes chargés quand la section approche (marge 150 %). | réimpression de l'étiquette                                                                           | SVG statique du relief + étiquette en DOM mise à jour en direct |
| 03  | Réglez-le. On l'imprime.                                  | Quatre cartes d'objet (poster SSR, h3, une ligne, stats du défaut, « Sur devis » ou fourchette), puis « Comment ça marche » en `<ol>` : Réglez · Envoyez · L'atelier vérifie (48 h) · Imprimé et livré                                                                                                                                                                                                                                                                                 | `.s3d-print` sur les cartes                                                                           | statique                                                        |
| 04  | Des objets choisis, imprimés à la commande.               | N = 1 : grande `ProductCard` du Vase spirale + légende d'attribution courte (« Design : Ian · CC BY-ND 4.0 ») ; N = 2–3 : rangée ; N ≥ 4 : grille + « Tout voir »                                                                                                                                                                                                                                                                                                                      | `.s3d-print`                                                                                          | statique                                                        |
| 05  | Imprimé à Gland et à Pully. Livré de Genève à Romanshorn. | Deux colonnes (Gland : Bambu Lab P1S + AMS 2 Pro ; Pully : Creality K2 + CFS), coordonnées, livraison offerte dès `formatChf(freeOverCents)`, moyens de paiement, lien « Visiter l'atelier » ; illustration ChatGPT facultative (étiquetée « Illustration »)                                                                                                                                                                                                                           | `.s3d-rise`                                                                                           | statique                                                        |
| 06  | Vous avez déjà un fichier ?                               | « STL, 3MF, OBJ ou STEP : envoyez-le, l'atelier vous répond sous 48 h avec un devis. » CTA rouge « Envoyer un fichier » (`/custom`)                                                                                                                                                                                                                                                                                                                                                    | —                                                                                                     | —                                                               |

- **À préserver** : `export const dynamic = "force-dynamic"` ; `generateMetadata` via
  `pageMetadata({ path: "", absoluteTitle: true })` (titre et description déplacés dans
  `landing.seo`) ; **un seul h1** (SSR, LCP) ; `getProducts(locale, { featuredOnly: true })` et
  `getShippingSettings()` (montants dynamiques, jamais écrits en dur) ; liens `/shop`, `/custom`,
  `/a-propos`, `/studio` ; comportements de `ProductCard` (h2 + lien étiré, favori, ajout rapide
  avec `Product Added` source `catalog`) ; l'accès mobile à l'Atelier (chapitre 05) et au sur-mesure
  (héros, chapitre 06).
- **Retiré** : `HeroScene`, `Reveal`, le panneau `night` multicolore, les barres 4 couleurs.
- **Analytics** : `Hero Customized` ; aucun texte saisi envoyé.
- **i18n** : `landing` (+ `studioCore` en lecture).

### 7.6 Index du Studio `/[locale]/studio` (WP-STUDIO)

Voir §6.12. Quatre cartes, étapes, FAQ, lien sur mesure. `<PageCut>`. Aucune vue WebGL (posters
SSR) : la page reste légère. i18n : `studio`, `studioCore`.

### 7.7 Objet du Studio `/[locale]/studio/[objet]` (WP-STUDIO)

Voir §6.2 à §6.13. `TrackEvent "Studio Viewed"`. BottomNav remplacée par la barre Studio sur
mobile. i18n : `studio`, `studioCore`.

### 7.8 Boutique `/[locale]/shop` (WP-SHOP)

- **N ≤ 2 et aucun filtre actif : une « planche » éditoriale par produit** (empilées) : grande photo (`cfImage` 1200),
  fiche d'identité `<dl>` (matière, dimensions, poids, délai, provenance), prix `formatChf`,
  pastilles des couleurs vendues, ajout rapide (même logique que `ProductCard`), lien vers la
  fiche, légende d'attribution courte ; puis la rangée **« À régler au Studio »** (4 objets,
  « Sur devis » ou fourchette ; ce ne sont **pas** des produits : aucun prix fixe, aucun JSON-LD
  produit) ; puis lien « J'ai un fichier ».
- **N ≥ 3 ou filtre actif : grille** 1 / 2 / 3 colonnes (< 480, ≥ 480, ≥ lg). Filtres en
  **puces SSR** (liens, sans JS) : catégorie, matière, couleur (pastilles avec
  `<span class="sr-only">` du nom), multicolore, tri ; recherche en `<form>` GET avec les champs
  cachés qui conservent les filtres ; compteur de résultats. Bascule **Grille / Registre**
  (tableau à filets : réf., vignette, nom, matière, dimensions, prix), état client en
  `localStorage["s3d-shop-view"]` (aucun nouveau paramètre d'URL).
- **Cartes** : image, nom (h2 + lien étiré), prix, ligne mono « Hauteur 209 mm · PLA · 3 j »
  (l'unité réelle d'abord), pastilles, favori, ajout rapide ; la 2ᵉ image « s'imprime » au survol
  (clip-path continu, `--ease-strate`, depuis le 07.10.2026) ;
  `<ViewTransition name={`product-${slug}`} share="morph" default="none">` sur
  l'image.
- **À préserver** : `searchParams` (`category`, `material`, `color`, `multicolor=1`,
  `sort=new|price_asc|price_desc`, `q`), `getUsedFilters(locale)`, `getProducts(locale, {…})`,
  canonical `/shop`, `collectionJsonLd` **seulement** sans filtre, `TrackEvent`
  `Products Searched {query, results}` et `Product List Filtered {category, material, color,
multicolor, sort, results}`, état vide utile, aucun nouveau paramètre d'URL (sinon robots et
  `KEPT_PARAMS`).
- **i18n** : `shop.*` + `catalog`.

### 7.9 Fiche produit `/[locale]/products/[slug]` (WP-SHOP) et attribution de Ian

- **Chapitres** :
  - **01 Objet** : galerie (images `cfImage` 1200/200, `fetchPriority="high"` sur la grande ;
    **plus de vignette 3D** dans la galerie) + colonne d'achat **collante** dès le premier écran
    (`md:sticky md:top-24`) : badge multicolore, h1, premier paragraphe, étoiles, `ProductPurchase`
    (dispo, prix, pastilles `aria-pressed`, variantes, `AddToCart` `aria-live`, favori, `BuyNow`),
    réassurance ×3, ligne d'attribution courte (« Design : Ian · CC BY-ND 4.0 · voir le crédit ↓ »).
  - **02 Tourner** : section pleine largeur, `StageView scene="product-viewer"` (fond papier,
    cyclorama, ombre de contact) : **rotation seulement** (glisser, flèches, boutons ; pas de zoom
    ni de panoramique ; polaire bornée 60–95°), matériau PBR simple, **couleurs réellement vendues
    uniquement** (Blanc, Noir, via `ProductColorProvider`), **aucune coupe, aucun shader
    d'impression, aucune ligne de couche** ; autorotation lente (0,6 tr/min) seulement en
    mouvement complet et hors interaction. STL chargé quand la section approche (marge 100 %),
    attente narrée « Chargement du modèle 3D (≈ 2,2 Mo) ». Légende : « Rendu temps réel du fichier
    original de Ian, non modifié ». C0 : la photo « Rendu 3D » existante et une phrase.
  - **03 Fiche technique** : `<dl>` SSR (matière, dimensions, poids, délai, provenance) + paragraphes
    suivants de la description.
  - **04 Crédit du design** : `AttributionBlock` (ci-dessous).
  - **05 Avis** : liste existante.
  - **06 « Un vase à vos couleurs ? »** : « Le Vase spirale reste tel que Ian l'a dessiné. Pour un
    vase à vos couleurs, le Studio propose nos propres modèles paramétriques. » → `/studio/lavaux`.
  - **07 Produits liés** (s'il y en a).
- **`AttributionBlock`** (SSR, 4 langues, `src/components/catalog/attribution-block.tsx`), données
  `src/lib/attribution.ts` (`attributionFor(slug)` ; `vase-spirale` → `{ title: "Vase", author: "Ian",
platform: "MakerWorld", url: "https://makerworld.com/fr/models/1262112-vase", license: "CC BY-ND 4.0",
licenseUrl: "https://creativecommons.org/licenses/by-nd/4.0/", modified: false }`, deed localisé
  `…/by-nd/4.0/deed.fr|de|it|en`). Texte FR : « Design : **Ian**, « Vase », publié sur MakerWorld
  (lien). Licence **Creative Commons BY-ND 4.0** (lien vers le deed). Swiss3Design imprime ce modèle
  **sans aucune modification**. Cette mention n'implique aucune approbation de Swiss3Design par
  l'auteur. » (DE/IT/EN en annexe C). Jamais de formulation laissant croire à un partenariat.
- **JSON-LD** : `productJsonLd` gagne une entrée facultative `design` qui ajoute au `Product`
  `subjectOf: { "@type": "3DModel", name: "Vase", creator: { "@type": "Person", name: "Ian" }, url:
"https://makerworld.com/fr/models/1262112-vase", license: "https://creativecommons.org/licenses/by-nd/4.0/",
isAccessibleForFree: true }` (**pas** `isBasedOn` sur `Product`, invalide).
- **À préserver** : `cache(getProductBySlug)` partagé metadata/page ; `notFound()` avant tout ;
  `generateMetadata` (titre `seo.productTitle` si nom ≤ 20 car., `productMetaDescription`, OG
  jusqu'à 4 photos `cfOgImage`, SVG exclus) ; `productJsonLd` + `breadcrumbJsonLd` ;
  `TrackEvent "Product Viewed"` (+ `in_stock`, `rating`, `reviews`) ; `ProductColorProvider`
  autour de la galerie, du viewer et de l'achat ; fiche `<dl>` rendue serveur ; réassurance (clés
  recopiées dans `catalog.trust*` pour découpler de `home.*`) ; avis ; produits liés ; morph
  `product-${slug}`.
- **Retiré** : `product-viewer-3d.tsx`, `showroom-scene.ts` (et leur entrée temporaire d'oxlint en
  WP-99).
- **i18n** : `product.*`, `reviews.*`, `viewer.*` + `catalog`.

### 7.10 Sur mesure `/[locale]/custom` (WP-QUOTE)

- **Structure** : `PageHeader` (titre `custom.title`, intro `custom.intro` : « … devis personnalisé
  sous 48 h ») ; deux entrées : « J'ai un fichier » (le formulaire) et « Je n'ai pas de fichier »
  → Studio ; le formulaire en « fiche de commande » à filets ; zone de dépôt plus visible ; si un
  `QuoteHandoff` est présent (`#studio`) : carte **« Configuration Studio jointe »** (vignette,
  résumé, fichier déjà envoyé, « Modifier dans le Studio », « Retirer ») et champs préremplis.
- **Composant partagé** `src/components/quote/quote-request-form.tsx` (remplace l'intérieur de
  `quote-form.tsx`, qui devient un simple wrapper) :

```ts
export interface QuotePrefill {
  description?: string;
  material?: string;
  colors?: string;
  dimensions?: string;
}
export interface QuoteUploadProgress {
  phase: "prepare" | "upload" | "submit";
  loaded?: number;
  total?: number;
  triangles?: number;
}
export interface QuoteAttachment {
  key?: string;
  name?: string; // déjà envoyé
  prepare?: (
    onProgress: (p: QuoteUploadProgress) => void,
  ) => Promise<{ key: string; name: string }>; // envoi paresseux
  summary?: { title: string; lines: string[]; thumbnail?: string };
}
export function QuoteRequestForm(props: {
  materials?: string[]; // absent → sélecteur masqué si prefill.material est fourni
  source: "form" | "studio";
  object?: StudioObjectId;
  prefill?: QuotePrefill;
  attachment?: QuoteAttachment | null;
  variant?: "page" | "drawer";
  extraFields?: React.ReactNode; // ex. quantité (Studio)
  onSuccess?: () => void;
}): React.JSX.Element;
```

Soumission : `onSubmit` → si `attachment.prepare`, l'appeler (progression narrée) → ajouter
`fileKey`/`fileName` au `FormData` → `startTransition(() => formAction(formData))`. Sans JS, le
formulaire reste un `<form action={formAction}>` (Server Action, amélioration progressive).
`src/lib/quote-upload-client.ts` : `uploadQuoteFile(file, onProgress)` (XHR, erreurs typées
`429 | 413 | 415 | 400 | "network"`).

- **À préserver** : `submitQuoteRequest` **inchangée** (rate limit, zod, transaction
  `quote_requests` + `status_events`, e-mail admin via outbox, `{ status }` sans `redirect()`) ;
  upload avant envoi par `POST /api/quote-upload` (FormData, `.stl,.3mf,.obj,.step,.stp`) ;
  champs cachés `fileKey`/`fileName` ; e-mail prérempli par `useSession()` ; champs `email`,
  `description` (min 10), `material`, `colors`, `dimensions`, `locale` ; états succès et erreur ;
  labels `htmlFor` ; `customServiceJsonLd` ; `pageMetadata("/custom")` ;
  `Quote Requested { material, has_file, signed_in }` + `source`.
- **i18n** : `custom.*` + `quote`.

### 7.11 Atelier `/[locale]/a-propos` (WP-ABOUT)

- **Structure** : h1 et badge issus d'`ABOUT_CONTENT[locale]` ; stats en bande de mesure ;
  chapitres **01 L'équipement** (ton encre : `PrinterShowcase`, schémas SVG annotés, tracés au
  `DrawSVG` à l'entrée en mouvement complet), **02 Le procédé**, **03 Les matières**, **04 Nos
  engagements**, **05 FAQ**, **06 Contact** ; `AboutNav` restylée en « rail kilométrique »
  (mêmes ancres, même logique de section active).
- **À préserver** : contenu `ABOUT_CONTENT` (JSX par langue) intact ; `pageMetadata` tiré du
  contenu ; `webPageJsonLd({ type: "AboutPage" })` + `faqJsonLd(c.faq)` avec la FAQ **visible en
  SSR** (`<details class="faq-item">`, sans JS) ; ancres `equipment, process, materials, trust,
faq, contact` + `scroll-mt-32` ; `AboutNav` **enfant direct** du conteneur racine (sinon le sticky
  se décolle) ; `DETECTION_LINE` alignée sur le header de 64 px ; `ContactForm` ; interactions du
  schéma (survol ↔ légende, focus, épinglage). `scrollIntoView` remplacé par `bridge.scroll.to`
  quand Lenis est là. La photo `about/p1s-ams2-pro.jpg` reste inutilisée (droits non vérifiés).
- **i18n** : contenu existant + `atelier`.

### 7.12 Contact `/[locale]/contact` (WP-ABOUT)

- **Structure** : `PageHeader`, formulaire en fiche à deux colonnes, bloc « Deux ateliers » avec
  isolignes SVG statiques (`public/posters/field-leman-{light,dark}.svg`) et deux points rouges
  « Gland » et « Pully » (villes seulement, jamais d'adresse de rue), `mailto:contact@swiss3design.ch`,
  lien `/custom`.
- **À préserver** : `ContactForm` (`useActionState(submitContactMessage)`, rate limit, zod,
  **honeypot `company`** masqué `aria-hidden`, 2 e-mails via outbox, `{ status }`),
  `webPageJsonLd({ type: "ContactPage" })`, `pageMetadata`.
- **i18n** : `contact.*` + `atelier`.

### 7.13 Panier `/[locale]/cart` (WP-UTILITY, hors `(site)`)

- **Structure** : `PageHeader` ; lignes (vignette `cfImage` 200, nom, variante et couleur, quantité
  ±, retirer) ; récapitulatif (sous-total, port, total) ; barre « livraison offerte » : filet
  rouge dont la tête est un point (la buse) ; CTA rouge « Commander » ; `CartReminder`. État vide :
  h1 « Votre panier est vide », surtitre mono « Terrain vierge », trois sorties (Studio,
  Boutique, J'ai un fichier).
- **À préserver** : `getShippingSettings()`, `shippingFor`, `CartRecovery` (`#restore=` →
  `POST /api/cart-reminder/restore`), `CartLinkImport` (`?item=slug|qty||Couleur`, revalidé par
  l'API publique puis URL nettoyée), `CartReminder` (**case décochée par défaut**, vérification
  d'e-mail invité, `POST /api/cart-reminder`), `Cart Viewed` (une fois après hydratation),
  `Product Removed`, NOINDEX. **Ni Lenis, ni Stage.**
- **i18n** : `cart.*`, `cartReminder.*`, `cartLink.*` + `system`.

### 7.14 Checkout `/[locale]/checkout` (WP-UTILITY, logique intouchable)

- **Refresh visuel seulement** : jetons, typographie, rayons `field`/`card`, libellés d'étape
  mono « 01 Contact · 02 Paiement ». **Ni Lenis, ni canvas, ni transform animé, ni overflow
  animé** autour des iframes Stripe. `window.scrollTo({ top: 0, behavior })` au passage à l'étape 2
  garde `smooth` sauf en mouvement réduit (`auto`).
- **`src/lib/stripe-appearance.ts` resynchronisé** (sélecteurs supportés seulement : `.Input`,
  `.Label`, `.Error`, `.AccordionItem`, `.Dropdown*`) : clair `colorText #1a1614`,
  `colorTextSecondary #6a635a`, `colorTextPlaceholder #9a9288`, `colorBackground #ffffff`,
  bordures `#d8d1c4` (survol `#c9c1b2`, focus `#1a1614`), libellés `#3d3731`, surlignage de liste
  `#f4f0e8`, `borderRadius "4px"` (accordéon 6 px) ; sombre `colorText #f2ede4`,
  `colorTextSecondary #a39b8f`, `colorTextPlaceholder #6a635a`, `colorBackground #211e1a`,
  bordures `#2e2a25` (survol `#3a352f`, focus `#f2ede4`), libellés `#d6d0c6`, surlignage
  `#2e2a25`. `colorPrimary #e5231c`. Police **Geist** inchangée (et `fonts` de `checkout-flow.tsx`
  inchangé).
- **À préserver** : tout `CheckoutFlow` (contact ou `GuestEmailVerification`, adresse **Suisse
  uniquement**, `StreetAutocomplete` sur `api3.geo.admin.ch`, NPA 4 chiffres, canton, pays figé,
  « enregistrer l'adresse », code promo `/api/discount/validate`, `POST /api/checkout` avec clé
  idempotente `sessionStorage s3d-checkout-attempt`, `CheckoutElementsProvider` + `PaymentElement`
  accordéon, `checkout.confirm()` puis `router.push('/checkout/success?session_id=…')`, Stripe.js
  préchargé en idle), événements `Checkout Started`, `Coupon Applied/Denied`,
  `Checkout Step Viewed`, `Payment Info Entered`, `Payment Failed`, mention CGV + lien avant le
  bouton payer, « Sécurisé par Stripe », `ph-mask` sur l'e-mail, bandeau de consentement masqué,
  récapitulatif avant le formulaire sur mobile, NOINDEX.
- **i18n** : `checkout.*` (clés existantes) + `system` (libellés d'étape mono seulement).

### 7.15 Confirmation `/[locale]/checkout/success` (WP-UTILITY)

- h1 « Merci, votre commande est reçue. » + surtitre mono « La buse chauffe. » ; la carte de
  confirmation « s'imprime » une fois (`.s3d-print`, en CSS) ; ticket mono (n°, montant).
- **À préserver** : `stripe.checkout.sessions.retrieve` + `settleSession()` idempotent, statuts
  `succeeded | processing | failed`, `ClearCart`, `TrackEvent "Order Completed"` (`onceKey =
order_id`, `revenue` port compris), `AttributionQuestion`, conversion invité → compte
  (`/account/register?email=`), lien `/track?order=`.
- **i18n** : `orderSuccess.*`, `attribution.*` + `system`.

### 7.16 Suivi `/[locale]/track` (WP-UTILITY)

- Statuts en **pile de couches** verticale (Commande · Impression · Contrôle · Expédiée · Livrée),
  libellés en clair d'abord, couche courante avec le point rouge ; lien Poste suisse ; lignes,
  totaux, adresse (`ph-mask`).
- **À préserver** : `TrackFlow` (n° + e-mail → `POST /api/track-order`), `?order=` prérempli,
  `statusStyle`, `account.status.*`, NOINDEX, exclusion des replays.
- **i18n** : `track.*`, `account.status.*` + `system`.

### 7.17 Favoris `/[locale]/favorites` (WP-UTILITY)

- **Une seule liste** (retour R13 du propriétaire, 07.10.2026 : l'ancienne page séparait objets
  et créations par des onglets) avec un filtre **Tout · Objets · Mes créations** en puces du
  site (`ChipRadio`, radios natives : flèches et annonce « 2 sur 3 » gérées par le navigateur ;
  le filtre ne s'écrit pas dans l'URL). Les cartes des deux sortes partagent la même grille
  (2 colonnes, 3 dès `lg`) ; une création porte une étiquette « Création » sur sa vignette :
  vignette, objet, libellé, date, « Rouvrir » → `/studio/<objet>#c=…`, « Supprimer ». « Tout
  ajouter au panier » (objets) n'apparaît que dans « Objets », ou dans « Tout » quand il n'y a
  aucune création. États vides par filtre ; « Rien de gardé pour l'instant. Personnalisez un
  objet au Studio et cliquez sur Garder. » pour les créations.
- **À préserver** : `localStorage s3d-favorites-v1`, « tout ajouter au panier »,
  `Product Added to Wishlist` / `Product Removed from Wishlist` (émis par `FavoritesProvider`),
  NOINDEX. **Corriger** `src/lib/favorites.tsx` : `setItem` en try/catch, pas d'écriture de `[]`
  avant hydratation. « Mes créations » lit `listCreations()` et `subscribeCreations()` (§4.5).
- **i18n** : `favorites.*` + `system` (+ `studioCore` pour les noms d'objets).

### 7.18 404 (WP-UTILITY, `src/app/[locale]/not-found.tsx`)

- h1 « Page introuvable. » ; surtitre mono « Point non coté » ; ligne « Altitude 404 m, soit
  32 m au-dessus du Léman. Rien n'a été imprimé ici. » ; isolignes SVG statiques
  (`field-404-{light,dark}.svg`) avec un point rouge « Vous êtes ici » ; CTA rouge « Retour à
  l'accueil » + liens Studio et Boutique.
- **À préserver** : `TrackEvent "Page Not Found"`, statut 404 réel, rendu dans le shell (le
  `[...rest]` reste en place).
- **i18n** : `errors.*` + `system`.
- **Note du 30.09.2026 (correctif vague 1, `claude/redesign-2026--fix-w1`)** : le `[...rest]`
  n'est plus en place et `src/app/layout.tsx` existe désormais. Un `notFound()` lancé pendant
  le rendu fait échouer la coquille React (Fizz n'a pas de limite d'erreur côté serveur) : Next
  retombe alors sur `<html id="__next_error__">` au corps vide. Statut 404 et `noindex` étaient
  corrects, mais h1, header et footer n'arrivaient qu'après l'hydratation (constaté aussi en
  production). Une URL sans route passe maintenant par la route interne `/_not-found` de Next,
  rendue côté serveur par le layout racine et `src/app/not-found.tsx` (habillage
  `LocaleShell`). **Reste rendu côté client** : un `notFound()` lancé par une page qui
  correspond à une route (fiche produit supprimée, `[locale]/not-found.tsx`) garde le statut
  404 et le `noindex`, mais son contenu s'écrit après l'hydratation : Next ne fixe le statut 404
  que dans ce repli, et aucune API de page ne permet de le poser autrement. Preuve dans le
  code de Next 16.3.6 (`node_modules/next/dist/server/app-render/app-render.js`) : le repli
  d'une erreur de coquille (`catch` « errorRecovery », vers la ligne 2382) fixe le statut puis
  rend `getErrorRSCPayload`, dont la graine est `<html id="__next_error__">` au `<body>` vide
  (vers la ligne 1325) ; la vraie arborescence, donc la limite `not-found`, n'est lue que par
  le client. Revérifié le 01.10.2026 : `/fr/products/slug-inexistant` répond 404 + `noindex`
  avec ce corps vide, `/fr/zzz-inconnu` et `/de/zzz` répondent 404 + `noindex` avec un
  header, un `<main>`, un h1 et un footer dans le HTML brut.

### 7.19 Erreur (WP-UTILITY, `src/app/[locale]/error.tsx`)

Restyle ; `trackException` et bouton `reset` inchangés ; message sobre (« Une couche a raté. On
réessaie ? »), lien d'accueil. **i18n** : `errors.*` + `system`.

### 7.20 Compte et authentification (WP-ACCOUNT, hors `(site)`)

- **Refresh visuel** : titres en `font-display`, cartes à filets `rounded-card`, champs
  `rounded-field`, aucune animation, aucune isoligne. **Corriger le `<main>` imbriqué** de
  `account/(dashboard)/layout.tsx` (→ `<div>`). `AccountNav` : rangée défilante en mobile,
  colonne `md:w-56` (inchangé).
- **À préserver** : `LoginForm` (mot de passe, **passkey + WebAuthn conditional UI**
  `autoComplete="username webauthn"`, 2FA TOTP/backup, OTP e-mail, **pas de `router.push`** quand
  better-auth répond `{ redirect, url }`, `next` interne uniquement, `reauth=admin`),
  `SocialButtons`, `RegisterForm` (`Signed Up`, e-mail prérempli), mot de passe oublié et
  réinitialisation, gardes de session du dashboard (`redirect` légitime dans le layout serveur),
  `AvatarPicker`, `SignOutButton`, commandes (`ReviewForm`, `ReorderButton`), devis (fil,
  `requestQuoteRevision`, `declineQuote`, **`QuotePayFlow`** avec `stripeAppearance`), profil,
  adresses, paiement, sécurité (passkeys, sessions, comptes liés, 2FA + QR `qrcode.react`), agents,
  notifications, confidentialité (export JSON, suppression nLPD), `_ui.ts`, NOINDEX.
- **i18n** : `account.*`, `auth.*` (clés existantes) + `accountUi` seulement pour un texte
  réellement nouveau.

### 7.21 OAuth et agents (WP-ACCOUNT)

`/oauth/consent` (requête signée, `ScopeList`, `ConsentForm` POST `/oauth2/consent`, avertissement
« non vérifié ») et `/agent/claim` (code à 6 chiffres, `confirmAgentClaim`/`denyAgentClaim`) :
restyle seulement, logique intacte. **i18n** : `agentAccess.*` (inchangé).

### 7.22 Légal `/legal/{terms,privacy,shipping}` (WP-ACCOUNT)

Typographie seulement : `.legal-prose` enfin définie dans un CSS Module de `legal-layout.tsx`
(mesure 68 caractères, sections numérotées « Art. 1 »…). **Contenus `content.tsx` intouchés**
(diff nul), `LEGAL_UPDATED` intouché (exporté, lu par le sitemap), avis « la version française fait
foi », `AnalyticsOptOut` dans la politique.

### 7.23 Admin (hors périmètre)

Aucun package ne modifie `src/app/[locale]/admin/**` (sauf le codemod `text-accent` de WP-00).
L'admin hérite des jetons, du header et du footer : WP-99 vérifie l'admin dans les deux thèmes
(contrastes, rayons) et corrige par les jetons seulement.

### 7.24 Autres surfaces

- `src/app/manifest.ts` (WP-00) : `background_color` `#f4f0e8`, `theme_color` `#1a1614`.
- `public/_headers` (WP-00) : `/posters/*` `Cache-Control: public, max-age=604800` ;
  `/studio/glyphs/*` `public, max-age=31536000, immutable` (fichier versionné `-v1`).
- E-mails transactionnels, pages HTML de désinscription, images OG par page : **inchangés en v1**
  (liste « plus tard ») ; l'OG par défaut reste `/brand/social/og-image.png`.

---

## 8. Inventaire des composants

Nature : **SSR** = rendu serveur (Server Component ou Client Component SSR sans import lourd) ;
**client** = îlot `"use client"` léger ; **lourd** = sous `src/motion/**`, atteint par une gate.

| Composant / module                                                                             | Fichier                                                                                                                                                                                                                            | Nature         | Package    | Utilisé par                                   |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------- | --------------------------------------------- |
| Polices                                                                                        | `src/app/fonts.ts`, `src/fonts/archivo-sx-latin.woff2`                                                                                                                                                                             | SSR            | WP-00      | layout                                        |
| Jetons et CSS global                                                                           | `src/app/globals.css`                                                                                                                                                                                                              | —              | WP-00      | tout                                          |
| `SiteShell`                                                                                    | `src/components/site-shell.tsx`                                                                                                                                                                                                    | client         | WP-00      | `(site)/layout.tsx`                           |
| Gates runtime                                                                                  | `src/gates/runtime.tsx` (`MotionRuntime`, `StageRoot`)                                                                                                                                                                             | client         | WP-00      | `SiteShell`                                   |
| Bridge                                                                                         | `src/lib/motion-bridge/{types,store,use-stage-view,motion-pref,tier}.ts`                                                                                                                                                           | léger          | WP-00      | tout le DOM animé                             |
| `StageView`                                                                                    | `src/components/ui/stage-view.tsx`                                                                                                                                                                                                 | client         | WP-00      | héros, chapitre 02, Studio, fiche             |
| `PageCut`                                                                                      | `src/components/ui/page-cut.tsx` (`<ViewTransition>`)                                                                                                                                                                              | SSR            | WP-00      | chaque page `(site)`                          |
| `SiteLink`                                                                                     | `src/components/ui/site-link.tsx` (`transitionTypes`, `useLinkStatus`)                                                                                                                                                             | client         | WP-00      | header, footer, CTA, cartes                   |
| `NavPending`                                                                                   | `src/components/ui/nav-pending.tsx`                                                                                                                                                                                                | client         | WP-00      | header                                        |
| `Button`, `ButtonLink`                                                                         | `src/components/ui/button.tsx` (primary, secondary, ghost, ink, text ; sm/md/lg)                                                                                                                                                   | SSR            | WP-00      | tout                                          |
| `Chip`, `ChipRadio`                                                                            | `src/components/ui/chip.tsx`                                                                                                                                                                                                       | SSR            | WP-00      | filtres, héros, Studio                        |
| `Field`, `fieldClass`                                                                          | `src/components/ui/field.tsx`                                                                                                                                                                                                      | SSR            | WP-00      | formulaires                                   |
| `Chapter`, `ChapterRail`                                                                       | `src/components/ui/chapter.tsx`, `chapter-rail.tsx`                                                                                                                                                                                | SSR / client   | WP-00      | accueil, Atelier, fiche                       |
| `DotTitle`                                                                                     | `src/components/ui/dot-title.tsx`                                                                                                                                                                                                  | SSR            | WP-00      | titres d'affichage                            |
| `MonoLabel`, `Num`                                                                             | `src/components/ui/mono.tsx`                                                                                                                                                                                                       | SSR            | WP-00      | télémétrie                                    |
| `MeasureStrip`                                                                                 | `src/components/ui/measure-strip.tsx`                                                                                                                                                                                              | SSR (props)    | WP-00      | héros, Studio, chapitre 02                    |
| `Ruler`                                                                                        | `src/components/ui/ruler.tsx` (SVG gradué)                                                                                                                                                                                         | SSR            | WP-00      | Studio, héros mobile                          |
| `MapFrame`                                                                                     | `src/components/ui/map-frame.tsx`                                                                                                                                                                                                  | SSR            | WP-00      | héros, footer                                 |
| `SpecTable`                                                                                    | `src/components/ui/spec-table.tsx` (`<dl>` à filets)                                                                                                                                                                               | SSR            | WP-00      | fiche, Studio, Atelier                        |
| `Drawer`                                                                                       | `src/components/ui/drawer.tsx` (`<dialog>`, verrou Lenis)                                                                                                                                                                          | client         | WP-00      | Studio, plus tard ailleurs                    |
| `Toast`                                                                                        | `src/components/ui/toast.tsx` (`aria-live`)                                                                                                                                                                                        | client         | WP-00      | Studio, favoris                               |
| Icônes maison                                                                                  | `src/components/ui/icons.tsx` (`StrataIcon` ; `NozzleIcon`, `LayerIcon`, `SummitIcon` retirés par WP-99)                                                                                                                           | SSR            | WP-00      | nav, Studio                                   |
| `MotionToggle`                                                                                 | `src/components/motion-toggle.tsx`                                                                                                                                                                                                 | client         | WP-00      | footer                                        |
| Header, Footer, BottomNav, Consent, PageHeader, BrandMark, ThemeToggle, LocaleSwitcher, Select | `src/components/*.tsx`                                                                                                                                                                                                             | SSR / client   | WP-00      | shell                                         |
| Contrats de données                                                                            | `src/lib/studio/types.ts`, `src/lib/studio/creations.ts`, `src/lib/quote-handoff.ts`                                                                                                                                               | léger          | WP-00      | Studio, favoris, sur mesure                   |
| Scripts de contrôle                                                                            | `scripts/check-worker-bundle.ts`, `scripts/chunk-report.ts`                                                                                                                                                                        | outil          | WP-00      | tous                                          |
| Cœur du Stage                                                                                  | `src/motion/stage/{stage-root.tsx,view-tracker.ts,loop.ts,bake.ts,controllers.ts,types.ts,geometry.ts}`                                                                                                                            | lourd          | WP-00      | scènes                                        |
| Matériau d'impression                                                                          | `src/motion/stage/materials/print-material.ts`, `src/motion/stage/glsl/*.ts`                                                                                                                                                       | lourd          | WP-00      | `print-hero`, `studio-object`                 |
| Registre des scènes (les stubs de WP-00 ont été retirés par WP-99)                             | `src/motion/stage/scenes/index.ts`                                                                                                                                                                                                 | lourd          | WP-00      | Stage                                         |
| GSAP, runtime                                                                                  | `src/motion/gsap.ts`, `src/motion/runtime.tsx`                                                                                                                                                                                     | lourd          | WP-00      | chorégraphies                                 |
| Géométrie Lavaux, noyau, stats, estimation, codecs, posters, STL                               | `src/lib/studio/{kernel/*,objects/lavaux.ts,profile.ts,patterns.ts,stats.ts,estimate.ts,pricing-params.ts,guards.ts,schemas.ts,url-state.ts,presets.ts,filaments.ts,camera.ts,format.ts,poster.ts,stl.ts,band-stats.ts}`           | pur TS         | WP-01      | tous les consommateurs 3D et SSR              |
| Posters de champ                                                                               | `scripts/gen-field-posters.ts` → `public/posters/field-*-{light,dark}.svg`                                                                                                                                                         | outil          | WP-01      | footer, 404, contact, accueil                 |
| Texte 3D, objets plats                                                                         | `src/lib/studio/{text/*,objects/cartouche.ts,objects/relief.ts,objects/borne.ts}`, `scripts/fonts/*`, `public/studio/glyphs/*`                                                                                                     | pur TS         | WP-02      | Studio, chapitre 02                           |
| `QuoteRequestForm`, `StudioAttachmentCard`                                                     | `src/components/quote/*.tsx`                                                                                                                                                                                                       | client         | WP-QUOTE   | `/custom`, tiroir du Studio                   |
| Upload client                                                                                  | `src/lib/quote-upload-client.ts`                                                                                                                                                                                                   | léger          | WP-QUOTE   | formulaires de devis                          |
| `StudioApp` et contrôles                                                                       | `src/components/studio/{studio-app,param-slider,band-editor,pattern-radio,swatch-radio,view-switch,measure-bar,printable-badge,studio-tools,studio-actionbar,send-drawer,elevation-view,object-card,studio-form-ssr}.tsx`          | SSR / client   | WP-STUDIO  | pages Studio, chapitre 02                     |
| Gates Studio                                                                                   | `src/gates/studio.tsx` (`StudioEngine`, `StudioChoreo`)                                                                                                                                                                            | client         | WP-STUDIO  | `StudioApp`                                   |
| Moteur et Worker                                                                               | `src/motion/studio/{engine.tsx,geometry.worker.ts,channel.ts}`                                                                                                                                                                     | lourd          | WP-STUDIO  | Studio, chapitre 02                           |
| Scène Studio                                                                                   | `src/motion/stage/scenes/studio-object.ts`                                                                                                                                                                                         | lourd          | WP-STUDIO  | Studio, chapitre 02                           |
| Composants de l'accueil                                                                        | `src/components/home/*` (`hero`, `hero-poster`, `hero-controls`, `hero-telemetry`, `chapter-map`, `chapter-summit`, `chapter-studio`, `chapter-shop`, `chapter-atelier`, `chapter-file`, `home-config-context`, `home.module.css`) | SSR / client   | WP-HOME    | accueil                                       |
| Gates et chorégraphie de l'accueil                                                             | `src/gates/home.tsx`, `src/motion/choreo/home.tsx`                                                                                                                                                                                 | client / lourd | WP-HOME    | accueil                                       |
| Scènes de l'accueil                                                                            | `src/motion/stage/scenes/{print-hero,contour-field}.ts`, `src/motion/stage/materials/field-material.ts`                                                                                                                            | lourd          | WP-HOME    | accueil                                       |
| Catalogue                                                                                      | `src/components/{product-card,product-gallery,product-purchase,add-to-cart,favorite-button,multicolor-dots,star-rating}.tsx`, `src/components/catalog/{attribution-block,product-plate,registry-table,studio-row}.tsx`             | SSR / client   | WP-SHOP    | boutique, fiche, accueil, admin (star-rating) |
| Attribution, JSON-LD                                                                           | `src/lib/attribution.ts`, `src/lib/seo.ts` (`productJsonLd`)                                                                                                                                                                       | léger          | WP-SHOP    | fiche                                         |
| Viewer produit                                                                                 | `src/motion/stage/scenes/product-viewer.ts`, `src/gates/product.tsx`, `src/motion/choreo/{product,shop}.tsx`                                                                                                                       | lourd          | WP-SHOP    | fiche, boutique                               |
| Atelier, contact                                                                               | `src/app/[locale]/(site)/{a-propos,contact}/**`, `src/gates/about.tsx`, `src/motion/choreo/about.tsx`                                                                                                                              | SSR / lourd    | WP-ABOUT   | Atelier, contact                              |
| Utilitaires                                                                                    | `src/app/[locale]/{cart,checkout,track,favorites}/**`, `not-found.tsx`, `error.tsx`, `src/components/{cart-reminder,cart-recovery,cart-link-import,guest-email-verification}.tsx`, `src/lib/{stripe-appearance.ts,favorites.tsx}`  | SSR / client   | WP-UTILITY | tunnel, suivi                                 |
| Compte, auth, légal                                                                            | `src/app/[locale]/{account,oauth,agent,legal}/**`                                                                                                                                                                                  | SSR / client   | WP-ACCOUNT | compte                                        |
| WebMCP                                                                                         | `src/components/webmcp-tools.tsx` (+ `studio_configure`)                                                                                                                                                                           | client         | WP-STUDIO  | layout                                        |

---

## 9. Work packages (agents parallèles)

### 9.1 Graphe et jalons

```
WP-00 Fondation
 ├──▶ WP-01 Géométrie : noyau, Lavaux, stats, codecs, posters ──▶ WP-02 Texte 3D, Cartouche, Relief, Borne ──┬──▶ WP-HOME
 │                                                                                                          └──▶ WP-STUDIO ◀── WP-QUOTE
 ├──▶ WP-QUOTE   Sur mesure + formulaire de devis partagé
 ├──▶ WP-SHOP    Boutique, fiche produit, attribution, viewer
 ├──▶ WP-ABOUT   Atelier, contact
 ├──▶ WP-UTILITY Panier, checkout (visuel), succès, suivi, favoris, 404, erreur
 └──▶ WP-ACCOUNT Compte, auth, OAuth, agents, légal
                                                           tous ──▶ WP-99 Intégration, mesures, docs, revue
```

- Après WP-00, **six packages démarrent en parallèle** : WP-01, WP-QUOTE, WP-SHOP, WP-ABOUT,
  WP-UTILITY, WP-ACCOUNT. WP-02 suit WP-01 ; WP-HOME suit WP-02 ; WP-STUDIO suit WP-02 et WP-QUOTE.
- Chemin critique : WP-00 → WP-01 → WP-02 → WP-STUDIO → WP-99 (l'axe du propriétaire d'abord).
- **Jalons de validation du propriétaire** (sur la preview, §11.2) : **J0** après WP-00 (jetons,
  polices, header, footer, mouvement réduit, noms) ; **J1** après WP-STUDIO (Studio complet et une
  vraie demande de devis envoyée depuis la preview) ; **J2** après WP-HOME et WP-SHOP ; **J3**
  après WP-99 (revue finale, puis fusion dans `main` en une fois et vérification du déploiement,
  règle d'or 9).
- Ordre de fusion dans `claude/redesign-2026` : celui du graphe ; un package parallèle rebase sur
  la branche d'intégration avant de fusionner. Aucun conflit n'est attendu si la propriété des
  fichiers est respectée.

### 9.2 Propriété des fichiers (seul le propriétaire édite ; tout le monde peut importer)

| Package        | Possède (édite, crée ou supprime)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WP-00**      | `package.json`, `bun.lock` ; `.oxlintrc.json` ; `src/app/globals.css`, `src/app/fonts.ts`, `src/fonts/**`, `src/app/manifest.ts` ; `src/app/[locale]/layout.tsx`, `src/app/[locale]/(site)/layout.tsx` et **le déplacement** (`git mv`, sans modification) de `page.tsx`, `shop/`, `products/`, `custom/`, `a-propos/`, `contact/` dans `(site)/` ; `src/i18n/request.ts`, `src/i18n/namespaces.ts`, `src/i18n/messages.test.ts` ; `messages/{fr,de,it,en}.json` (correction du ß seulement) ; création des 36 fichiers `messages/<locale>/<ns>.json` (vides) et contenu de `messages/*/shell.json` ; `src/lib/motion-bridge/**` ; `src/lib/studio/types.ts`, `src/lib/studio/creations.ts`, `src/lib/studio/texts-store.ts`, `src/lib/quote-handoff.ts` (+ tests) ; `src/lib/analytics.ts` (+ test) ; `src/gates/runtime.tsx`, `src/gates/boundary.test.ts` ; `src/motion/gsap.ts`, `src/motion/runtime.tsx`, `src/motion/stage/*` (cœur), `src/motion/stage/materials/print-material.ts`, `src/motion/stage/glsl/**`, `src/motion/stage/scenes/index.ts` et les **stubs** des 4 scènes (transférés ensuite) ; `src/components/{header,footer,bottom-nav,consent-banner,brand-mark,page-header,theme-toggle,locale-switcher,select,site-shell,motion-toggle}.tsx`, `src/components/ui/**` ; le **codemod `text-accent` → `text-accent-text`** sur tout `src/**` (une fois) ; `public/_headers` ; placeholders `public/posters/field-{footer,404,leman,home}-{light,dark}.svg` (transférés à WP-01) ; `scripts/check-worker-bundle.ts`, `scripts/chunk-report.ts` ; `AGENTS.md` (nouvelle règle d'or « frontière motion ») et `docs/conventions.md` (motion, i18n, jetons) |
| **WP-01**      | `src/lib/studio/**` sauf `types.ts` (ajouts seulement), `creations.ts`, `texts-store.ts` : `kernel/**`, `objects/lavaux.ts`, `profile.ts`, `patterns.ts`, `stats.ts`, `estimate.ts`, `pricing-params.ts`, `guards.ts`, `schemas.ts`, `url-state.ts`, `presets.ts`, `filaments.ts`, `camera.ts`, `format.ts`, `poster.ts`, `stl.ts`, `band-stats.ts` et leurs tests ; `scripts/gen-field-posters.ts` ; `public/posters/**` ; `messages/*/studioCore.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **WP-02**      | reprend la propriété de `src/lib/studio/**` (mêmes exclusions) **après la fusion de WP-01** : `text/**`, `objects/{cartouche,relief,borne}.ts`, extensions de `stats.ts`, `guards.ts`, `schemas.ts`, `presets.ts`, `poster.ts`, `manifold.test.ts` ; `scripts/fonts/**` ; `public/studio/glyphs/**` ; `public/posters/relief-*` ; `messages/*/studioCore.json` (ajouts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **WP-QUOTE**   | `src/app/[locale]/(site)/custom/**` (**`actions.ts` : logique inchangée**) ; `src/components/quote/**` ; `src/lib/quote-upload-client.ts` (+ test) ; `messages/*/quote.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **WP-SHOP**    | `src/app/[locale]/(site)/shop/**`, `src/app/[locale]/(site)/products/**` ; `src/components/{product-card,product-gallery,product-purchase,add-to-cart,favorite-button,multicolor-dots,star-rating,product-color-context}.tsx`, `src/components/catalog/**` ; suppression de `src/components/product-viewer-3d.tsx` et `src/components/showroom-scene.ts` ; `src/lib/attribution.ts` (+ test) ; `src/lib/seo.ts` (**`productJsonLd` seulement**) et `src/lib/seo.test.ts` ; `src/motion/stage/scenes/product-viewer.ts` ; `src/gates/product.tsx` ; `src/motion/choreo/{product,shop}.tsx` ; `messages/*/catalog.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **WP-ABOUT**   | `src/app/[locale]/(site)/a-propos/**`, `src/app/[locale]/(site)/contact/**` ; `src/gates/about.tsx` ; `src/motion/choreo/about.tsx` ; `messages/*/atelier.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **WP-UTILITY** | `src/app/[locale]/{cart,checkout,track,favorites}/**` ; `src/app/[locale]/not-found.tsx`, `src/app/[locale]/error.tsx` ; `src/components/{cart-reminder,cart-recovery,cart-link-import,guest-email-verification}.tsx` ; `src/lib/stripe-appearance.ts`, `src/lib/favorites.tsx` ; `messages/*/system.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **WP-ACCOUNT** | `src/app/[locale]/{account,oauth,agent,legal}/**` (**`legal/*/content.tsx` et `LEGAL_UPDATED` intouchés**) ; `messages/*/accountUi.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **WP-STUDIO**  | `src/app/[locale]/(site)/studio/**` ; `src/components/studio/**` ; `src/gates/studio.tsx` ; `src/motion/studio/**` ; `src/motion/stage/scenes/studio-object.ts` ; `src/motion/choreo/studio.tsx` ; `src/components/webmcp-tools.tsx` ; `src/app/sitemap.xml/route.ts`, `src/app/robots.txt/route.ts`, `src/app/llms.txt/route.ts` ; `messages/*/studio.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **WP-HOME**    | `src/app/[locale]/(site)/page.tsx` ; `src/components/home/**` ; suppression de `src/components/hero-scene.tsx` ; `src/gates/home.tsx` ; `src/motion/choreo/home.tsx` ; `src/motion/stage/scenes/{print-hero,contour-field}.ts` ; `src/motion/stage/materials/field-material.ts` ; `messages/*/landing.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **WP-99**      | nettoyage transversal après fusion de tous : suppression de `src/components/reveal.tsx` et des composants devenus inutiles, clés mortes de `messages/*.json`, entrée temporaire d'oxlint ; `docs/codemap.md`, `docs/architecture.md`, `README.md`, `ROADMAP.md`, `LICENSE.md` (crédits GSAP, OFL) ; corrections de jetons pour l'admin ; aucune autre refonte                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

**Non attribués (personne n'y touche)** : `src/app/[locale]/admin/**` (hors codemod), `src/app/api/**`,
`src/db/**`, `src/middleware.ts`, `src/lib/{auth,orders,cart,shipping,…}.ts` (logique),
`wrangler.jsonc`, `next.config.ts`, `open-next.config.ts`, `drizzle*/**`, `workers/**`.

**Contrat de vue « objet Studio »** (permet à WP-HOME d'utiliser la scène de WP-STUDIO sans
dépendre de son calendrier) :

```ts
// ajout à src/lib/motion-bridge/types.ts (WP-00)
export interface StudioObjectViewProps {
  config: import("@/lib/studio/types").StudioConfig;
  texts: import("@/lib/studio/types").StudioTexts;
  view: "orbit" | "plan";
  cutZ: number | null;                         // null = objet entier
  exploded: boolean;
  simulate?: { speed: 1 | 10 | 100; startedAt: number } | null;
  autoRotate?: boolean;
}
// ajout à MotionBridgeState :
studio: { exportStl(config: StudioConfig, texts: StudioTexts, name: string): Promise<{ blob: Blob; triangles: number; bytes: number }> } | null;
```

La scène `studio-object` construit elle-même ses maillages par le Worker partagé
(`src/motion/studio/worker-client.ts`). Tant que WP-STUDIO n'est pas fusionné, le stub de
WP-00 affiche un volume neutre et le poster SSR reste visible : l'accueil fonctionne quand même.

### 9.3 Fiches des packages

#### WP-00 · Fondation (dépend de : rien ; effort ≈ 3–4 sessions)

**Objectif** : poser tout ce qui est transversal pour que les autres packages ne se marchent
jamais dessus.

**Étapes, dans l'ordre :**

1. **Mesures de référence** sur `claude/redesign-2026` avant tout changement :
   `bunx opennextjs-cloudflare build` puis `bunx wrangler deploy --dry-run` (noter `Total Upload …
gzip`) ; `bun scripts/chunk-report.ts` ; Lighthouse mobile de `/fr`, `/fr/shop`,
   `/fr/products/vase-spirale` sur `bun run preview`. Consigner dans le compte rendu.
2. **Paquets** (§4.7), puis `bun run typecheck`.
3. **Garde-fous** : `.oxlintrc.json` (§4.6), `src/gates/boundary.test.ts`, les deux scripts.
4. **Groupe `(site)`** par `git mv` (§4.2), `(site)/layout.tsx`, `SiteShell`. Vérifier les 8 routes,
   `sitemap.xml`, 404.
5. **Jetons, polices, `globals.css`** (§2.5), `src/app/fonts.ts`, `manifest.ts`, `_headers`, puis le
   **codemod** `text-accent` sur `src/**/*.{ts,tsx}` (script Bun jetable, non commité ; relire le
   diff fichier par fichier ; `text-accent-dark` et les autres utilitaires `*-accent` ne bougent pas) :

   ```ts
   // Remplace text-accent (avec ses préfixes hover:, md:… et son éventuel /opacité) par text-accent-text.
   const re = /(^|[\s"'`:])text-accent(?=[\s"'`/]|$)/gm;
   const out = source.replace(re, "$1text-accent-text");
   ```

   Enfin, suppression du halo rouge du `body`.

6. **i18n** : `namespaces.ts`, `request.ts` (§4.9), 36 fichiers, `shell.json` dans les 4 langues,
   correction « Schließen » → « Schliessen », `messages.test.ts`.
7. **Bridge et contrats** (§4.5, §9.2) avec tests (store, `creations`, `quote-handoff`,
   `texts-store`, `tier`).
8. **Runtime et Stage** : `gsap.ts`, `runtime.tsx`, gates, cœur du Stage, matériau d'impression
   (annexe A), registre et stubs des scènes, `bake`, contrôleurs, perte de contexte, déclassement.
   Démonstration interne : une page de test **non commitée** (ou un stub visible seulement en dev)
   pour valider scissor, bake et thème.
9. **Chrome** : header, BottomNav, footer, consentement, `PageHeader`, `Select`, primitives
   `src/components/ui/**`, `MotionToggle`, script anti-FOUC (§4.3), `PageCut` et CSS « Coupe ».
10. **Analytics** : `sanitizeUrl` retire `#c=` ; `Quote Requested` accepte `source`/`object` (types).
11. **Docs** : ajouter à `AGENTS.md` une règle d'or « frontière motion » (`src/motion/**` +
    `src/gates/**`, bridge, `(site)`, i18n par namespaces) et mettre à jour `docs/conventions.md`.

**Critères d'acceptation (en plus du §10)** :

- Worker : ≤ base + 20 KiB gzip ; `check-worker-bundle` : 0 signature.
- Sur `(site)` : `html.lenis` présent en mouvement complet desktop, absent en réduit et sur
  `/cart`, `/checkout`, `/account`, `/admin`, `/track`, `/favorites`, `/legal/*`.
- Aucune page sans vue ne télécharge le chunk three (onglet Réseau sur `/fr/contact`).
- La transition « Coupe » joue entre deux pages de `(site)` depuis la nav (Chrome, Safari), pas au
  bouton retour, pas en mouvement réduit ; le header ne bouge pas.
- Contrastes du §2.1 respectés sur header, footer, consentement dans les deux thèmes ; admin
  lisible (capture des pages admin principales dans le compte rendu).
- `messages.test.ts` vert (parité, ICU, zéro ß) ; `boundary.test.ts` vert.
- Le script anti-FOUC pose `data-motion` avant le paint (pas de flash) ; `MotionToggle` bascule
  sans rechargement.

#### WP-01 · Géométrie : noyau, Lavaux, statistiques, codecs, posters (dépend de : WP-00 ; ≈ 2–3 sessions)

**Livrables** : tout le §6.3.1, §6.3.2, §6.4 (bandes, `band-stats.ts`), §6.5, §6.6 (règles
Lavaux + `nearVaseSpirale`), §6.8 (schémas zod, fragment, GET), `presets.ts` (`HERO_CONFIG`,
`HERO_PATTERNS`, `HERO_PALETTES`, défauts des 4 objets, préréglages), `camera.ts` (cadrage du héros
partagé avec le Stage), `poster.ts` (héros `ghost`/`final`/`exploded`, Élévation Lavaux),
`stl.ts`, `format.ts`, `scripts/gen-field-posters.ts` (FBM périodique + `d3-contour` → SVG clair et
sombre pour footer, 404, Léman, accueil mobile), namespace `studioCore`.

**Critères** :

- Tests : variété sur 200 configurations Lavaux ; déterminisme (même entrée → mêmes octets) ;
  `nearVaseSpirale` faux pour tous les préréglages et 1 000 tirages « Surprenez-moi », vrai pour
  « nervures 40, torsion 120°, col 0,5 » ; `computeStats` du héros dans ±2 % d'une intégration
  fine ; `estimate` en centimes entiers, arrondi à 50, plancher respecté, `null` si
  `validated: false` ; fragment aller-retour, rejet des clés inconnues, **aucune clé de texte
  acceptée** ; STL `84 + 50n`, en-tête sans « solid ».
- Performance (Node, machine de dev) : `drag` ≤ 8 ms, `display` C2 ≤ 40 ms, `export` ≤ 400 ms.
- Posters : `ghost` ≤ 6 Ko, `final` ≤ 8 Ko ; champs SVG ≤ 60 Ko chacun.
- Aucun import de `three` dans `src/lib/studio/**` (vérifié par le test de frontière).

#### WP-02 · Texte 3D et objets plats (dépend de : WP-01 ; ≈ 2–3 sessions)

**Livrables** : chaîne de glyphes (§6.3.3 : instance statique, script `build-glyphs.ts`, JSON
`s3d-relief-v1.json`, `OFL.txt`), `text/{glyphs,layout,shapes}.ts`, `kernel/extrude.ts` complété,
objets Cartouche, Relief (avec `peakLabel(name, locale)` et `peakAltitude(name)`), Borne ;
statistiques, garde-fous et posters (vue de dessus SSR ; relief par défaut en fichiers clair et
sombre) de ces trois objets ; `RELIEF_DEFAULT` et préréglages.

**Critères** :

- Tous les caractères du jeu se triangulent sans erreur (test sur le jeu complet, dont Ł, Œ, Ç ;
  le glyphe ß reste accepté dans un nom saisi, la règle « sans ß » ne vise que nos textes de-CH) ;
  les caractères hors jeu sont refusés avec le bon message.
- Variété sur 200 configurations par objet (par coque) ; gravure sans chevauchement de glyphes.
- Garde-fous de texte : trait < 0,8 mm → avertissement, < 0,6 mm → erreur, ajustement automatique
  jusqu'aux minima, puis `text-fit`.
- Glyphes ≤ 45 KiB gzip ; `display` d'une Cartouche ≤ 25 ms dans Node.

#### WP-QUOTE · Sur mesure et formulaire partagé (dépend de : WP-00 ; ≈ 1 session)

**Livrables** : `QuoteRequestForm` (contrat du §7.10), `uploadQuoteFile`, carte « Configuration
Studio jointe » (lecture de `readQuoteHandoff()`), page `/custom` restylée, messages 429/413/415,
`Quote Requested` avec `source`, namespace `quote`.

**Critères** : le formulaire marche **sans JS** (description seule) ; avec JS, un envoi avec
fichier réussit en local sur `bun run preview` (clé `quotes/…`, ligne `quote_requests` dans la
base de développement ; voir §10 pour les e-mails) ; un faux `QuoteHandoff` dans `sessionStorage`
préremplit la page ; `actions.ts` a un diff vide ; `customServiceJsonLd` intact ; rate limits
inchangés.

#### WP-SHOP · Boutique, fiche, attribution, viewer (dépend de : WP-00 ; ≈ 2–3 sessions)

**Livrables** : §7.8 et §7.9 (planche N = 1, grille et Registre, cartes, morph, chapitres de la
fiche, `AttributionBlock` en 4 langues, `attributionFor`, `productJsonLd` + `subjectOf 3DModel`,
scène `product-viewer` rotation seule, chargement différé du STL, suppression de l'ancien viewer),
namespace `catalog`.

**Critères** :

- `curl` de `/fr/products/vase-spirale` (et `/de`, `/it`, `/en`) : le HTML SSR contient « Ian »,
  « CC BY-ND 4.0 », `https://makerworld.com/fr/models/1262112-vase` et le lien du deed ; le JSON-LD
  valide au validateur schema.org (Product avec `subjectOf` de type `3DModel`), fiche Google sans
  nouvelle erreur.
- Le viewer ne propose ni zoom, ni coupe, ni teinte hors couleurs vendues ; un seul contexte WebGL
  sur la page ; STL non téléchargé tant que la section est loin.
- Événements `Product Viewed`, `Products Searched`, `Product List Filtered`, `Product Added`
  identiques (noms et propriétés) ; filtres fonctionnels sans JS ; canonical `/shop`.
- Grille testée avec le catalogue démo de la preview (6 produits) et à N = 1.

#### WP-ABOUT · Atelier et contact (dépend de : WP-00 ; ≈ 1–2 sessions)

**Livrables** : §7.11, §7.12, chorégraphie `about` (DrawSVG des schémas à l'entrée, en mouvement
complet), abandon de `Reveal` sur ces pages, namespace `atelier`.

**Critères** : FAQ présente dans le HTML sans JS et dans `faqJsonLd` ; ancres et section active de
l'AboutNav justes (header de 64 px) ; honeypot et envoi du formulaire de contact inchangés ; aucun
contenu d'`ABOUT_CONTENT` modifié.

#### WP-UTILITY · Panier, checkout (visuel), succès, suivi, favoris, 404, erreur (dépend de : WP-00 ; ≈ 1–2 sessions)

**Livrables** : §7.13 à §7.19, `stripeAppearance` resynchronisé, onglet « Mes créations »,
correctif de `favorites.tsx`, namespace `system`.

**Critères** : **paiement de test Stripe complet en local** (`bun run preview` sur localhost, clé
publiable et secrète **de test** de `.dev.vars`, carte de test publiée par Stripe) jusqu'à
`/checkout/success`, avec `Order Completed` émis une fois ; Payment Element lisible dans les deux
thèmes ; aucun Lenis ni canvas sur ces routes ; relance de panier (case décochée) et import
`?item=` fonctionnels ; `/track` fonctionne avec une commande de test ; 404 réelle (statut 404).
Le propriétaire refait le paiement de test sur la preview déployée au jalon J2.

#### WP-ACCOUNT · Compte, auth, OAuth, agents, légal (dépend de : WP-00 ; ≈ 1 session)

**Livrables** : §7.20 à §7.22.

**Critères** : connexion par mot de passe vérifiée **en local** avec un compte de test créé pour
l'occasion (identifiants consignés dans `.dev.vars` ou le seed, jamais dans le compte rendu) ;
écrans passkey et 2FA rendus sans régression (le parcours complet passkey/2FA est refait par le
propriétaire au jalon J3) ; flux OAuth de consentement intact ; `<main>` unique (vérifié dans le
HTML) ; diff nul sur `legal/*/content.tsx` ; paiement d'un devis (`QuotePayFlow`) toujours rendu.

#### WP-STUDIO · Le Studio (dépend de : WP-01, WP-02, WP-QUOTE ; ≈ 4–5 sessions)

**Livrables** : tout le §6 côté produit : routes SSR (index, objet, formulaire GET sans JS),
`StudioApp` (état, historique, fragment, textes en `sessionStorage`), contrôles, barre
altimétrique, bande de mesure, badge Imprimable et corrections, vues (3/4, Plan, Élévation,
Couches avec réglette Z et simulation), éclaté, outils (Annuler, Rétablir, Surprenez-moi,
Copier le lien, Garder), barre Studio mobile, tiroir d'envoi (export, upload, cache, Server
Action, attente narrée, erreurs), repli `/custom#studio`, Worker et `worker-client`, scène
`studio-object`, `StudioEngine` (`bridge.studio.exportStl`), WebMCP `studio_configure`, sitemap,
robots, `llms.txt`, événements, namespace `studio`.

**Critères** :

- Parcours complet **en local** (`bun run preview`) : régler un Lavaux 3 bandes → « Envoyer à
  l'atelier » → fichier `quotes/…stl` dans le R2 local, demande enregistrée avec la description
  attendue (§6.9) ; même chose pour une Cartouche avec texte. Le propriétaire refait un envoi réel
  sur la preview déployée au jalon J1.
- Le STL s'ouvre dans Bambu Studio aux bonnes dimensions (mm, Z vers le haut) et se tranche sans
  réparation ; 1–3 Mo pour le vase par défaut.
- **Aucun texte personnel** dans l'URL, le fragment, les événements PostHog (inspection réseau) ni
  dans le HTML non masqué ; le lien copié rouvre la même forme avec le texte d'exemple.
- INP ≤ 150 ms (glissé de curseur, frappe, « Envoyer ») en CPU ×4 ; aucune tâche longue > 50 ms
  sur le fil principal pendant un glissé.
- Fonctionne en C0 (WebGL désactivé) : Élévation, stats, export et devis ; fonctionne sans JS
  (formulaire GET, poster, lien de devis) ; en mouvement réduit, la 3D se met à jour sans animation.
- `nearVaseSpirale` bloque l'envoi avec le message prévu ; badge et corrections fonctionnels.
- 429 simulé (onze envois) → message clair, pas de second upload pour une configuration inchangée.
- Clavier seul : tous les réglages, la barre altimétrique et le tiroir sont utilisables ; résumé
  `aria-live` correct.

#### WP-HOME · Accueil (dépend de : WP-01, WP-02 ; ≈ 3–4 sessions)

**Livrables** : §5 en entier et §7.5 : page, `HeroPoster`, contrôles, télémétrie, contexte
`HomeConfig`, chapitres 01 à 06, chorégraphie `home` (intro, pin, bascule, SplitText des titres
de chapitre, éclaté à l'entrée), scènes `print-hero` et `contour-field` (+ `field-material`),
suppression de `hero-scene.tsx`, namespace `landing`.

**Critères** :

- Lighthouse mobile (preview) : LCP ≤ 2,0 s avec le **h1** comme élément LCP, CLS ≤ 0,05 ;
  desktop idem.
- Premier écran : raccord poster → canvas sans saut visible ; premier changement de filament
  avant tout scroll (≈ 2,4 s) ; intro ≤ 3,2 s.
- Pin seulement ≥ 1024 × 768 ; aucun pin sur mobile ; « Passer l'animation » au clavier.
- Palette et motif : INP ≤ 100 ms, vague et réimpression continues.
- Chapitre 02 : la saisie ne part nulle part (réseau vide), le texte arrive dans le Studio par
  `sessionStorage` ; la saisie n'est dans aucune section pinnée.
- Mouvement réduit : aucun mouvement, posters finaux, contrôles instantanés ; C0 : idem avec la
  bascule dessin → matière en 2D.
- Chunk `print-hero` ≤ 15 KiB, `contour-field` ≤ 10 KiB, `home` ≤ 15 KiB (gzip).

#### WP-99 · Intégration, mesures, documentation, revue (dépend de : tous ; ≈ 1–2 sessions)

**Étapes** : fusion finale ; nettoyage (§9.2) ; mesures complètes (Worker, chunks, Lighthouse
des pages principales, INP, contexte WebGL unique, replays PostHog de 3 parcours) ; audit des
**actions PostHog** fondées sur des sélecteurs ou des textes (projet 285063, via le connecteur
PostHog) et liste de celles à recréer ; vérification des 4 langues sur chaque page (longueurs DE) ;
revue de l'admin dans les deux thèmes ; docs ; checklist du propriétaire (§11) ; après
validation J3 seulement : PR vers `main`, CI verte (`quality`, « Workers Builds »), fusion,
**vérification que le Worker de prod a bien été redéployé** (`modified_on`), repli manuel sinon.

---

## 10. Critères d'acceptation communs (tous les packages)

1. `bun run lint`, `bun run typecheck`, `bun run test`, `bun run format:check` : verts.
2. `src/i18n/messages.test.ts` vert : 4 locales complètes, arguments ICU identiques, aucun ß.
3. `bunx opennextjs-cloudflare build` réussit ; `bunx wrangler deploy --dry-run` : Worker gzip
   dans le budget du §4.11 (valeur notée dans le compte rendu) ; `bun scripts/check-worker-bundle.ts` :
   0 signature three, gsap, lenis.
4. `bun run preview` (CSP de production avec nonce) : aucune violation CSP ni erreur
   d'hydratation dans la console sur les pages touchées.
5. **Mouvement réduit** (préférence OS **et** interrupteur du footer) : pages utilisables, contenu
   dans son état final, ni Lenis, ni pin, ni scrub.
6. **Mobile** 375 × 812 (émulation tactile) : pas de défilement horizontal, BottomNav ou barre
   Studio, consentement et `safe-area` corrects, aucun pin.
7. **Thème sombre** : contrastes du §2.1, aucun flash blanc sur les chapitres « encre ».
8. **Clavier** : tout est atteignable, focus visible, liens d'évitement fonctionnels.
9. **SSR** : `curl` montre le contenu, un seul h1, JSON-LD intact ; aucun contenu important
   visible seulement dans un canvas.
10. **Analytics** : événements existants inchangés (noms, propriétés) ; nouveaux conformes au
    §4.10 ; aucun texte personnel dans une URL ou un événement.
11. `git diff --name-only` ne contient **que** des fichiers possédés par le package (§9.2).
12. Rien n'est poussé sur `main`. Compte rendu : captures desktop et mobile, mesures, demandes
    hors périmètre.
13. **Parcours testés en local seulement** (`bun run dev` ou `bun run preview` sur localhost),
    avec des valeurs de test (comptes de test, clés Stripe de test, cartes de test publiées par
    Stripe) ; aucune valeur de test recopiée dans le compte rendu. Avant tout envoi de formulaire
    qui déclenche l'outbox (devis, contact), vérifier que `RESEND_API_KEY` est absent du
    `.dev.vars` du worktree : sinon un vrai e-mail part vers l'admin (prévenir le propriétaire
    plutôt que de l'envoyer). Les parcours sur la preview déployée sont faits par le propriétaire
    aux jalons J0–J3.

---

## 11. Décisions et assets demandés au propriétaire

### 11.1 Ce qui ne dépend de personne (Tier A)

Tout le v1 se construit **sans aucun nouvel asset** : géométries procédurales, posters SVG
générés, shaders, polices libres, photos existantes du Vase spirale. **Aucun changement de CSP,
aucun changement de schéma de base de données**, aucun service tiers nouveau.

### 11.2 Décisions minimales (avec la valeur par défaut si vous ne répondez pas)

| #   | Décision                                                                                                                                                                                                                                                                                                                       | Défaut appliqué sans réponse                                              | Quand                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | Valider la direction : palette du §2.1, Archivo SemiExpanded pour les titres, noms « Studio », « Lavaux », « Cartouche », « Relief », « Borne », libellé « Atelier » pour `/a-propos`                                                                                                                                          | on construit avec ces choix                                               | J0                                       |
| 2   | **Inventaire réel des bobines** (marque, nom, hex, matière)                                                                                                                                                                                                                                                                    | palette indicative + mention « Teintes indicatives »                      | avant J1                                 |
| 3   | **Coefficients de prix** (table `PRICING`, §6.5)                                                                                                                                                                                                                                                                               | aucun CHF affiché (grammes, durée, changements)                           | quand vous voulez ; active la fourchette |
| 4   | Politique de modération des textes (phrase proposée au §6.6) et mention du stockage local du Studio dans la politique de confidentialité (4 langues)                                                                                                                                                                           | phrase de modération affichée ; politique inchangée                       | avant J1                                 |
| 5   | **Preview dédiée** à la refonte (3ᵉ Worker `swiss3design-redesign` ou URL de version) et, sur la branche Neon preview, réinjection du Vase spirale avec `model_3d_url`, photos et STL copiés dans le bucket R2 preview                                                                                                         | revues sur la preview partagée, autres branches gelées pendant les revues | avant J0                                 |
| 6   | Valider les accroches (annexe C), dont « Pointe {nom} » (DE « Piz », IT « Pizzo », EN « Mount »)                                                                                                                                                                                                                               | textes de l'annexe C                                                      | J2                                       |
| 7   | Mise en ligne en une fois après J3 (recommandé, les jetons changent partout) ou progressive                                                                                                                                                                                                                                    | en une fois                                                               | J3                                       |
| 8   | Options : police suisse premium (licence web) ; redessin vectoriel du mark (changement de marque) ; session Blender (§11.4) ; une image ChatGPT (§11.3) ; imprimer et peser 3 pièces Studio (Lavaux du héros, une Cartouche, un Relief) pour calibrer l'estimation à ±8 % et obtenir les premières photos multicolores réelles | rien de tout cela ; le site est complet sans                              | après J1                                 |

### 11.3 Image ChatGPT (une seule, facultative, étiquetée « Illustration »)

Usage : en-tête du chapitre « L'équipement » de l'Atelier et fond discret du chapitre 05 de
l'accueil. Jamais pour montrer un produit.

> **Prompt (à coller tel quel)** : « Gravure cartographique monochrome à l'encre sépia (#6A4E35)
> sur papier crème légèrement texturé (#F4F0E8). Vue aérienne oblique, à l'aube, des terrasses
> viticoles de Lavaux qui descendent vers le lac Léman, rendue uniquement par des hachures fines
> et de fines courbes de niveau régulièrement espacées, comme une ancienne feuille de carte
> nationale suisse. Lumière rasante venant du nord-ouest (en haut à gauche), brume basse sur le
> lac, Alpes savoyardes à peine esquissées à l'horizon. Aucune personne, aucun bateau, aucun
> bâtiment reconnaissable, aucun texte, aucune lettre, aucun chiffre, aucun logo, aucun drapeau,
> aucune croix. Grand espace calme et vide dans le tiers supérieur pour du texte. Format paysage
> 3:2, 3000 × 2000 pixels. »

Livraison : PNG à WP-99, converti en AVIF et WebP (≤ 180 Ko à 1600 px de large), rangé dans
`public/illustrations/lavaux-gravure.{avif,webp}`, texte alternatif dans les 4 langues, légende
visible « Illustration ».

### 11.4 Rendus Blender 5.2 (facultatifs, via le MCP, étiquetés « Rendu »)

Prérequis : ouvrir Blender, démarrer l'add-on MCP (panneau N → BlenderMCP → Connect). Aucun
générateur 3D payant n'est nécessaire.

1. **Images OG 1200 × 630** (7) : accueil (Lavaux, palette Léman, cyclorama papier, lumière NO),
   Studio (les 4 objets sur un plateau 256 mm), une par objet, Vase spirale **non modifié** (STL
   original, blanc). Nos objets viennent de STL exportés par le générateur (script Bun
   `scripts/export-demo-stl.ts`, à écrire par WP-99). Titre en Archivo, wordmark en Geist.
   Fichiers dans `public/og/`, déclarés par `pageMetadata` (jamais par la convention
   `opengraph-image`, règle d'or 10).
2. **Turntable du Vase spirale** (blanc et noir, 72 images WebP de 1280 px) : repli C0 du chapitre
   « Tourner » de la fiche.
3. **Macro des lignes de couche** d'un Lavaux (4K) : en-tête éditorial de l'index du Studio.

Le poster LCP du héros reste un SVG généré par le code (§5.7) : un rendu ne serait ni aligné sur
le canvas, ni thémé, ni aussi léger.

### 11.5 Ce dont on n'a pas besoin

Pas de vidéo (ni Higgsfield, ni Runway), pas de Spline, Rive, Unicorn Studio, Lottie, Midjourney
ou FLUX, pas de photogrammétrie, pas de domaine média, pas de `'wasm-unsafe-eval'`.

---

## 12. Risques et parades

| Risque                                         | Parade                                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| three, gsap ou lenis fuient dans le Worker     | `src/motion/**` + `src/gates/**`, lint (imports statiques **et** dynamiques), test de frontière, `check-worker-bundle` à chaque package |
| LCP retardé par le mouvement                   | h1 SSR sans animation, posters inline, Stage chargé en idle, aucun préloader                                                            |
| Un de nos objets ressemble au Vase spirale     | pas de profil bouteille, col ≥ 0,5, pas de nervures dans le héros, `nearVaseSpirale` bloquant et testé                                  |
| Attribution absente ou trompeuse               | `AttributionBlock` SSR en 4 langues, test `curl`, JSON-LD `3DModel`, aucune formulation d'approbation                                   |
| Configuration non imprimable vendue            | bornes couplées, garde-fous, test de variété, relecture humaine de chaque demande                                                       |
| Estimation perçue comme un prix                | fourchette, libellé « Estimation », aucun CHF avant validation, prix ferme par devis sous 48 h                                          |
| Texte personnel qui fuit                       | jamais dans l'URL ni les événements, `sessionStorage`, `.ph-mask`, inspection réseau en acceptation                                     |
| INP du Studio                                  | Worker + LOD `drag`/`display`, stats analytiques, télémétrie ≤ 10 Hz, mesure CPU ×4                                                     |
| Upload lent sur mobile, 429                    | STL adaptatif 1–3 Mo, progression narrée, cache du `fileKey`, message 429                                                               |
| Lenis ou transforms autour de Stripe           | groupe `(site)` : le tunnel n'est pas dedans                                                                                            |
| iOS : barre d'adresse, clavier, contextes      | pas de pin mobile, `ignoreMobileResize`, `svh`, saisies hors pin, un seul contexte, bake au repos, repli sur perte de contexte          |
| Décalage DOM / canvas au scroll natif mobile   | bake des vues au repos en C1 ; Lenis synchronise le desktop                                                                             |
| Allemand trop long                             | échelle `:lang(de)`, `hyphens`, tests avec les mots du lexique                                                                          |
| Replays PostHog lourds                         | `ph-no-capture` sur les compteurs et conteneurs décoratifs, mesure en WP-99                                                             |
| Actions PostHog cassées par le nouveau DOM     | audit et liste de recréation en WP-99                                                                                                   |
| Preview partagée écrasée par d'autres branches | preview dédiée ou gel pendant les revues (décision 5)                                                                                   |
| Branche longue qui dérive de `main`            | noms de jetons conservés, packages courts, rebase avant chaque fusion                                                                   |
| Admin abîmé par les jetons                     | revue de l'admin en WP-00 et WP-99, corrections par les jetons seulement                                                                |
| Dépendances : three 0.187 casse le Stage       | three figé en `0.186.1`, Dependabot relu                                                                                                |

---

## 13. Annexes

### Annexe A · Matériau d'impression (GLSL injecté par `onBeforeCompile`)

WebGL2 (three r186) : indexation dynamique des tableaux d'uniforms permise. Couleurs passées en
`THREE.Color` (conversion sRGB → linéaire gérée par three). Les variables locales déclarées dans
`color_fragment` restent visibles dans les blocs suivants (même `main`).

```ts
material.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      "#include <common>\nattribute float side;\nvarying float vZ;\nvarying float vSide;",
    )
    .replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvZ = position.z;\nvSide = side;",
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${PRINT_HEAD}`)
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>\n${PRINT_COLOR}`,
    )
    .replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>\n${PRINT_NORMAL}`,
    )
    .replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>\n${PRINT_EMISSIVE}`,
    );
};
material.customProgramCacheKey = () => "s3d-print-v1";
```

```glsl
// PRINT_HEAD
varying float vZ; varying float vSide;
uniform float uCutZ, uHeight, uLayerH, uLayerRelief;
uniform float uBandTop[3]; uniform int uBandCount;
uniform vec3 uBandColor[4]; uniform vec3 uBandColorFrom[4];
uniform float uRippleZ, uRippleActive, uReprintZ, uReprintSide, uReprintActive;
uniform float uHot, uFlash, uGhost, uGhostStep, uIsoMode;
uniform vec3 uHotColor, uGhostColor, uIsoIndexColor, uUpView;

// PRINT_COLOR
float isGhost = 0.0;
if (vZ > uCutZ + 1e-4) {
  if (uGhost < 0.5 || vSide > 0.5) discard;                 // fantômes : paroi extérieure seulement
  float d = abs(fract(vZ / uGhostStep + 0.5) - 0.5) * uGhostStep;
  if (d > max(0.05, fwidth(vZ) * 0.8)) discard;             // anneau d'environ 1 px
  isGhost = 1.0;
} else {
  if (uReprintSide > 0.5 && vZ < uReprintZ) discard;        // ancien maillage : garde le dessus
  if (uReprintSide < -0.5 && vZ > uReprintZ) discard;       // nouveau maillage : garde le dessous
  int band = 0;
  for (int i = 0; i < 3; i++) { if (i < uBandCount - 1 && vZ > uBandTop[i]) band = i + 1; }
  diffuseColor.rgb = (vZ <= uRippleZ) ? uBandColor[band] : uBandColorFrom[band];
  if (uIsoMode > 0.0) {                                     // vue « carte » : courbe maîtresse toutes les 10 couches
    float step10 = uLayerH * 10.0;
    float di = abs(fract(vZ / step10 + 0.5) - 0.5) * step10;
    diffuseColor.rgb = mix(diffuseColor.rgb, uIsoIndexColor, uIsoMode * (1.0 - smoothstep(0.0, max(0.04, fwidth(vZ)), di)));
  }
}

// PRINT_NORMAL (lignes de couche, effacées quand elles passent sous le pixel : pas de moiré)
{
  float f = fwidth(vZ) / uLayerH;
  float amp = uLayerRelief * (1.0 - smoothstep(0.25, 0.6, f)) * (1.0 - isGhost);
  normal = normalize(normal + amp * sin(6.2831853 * vZ / uLayerH) * uUpView);
}

// PRINT_EMISSIVE
{
  float w = max(0.3, fwidth(vZ) * 1.5);
  float hot = (1.0 - smoothstep(0.0, w, abs(vZ - uCutZ))) * uHot * step(uCutZ, uHeight - 1e-3);
  float rip = (1.0 - smoothstep(0.0, w, abs(vZ - uRippleZ))) * uRippleActive;
  float rep = (1.0 - smoothstep(0.0, w, abs(vZ - uReprintZ))) * uReprintActive;
  totalEmissiveRadiance += uHotColor * (hot * (1.0 + 2.0 * uFlash) + rip + rep);
  if (isGhost > 0.5) { diffuseColor.rgb = vec3(0.0); totalEmissiveRadiance = uGhostColor; }
}
```

`uUpView` = direction Z du modèle en espace vue (`new Vector3(0, 0, 1).transformDirection(mesh.modelViewMatrix)`),
mise à jour par frame. `uLayerRelief` ≈ 0,25.

**Champ de courbes** (`field-material.ts`, WP-HOME) : la hauteur est **précalculée une fois**
(FBM périodique, 512² R16F, passe GPU unique au montage) ; par pixel, on lit la texture en
coordonnées « page » (`gl_FragCoord` + défilement) pour que deux vues se raccordent sans couture,
puis `v = h / espacement` (l'espacement se resserre de 15 % au plus avec la vitesse de scroll),
ligne anti-crénelée `1 − clamp(abs(fract(v + 0.5) − 0.5) / fwidth(v) − 0.5, 0, 1)`, courbe maîtresse
une sur cinq en `iso-index`, tramage de Bayer 4×4 à 1,5 %, `uReveal` pour l'ouverture en fin de
héros. Rendu seulement quand le scroll bouge ou que `uReveal` change.

### Annexe B · Formules de référence

- Couches : `ceil(h / 0,2)` ; une frontière de bande `z` tombe à la couche `round(z / 0,2) + 1`.
- Masse : `V(cm³) × 1,24 + changements × 0,8 g`. Durée : `V(mm³) / 8 + couches × 1,5 s +
changements × 110 s + 360 s`.
- Prix : `max(900, 400 + 8 × g + 300 × h + 60 × changements) × marge` centimes, fourchette ±15 %,
  arrondi à 50 centimes, jamais sous le plancher (valeurs à valider, `PRICING.validated`).
- STL binaire : `84 + 50 × triangles` octets. Pour viser 1–3 Mo : 20 000 à 60 000 triangles.
- Altitude fictive du sommet : `1800 + (fnv1a(nom en minuscules, sans espaces superflus) mod 2600)` m.
- Léman : 372 m ; « Altitude 404 m » = 32 m au-dessus du lac.

### Annexe C · Banque de textes (FR · DE · IT · EN)

| Clé (namespace)                           | FR                                                                                                                                                                                                                    | DE (CH, sans ß)                                                                                                                                                                                                          | IT                                                                                                                                                                                                                                 | EN                                                                                                                                                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `landing.hero.kicker`                     | Impression 3D multicolore · Gland & Pully (VD)                                                                                                                                                                        | Mehrfarbiger 3D-Druck · Gland & Pully (VD)                                                                                                                                                                               | Stampa 3D multicolore · Gland & Pully (VD)                                                                                                                                                                                         | Multicolor 3D printing · Gland & Pully (VD)                                                                                                                                                                          |
| `landing.hero.title`                      | Tout relief commence par une couche.                                                                                                                                                                                  | Jedes Relief beginnt mit einer Schicht.                                                                                                                                                                                  | Ogni rilievo nasce da uno strato.                                                                                                                                                                                                  | Every relief starts with a layer.                                                                                                                                                                                    |
| `landing.hero.lead`                       | Des objets dessinés par notre atelier, que vous réglez en direct : forme, motif, jusqu'à quatre couleurs. Vous réglez, on imprime, à Gland et à Pully.                                                                | Objekte aus unserem Atelier, die Sie live einstellen: Form, Muster, bis zu vier Farben. Sie stellen ein, wir drucken, in Gland und Pully.                                                                                | Oggetti disegnati nel nostro atelier, che Lei regola dal vivo: forma, motivo, fino a quattro colori. Lei regola, noi stampiamo, a Gland e Pully.                                                                                   | Objects designed in our workshop that you adjust live: shape, pattern, up to four colors. You set it, we print it, in Gland and Pully.                                                                               |
| `landing.hero.ctaStudio`                  | Régler un objet                                                                                                                                                                                                       | Objekt einstellen                                                                                                                                                                                                        | Regola un oggetto                                                                                                                                                                                                                  | Adjust an object                                                                                                                                                                                                     |
| `landing.hero.ctaShop`                    | Boutique                                                                                                                                                                                                              | Shop                                                                                                                                                                                                                     | Negozio                                                                                                                                                                                                                            | Shop                                                                                                                                                                                                                 |
| `landing.hero.ctaFile`                    | J'ai un fichier                                                                                                                                                                                                       | Ich habe eine Datei                                                                                                                                                                                                      | Ho un file                                                                                                                                                                                                                         | I have a file                                                                                                                                                                                                        |
| `landing.hero.label`                      | Objet Studio · configuration d'exemple · rendu temps réel                                                                                                                                                             | Studio-Objekt · Beispielkonfiguration · Echtzeit-Rendering                                                                                                                                                               | Oggetto Studio · configurazione di esempio · rendering in tempo reale                                                                                                                                                              | Studio object · sample configuration · real-time render                                                                                                                                                              |
| `landing.hero.skip`                       | Passer l'animation                                                                                                                                                                                                    | Animation überspringen                                                                                                                                                                                                   | Salta l'animazione                                                                                                                                                                                                                 | Skip the animation                                                                                                                                                                                                   |
| `landing.hero.palette` / `.pattern`       | Palette / Motif                                                                                                                                                                                                       | Palette / Muster                                                                                                                                                                                                         | Tavolozza / Motivo                                                                                                                                                                                                                 | Palette / Pattern                                                                                                                                                                                                    |
| `landing.hero.telemetry`                  | Couche {layer} / {total} · z {z} mm · {filament}                                                                                                                                                                      | Schicht {layer} / {total} · z {z} mm · {filament}                                                                                                                                                                        | Strato {layer} / {total} · z {z} mm · {filament}                                                                                                                                                                                   | Layer {layer} / {total} · z {z} mm · {filament}                                                                                                                                                                      |
| `landing.hero.change`                     | Changement de filament → {filament} · couche {layer}                                                                                                                                                                  | Filamentwechsel → {filament} · Schicht {layer}                                                                                                                                                                           | Cambio di filamento → {filament} · strato {layer}                                                                                                                                                                                  | Filament change → {filament} · layer {layer}                                                                                                                                                                         |
| `landing.map.title`                       | Une couleur par altitude.                                                                                                                                                                                             | Eine Farbe pro Höhenstufe.                                                                                                                                                                                               | Un colore per ogni quota.                                                                                                                                                                                                          | One color per altitude.                                                                                                                                                                                              |
| `landing.summit.title`                    | Votre nom, en relief. Littéralement.                                                                                                                                                                                  | Ihr Name, im Relief. Wörtlich.                                                                                                                                                                                           | Il Suo nome, in rilievo. Letteralmente.                                                                                                                                                                                            | Your name, in relief. Literally.                                                                                                                                                                                     |
| `landing.summit.input`                    | Nommez votre sommet                                                                                                                                                                                                   | Benennen Sie Ihren Gipfel                                                                                                                                                                                                | Dia un nome alla Sua vetta                                                                                                                                                                                                         | Name your peak                                                                                                                                                                                                       |
| `landing.summit.note`                     | Le texte reste dans votre navigateur jusqu'à l'envoi à l'atelier.                                                                                                                                                     | Der Text bleibt in Ihrem Browser, bis Sie ihn ans Atelier senden.                                                                                                                                                        | Il testo resta nel Suo browser fino all'invio all'atelier.                                                                                                                                                                         | The text stays in your browser until you send it to the workshop.                                                                                                                                                    |
| `studioCore.relief.peak`                  | Pointe {name}                                                                                                                                                                                                         | Piz {name}                                                                                                                                                                                                               | Pizzo {name}                                                                                                                                                                                                                       | Mount {name}                                                                                                                                                                                                         |
| `studioCore.relief.fictional`             | altitude fictive                                                                                                                                                                                                      | fiktive Höhe                                                                                                                                                                                                             | quota immaginaria                                                                                                                                                                                                                  | fictional altitude                                                                                                                                                                                                   |
| `landing.summit.cta`                      | Continuer dans le Studio                                                                                                                                                                                              | Im Studio weitermachen                                                                                                                                                                                                   | Continua nello Studio                                                                                                                                                                                                              | Continue in the Studio                                                                                                                                                                                               |
| `landing.studio.title`                    | Réglez-le. On l'imprime.                                                                                                                                                                                              | Sie stellen ein. Wir drucken.                                                                                                                                                                                            | Lei regola. Noi stampiamo.                                                                                                                                                                                                         | You set it. We print it.                                                                                                                                                                                             |
| `landing.shop.title`                      | Des objets choisis, imprimés à la commande.                                                                                                                                                                           | Ausgewählte Objekte, auf Bestellung gedruckt.                                                                                                                                                                            | Oggetti scelti, stampati su ordinazione.                                                                                                                                                                                           | Selected objects, printed to order.                                                                                                                                                                                  |
| `landing.atelier.title`                   | Imprimé à Gland et à Pully. Livré de Genève à Romanshorn.                                                                                                                                                             | Gedruckt in Gland und Pully. Geliefert von Genf bis Romanshorn.                                                                                                                                                          | Stampato a Gland e Pully. Consegnato da Ginevra a Romanshorn.                                                                                                                                                                      | Printed in Gland and Pully. Delivered from Geneva to Romanshorn.                                                                                                                                                     |
| `landing.file.title`                      | Vous avez déjà un fichier ?                                                                                                                                                                                           | Sie haben schon eine Datei?                                                                                                                                                                                              | Ha già un file?                                                                                                                                                                                                                    | Already have a file?                                                                                                                                                                                                 |
| `landing.file.cta`                        | Envoyer un fichier                                                                                                                                                                                                    | Datei senden                                                                                                                                                                                                             | Invia un file                                                                                                                                                                                                                      | Send a file                                                                                                                                                                                                          |
| `studio.send`                             | Envoyer à l'atelier                                                                                                                                                                                                   | Ans Atelier senden                                                                                                                                                                                                       | Invia all'atelier                                                                                                                                                                                                                  | Send to the workshop                                                                                                                                                                                                 |
| `studio.moderation`                       | Un humain de l'atelier relit chaque texte avant l'impression. Nous refusons les marques de tiers, les injures et les contenus illicites.                                                                              | Ein Mensch im Atelier prüft jeden Text vor dem Druck. Marken Dritter, Beleidigungen und rechtswidrige Inhalte lehnen wir ab.                                                                                             | Una persona dell'atelier rilegge ogni testo prima della stampa. Rifiutiamo marchi di terzi, insulti e contenuti illeciti.                                                                                                          | A person in our workshop reviews every text before printing. We refuse third-party trademarks, insults and unlawful content.                                                                                         |
| `studio.estimate`                         | Estimation · prix ferme confirmé par l'atelier sous 48 h                                                                                                                                                              | Schätzung · verbindlicher Preis vom Atelier innert 48 Stunden                                                                                                                                                            | Stima · prezzo definitivo confermato dall'atelier entro 48 ore                                                                                                                                                                     | Estimate · firm price confirmed by the workshop within 48 hours                                                                                                                                                      |
| `studio.indicative`                       | Teintes indicatives, couleur finale selon les bobines en stock.                                                                                                                                                       | Farbtöne unverbindlich, die endgültige Farbe hängt von den vorrätigen Spulen ab.                                                                                                                                         | Tinte indicative, colore finale secondo le bobine disponibili.                                                                                                                                                                     | Indicative shades; the final color depends on the spools in stock.                                                                                                                                                   |
| `studio.success`                          | Reçu. L'atelier vérifie votre pièce et vous répond sous 48 h avec un prix ferme.                                                                                                                                      | Erhalten. Das Atelier prüft Ihr Stück und antwortet Ihnen innert 48 Stunden mit einem verbindlichen Preis.                                                                                                               | Ricevuto. L'atelier verifica il Suo pezzo e Le risponde entro 48 ore con un prezzo definitivo.                                                                                                                                     | Received. The workshop checks your piece and replies within 48 hours with a firm price.                                                                                                                              |
| `studio.error429`                         | Trop d'envois depuis cette connexion (10 par heure). Réessayez plus tard ou écrivez à contact@swiss3design.ch.                                                                                                        | Zu viele Uploads von dieser Verbindung (10 pro Stunde). Versuchen Sie es später erneut oder schreiben Sie an contact@swiss3design.ch.                                                                                    | Troppi invii da questa connessione (10 all'ora). Riprovi più tardi o scriva a contact@swiss3design.ch.                                                                                                                             | Too many uploads from this connection (10 per hour). Try again later or write to contact@swiss3design.ch.                                                                                                            |
| `studioCore.guard.nearVase`               | Cette combinaison rappelle le Vase spirale de Ian (licence sans modification). Réduisez la torsion ou le nombre de nervures.                                                                                          | Diese Kombination erinnert an Ians Vase spirale (Lizenz ohne Bearbeitungen). Verringern Sie die Drehung oder die Anzahl Rippen.                                                                                          | Questa combinazione ricorda il Vase spirale di Ian (licenza senza modifiche). Riduca la torsione o il numero di nervature.                                                                                                         | This combination resembles Ian's Vase spirale (no-derivatives license). Reduce the twist or the number of ribs.                                                                                                      |
| `shell.stage.unavailable`                 | Vue 3D indisponible sur cet appareil : l'aperçu 2D est exact au dixième de millimètre.                                                                                                                                | 3D-Ansicht auf diesem Gerät nicht verfügbar: Die 2D-Vorschau ist auf den Zehntelmillimeter genau.                                                                                                                        | Vista 3D non disponibile su questo dispositivo: l'anteprima 2D è precisa al decimo di millimetro.                                                                                                                                  | 3D view unavailable on this device: the 2D preview is accurate to a tenth of a millimeter.                                                                                                                           |
| `shell.motion.toggle`                     | Réduire les animations                                                                                                                                                                                                | Animationen reduzieren                                                                                                                                                                                                   | Riduci le animazioni                                                                                                                                                                                                               | Reduce motion                                                                                                                                                                                                        |
| `catalog.attribution.body`                | Design : Ian, « Vase », publié sur MakerWorld. Licence Creative Commons BY-ND 4.0. Swiss3Design imprime ce modèle sans aucune modification. Cette mention n'implique aucune approbation de Swiss3Design par l'auteur. | Design: Ian, «Vase», veröffentlicht auf MakerWorld. Lizenz Creative Commons BY-ND 4.0. Swiss3Design druckt dieses Modell ohne jede Änderung. Dieser Hinweis bedeutet keine Billigung von Swiss3Design durch den Urheber. | Design: Ian, «Vase», pubblicato su MakerWorld. Licenza Creative Commons BY-ND 4.0. Swiss3Design stampa questo modello senza alcuna modifica. Questa menzione non implica alcuna approvazione di Swiss3Design da parte dell'autore. | Design: Ian, "Vase", published on MakerWorld. License Creative Commons BY-ND 4.0. Swiss3Design prints this model without any modification. This credit does not imply any endorsement of Swiss3Design by the author. |
| `catalog.cross.title`                     | Un vase à vos couleurs ?                                                                                                                                                                                              | Eine Vase in Ihren Farben?                                                                                                                                                                                               | Un vaso nei Suoi colori?                                                                                                                                                                                                           | A vase in your colors?                                                                                                                                                                                               |
| `system.notFound.title`                   | Page introuvable.                                                                                                                                                                                                     | Seite nicht gefunden.                                                                                                                                                                                                    | Pagina non trovata.                                                                                                                                                                                                                | Page not found.                                                                                                                                                                                                      |
| `system.notFound.kicker`                  | Point non coté                                                                                                                                                                                                        | Kein vermessener Punkt                                                                                                                                                                                                   | Punto non quotato                                                                                                                                                                                                                  | Unsurveyed point                                                                                                                                                                                                     |
| `system.notFound.line`                    | Altitude 404 m, soit 32 m au-dessus du Léman. Rien n'a été imprimé ici.                                                                                                                                               | Höhe 404 m, also 32 m über dem Genfersee. Hier wurde nichts gedruckt.                                                                                                                                                    | Quota 404 m, cioè 32 m sopra il Lemano. Qui non è stato stampato nulla.                                                                                                                                                            | Altitude 404 m, 32 m above Lake Geneva. Nothing was printed here.                                                                                                                                                    |
| `system.cart.emptyTitle` / `.emptyKicker` | Votre panier est vide. / Terrain vierge                                                                                                                                                                               | Ihr Warenkorb ist leer. / Unberührtes Gelände                                                                                                                                                                            | Il carrello è vuoto. / Terreno vergine                                                                                                                                                                                             | Your cart is empty. / Blank terrain                                                                                                                                                                                  |
| `system.success.kicker`                   | La buse chauffe.                                                                                                                                                                                                      | Die Düse heizt auf.                                                                                                                                                                                                      | L'ugello si scalda.                                                                                                                                                                                                                | The nozzle is heating up.                                                                                                                                                                                            |
| `system.error.title`                      | Une couche a raté. On réessaie ?                                                                                                                                                                                      | Eine Schicht ist missglückt. Nochmals versuchen?                                                                                                                                                                         | Uno strato non è riuscito. Riproviamo?                                                                                                                                                                                             | A layer failed. Shall we retry?                                                                                                                                                                                      |

_Fin du brief._

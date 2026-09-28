# Critique de complétude : phase de recherche de la refonte 2026

> Relecture critique du 2026-09-27 (lecture seule) des notes `codemap.md`, `tech.md`, `assets.md`,
> `inspiration-motionsites.md`, `inspiration-galleries.md` et `inspiration-x.md`, avec quelques
> vérifications ponctuelles dans le dépôt (citées). Ce fichier ne récapitule pas les notes : il liste
> seulement ce qui manque, ce qui n'est pas vérifié et ce qui se contredit, bref ce qui gênerait la
> phase de design.

**Verdict.** La recherche est riche sur la technique (CSP, bundle, Lenis/GSAP, WebGL) et sur
l'inspiration. Elle est faible sur trois points :

- **les données réelles** : aucune mesure d'audience ni de performance de référence ;
- **les décisions du propriétaire**, qui bloquent le héros ;
- **la convergence** : environ 40 idées signature qui se recoupent, sans tri ni plan validé.

Rien de tout cela n'empêche de démarrer le design. En revanche, il faut trancher quelques points avant
de dessiner le héros.

---

## 1. Bloquants (à régler avant de figer le concept du héros)

| #   | Problème                                                                                                                                                                                                                                                 | Pourquoi ça bloque                                                                                                                                                                                                                           | Action                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **La licence du seul modèle 3D réel n'est pas vérifiée.** L'en-tête du STL du vase est « MW 1.0 1262112 US », ce qui évoque MakerWorld ou un export tiers (assets §1.4).                                                                                 | Le concept dominant (« l'objet s'imprime sous vos yeux », présent dans les 3 notes d'inspiration) repose sur ce fichier. S'il vient d'une plateforme, la vente et l'usage marketing (rendus, vidéos IA, simulations) peuvent être interdits. | Demander au propriétaire l'origine et la licence. Plan B : un objet conçu en interne, par exemple le mark en 3D.                                                                                   |
| B2  | **La promesse multicolore n'a aucune preuve.** L'unique produit live est monochrome (blanc ou noir), et aucune pièce multicolore réelle n'existe en photo ni en 3D (assets §0, G4).                                                                      | Un héros qui change de couleur « aux vrais indices de couche » sur ce vase montrerait un produit qui n'existe pas. C'est un risque LCD art. 3 (indications inexactes).                                                                       | Soit une pièce-signature 4 couleurs imprimée par le propriétaire, soit une scène étiquetée « illustration », séparée de la fiche produit. À décider avant le storyboard.                           |
| B3  | **Préloader narratif ou LCP : il faut choisir.** Les 3 notes d'inspiration recommandent un préloader « slicer/CAD » façon Oryzo. `tech.md` règle 2 impose un LCP visible au premier paint, sans jamais `opacity:0` en attendant le JS, avec LCP ≤ 2,0 s. | Les deux sont incompatibles tels qu'ils sont décrits.                                                                                                                                                                                        | Définir le « loader » comme une animation **dans** le héros, non bloquante, jouée par-dessus un h1 et un poster déjà peints. Pas d'overlay plein écran. Éventuellement une seule fois par session. |
| B4  | **L'espace de preview est partagé.** Un seul Worker `swiss3design-preview` reçoit **tous** les push hors `main`, et le dernier push l'emporte (`docs/deploiement-cloudflare.md` l.219-224).                                                              | Les branches Dependabot et les correctifs écraseront la preview que le propriétaire doit valider.                                                                                                                                            | Prévoir une preview dédiée à la refonte (un 3e Worker ou une URL de version), ou geler les autres branches pendant les revues.                                                                     |
| B5  | **La preview ne contient pas les vrais assets.** Elle a son propre bucket R2 (`swiss3design-preview-files`, `wrangler.jsonc` l.137-141) et un catalogue démo de 6 produits avec des SVG hors charte et sans `model_3d_url` (assets §1.5).                | Le héros construit sur le STL du vase ne s'affichera pas sur la preview, qui montrera en plus des produits factices hors marque.                                                                                                             | Copier le STL et les photos dans le bucket preview. Réinjecter le vase avec `model_3d_url` dans la branche Neon preview. Vérifier avant la première revue.                                         |

## 2. Contradictions entre notes à trancher

1. **R3F et drei « déjà installés »** (`inspiration-motionsites.md` §4) : c'est **faux**. Ni l'un ni
   l'autre n'est installé (codemap §1, tech §4).
2. **Import dynamique dans un effet.** codemap §7 dit que `await import("gsap")` dans un effet suffit à
   garder la lib hors du Worker. tech §0 (règle 1) dit que ce chunk **reste** dans le Worker. **J'ai
   vérifié : tech a raison.** `showroom-scene.ts` n'importe `three` que par `import type` et
   `await import("three")` (l.1, 114), et pourtant AGENTS.md chiffre à environ 243 KiB gzip son import
   statique depuis `product-gallery.tsx`. Seul `next/dynamic({ ssr:false })`, déclaré dans un
   composant client, retire la lib. Il faut corriger la recette de codemap §7.
3. **Canvas persistant dans `[locale]/layout.tsx`** (tech §4, galleries « INK Games »). Ce layout
   enveloppe aussi `/admin`, `/checkout` et `/account` (codemap §0.11). Il faut concevoir un groupe de
   routes `(site)`. C'est un gros déplacement de fichiers, pas un simple détail. Aujourd'hui, rien ne
   le spécifie.
4. **Périmètre de Lenis.** tech §2 l'exclut de checkout, cart, account, admin et legal. codemap §18
   l'exclut de checkout, account, admin, oauth et agent. Il faut une seule liste, qui dise aussi ce
   qu'on fait de `/track`, `/favorites` et `/cart`.
5. **Draco et KTX2** sont recommandés dans galleries (idée 1, « single glTF (Draco) + KTX2 ») et dans
   motionsites §4. tech et assets choisissent au contraire de partir **sans WASM**
   (`KHR_mesh_quantization`), faute de `'wasm-unsafe-eval'`. Même problème pour Rapier (voxel drop,
   « Labo »), qui est en WASM : il faut soit cannon-es (JS pur), soit un changement de CSP.
6. **Splats gaussiens** pour « L'atelier » (galleries idée 7). tech indique que le renderer de splats
   de three r186 est WebGPU/TSL, alors que la décision est WebGL2 seul. Il faut une autre librairie
   (licence, WASM et workers à vérifier) ou abandonner l'idée.
7. **Compteurs de fabrication « déjà disponibles »** (galleries idée 5, « parse them from the
   slicer/G-code metadata we already have ») : c'est **faux**. Le schéma n'a que `productionDays`,
   `material`, `weightGrams` et `dimensionsMm` (assets §1.6), et le G-code doit d'abord être exporté
   par le propriétaire (G2).
8. **Éditions limitées avec compte à rebours** (galleries idée 10). `docs/refonte-plateforme-2026.md`
   §4 interdit les « compte-à-rebours artificiels », et pose aussi « Pas de décoration mouvante ». Il
   faut dire explicitement si ce document (« La Forge », non implémenté) est remplacé par le brief
   actuel ou s'il reste la référence produit.
9. **Page d'accueil.** La Forge (§0, §6.1) prévoit une page à **double intention** (« Acheter un
   objet » / « Imprimer ma pièce ») et fait du sur-mesure le vrai différenciateur. Les notes
   d'inspiration centrent tout sur un seul objet héros. Les notes n'ont pas lu la Forge au-delà de sa
   mention.
10. **Bascule de fond noir ↔ papier par chapitre** (NODAL, Kalkbrenner) et thème choisi par
    l'utilisateur. Rien ne dit comment une section « papier » se comporte en mode sombre (flash
    blanc ?), ni comment une scène WebGL suit `useIsDark()` pendant une bascule.

## 3. Manques et points non vérifiés

### 3.1 Données de référence (aucune n'a été mesurée)

- **Audience** : la répartition mobile/desktop, la part d'iOS Safari (vidéo sans `Range` = cassée), de
  Firefox (pas de `animation-timeline`, pas de types de View Transition), et les pages d'entrée
  (accueil ou fiche produit depuis Google). Le connecteur PostHog (projet 285063) n'a pas servi. Sans
  ces chiffres, les tiers d'appareils et les priorités de pages sont arbitraires.
- **Web vitals actuels** (LCP, INP, CLS, TTFB depuis la Suisse) et **poids du JS client actuel**. tech
  pose « ne pas dépasser l'actuel » sans connaître l'actuel. Le TTFB est important : `prefetch=false`
  et `force-dynamic` font attendre le Worker et Postgres à chaque navigation, donc avant chaque morph
  de View Transition.
- **Poids du Stage** (150 à 230 KiB gzip) et du chunk motion (55 à 70 KiB) : ce sont des estimations.
  Il faut les mesurer sur un prototype avec `bunx wrangler deploy --dry-run` (Worker) et un bundle
  analyzer (client).
- **SEO et trafic organique** : aucune mesure avant la refonte, et GSC n'est pas accessible (mémoire).
  Il faut au minimum figer les URL, les h1 et le JSON-LD, puis comparer avant et après.

### 3.2 Contenu réel (N = 1)

- Un seul produit live et 2 catégories sur 3 vides (`bureau`, `accessoires`). Les produits liés de la
  fiche sont vides, la « sélection » de l'accueil n'a qu'une carte, et les idées « une salle par
  collection », « footer de particules par catégorie » ou « table d'impression » présupposent un
  catalogue. Il faut spécifier les états N = 1 et N = 0, et la montée à N = 20.
- **Aucun asset poster pour le héros** : il n'y a qu'un rendu de 1000 px. Blender est fermé (MCP
  injoignable), et ffmpeg et gltfpack ne sont pas installés. Les installer (winget, npm) demande
  l'accord du propriétaire.
- Il faut définir un **« Tier A » réalisable sans aucun nouvel asset** (shader procédural sur le STL
  existant, blanc/noir, typo, grain) et un « Tier B » après la séance photo et la pièce multicolore.
  Aujourd'hui, tout le design dépend implicitement du Tier B.

### 3.3 Mobile (stratégie de perf seulement, aucun concept de design)

- Il n'existe aucune chorégraphie mobile : ce que devient le héros « impression au scroll » sur 375 px,
  ni la durée des sections pinnées au pouce.
- Le redimensionnement de la barre d'adresse iOS casse les pins ScrollTrigger : il faut
  `ScrollTrigger.config({ ignoreMobileResize: true })`, des unités `svh`/`dvh` et des `refresh`
  maîtrisés. Ce n'est pas traité.
- Les idées qui reposent sur le survol n'ont pas d'équivalent tactile : loupe rayon X, boutons
  magnétiques, texte en roulement, sons au survol des pastilles, couleurs au hover (Nike).
- L'empilement des couches fixes n'est pas conçu : canvas fixe, BottomNav z-50 avec safe-area,
  bannière de consentement à 4,5 rem, et le trou `md`/`lg` du footer (codemap §8).

### 3.4 Accessibilité

- **Contraste de l'accent** (calcul manuel, à confirmer avec un outil) : `#E5231C` fait environ
  **4,4:1 sur `#fafaf9`** et environ **4,3:1 sur `#0b0a09`**, donc moins que l'AA de 4,5:1 pour le
  texte courant. C'est acceptable pour le texte ≥ 24 px (ou ≥ 19 px en gras) et les éléments non
  textuels (3:1). Blanc sur rouge : environ 4,6:1, juste suffisant. `text-accent` est utilisé
  **107 fois dans 59 fichiers**. Il faut définir un jeton « accent-texte » par thème avant de faire du
  rouge le seul accent. `accent-dark #c01d14` passe sur papier (environ 5,9:1) mais pas sur fond
  sombre (environ 3,2:1).
- Les **libellés dupliqués dans le DOM** pour le texte en roulement (Lando Norris) créent du texte en
  double pour le SEO, la conversion Markdown des agents et les lecteurs d'écran. Il faut `aria-hidden`
  sur la copie.
- Rien n'est spécifié pour les sections pinnées et scrubbées au clavier (Espace/PageDown) et en ordre
  de lecture. Pas de repli en cas de `webglcontextlost` non plus.
- Pour l'interrupteur « Réduire les animations » (tech §8), la classe doit être posée avant le paint.
  Le plus simple est d'étendre le script anti-FOUC du thème (déjà nonce) plutôt que d'en ajouter un.

### 3.5 i18n (spécificités suisses non traitées)

- **Pas de ß en allemand suisse.** `messages/de.json` l.96 contient déjà « Schließen »
  (« Schliessen » en de-CH). Il faut en faire une règle pour toute la nouvelle copie.
- **Formats numériques par locale** pour la télémétrie animée (« Couche 142/300 · 0,2 mm »,
  « 14 h 32 min », « 38 m ») : fr-CH écrit `0,2`, de-CH et it-CH écrivent `0.2`, et le séparateur de
  milliers est `’`. Il faut passer par `Intl.NumberFormat`, jamais par des chaînes figées, y compris
  dans les textes rendus dans un canvas.
- **Volume de copie** : tous les chapitres, compteurs et microcopies sont à produire en 4 langues. Il
  faut savoir qui rédige et valide l'allemand et l'italien, et tester les longueurs en DE sur chaque
  mise en page cinétique.

### 3.6 Licences et sécurité

- GSAP : vérifié (licence standard gratuite, pas MIT). Lenis, three, postprocessing et le bruit
  Ashima sont OK. LYGIA est déjà écarté.
- **Non vérifiés** :
  - la licence Fontshare (ITF FFL) pour l'auto-hébergement web, et le coût des fonderies suisses ;
  - **la licence de ThreeUI** (proposé comme base) ;
  - la licence **de chaque dépôt Codrops ou GitHub** qu'on adapterait (Unwoven, curve-gallery,
    draggable-grid, three-skull…) ;
  - l'emplacement de l'attribution swisstopo ;
  - les droits de l'image Bambu orpheline (`about/p1s-ams2-pro.jpg`).
- **Skills Claude tiers** (scroll-world, scroll-craft) : ne pas les installer sans revue. C'est du code
  non audité qui s'exécuterait dans la session.

### 3.7 Juridique suisse

- **Swissness** (LPM art. 47-49, loi sur la protection des armoiries) : aucune vérification. Si le
  design utilise la croix suisse, le drapeau ou une mention « Swiss made / Imprimé en Suisse »
  (diorama des cantons, topo swisstopo, badges), les règles d'usage s'appliquent, y compris le seuil
  de 60 % du coût de revient pour les produits industriels (filament importé).
- Visuels IA : le risque LCD est noté (assets §5), mais **aucune règle d'étiquetage visible dans
  l'UI** n'est définie (« rendu », « illustration »).

### 3.8 Analytics

- **Session replay et motion** : rrweb (PostHog) enregistre chaque mutation d'attribut `style`. Les
  tweens GSAP ou Motion par frame et SplitText peuvent faire exploser la taille des replays et le coût
  sur le fil principal, donc l'INP. Il faut le tester sur le prototype et, si nécessaire, désactiver
  le replay sur les chapitres animés ou les exclure.
- Les actions PostHog fondées sur des sélecteurs (autocapture) ne sont **pas auditées**. C'est signalé
  dans codemap §11, mais pas fait.

### 3.9 Surfaces non cartographiées

- Les **e-mails transactionnels** (`src/lib/email-templates.ts`) et les **pages HTML de
  désinscription** (`src/app/api/newsletter/unsubscribe`, `src/app/api/cart-reminder/unsubscribe`)
  restent-ils dans l'ancien style ou passent-ils à la nouvelle identité ?
- Il faut aussi trancher pour les OG par page, `manifest`/`theme-color` par thème et les avatars au
  style de l'ancien logo (G16).
- Les routes prévues par la Forge (`/forge`, `/matieres`, `/aide`, `/pro`) sont-elles dans le
  périmètre ? Si oui, il faut mettre à jour `STATIC_PAGES`, `llms.txt` et robots.

### 3.10 Marque

- Le mark n'existe qu'en raster (480 px). La vectorisation (G6) est un **changement de marque soumis à
  validation**, et elle conditionne le loader toolpath, les particules vers le mark, le mark 3D et le
  wordmark 3D. Il faut la faire valider **avant** de concevoir ces pièces.
- Changer de police change le wordmark (texte Geist) et la police des iframes Stripe (codemap §5).
  C'est aussi une décision de marque, pas seulement de design.

### 3.11 Méthode

- Il n'y a **aucune planche visuelle** : les captures des sites de référence n'ont pas été enregistrées
  dans `research/`, et le propriétaire ne peut valider une direction que sur du texte. Il faut
  produire un moodboard (8 à 12 captures et 2 à 3 « style tiles ») avant le design détaillé.
- Il faut dire au propriétaire que **motionsites.ai est un « plancher »** : c'est une bibliothèque de
  prompts à base de vidéos IA Higgsfield, pas une galerie de sites réels. Il l'a citée comme référence,
  donc ses attentes doivent être réalignées sur des exemples visuels.
- Les idées doivent converger. Signaux communs aux 3 notes d'inspiration :
  - impression couche par couche scrubbée au scroll ;
  - courbes de niveau suisses (couches = topographie) ;
  - loader toolpath ;
  - couleur qui se propage le long des couches ;
  - loupe ou rayon X sur l'infill ;
  - un seul accent rouge avec bascules papier/encre.

  Il faut en retenir **une mécanique héros et 2 à 3 motifs de soutien**. Le reste va dans une liste
  « plus tard ».

- **Découpage et validation** : pas de phases, pas de jalons de validation par le propriétaire
  (règle de marque : « tout nouveau visuel validé »), pas de stratégie de déploiement (big bang ou
  progressif par route ou par flag), pas de plan contre la dérive d'une branche longue face à `main`
  (116 fichiers utilisent les jetons).
- Le **configurateur multicolore avec prix live**, les **Éditions** et le **wizard 3D de devis**
  demandent des changements de schéma (couleur par région, prix par option, stock d'édition) qui se
  répercutent sur l'API v1, le flux du catalogue agentique et les outils MCP. Ce n'est pas du design :
  il faut les marquer hors périmètre de la refonte visuelle, ou les chiffrer à part.

## 4. Décisions à obtenir du propriétaire (liste consolidée)

1. L'origine et la licence du STL du vase (B1). Le mode vase et l'export du G-code.
2. La pièce-signature multicolore réelle, oui ou non (B2). L'inventaire exact des bobines (marque, nom,
   hex).
3. La séance photo et vidéo (shot-list d'assets §7), ou 100 % rendu et IA au départ.
4. Le paquet CSP :
   - `blob:` dans `connect-src` (GLB texturés) ;
   - `media-src` pour `media.swiss3design.ch` (bucket R2 public, pour les requêtes Range) ;
   - `'wasm-unsafe-eval'`, oui ou non (Draco, Meshopt, KTX2, Rive, Rapier).
5. Le budget : Higgsfield ou Runway, une police premium éventuelle, Midjourney ou FLUX.
6. Le son sur le site : oui (coupé par défaut) ou non.
7. La vectorisation du mark et un éventuel changement de police ou de wordmark (validation de marque).
8. La Forge : remplacée ou conservée comme référence produit ? Page d'accueil à double intention ou
   récit d'un seul objet ?
9. Une preview dédiée à la refonte (B4) et le mode de mise en ligne (big bang ou progressif).
10. L'installation locale de ffmpeg et gltfpack, et le lancement de Blender avec l'add-on MCP.

## 5. Vérifié par cette critique (reproductible)

- `showroom-scene.ts` : seulement `import type` et `await import("three")`. Combiné à la mesure
  d'AGENTS.md (import statique = environ 243 KiB gzip dans le Worker), cela confirme qu'un import
  dynamique dans un module rendu côté serveur reste dans le bundle.
- `wrangler.jsonc` : la preview utilise le bucket R2 séparé `swiss3design-preview-files`.
- `docs/deploiement-cloudflare.md` l.219-224 : une seule preview pour toutes les branches, et le
  dernier push l'emporte.
- `messages/de.json` l.96 : « Schließen » (ß en allemand suisse).
- `text-accent` : 107 occurrences dans 59 fichiers sous `src/`.
- `docs/refonte-plateforme-2026.md` §4 : interdit les compte-à-rebours artificiels et la
  « décoration mouvante ». §0 et §6.1 : page d'accueil à double intention.
- E-mails (`src/lib/email-templates.ts`) et pages de désinscription HTML : absents de codemap.

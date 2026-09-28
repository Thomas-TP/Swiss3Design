# Verdict du juge ingénierie : Strates, G1 (Atelier), Studio

> Juge n° « ingénierie ». Cadre : Next.js 16.3 + React 19.3 + OpenNext sur Cloudflare Workers. Je juge
> la règle du bundle Worker, le CSP (ni eval ni wasm), LCP ≤ 2 s, INP ≤ 150 ms et CLS ≤ 0,05 sur un
> mobile moyen, le budget GPU et le contexte WebGL unique, les pièges iOS, le SSR et le SEO, les
> performances de la géométrie du configurateur, la taille de l'export STL, la maintenabilité par
> des agents IA, le risque pour Stripe LIVE et l'effort de construction.
> Faits vérifiés dans le dépôt : `/api/quote-upload` accepte 30 Mo au plus et 10 envois par heure,
> et `hasExpectedSignature` valide un STL binaire par la formule `84 + 50 × n = taille`. L'export
> doit donc être un STL binaire strict, sans en-tête exotique ni octets de fin.

## 0. Arithmétique commune (STL binaire = 84 + 50 octets par triangle)

| Concept | Maillage d'export annoncé    | Triangles     | Taille réelle   | Taille annoncée               |
| ------- | ---------------------------- | ------------- | --------------- | ----------------------------- |
| Strates | 240 × 400                    | ≈ 192 k       | **≈ 9,6 Mo**    | ≤ 12 Mo ✔                     |
| G1      | 256 × 360, plafond 300 k tri | 184 k à 300 k | **9,2 à 15 Mo** | « ≈ 5 Mo » ✘ (erreur ×2 à ×3) |
| Studio  | 192 × 360                    | ≈ 138 k       | **≈ 6,9 Mo**    | ≈ 7 Mo ✔                      |

Les trois tiennent sous 30 Mo. Aucun ne pense à la **voie montante mobile** : 7 à 15 Mo sur une 4G
suisse moyenne (5 à 10 Mbit/s en envoi), c'est 6 à 25 s d'attente. Or un trancheur n'a pas besoin
d'un anneau tous les 0,2 mm : un pas vertical adaptatif de 0,5 à 1 mm (plus fin seulement là où le
motif varie en z) ramène le vase à 1 à 3 Mo, sans perte imprimable.

## 1. Grille de notation (10 critères, /10 chacun)

1. **Bundle** : Worker +0 et poids client.
2. **CSP et vie privée.**
3. **LCP et CLS** au premier paint.
4. **INP et fil principal** : régénération de la géométrie, export.
5. **GPU et mobile** : contexte unique, iOS, paliers bas de gamme.
6. **Justesse de la géométrie** : maillage fermé, physique d'impression.
7. **Parcours de commande** : STL, `/custom`, prix en centimes.
8. **SSR, SEO, a11y et i18n.**
9. **Risque pour les flux live** (Stripe, auth) et phasage.
10. **Maintenabilité par des agents et réalisme de l'effort.**

---

## 2. STRATES : 79/100

| #   | Note | Justification                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 8    | Worker +0, garde oxlint, Stage ≤ 190 Ko, `d3-contour` à 10 Ko, polices JSON chargées seulement dans le Studio. Mais le fond `contour-field` (S1) sur toutes les pages et dans le footer impose le chunk Stage à **chaque** page `(site)`                                                                                                                                                        |
| 2   | 8    | Aucun changement de CSP, ni WASM ni média. L'état en fragment `#c=` n'atteint jamais le Worker. Mais si le nom ou le texte de la carte entrent dans le fragment, PostHog les capte dans `$current_url` (le hash y figure), et ce n'est pas traité                                                                                                                                               |
| 3   | 9    | Le h1 SSR est l'élément LCP. Poster SVG d'isolignes de 15 Ko généré au build par le même code, ratio réservé, donc CLS nul. Intro jouée une fois par session. Le passage du dessin à la matière est voulu, donc aucun raccord au pixel à réussir                                                                                                                                                |
| 4   | 6    | Aucune stratégie de niveau de détail pendant le glissé d'un curseur : 120 k triangles et un voronoï recalculés sur le fil principal dépassent 16 ms sur mobile. Export STL sur le fil principal. L'axe `wdth` d'Archivo lié à la vitesse de scroll fait une **mise en page par frame** sur un h1 géant                                                                                          |
| 5   | 8    | 120 k / 40 k triangles, moins de 20 draw calls, **aucun pin sur mobile**, repli poster sur `webglcontextlost`. Le FBM plein écran à chaque frame de scroll coûte cher en batterie mobile s'il n'est pas rendu en demi-résolution                                                                                                                                                                |
| 6   | 9    | **Seul concept juste sur la physique** : le multicolore en mode standard à 3 périmètres, la spirale seulement en monochrome. Test Vitest de propriété (chaque arête partagée par 2 triangles, 200 jeux de paramètres). Voronoï périodique en θ, pente ≤ 45°, bandes quantifiées à 0,2 mm, garde-fous sur la hauteur de capitale et le trait. QR de 29 modules sur 30 mm, qui tient sur la carte |
| 7   | 8    | STL ≤ 12 Mo au calcul juste, relais par `sessionStorage`, `QuoteForm` prérempli, Server Action sans `redirect()`, **centimes entiers** arrondis à 0,50. Mais une fourchette de ±8 % calée sur **un seul** point (le vase d'Ian) est trop sûre d'elle                                                                                                                                            |
| 8   | 9    | `/studio/[objet]` en SSR (h1, `<dl>`, FAQ), sitemap et `llms.txt`, `aria-valuetext` en unités, `fieldset`, `Intl.NumberFormat` jusque dans le canvas                                                                                                                                                                                                                                            |
| 9   | 8    | Liste d'exclusion de Lenis la plus complète (track et légal inclus). Mais des « exclusions par route » au lieu d'un groupe `(site)` explicite, et le Studio (l'axe central) n'arrive qu'en P2, après le héros                                                                                                                                                                                   |
| 10  | 6    | Beaucoup de sous-systèmes sur mesure : 8 scènes de Stage, `MapFrame`, graduations, transition plan, son, 5 objets, QR. En revanche, un générateur pur en TS, testé, facilite la reprise par un agent                                                                                                                                                                                            |

**Idées les plus fortes**

- Le générateur géométrique pur (mm, Z en haut, PRNG seedé) sert à la fois au poster SVG du build, à
  la vue Élévation de repli sans WebGL et à l'estimation serveur : une seule source de vérité.
- Le test de propriété sur le maillage fermé.
- `estimate.ts` sans three, réutilisable pour un prix ferme calculé par le serveur.
- Le fragment d'URL : aucun rendu Worker, aucun doublon SEO, aucune fragmentation du cache.
- Le sous-verre en `d3-contour` puis `Shape` extrudé par strate : 10 Ko, le multicolore par bandes
  sous sa forme la plus honnête.
- La distinction mode standard et mode spirale.
- Aucun pin sur mobile, impression autojouée en 3,2 s.

**Défauts graves**

- La régénération à chaque `input` n'a pas de budget, et un voronoï à 60 k sommets sur un mobile
  moyen coûte 15 à 30 ms, ce qui fait échouer l'INP du Studio.
- Le fond WebGL `contour-field` sur toutes les pages charge 190 Ko et occupe le GPU pour un décor qu'un
  SVG rendrait.
- `wdth` piloté par la vitesse de scroll fait une mise en page continue.
- Le texte personnel peut fuir via le fragment vers PostHog.

---

## 3. G1 (ATELIER) : 75/100

| #   | Note | Justification                                                                                                                                                                                                                                                                                                                                            |
| --- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 8    | Worker +0 et garde oxlint, footer en SVG pur. Mais le « formulaire SSR sans JS qui envoie en GET et affiche le poster » demande soit un poster par jeu de paramètres calculé dans le Worker (CPU et bundle), soit un poster générique, et ce n'est pas tranché                                                                                           |
| 2   | 9    | **Seul concept qui exclut les textes personnels de l'URL** (nLPD). Paramètres bornés par zod, `KEPT_PARAMS` et robots, aucun changement de CSP                                                                                                                                                                                                           |
| 3   | 8    | h1 ou SVG toolpath de 35 Ko en `fetchpriority="high"`, HUD en SSR. Un SVG de 35 Ko reste plus lourd que nécessaire pour un élément LCP                                                                                                                                                                                                                   |
| 4   | 9    | **Seule stratégie explicite de régénération** : basse résolution à chaque frame, haute résolution 150 ms après le relâchement, calcul dans un Web Worker, budget de 8 ms. Seule ombre : l'animation de `wdth` au passage de la buse                                                                                                                      |
| 5   | 7    | 92 k sommets, au plus 12 draw calls, aucun pin sous 768 px de haut, déclassement automatique après 60 frames lentes. Mais le rayon X sur un gyroïde (surface implicite) et les machines éclatées alourdissent GPU et code                                                                                                                                |
| 6   | 5    | **Contradiction avec sa propre thèse de vérité** : Onde est imprimée en « mode vase » avec 3 bandes et une tour de purge, alors que le mode spirale exclut en pratique les changements de filament et la tour de purge (Bambu Studio la désactive). Le gyroïde du rayon X ne sera pas celui que le trancheur imprime, et l'estimation de 5 Mo est fausse |
| 7   | 7    | Flux propre (Server Action existante, puis paiement dans `account/quotes/[id]/pay`), prix en CHF affiché seulement avec les coefficients du propriétaire, fourchette de ±20 % étalonnée sur 3 exports. Mais le plafond de 300 k triangles donne 15 Mo, et les centimes ne sont pas explicités                                                            |
| 8   | 9    | Contrôles natifs avec `<output>`, `aria-live`, JSON-LD `isBasedOn` et `license` pour l'attribution (précieux pour le SEO et les agents), test e2e du bloc d'attribution                                                                                                                                                                                  |
| 9   | 8    | Groupe `(site)` explicite, phases validées sur preview. Le Studio n'arrive qu'en P2 et seulement pour Onde, les 3 autres objets en P3                                                                                                                                                                                                                    |
| 10  | 5    | Un **mini-trancheur** (périmètres et remplissage à 45° par intersection ligne-polygone) sur 4 objets, un gyroïde, un configurateur sans JS et un registre : la plus grande surface sur mesure, et la moins liée à l'axe « personnalisation » du propriétaire                                                                                             |

**Idées les plus fortes**

- Le LOD de régénération (basse résolution pendant le geste, haute résolution au relâchement) dans un
  Web Worker, avec un budget de 8 ms.
- Aucun texte personnel dans l'URL.
- Le bouton « Simuler ×1 / ×10 / ×100 » par `drawRange`, avec la durée réelle annoncée : c'est la
  simulation d'impression appliquée _au configurateur_, comme le demande le propriétaire.
- Le JSON-LD `isBasedOn` et `license`.
- Aucun pin sous 768 px de hauteur d'écran, et déclassement automatique après 60 frames lentes.
- Aucun prix en CHF tant que les coefficients ne sont pas validés.
- La réglette Z verticale façon Bambu Studio.

**Défauts graves**

- Le multicolore en mode vase est physiquement faux, alors que c'est l'argument même du concept.
- Le mini-trancheur et le gyroïde représentent des semaines d'ingénierie pour une vraisemblance
  approximative.
- L'estimation de la taille du STL est fausse.

---

## 4. STUDIO : 71/100

| #   | Note | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 7    | Worker +0, Stage ≤ 210 Ko. Mais le héros « votre nom » impose de charger dès l'accueil une police typeface JSON (≈ 70 Ko), plus un deuxième matériau et une géométrie de particules, et ce coût n'est pas compté dans le budget de l'accueil                                                                                                                                                                                                                                            |
| 2   | 6    | **`?nom=` place un nom personnel dans la query string** : il part dans les logs Cloudflare, dans le `$current_url` et le referrer PostHog, et viole la règle « aucune donnée personnelle en paramètre d'URL ». Rien d'autre au CSP (worker same-origin, fflate en JS pur)                                                                                                                                                                                                               |
| 3   | 7    | Le h1 est visible, mais le poster AVIF 1080×1350 devient le LCP probable sur mobile. Le remplacement « au pixel près » ne tient que si le poster est rendu par le Stage lui-même (`/dev/poster`). Le poster Cycles du Tier B ne correspondra pas et provoquera un saut visible                                                                                                                                                                                                          |
| 4   | 7    | Le déplacement en GLSL rend le morph et les curseurs quasi gratuits pour le CPU (le meilleur INP possible), télémétrie DOM ≤ 10 Hz, export STL dans un Web Worker. Le prix à payer : **deux implémentations** de chaque motif, en TS et en GLSL                                                                                                                                                                                                                                         |
| 5   | 6    | Pin de 320 vh en desktop et de 200 svh sur mobile, 40 k / 8 k particules en plus d'un vase de 138 k triangles. Bonne idée iOS : l'input du nom sort du pin à cause du clavier. Critères bas de gamme explicites                                                                                                                                                                                                                                                                         |
| 6   | 7    | Badge « Imprimable » (surplomb, paroi, plateau 256³), préréglages distincts de la silhouette d'Ian. Mais la gravure par `holes` sans CSG casse dès que des contours de glyphes se chevauchent. Un QR vCard (version 8 à 10, 49 à 57 modules) à 1,2 mm par module mesure 59 à 68 mm et **ne tient pas sur une carte de 55 mm**. Enfin, une formule de grammes en paroi unique avec jusqu'à 8 bandes laisse entendre le mode vase, donc le même problème de physique que G1 en plus léger |
| 7   | 9    | Taille du STL juste, export en Worker, champs de `/custom` préremplis sans changement de schéma en v1, 3MF via `fflate` (JS pur) en v2, prix recalculé par le serveur, centimes, outil WebMCP `studio_configure`                                                                                                                                                                                                                                                                        |
| 8   | 8    | SSR, `Disallow: /studio/*?c=`, a11y la plus poussée (boutons d'orbite, `role="img"`, couleurs nommées). Le `?c=` en query fait tout de même atteindre le Worker à chaque lien partagé                                                                                                                                                                                                                                                                                                   |
| 9   | 8    | Groupe `(site)` et liste d'exclusion complète. **Studio en P1, avant le héros** : le bon ordre pour l'axe du propriétaire, avec le risque du héros isolé en P2                                                                                                                                                                                                                                                                                                                          |
| 10  | 6    | La double source TS/GLSL est un piège pour un agent : il modifie le motif en TS et oublie le GLSL. Le « test unitaire qui compare les deux » n'est pas réalisable tel quel dans Vitest sans contexte GL. Le morph de particules du héros est lui aussi entièrement sur mesure                                                                                                                                                                                                           |

**Idées les plus fortes**

- Le Studio livré avant le héros.
- L'export STL dans un Web Worker, puis le 3MF multi-objets via `fflate`, directement lisible par
  Bambu Studio et déjà accepté par `hasExpectedSignature` (préfixe PK).
- Le badge « Imprimable » avec la correction proposée.
- L'outil WebMCP `studio_configure`, cohérent avec les surfaces agents existantes.
- L'input du nom sorti du pin sur iOS.
- La télémétrie SSR calculée par la même fonction pure que le client.
- Les préréglages qui évitent explicitement la silhouette du Vase spirale.
- Les critères du palier bas de gamme (`saveData`, `deviceMemory`, 60 frames > 22 ms).
- Annuler et rétablir.

**Défauts graves**

- Des données personnelles dans la query string.
- Deux implémentations de la géométrie sans moyen réaliste de les tester l'une contre l'autre.
- Un héros de 320 vh à particules qui cumule le plus gros risque de performance et de délai sur la
  page la plus vue.
- Le QR vCard ne tient pas sur la carte.

---

## 5. Vainqueur : STRATES (79)

Strates gagne parce que c'est **le seul concept physiquement juste** (multicolore en mode standard),
qu'il a le premier paint le plus robuste (h1 et SVG de 15 Ko générés par le même code, aucun raccord
au pixel à réussir), une architecture de géométrie saine (pur TS, testée par propriété, partagée par
le build, le repli SVG et l'estimation serveur), aucune pin sur mobile et le calcul de STL juste. Ses
faiblesses (INP du configurateur, fond WebGL partout, phasage) se corrigent par greffe. Les défauts de
G1 (physique fausse, mini-trancheur) et de Studio (PII dans l'URL, double géométrie) touchent au
contraire leur cœur.

## 6. Greffes obligatoires sur Strates

**De G1**

1. **LOD de régénération** : basse résolution (≈ 64 × 120) à chaque frame de geste, haute résolution
   150 ms après le relâchement, calcul dans un **Web Worker** avec des `Float32Array` transférables et
   un budget de 8 ms par frame, vérifié dans un test de performance.
2. **Aucun texte personnel dans l'état partagé** : le fragment ne porte que la forme et les couleurs,
   le texte passe par `sessionStorage`. Ajouter un `before_send` PostHog qui retire le hash sur
   `/studio`.
3. **Groupe de routes `(site)`** explicite pour le Stage persistant et Lenis, au lieu d'exclusions par
   route.
4. **Footer en SVG pur**, et un `contour-field` WebGL limité à l'accueil. Ailleurs, les isolignes sont
   en SVG statique généré au build.
5. **« Simuler ×1 / ×10 / ×100 »** par `drawRange` dans le Studio : la simulation d'impression
   appliquée aux objets configurables.
6. **Aucun pin sous 768 px de hauteur** et déclassement automatique après 60 frames lentes.
7. **JSON-LD `isBasedOn` et `license`** sur la fiche du Vase spirale, avec un test e2e du bloc
   d'attribution.
8. **Fourchette de ±15 à 20 %** tant que l'étalonnage ne repose pas sur au moins 3 exports Bambu
   Studio. Aucun CHF affiché avant la validation des coefficients.

**De Studio** 9. **Le Studio en P1**, le héros en P2 : l'axe central du propriétaire est livré en premier et le
héros réutilise son générateur. 10. **Export dans un Web Worker, en écrivant le STL binaire directement depuis les tableaux du
générateur** (sans three dans le worker, et plus simple que `STLExporter`). Pas vertical adaptatif
pour viser **1 à 3 Mo** sur le vase. **3MF via `fflate`** en v2 pour la carte et l'étiquette
(objets séparés par couleur). 11. **Badge « Imprimable »** avec la correction proposée, alimenté par les mêmes bornes que le test de
propriété. 12. **Outil WebMCP `studio_configure`**, sortie limitée à un lien sans texte personnel. 13. **Input de texte hors de toute section pinnée** (clavier iOS), télémétrie DOM ≤ 10 Hz. 14. **Critères explicites du palier bas de gamme** (`saveData`, `deviceMemory ≤ 2`, absence de
WebGL2, 60 frames > 22 ms). 15. **Préréglages testés pour rester loin de la silhouette du Vase spirale.** 16. **Preview dédiée à la refonte**, avec le vase et `model_3d_url` réinjectés.

**Correctifs propres au vainqueur** 17. **Polices pour `TextGeometry`** : n'utiliser que des instances **statiques aux contours
fusionnés** (`fonttools varLib.instancer --remove-overlaps`) avant la conversion en typeface
JSON. Les polices variables (Archivo, Bricolage, Martian Mono) ont des contours qui se
chevauchent, ce qui casse la détection des trous par `ShapePath.toShapes`. Ajouter un test de
triangulation sur tout le jeu Latin-1. 18. **Ne jamais lier `wdth` à la vitesse de scroll sur le h1**, pour éviter une mise en page par frame
sur l'élément LCP. Soit des paliers discrets sur un titre non LCP avec
`contain: layout inline-size`, soit rien. 19. **Réduire les scènes de 8 à 5 en v1** : S2 héros, S3 objet Studio (le « band-ripple » S6 et le
générateur de relief S8 deviennent des uniforms et des générateurs de S3), S4 viewer produit, S7
vignettes, et S5 transition plan en option de P1. Le champ de courbes S1 reste réservé à
l'accueil. 20. **Rendre le FBM de fond à 0,5× dans un render target**, et seulement quand le scroll bouge. 21. **Budget INP mesuré** sur un Android moyen de 2023, à trois moments : glissé d'un curseur,
frappe de texte et clic « Envoyer à l'atelier ». La porte de sortie de la phase P1 est
INP ≤ 150 ms.

# Refonte 2026 : stack motion et graphisme (tech.md)

> Recherche du 2026-09-27, branche `claude/redesign-2026`. Lecture seule : aucune
> modification du dépôt. Les faits viennent des registres npm, de la
> documentation Next.js installée (`node_modules/next/dist/docs`), des sources
> installées (`node_modules/motion`, `framer-motion`, `three`, `react`,
> `next-intl`) et de sources web (liste en fin de fichier).

---

## 0. Décision en une page

| Couche                       | Choix                                                                                                           | Version exacte                                     | Rôle                                                                                                                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chorégraphie et scroll       | **GSAP** (ScrollTrigger, SplitText, Flip, CustomEase, DrawSVG, MorphSVG à la demande) + `@gsap/react` (useGSAP) | `gsap@3.15.0`, `@gsap/react@2.1.2`                 | Timelines, scroll scrubbing, pinning, texte découpé, tweens des uniforms WebGL                                                                                                                                                         |
| Défilement fluide            | **Lenis** (`lenis/react`, piloté par `gsap.ticker`)                                                             | `lenis@1.3.26`                                     | Défilement inertiel. Le scroll reste natif, donc `position: sticky`, IntersectionObserver et ScrollTrigger fonctionnent sans `scrollerProxy`                                                                                          |
| Animations d'UI              | **Motion** (déjà installé) via `LazyMotion` + `m`                                                               | `motion@13.4.4`                                    | Montage/démontage (AnimatePresence), animations de layout, gestes, ressorts, micro-interactions. Déjà rendu côté serveur                                                                                                               |
| Transitions de page          | **React `<ViewTransition>`** (React 19.3, intégré à l'App Router de Next 16.3, sans configuration) + `transitionTypes` sur `Link`/`router.push` | `react@19.3.0`, `next@16.3.6`                      | Morph d'élément partagé (vignette produit vers héros produit), glissements directionnels, fondus. `motion/react-animate-view` (AnimateView) en option                                                                                  |
| WebGL                        | **three.js**, `WebGLRenderer` (WebGL2) + GLSL maison (`ShaderMaterial` / `onBeforeCompile`)                   | `three@0.186.1` (installé), `@types/three@0.186.0` | Un seul « Stage » : une scène et un contexte par page. Héros 3D, viewer produit, plans suivant le DOM, effets plein écran                                                                                                               |
| Post-traitement              | **pmndrs `postprocessing`**, desktop seulement, désactivable                                                    | `postprocessing@6.39.5` (peer `three >=0.168 <0.187`, compatible 0.186) | Bloom léger, grain, dithering, aberration chromatique, SMAA                                                                                                                                                                     |
| Pont Motion vers three       | `motion/three` (`threeEffect`, nouveau dans Motion 13)                                                          | inclus dans `motion@13.4.4`                        | Facultatif : animer des uniforms ou des meshes avec les springs de Motion                                                                                                                                                              |
| Polices                      | `next/font` (google ou local), polices variables à axes                                                         | Next 16.3.6                                        | Auto-hébergées au build, donc `font-src 'self'` suffit                                                                                                                                                                                 |
| Écarté                       | R3F/drei (option B, voir §4), OGL, Spline, ScrollSmoother, Theatre.js, LYGIA (licence), WebGPU/TSL pour l'instant | —                                                  | Raisons au §4                                                                                                                                                                                                                          |

**Règle d'architecture n° 1 (bundle du Worker) :** `gsap`, `lenis`, `three`,
`postprocessing` et tout le code qui les importe vivent sous `src/motion/**`.
Ce dossier n'est **jamais** importé statiquement ailleurs. On ne l'atteint que
par `next/dynamic(() => import(...), { ssr: false })`, déclaré dans un
composant client. Avec `ssr: false`, le transform SWC de Next retire l'import
du build serveur. En revanche, un `await import("three")` dans un `useEffect`
d'un composant client rendu côté serveur **reste** dans le bundle du Worker
sous forme de chunk paresseux, car OpenNext embarque tout ce qui est
atteignable. AGENTS.md le confirme : importer directement `showroom-scene.ts`
coûte environ 243 KiB gzip côté serveur. Cette règle s'impose avec
`no-restricted-imports` d'oxlint : interdire `gsap*`, `lenis*`, `three*` et
`postprocessing` hors de `src/motion/**`. On vérifie avec
`bunx wrangler deploy --dry-run` (ligne `gzip:`).

**Règle n° 2 (SEO et LCP) :** tout le contenu est rendu côté serveur, lisible
sans JS et sans WebGL. Le mouvement enrichit un DOM déjà complet
(amélioration progressive). L'élément LCP (titre du héros ou image poster en
AVIF avec `fetchpriority="high"`) est visible dès le premier paint : jamais
`opacity: 0` en attendant le JS. Le canvas arrive après, en fondu par-dessus
le poster.

---

## 1. GSAP 3.15 : licence, plugins, intégration React 19 / Next 16

### Licence (vérifiée)

- Webflow a racheté GreenSock le 15 octobre 2024. Depuis la 3.13 (avril 2025),
  **tout GSAP est gratuit, y compris en usage commercial**, avec tous les
  anciens plugins « Club » : SplitText, MorphSVG, DrawSVG, ScrollSmoother,
  Inertia, Physics2D, CustomEase, etc. Plus de clé, de token ni de registre
  privé.
- Le champ `license` du paquet npm vaut
  `Standard 'no charge' license: https://gsap.com/standard-license`. Seule
  restriction : ne pas utiliser GSAP dans un **outil d'animation visuelle sans
  code concurrent de Webflow**. Une boutique n'est pas concernée, et le code
  généré par IA est explicitement autorisé. Aucune attribution n'est exigée.
- Ce n'est pas du MIT. C'est acceptable pour ce projet, mais à mentionner dans
  `LICENSE.md` et les crédits si besoin.

### Versions

- `gsap@3.15.0` (dernière). Nouveauté : `easeReverse`, qui remplace
  `yoyoEase` (déprécié) pour appliquer un autre ease quand la tête de lecture
  recule. Pratique pour les animations scrubbées. Correctifs sur ScrollTrigger,
  Observer et SplitText.
- `@gsap/react@2.1.2` : peers `gsap ^3.12.5`, `react >=17`, donc React 19.3
  est compatible.
- Types TypeScript inclus (`types/index.d.ts`). Imports ESM :
  `gsap/ScrollTrigger`, `gsap/SplitText`, `gsap/Flip`, `gsap/CustomEase`,
  `gsap/DrawSVGPlugin`, `gsap/MorphSVGPlugin`.
- Poids : environ 23 à 27 KiB gzip pour le cœur, environ 13 à 17 KiB pour
  ScrollTrigger, quelques KiB chacun pour SplitText (réécrit en 3.13, deux fois
  plus léger) et Flip. Le chunk « motion runtime » complet
  (gsap + ScrollTrigger + SplitText + Flip + Lenis) pèse environ 55 à 70 KiB
  gzip, côté client uniquement.

### SplitText 3.13+ (ce qui compte pour la refonte)

- `mask: "lines" | "words" | "chars"` ajoute des wrappers en `overflow: clip`,
  ce qui donne des révélations ligne par ligne propres.
- `autoSplit: true` + `onSplit(self)` : re-découpe au chargement des polices
  (`document.fonts`) et au redimensionnement (debounce de 200 ms). Il faut
  **retourner l'animation depuis `onSplit`** pour qu'elle soit recréée.
- `aria` est actif par défaut : `aria-label` sur le parent, `aria-hidden` sur
  les fragments. Le texte rendu par le serveur reste intact pour le SEO. Le
  découpage ne se fait que côté client.
- Toujours `revert()` (useGSAP le fait via son contexte).

### Intégration React 19.3 / App Router

- `useGSAP(() => {...}, { scope: ref, dependencies: [...] })` repose sur un
  `gsap.context()` : au démontage (y compris au double montage du Strict
  Mode), toutes les tweens, timelines et ScrollTriggers sont revertés. Les
  handlers d'événements se wrappent avec `contextSafe`.
- On enregistre les plugins une fois dans `src/motion/gsap.ts` :
  `gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip, CustomEase)`,
  plus `gsap.defaults({ ease: "expo.out", duration: 0.9 })` et des eases
  maison (`CustomEase.create("s3d", ...)`). Tous les modules importent depuis
  `@/motion/gsap`, jamais depuis `gsap` directement (approche de basement.studio).
- `gsap.matchMedia()` sert à la fois au responsive et au reduced motion :
  ```ts
  const mm = gsap.matchMedia();
  mm.add(
    {
      full: "(prefers-reduced-motion: no-preference) and (min-width: 768px)",
      mobile: "(prefers-reduced-motion: no-preference) and (max-width: 767px)",
      reduce: "(prefers-reduced-motion: reduce)",
    },
    (ctx) => {
      /* ctx.conditions.reduce → états finaux, fondus seulement, zéro pin/scrub */
    },
  );
  ```
- Changement de route : les chorégraphies de page sont montées dans chaque
  `page.tsx` et non dans le layout, pour que useGSAP nettoie au démontage.
  Après montage : `ScrollTrigger.refresh()`, plus un second refresh après
  `document.fonts.ready` et après le chargement des images au-dessus de la
  ligne de flottaison.
- Ne **pas** utiliser `ScrollTrigger.normalizeScroll()` avec Lenis : les deux
  se battent.
- CSP : GSAP n'utilise ni `eval` ni `new Function`, et les styles inline posés
  via CSSOM ne relèvent pas de `style-src`. À confirmer quand même par un
  passage `bun run preview` (golden rule 4).

---

## 2. Lenis 1.3.26 : défilement fluide

- Paquet unique `lenis` (MIT) avec les exports `.`, `./react`, `./snap`,
  `./vue` et `./dist/*`. Les anciens paquets `@studio-freight/*` sont morts.
- CSS obligatoire : `import "lenis/dist/lenis.css"`, qui gère `html.lenis`,
  `[data-lenis-prevent]` et `.lenis-stopped`.
- Options utiles, confirmées dans le README :
  - `autoRaf: false` quand GSAP pilote la boucle.
  - `lerp: 0.1` ou `duration: 1.2`.
  - `anchors: true` pour les liens d'ancre fluides.
  - `stopInertiaOnNavigate: true` : l'inertie s'arrête sur un clic de lien
    interne. Indispensable avec le routeur Next, qui remonte en haut de page.
  - `allowNestedScroll: true`, à léger coût : gère les conteneurs imbriqués
    (tiroir panier, menus, sélecteurs).
  - `autoToggle: true`.
  - **`respectReducedMotion` (défaut `true`)** : sous `prefers-reduced-motion`,
    le lissage est coupé et les scrolls programmés deviennent instantanés.
    `lenis.prefersReducedMotion` est exposé.
- Synchronisation avec ScrollTrigger (recommandation officielle) :
  ```ts
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  ```
  En React : `<ReactLenis root options={{ autoRaf: false, ... }} ref={lenisRef} />`,
  puis `lenisRef.current?.lenis?.raf(...)` dans le ticker.
- **Piège :** avec `autoRaf: false`, si le ticker GSAP n'est pas encore là, la
  molette ne défile plus du tout. Il faut donc monter `ReactLenis` **dans le
  même chunk client-only que GSAP** (le `MotionRuntime`). Avant son arrivée,
  le scroll natif fonctionne. Lenis s'active ensuite sans aucune rupture.
- Limites connues : Safari est plafonné à 60 fps, pas de CSS scroll-snap (il
  faut `lenis/snap`), pas d'iframes, `syncTouch` fragile sous iOS 16 (le
  laisser à `false`, défaut : le tactile reste natif, ce qui est le bon choix
  sur mobile), léger décalage de `position: fixed` sur Safari macOS Intel.
- **Périmètre :** Lenis sur les pages vitrine (accueil, boutique, produit,
  sur-mesure, à propos). **Pas de Lenis sur `/checkout`, `/cart`, `/account`,
  `/admin` ni les pages légales** : on ne touche pas au tunnel Stripe LIVE. Il
  faut donc un `lenis.stop()` ou un démontage selon la route, plus
  `data-lenis-prevent` sur les modales, le tiroir panier et les listes
  déroulantes.
- ScrollSmoother (GSAP, gratuit lui aussi) est écarté. Il déplace le contenu
  par transform dans un wrapper `#smooth-content`, ce qui casse
  `position: fixed/sticky` dans le contenu et complique les snapshots de View
  Transition. Lenis garde le scroll natif.

---

## 3. Motion 13.4.4 (installé) : quel rôle à côté de GSAP

Vérifié dans `node_modules` : `motion@13.4.4` et `framer-motion@13.4.4`, avec
les exports `./react`, `./react-m`, `./react-mini`, `./react-animate-view`,
`./three`, `./vgpu` et `./mini`.

- Nouveautés 13.x utiles :
  - `AnimateView` (`motion/react-animate-view`, « requires React and React DOM
    19.3 or later ») anime les enter, exit, share et update des View
    Transitions avec le moteur Motion.
  - `animate.addEffect()` + `threeEffect` (`motion/three`) animent des meshes,
    matériaux et uniforms three.js. Les écritures se font en `frame.preRender`.
  - Scroll animé nativement via ScrollTimeline, avec offsets `"start"`/`"end"`
    accélérés matériellement.
  - `layout="x" | "y"`, `layoutAnchor`, couleurs `oklch`/`color-mix`.
- Poids mesuré (gzip, dans `framer-motion/dist`) : `motion` complet environ
  40 KiB, `domAnimation` environ 14 KiB, `m` environ 3 KiB, `animate` environ
  20 KiB, `mini` environ 4 KiB. **Passer à `LazyMotion features={domAnimation}`
  + `m.*`** réduit le poids de Motion côté client et serveur.
- **Partage des rôles, pour éviter les doublons :**
  - GSAP : tout ce qui est lié au scroll (scrub, pin), les timelines
    multi-éléments, SplitText, Flip entre états de grille, DrawSVG/MorphSVG et
    les tweens d'uniforms WebGL.
  - Motion : l'état des composants React (AnimatePresence, tiroir panier,
    toasts, menus, boutons magnétiques, hover spring, layout d'accordéons,
    compteur panier).
  - Interdit : animer la même propriété d'un même élément avec les deux
    librairies.
- On garde `useReducedMotion()` et on ajoute `<MotionConfig reducedMotion="user">`
  à la racine.

---

## 4. WebGL : three.js 0.186 vs React Three Fiber/drei vs OGL

### Faits vérifiés

- `three@0.186.1` est la dernière version publiée (MIT). r186 apporte
  WebGPURenderer et TSL matures, avec repli WebGL2, et un renderer de
  Gaussian splats (WebGPU/TSL).
- Poids mesuré sur les builds non minifiés, en gzip : `three.core.js`
  284 KiB, `three.module.js` 129 KiB, `three.webgpu.js` 437 KiB. Minifié et
  tree-shaké, la voie WebGL tourne autour de 150 à 180 KiB gzip. La voie
  WebGPU est nettement plus lourde.
- `@react-three/fiber@9.8.1` : peers `react >=19 <19.4`, `three >=0.156`.
  **La 9.8.0 (22 sept. 2026) est la première compatible React 19.3.** Les
  versions antérieures bloquaient à `<19.3`, avec un crash réel de
  `useTransition()` venant de leur réconciliateur embarqué (issue #3915).
  Cette compatibilité date donc de 5 jours.
- `@react-three/drei@10.7.9` : peer fiber `^9`. Ses dépendances incluent
  hls.js, `@mediapipe/tasks-vision`, troika-three-text, three-stdlib,
  camera-controls, detect-gpu, stats-gl et meshline. Tout est tree-shakable,
  mais c'est un périmètre à surveiller.
- R3F v10 est en alpha (WebGPU/TSL, `@pmndrs/scheduler`), avec drei 11 alpha.
  Pas pour la production.
- `@react-three/postprocessing@3.1.3` : peer fiber `>=9.7.0`.
- `ogl@1.0.11` (Unlicense, environ 8 KiB gzip, types inclus), dernière
  publication il y a environ un an.

### Décision : three.js « vanilla » avec un Stage maison (option A, retenue)

1. **Cohérence :** le code actuel (`showroom-scene.ts`, `product-viewer-3d.tsx`)
   est déjà en three impératif. Le viewer produit, les vignettes 3D et le
   héros partagent une seule librairie.
2. **Risque :** on évite un réconciliateur React embarqué dont la
   compatibilité avec React 19.3 date de 5 jours, sur un site LIVE.
3. **Contrôle du poids et du CSP :** drei va chercher des ressources sur des
   CDN par défaut. Les presets `Environment` récupèrent des HDR distants,
   troika des polices de repli, `detect-gpu` ses benchmarks sur unpkg, et le
   décodeur Draco de `useGLTF` vient de gstatic. Tout cela est bloqué par
   `connect-src 'self'`.
4. **Le Stage** (environ 300 lignes, sous `src/motion/stage/`) :
   - un `WebGLRenderer` unique en `position: fixed` derrière le contenu
     (`pointer-events: none`, `aria-hidden`), monté dans le layout
     `[locale]`, donc persistant entre les routes ;
   - un registre de « vues » attachées à des éléments DOM (`data-stage="hero"`,
     `data-stage-plane`), rendues en `setScissor`/`setViewport` : le même
     principe que `<View>` de drei ou r3f-scroll-rig ;
   - les rectangles DOM mis en cache au resize et décalés au scroll Lenis,
     sans `getBoundingClientRect` à chaque frame ;
   - boucle sur `gsap.ticker` (la même que Lenis), en pause si
     `document.hidden` ou si aucune vue n'est visible (IntersectionObserver),
     et rendu à la demande quand rien ne bouge.
5. **Option B (si la vélocité prime) :** R3F 9.8.1 + drei 10.7.9 à version
   exacte, sans `^`, avec `<Canvas>` persistant et drei `<View>`. À réévaluer
   quand R3F 9.8 aura fait ses preuves avec React 19.3 (quelques semaines),
   et en auto-hébergeant toutes les ressources (HDR, polices, décodeurs).
6. **OGL est écarté** : un deuxième moteur coûte plus en complexité qu'il ne
   fait gagner en poids, puisque three est de toute façon nécessaire pour les
   GLB/STL PBR des produits. Les effets 2D plein écran (dégradés en bruit,
   dithering, grain, déplacement d'images) passent par des `ShaderMaterial`
   sur des plans, **dans le même contexte**. Il faut un seul contexte WebGL
   par page (Safari iOS limite le nombre de contextes simultanés).
7. **WebGPU/TSL : pas maintenant.** `postprocessing@6` ne supporte pas
   WebGPURenderer (il faudrait le `RenderPipeline` TSL de three), le build est
   plus lourd, et le support Firefox reste partiel. GLSL/WebGL2 fonctionne
   partout. On réévaluera en 2027.

### Post-traitement

- `postprocessing@6.39.5` : peer `three >= 0.168.0 < 0.187.0`, compatible avec
  0.186.1. Attention, la mise à jour de three vers 0.187 cassera ce peer :
  bloquer three à `~0.186` tant que postprocessing n'a pas suivi. La v7 est en
  beta (7.0.0-beta.16).
- Utilisation : un seul `EffectPass` qui fusionne les effets (bloom léger
  seuillé sur le rouge marque, grain et dithering, vignette, SMAA). **Sur
  mobile ou GPU modeste :** pas de composer, grain intégré au shader de
  matériau et DPR plafonné.
- Pas de `detect-gpu` (CDN). On choisit la qualité par heuristique :
  `matchMedia('(pointer: coarse)')`, `navigator.hardwareConcurrency`,
  `navigator.deviceMemory`, `navigator.connection?.saveData`, plus une mesure
  des 60 premières frames qui fait redescendre d'un niveau si ça rame.

### Shaders GLSL : techniques retenues et sources libres

- **Shaders en littéraux TypeScript** (`/* glsl */ \`...\``), sans loader
  `.glsl`. Ça marche aussi bien avec Turbopack en dev qu'avec webpack pour le
  build OpenNext, sans configuration.
- **Bruit :** simplex, curl et FBM d'Ashima/Stefan Gustavson (MIT), à copier
  dans `src/motion/stage/glsl/noise.ts`, ou le paquet `glsl-noise` (celui
  qu'utilise drei). **LYGIA est à éviter** : double licence Prosperity (non
  commerciale) + Patron (réservée aux sponsors), donc un usage commercial
  exige un sponsoring ou une licence négociée.
- **Signature « impression couche par couche »** (le cœur du concept) :
  `onBeforeCompile` sur `MeshPhysicalMaterial`, pour garder l'éclairage PBR.
  - `discard` si `vWorldPos.y > uPrintHeight` ;
  - bande émissive rouge `#E5231C` à la ligne de coupe (la buse chaude) ;
  - quantification `floor(y / uLayerH)` pour rendre les couches lisibles ;
  - palette multicolore par bandes de couches (changements de filament) ;
  - `uPrintHeight` scrubbé par ScrollTrigger.
  - Ça marche sur les vrais modèles produits (STL/GLB déjà dans R2), sans
    asset IA.
- **Dithering :** matrice de Bayer 4×4/8×8 ordonnée, ou texture de bruit bleu
  (CC0, Christoph Peters, « Moments in Graphics »), en post-pass ou dans les
  shaders 2D. C'est l'esthétique « trame » très 2026.
- **Déplacement :** survol des cartes produit avec UV déplacées par bruit et
  légère séparation RGB. Transition de page par un « wipe » dithered sur le
  canvas persistant.
- **Matériau « filament » :** légère transmission et sheen
  (`MeshPhysicalMaterial.sheen`, `iridescence` très bas), avec une normal map
  de stries de couches générée en procédural.

---

## 5. Transitions de page : View Transitions dans Next 16.3

D'après `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` et
`link.md` :

- **Aucune configuration.** `import { ViewTransition } from "react"`.
  Confirmé dans `react@19.3.0` : `exports.ViewTransition` et
  `addTransitionType` en build de production. Les navigations de l'App Router
  sont des transitions, donc les animations se déclenchent automatiquement.
- **`<Link transitionTypes={["nav-forward"]}>`** existe depuis Next 16.2, et
  `router.push(href, { transitionTypes })` aussi. `next-intl` forwarde bien le
  prop : son `Link` dérive de `LinkProps` de `next/link`, et ses types
  `createNavigation` déclarent `transitionTypes?: string[]`.
- Patterns :
  - **Morph partagé :** `name={\`product-${id}\`}` identique sur la carte de
    la grille et sur le héros de la fiche, avec `share="morph"` et
    `default="none"`. Le morph ne joue que si la destination est rendue dans
    le même commit (pages préchargées). Sinon c'est l'animation d'entrée qui
    joue.
  - **Révélation de Suspense :** `exit="slide-down"` sur le fallback,
    `enter="slide-up"` sur le contenu.
  - **Glissement directionnel :** wrapper dans chaque `page.tsx`, pas dans le
    layout, qui persiste.
  - **Header ancré :** `viewTransitionName: 'site-header'` + CSS
    `animation: none`.
  - `::view-transition { pointer-events: none }`.
  - Neutralisation sous `prefers-reduced-motion`.
- Support navigateurs : les transitions same-document sont Baseline (Chrome
  111+, Safari 18+, Firefox 144+). **Firefox n'implémente pas les
  transition types** : pas de glissement directionnel, mais le morph
  fonctionne. Sans support, la navigation reste normale.
- Articulation avec GSAP : la View Transition gère le DOM (morph, fondus). Le
  Stage WebGL persistant peut en plus jouer un wipe shader via `onStart` de la
  navigation (`useRouter` + `startTransition`). On tue ou on rafraîchit les
  ScrollTriggers à la fin de la transition.

---

## 6. CSS natif : scroll-driven animations

- `animation-timeline: view()` / `scroll()` : Chrome/Edge 115+, **Safari 26**
  (threadé depuis 26.4). **Firefox 152 l'a encore derrière un flag** (priorité
  Interop 2026). Couverture globale d'environ 84 %.
- Usage : petites révélations et parallaxes non critiques, **tout sur le
  compositeur, donc zéro coût d'INP**. Encapsulé dans
  `@supports (animation-timeline: view())`, avec un repli en état final
  visible. Les séquences riches restent sur ScrollTrigger (pin, scrub
  multi-éléments, synchronisation WebGL).

---

## 7. Polices (`next/font`)

- `next/font/google` et `next/font/local` auto-hébergent au build, donc
  `font-src 'self'` suffit, sans changement de CSP. `preload` est à `true` par
  défaut (uniquement sur les routes où la police est appelée).
  `adjustFontFallback` évite le CLS. `axes: ['wdth','opsz']` inclut les axes
  variables en plus de `wght`.
- **Typographie cinétique :** animer `font-variation-settings`
  (`wght`/`wdth`) au scroll avec GSAP, sur une police variable d'affichage.
  Pistes libres à trancher avec la recherche design : Bricolage Grotesque
  (opsz, wdth, wght), Anybody (wdth 50–150), Roboto Flex. On garde Geist pour
  l'UI, avec **Geist Mono** pour les étiquettes techniques d'impression
  (couche 0.12 mm, 215 °C).
- Si une police premium suisse est choisie (Dinamo, Grilli Type, Swiss
  Typefaces, Optimo, Milieu Grotesque) : licence web payante, par paliers de
  trafic, à acheter par le propriétaire. Intégration par `next/font/local`
  avec des woff2 variables sous-ensemblés. Coûts à vérifier chez chaque
  fonderie.
- Une seule police d'affichage préchargée, en `display: swap`. Le découpage
  SplitText se refait après `document.fonts.ready` (`autoSplit`).

---

## 8. Contraintes de production et changements de CSP nécessaires

Analyse du CSP actuel (`src/middleware.ts` → `buildCsp`) :

| Directive actuelle                                   | Impact sur la refonte                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Action                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connect-src 'self' …` **sans `blob:`**              | **Bug latent confirmé :** `GLTFLoader` sous Chrome utilise `ImageBitmapLoader`, qui fait un `fetch()` des textures embarquées d'un GLB via des URL `blob:`. Refusé par `connect-src`, ce qui donne des GLB texturés sans textures. C'est un problème connu (forum three.js, plusieurs PR de projets tiers). Le dev est aussi touché, car le CSP de dev a le même `connect-src`. Le viewer actuel ne teint que la couleur, ce qui explique pourquoi le bug n'est pas encore apparu.  | **Ajouter `blob:` à `connect-src`** (risque minimal) dès qu'on charge un GLB texturé.                                                                                                                                                                                                                                                                             |
| `script-src 'self' 'nonce-…'` sans `'wasm-unsafe-eval'` | Tout décodeur WASM est bloqué : Draco (`DRACOLoader`), Meshopt (`EXT_meshopt_compression`), KTX2/Basis, runtime Rive, dotLottie (ThorVG), Spline (Draco interne). three, GSAP, Lenis, Motion et postprocessing n'en ont **pas** besoin.                                                                                                                                                                                                                                                                                  | Commencer **sans** WASM : GLB en `KHR_mesh_quantization` (pas de décodeur), textures WebP/AVIF, géométries allégées dans Blender. Si Meshopt, KTX2 ou Rive deviennent nécessaires, ajouter **`'wasm-unsafe-eval'`**. Ce mot-clé n'autorise que la compilation WASM, pas `eval` ni `new Function`. Auto-héberger les `.wasm` (`application/wasm`) et valider avec `bun run preview`. |
| `worker-src 'self' blob: data:`                      | OK : worker blob de DRACOLoader, troika, OffscreenCanvas dans un worker.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                                                                                                                                                                                                                                                                                                                                                 |
| `media-src` absent, donc `default-src 'self'`        | Les vidéos (boucles du héros) doivent être servies **en same-origin**.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | MP4/WebM dans `public/` (assets statiques Workers : 25 MiB max par fichier, 100 000 fichiers en Paid), ou R2 via une route same-origin. Si on passe par un domaine R2 dédié (ex. `media.swiss3design.ch`) : `media-src 'self' https://media.swiss3design.ch`. Si HLS ou MSE : ajouter `blob:`. Vérifier le support des requêtes Range pour le scrubbing vidéo.                          |
| `img-src 'self' data: blob: https:`                  | OK pour les textures via `<img>`/`TextureLoader` et le dataURL des vignettes.                                                                                                                                                                                                                                                                                                                                                                                                                                             | —                                                                                                                                                                                                                                                                                                                                                                 |
| `style-src 'unsafe-inline'`                          | OK pour GSAP, Motion, Lenis et les styles inline de View Transition.                                                                                                                                                                                                                                                                                                                                                                                                                                                      | —                                                                                                                                                                                                                                                                                                                                                                 |
| `frame-src` limité à Stripe                          | Les embeds Spline, Unicorn Studio ou YouTube en iframe sont bloqués.                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Ne pas utiliser d'iframes de tiers. Tout doit être auto-hébergé.                                                                                                                                                                                                                                                                                                  |

**Aucun script inline nouveau.** S'il faut un script pré-hydratation (par
exemple poser `html.has-motion` ou `html.reduce-motion` avant le paint pour
éviter le flash), il doit recevoir le nonce via `(await headers()).get("x-nonce")`
(golden rule 4). Préférer du CSS pur quand c'est possible, par exemple
`@media (prefers-reduced-motion)`.

### Budgets (cibles p75 mobile 4G, mesurées via PostHog web vitals + DevTools)

- **LCP ≤ 2,0 s**, **INP ≤ 150 ms**, **CLS ≤ 0,05**.
- **JS initial client** hors chunks motion : ne pas dépasser l'actuel.
  **Chunk motion** (GSAP + ScrollTrigger + SplitText + Flip + Lenis) : environ
  60 KiB gzip, chargé après l'hydratation. **Chunk Stage WebGL** (three +
  scènes + postprocessing) : environ 180 à 230 KiB gzip, chargé en
  `requestIdleCallback` ou quand le héros est visible, **jamais** sur
  checkout, compte ou admin.
- **Worker serveur :** +0 KiB pour gsap, lenis, three et postprocessing.
  Motion est déjà dans le bundle (et diminue avec LazyMotion).
- **GPU :** un contexte WebGL par page. DPR plafonné à 2 sur desktop et 1,5
  sur mobile. Moins de 100 draw calls. Héros sous 300 000 triangles sur
  desktop et 100 000 sur mobile. Textures jusqu'à 2048 sur desktop et 1024 sur
  mobile. **Charge 3D de l'accueil ≤ 1,5 Mo sur desktop et ≤ 800 Ko sur
  mobile.** Boucle en pause hors écran et onglet caché. Rendu à la demande au
  repos.
- **Vidéo :** boucle du héros ≤ 2,5 Mo sur mobile (720p) et ≤ 5 Mo sur
  desktop (1080p). AV1 + H.264 en repli. `muted playsinline`, poster AVIF
  ≤ 80 Ko, `preload="metadata"`. Rien si `saveData`.
- **INP :** pas de SplitText sur des centaines de nœuds simultanés (découper
  à l'entrée dans la vue). Aucune lecture de layout dans les callbacks de
  scroll (valeurs mises en cache). `will-change` posé seulement pendant
  l'animation. Option avancée si l'INP souffre : Stage dans un worker via
  OffscreenCanvas (autorisé par `worker-src`).

### Accessibilité et reduced motion (politique unifiée)

- **Lenis :** `respectReducedMotion` (défaut).
- **GSAP :** branche `reduce` de `gsap.matchMedia()` : états finaux, fondus
  courts, aucun pin ni scrub.
- **Motion :** `MotionConfig reducedMotion="user"`.
- **WebGL :** une seule frame statique (ou le poster), pas de boucle.
- **Vidéo :** pas d'autoplay, poster + bouton lecture.
- **View Transitions :** durée à 0 ou fondu seul.
- **Interrupteur « Réduire les animations »** dans le footer (préférence en
  `localStorage`, dans un try/catch). Ça couvre aussi **WCAG 2.2.2**, qui
  demande un moyen de mettre en pause tout contenu animé automatiquement plus
  de 5 s (boucles vidéo ou WebGL).
- Canvas et vidéos décoratifs en `aria-hidden`. Toute info montrée en 3D
  existe aussi en texte HTML.

---

## 9. Architecture de fichiers proposée (branche de refonte)

```
src/motion/                       ← SEUL endroit autorisé à importer gsap/lenis/three/postprocessing
  gsap.ts                         registerPlugin, defaults, CustomEase maison
  runtime.tsx      "use client"   MotionRuntime : ReactLenis root (autoRaf:false) + ticker GSAP,
                                  matchMedia, refresh sur changement de pathname + fonts.ready,
                                  stop Lenis sur /checkout|/cart|/account|/admin
  choreo/home-hero.tsx …          chorégraphies par section (ciblent le DOM serveur via ref/data-*)
  stage/renderer.ts               WebGLRenderer unique, tiers de qualité, boucle sur gsap.ticker
  stage/tracker.ts                vues liées au DOM (scissor/viewport), cache des rects
  stage/materials/print-layer.ts  onBeforeCompile « impression couche par couche »
  stage/glsl/noise.ts, dither.ts  GLSL en template literals (MIT / CC0)
src/components/motion-boundary.tsx "use client" : dynamic(() => import("@/motion/runtime"), { ssr:false })
                                   + un dynamic par chorégraphie lourde
```

- Garde-fou : `.oxlintrc.json`, `no-restricted-imports` sur `gsap`,
  `gsap/*`, `@gsap/react`, `lenis`, `lenis/*`, `three`, `three/*` et
  `postprocessing`, avec une exception pour `src/motion/**` (et
  `showroom-scene.ts` / `product-viewer-3d.tsx` s'ils y sont migrés).
- Bloquer les versions : `gsap@3.15.0`, `@gsap/react@2.1.2`, `lenis@1.3.26`,
  `postprocessing@6.39.5`, `three@~0.186.1` (à cause du peer de
  postprocessing).
- Installation : `bun add gsap@3.15.0 @gsap/react@2.1.2 lenis@1.3.26 postprocessing@6.39.5`,
  **jamais** `npm install` (bun.lock).

---

## 10. Services d'assets : évaluation

| Service                                       | Apport concret pour Swiss3Design                                                                                                                                                                                                                                                                                                                    | Coût (sept. 2026, à revérifier)                                                                                                                                                            | Compte ?                                                                                        | Verdict                                                                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Blender** (+ MCP local)                     | **Pipeline 3D principal.** À partir des vrais STL/GLB produits : décimation, UV, bake d'AO et de lightmaps, export GLB `KHR_mesh_quantization` (sans WASM). Chemins de caméra animés exportés en GLB et scrubbés au scroll. Rendus Cycles pour posters, images OG et « photos » produit cohérentes. Vues éclatées et séquences de couches. HDRI CC0 Poly Haven. | Gratuit (GPL)                                                                                                                                                                              | Non. Sketchfab demande un compte et une clé. Hyper3D, Hunyuan3D et Tripo demandent des clés API payantes (inutiles : les modèles réels existent). | **Indispensable.** Le serveur MCP est présent, mais l'addon Blender **ne répond pas** (« Could not connect to Blender ») : ouvrir Blender, puis démarrer l'addon (panneau N → BlenderMCP → Connect). |
| **Higgsfield** (agrégateur vidéo et image IA) | Boucles cinématiques du héros et film de marque : macro de buse déposant du filament multicolore, textures alpines, image-to-video depuis des rendus Blender. Accès à plusieurs modèles (Kling, Veo, Sora, etc.).                                                                                                                                      | Environ 15 à 129 $/mois selon le palier. Les plans ont changé plusieurs fois en 2026. Crédits non reportés, recharges d'environ 5 $/100 crédits. Un clip court coûte environ 50 à 100 crédits. | Oui (usage commercial seulement sur les plans payants)                                           | **Recommandé pour 1 mois**, pour produire 3 à 6 boucles. Choisir Higgsfield **ou** Runway, pas les deux.                                                                        |
| **Runway** (Gen-4.5)                          | Image-to-video mieux contrôlé (caméra), upscaling, retouche vidéo.                                                                                                                                                                                                                                                                                  | Standard 12 $/mois (annuel, 625 crédits, soit environ 52 s de Gen-4.5 à 12 crédits/s). Pro 28 $/mois (2250 crédits, environ 3 min).                                                     | Oui                                                                                             | Alternative à Higgsfield. Plus prévisible, moins de modèles.                                                                                                             |
| **Midjourney** (V8.2 par défaut depuis le 24/07/2026) | Direction artistique, moodboards, fonds et textures éditoriales, images de sections « univers ». **Pas pour montrer les produits**, qui doivent rester réels (loyauté commerciale).                                                                                                                                                                  | Basic 10 $, Standard 30 $, Pro 60 $, Mega 120 $/mois (-20 % en annuel). Droits commerciaux sur tout plan payant sous 1 M$ de CA.                                                        | Oui                                                                                             | Utile, facultatif. Un mois de Standard suffit pour la DA.                                                                                                                |
| **FLUX** (Black Forest Labs API)              | Génération et édition **programmables** (je peux l'appeler avec une clé API) : compositing de rendus produits dans des décors, variantes de fonds, retouches.                                                                                                                                                                                       | FLUX.2 Pro environ 0,03 $ par mégapixel (1 crédit = 0,01 $), sans abonnement                                                                                                               | Oui (clé API, à stocker dans `.dev.vars`, jamais commitée)                                     | Bon complément à Blender pour l'automatisation. Facultatif.                                                                                                              |
| **Spline**                                    | Scènes 3D no-code interactives.                                                                                                                                                                                                                                                                                                                     | Free (avec watermark), Hobby 12 $/mois, Pro 25 $/mois, Max 60 $/mois. **L'export auto-hébergé est réservé à Enterprise** (page tarifs).                                                  | Oui                                                                                             | **Écarté en production** : runtime lourd avec sa propre copie de three, `.splinecode` chargé depuis `prod.spline.design` (bloqué par `connect-src`), Draco interne qui exige `'wasm-unsafe-eval'`. Au mieux un outil de maquettage. |
| **Rive**                                      | Micro-animations interactives à state machine : icône panier, succès d'ajout au panier, loaders, pictogrammes d'étapes d'impression, toggles.                                                                                                                                                                                                       | Free pour créer, **Cadet 9 $/mois pour exporter les `.riv`**, Voyager 32 $/mois.                                                                                                        | Oui                                                                                             | Facultatif et très qualitatif. Exige `'wasm-unsafe-eval'` + `rive.wasm` auto-hébergé. Sinon, SVG + GSAP (DrawSVG/MorphSVG) couvre 90 % du besoin sans changer le CSP.    |
| **Unicorn Studio**                            | Scènes de shaders no-code (dither, liquide, dégradés, effets d'image) : accélère l'exploration de la DA.                                                                                                                                                                                                                                             | Free (avec watermark, modèles préréglés). **Legend 20 $/mois ou 168 $/an** : sans logo, licence commerciale, export JSON pour auto-hébergement. SDK d'environ 50 KiB gzip.              | Oui                                                                                             | Facultatif. Utile pour prototyper, mais c'est un deuxième runtime WebGL et contexte. Préférer porter l'effet en GLSL dans le Stage. S'il est utilisé : SDK + JSON auto-hébergés (`sdkUrl`), test sous CSP de prod.  |
| **Lottie** (LottieFiles)                      | Icônes et illustrations animées faites par un designer.                                                                                                                                                                                                                                                                                             | Bibliothèque gratuite avec compte. Offres payantes pour les équipes.                                                                                                                       | Compte gratuit pour télécharger                                                                 | Peu utile ici. `dotlottie-web` exige WASM et `'wasm-unsafe-eval'`. `lottie-web` en build *light* (sans expressions, donc sans `eval`) si vraiment nécessaire. Rive ou SVG + GSAP sont meilleurs.  |
| **Mixamo**                                    | Rig et animations de personnages humanoïdes (FBX).                                                                                                                                                                                                                                                                                                  | Gratuit, royalty-free, usage commercial                                                                                                                                                    | Oui (Adobe ID)                                                                                  | **Hors sujet** pour des objets imprimés, sauf mascotte ou figurine. Service vieillissant, pannes en 2025.                                                               |
| Poly Haven / ambientCG                        | HDRI et textures CC0 (éclairage PBR, sols, matières).                                                                                                                                                                                                                                                                                               | Gratuit, CC0                                                                                                                                                                               | Non                                                                                             | Oui, en HDRI 1k préfiltrés et **auto-hébergés** (pas de CDN, à cause de `connect-src`).                                                                                         |

**Dépense minimale recommandée :** Blender (0) + un mois de Higgsfield Plus
**ou** Runway Pro (environ 30 à 60 $), plus, en option, Midjourney Standard un
mois (30 $) et des crédits FLUX (10 à 20 $). Rive Cadet (9 $/mois) seulement
si on valide l'ajout de `'wasm-unsafe-eval'`.

---

## 11. Risques et points à vérifier

1. **R3F et React 19.3 :** compatibilité toute récente (9.8.0, 22/09). C'est
   la raison principale de l'option A. Réévaluer plus tard.
2. **Peer de postprocessing** `three <0.187` : bloquer three à `~0.186`.
   Dependabot proposera 0.187, qu'il faudra refuser ou différer.
3. **Bug `connect-src blob:`** avec GLTFLoader/ImageBitmapLoader. À corriger
   avant tout GLB texturé.
4. **WASM :** tout ajout de Draco, Meshopt, KTX2, Rive ou dotLottie impose
   `'wasm-unsafe-eval'`, à décider consciemment et à valider avec
   `bun run preview`.
5. **LCP :** le titre ou le poster du héros doivent être visibles au premier
   paint. Une révélation SplitText sur l'élément LCP retarde le LCP.
6. **Lenis et Stripe :** ne jamais activer Lenis dans le tunnel de paiement.
7. **Firefox :** pas de transition types dans les View Transitions et pas de
   scroll-driven CSS (flag). Les replis doivent être propres.
8. **Contextes WebGL multiples** (ancien viewer + Stage) : migrer le viewer
   produit dans le Stage, ou démonter le Stage sur la fiche produit.
9. **Hébergement vidéo :** vérifier que la route de fichiers R2 gère les
   requêtes `Range` (scrubbing, Safari). Sinon, passer par `public/`.
10. **Licence GSAP** : licence standard « no charge », pas MIT. Acceptable,
    mais à citer dans les crédits et `LICENSE.md`.

---

## Sources

- GSAP gratuit : [Webflow blog](https://webflow.com/blog/gsap-becomes-free), [CSS-Tricks](https://css-tricks.com/gsap-is-now-completely-free-even-for-commercial-use/), [GSAP standard license](https://gsap.com/standard-license), [GSAP pricing](https://gsap.com/pricing/)
- GSAP 3.15 : [npm gsap](https://www.npmjs.com/package/gsap), [GitHub greensock/GSAP](https://github.com/greensock/GSAP), registre npm `gsap/latest`, `@gsap/react/latest`
- SplitText : [docs](https://gsap.com/docs/v3/Plugins/SplitText/), [réécriture (Webflow)](https://webflow.com/blog/gsap-splittext-rewrite), [Codrops](https://tympanus.net/codrops/2025/05/14/from-splittext-to-morphsvg-5-creative-demos-using-free-gsap-plugins/)
- Lenis : [GitHub](https://github.com/darkroomengineering/lenis), [README brut](https://raw.githubusercontent.com/darkroomengineering/lenis/main/README.md), [npm](https://www.npmjs.com/package/lenis)
- R3F : [releases](https://github.com/pmndrs/react-three-fiber/releases), [issue #3915](https://github.com/pmndrs/react-three-fiber/issues/3915), [hacer#342](https://github.com/mezivillager/hacer/issues/342), registre npm `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`
- three.js : [r186](https://github.com/mrdoob/three.js/releases/tag/r186), [utsubo : three.js 2026](https://www.utsubo.com/blog/threejs-2026-what-changed), [utsubo : best three.js sites 2026](https://www.utsubo.com/blog/best-threejs-websites-2026)
- postprocessing : [GitHub](https://github.com/pmndrs/postprocessing), registre npm `postprocessing/latest` (peer `>= 0.168.0 < 0.187.0`)
- OGL : [GitHub](https://github.com/oframe/ogl)
- Motion : [changelog](https://motion.dev/changelog), [GSAP vs Motion](https://motion.dev/docs/gsap-vs-motion), [splitText Motion+](https://motion.dev/docs/split-text), sources installées `motion/dist/three.d.ts`, `framer-motion/dist/animate-view.d.ts`
- View Transitions : `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`, `.../02-components/link.md`, [web.dev Baseline](https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available), [support 2026](https://www.testmuai.com/learning-hub/view-transitions-api-browser-support/)
- CSS scroll-driven : [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations), [guide 2026](https://cssawwwards.com/blog/css-scroll-driven-animations-guide-2026)
- CSP, WASM et blob : [Rive FAQ](https://rive.app/docs/runtimes/web/faq), [rive-wasm#131](https://github.com/rive-app/rive-wasm/issues/131), [dotlottie CSP guide](https://github.com/LottieFiles/dotlottie-web/wiki/CSP-and-WASM-Self%E2%80%90Hosting-Guide), [Spline CSP (PR vultisig)](https://github.com/vultisig/website-prod/pull/130), [three.js forum : CSP blob GLTFLoader](https://discourse.threejs.org/t/loading-model-via-gltfloader-with-0-133-throws-csp-error-in-my-web-plugin/40507), [three.js#20055](https://github.com/mrdoob/three.js/issues/20055)
- Cloudflare Workers limits : [developers.cloudflare.com/workers/platform/limits](https://developers.cloudflare.com/workers/platform/limits/)
- LYGIA licence : [GitHub](https://github.com/patriciogonzalezvivo/lygia)
- Higgsfield : [pricing](https://higgsfield.ai/pricing), [layer3labs](https://www.layer3labs.io/guides/higgsfield-ai-pricing), [creatify](https://creatify.ai/blog/higgsfield-pricing-(2026)-plans-and-what-you-ll-actually-pay)
- Runway : [pricing](https://runway.com/pricing), [eesel](https://www.eesel.ai/blog/runway-ai-pricing)
- Midjourney : [techjack](https://techjacksolutions.com/ai-tools/midjourney/midjourney-pricing/), [eesel](https://www.eesel.ai/blog/midjourney-pricing)
- FLUX : [bfl.ai/pricing](https://bfl.ai/pricing), [docs](https://docs.bfl.ml/quick_start/pricing)
- Spline : [pricing](https://spline.design/pricing), [exporting as code](https://docs.spline.design/exporting-your-scene/web/exporting-as-code)
- Rive : [pricing](https://rive.app/docs/account-admin/pricing), [Cadet](https://community.rive.app/c/announcements/free-to-create-9-to-ship-cadet-is-live)
- Unicorn Studio : [FAQ](https://www.unicorn.studio/docs/faqs/), [embed](https://www.unicorn.studio/docs/embed/), [unicornstudio.js](https://github.com/hiunicornstudio/unicornstudio.js)
- Mixamo : [Adobe FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html), [Cinevva 2026](https://app.cinevva.com/guides/free-character-animations-rigging)
- Next + GSAP : [basement.studio](https://basement.studio/blog/gsap-next-js-setup-the-bsmnt-way), [devdreaming 2026](https://devdreaming.com/blogs/nextjs-smooth-scrolling-with-lenis-gsap)

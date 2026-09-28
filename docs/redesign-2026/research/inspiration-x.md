# Inspiration X : les sites faits par Claude (Opus 5.5 / Fable 5 / Opus 5) et l'état de l'art motion en 2026

> Recherche du 2026-09-27, en lecture seule. Sources : recherche X faite dans le Chrome du propriétaire (connecté ; rien liké, posté ni suivi), WebSearch et WebFetch sur des pages publiques. J'ai visité en direct les sites qui avaient une URL publique (captures d'écran et inspection JS : version de three, présence de GSAP/Lenis, poids transféré, polices).
> Les vues et likes sont ceux du 2026-09-27. Je n'ai pas regardé les vidéos des posts en entier : pour les posts sans lien, la description s'appuie sur le texte du post et sur une image.

---

## 0. Contexte (ce dont parle X cette semaine)

- **Claude Opus 5.5 est sorti le 22 septembre 2026** (annonce de @claudeai : 27 M de vues). X en a tiré une story tendance : « Opus 5.5 génère des vidéos de motion design de niveau pro en quelques minutes ». Selon les pros, ce travail coûte d'habitude 8 à 10 k$ et demande 3 à 4 semaines ; Opus le fait en environ 15 min.
- Sur X, trois familles de « sites faits par Claude » se partagent l'attention :
  1. **Les mondes et produits Three.js procéduraux** (zéro asset téléchargé, tout est du code). C'est ce qui impressionne le plus et ce qui pèse le moins : Meng To, NODAL, Trinetra, anda.ai.
  2. **Le pipeline « Claude Code + Higgsfield MCP + GSAP + Lenis »**, qui scrubbe au scroll des vidéos ou des séquences d'images générées par IA. C'est la mode « site d'agence à 35 k$ pour 12 $ ». Ça rend bien, mais c'est lourd (motionsites.ai : environ 141 Mo transférés sur la home).
  3. **La « motion en code »** : films de lancement HTML+GSAP rendus en MP4 (HyperFrames de HeyGen, Remotion). La même grammaire sert aux transitions d'un site.
- Le contre-courant existe aussi : des designers se plaignent que le fil est « plein du même motion design slop ». La différenciation passe donc par **une idée propre à la marque, pas par l'effet**.

---

## 1. Catalogue : sites visités en direct (les plus utiles pour nous)

### 1.1 NODAL, page produit d'un objectif (Opus 5, open source) : la référence n°1 pour nos pages produit

- Live : https://sam1983aing.github.io/nodal/ · Repo : https://github.com/Sam1983Aing/nodal · Post : https://x.com/SammmAing/status/2092257042769580375
- **Technique** (mesurée) : three r185, **Lenis**, un seul canvas, **environ 1,4 Mo transférés**, 5 400 lignes sans étape de build, police **Martian Mono**.
- **Ce qui la rend premium :**
  - L'objet **n'est pas un modèle 3D**. Opus l'a conçu à partir d'une prescription optique de 18 lignes : 10 lentilles en 8 groupes, avec une réfraction réelle. En changeant un chiffre du tableau, le verre, le barillet, le trajet de la lumière et les specs imprimées bougent ensemble.
  - Narration par chapitres, numérotés en petit en haut de page (« 01 · Rendering », « 02 · The cost », « 03 · Inside », « 04 · Proof »). Une barre de progression fine court en haut.
  - Le fond passe **du noir au papier chaud puis revient au noir** selon le chapitre, et l'objet reste pinné pendant qu'il tourne.
  - Chapitre **« Then you take it apart. »** : vue éclatée où chaque lentille flotte avec une étiquette technique en mono (type de verre, indice, diamètre).
  - Titres énormes en mono, avec un deuxième vers en couleur. Tableaux de specs à filets fins, stats en bandeau (« T1.86 · 1.5 µm · 100 % · 0.45 m »).
- **Idée pour nous :** c'est exactement le format « fiche produit-récit » d'un objet imprimé. On le prend tel quel : pinned object → specs réelles → **éclaté par couleur de filament** → preuve (macro des couches) → « Commander ».

### 1.2 Meng To : Sakura River Valley (Opus 5.5), ThreeUI et « la 3D à la place de la vidéo »

- Live : https://valley.mengto.here.now (post : https://x.com/MengTo/status/2102760783344189761, 462 k vues)
- Mesuré : **three r186** (notre version 0.186), un seul bundle `scene-*.js`, environ 7,7 Mo. Le loader est un anneau doré fin sur fond anthracite. La scène qui suit est photoréaliste : brouillard volumétrique, reflets d'eau, lucioles, pagode, barque.
- **ThreeUI**, https://threeui.com · https://github.com/MengTo/threeui : plus de 490 composants Three.js (heroes procéduraux, fonds shaders, boutons shader, texte animé, landing pages entières) copiables en prompts ; il existe aussi un MCP et des skills. Chaque composant pèse **100 à 200 Ko**. Le site revendique 100 k vues par jour et 3,8 k étoiles en 4 jours (https://x.com/MengTo/status/2090817187900780961, 1,33 M vues).
- Post « la 3D remplace la vidéo » (https://x.com/MengTo/status/2085765403729653877) : une landing avec du scroll 3D dans chaque section pèse **922 Ko sur disque et 290 Ko en gzip**. Un site à vidéo scrollée pèse 20 à 100 Mo.
- Post « exploded-view & wireframe product sites » (https://x.com/MengTo/status/2092275643623109037) : un clavier « Kestrel » dont les touches s'envolent en vue éclatée. Toute son équipe est passée des landings en images/vidéo au Three.js, qu'il juge « plus léger, plus facile à prompter, itérations plus précises ».
- Prompts qui marchent selon lui : « orbit using mouse » (parallaxe 3D), « add particles to pointer », « Recreate this in Three.js in a single HTML file. Self-verify until perfect. » (Opus a tourné 2 h), un intro en **wireframe qui se « scanne »** façon Death Stranding, un « scan effect » sur les images au chargement.
- **Idée pour nous :** la voie procédurale est **compatible avec notre budget Worker**, puisque Three.js est chargé côté client via `next/dynamic`, alors que la voie vidéo ne l'est pas. On pourrait partir d'une base ThreeUI ou de ses prompts.

### 1.3 Trinetra (Opus 5.5, fait en 2 h)

- Live : https://trinetra.shivag.fyi · post : https://x.com/ShivaGupta4639/status/2103840021447110673 (57 k vues)
- Mesuré : three r170, 2 canvas, **environ 950 Ko**, polices Cormorant, Cormorant SC et Tiro Devanagari. La page fait environ 13 500 px de scroll.
- Une seule image-héros (générée par IA) sert de décor. Le scroll **zoome** dedans, chapitre par chapitre, avec un compteur « 0 / 5 » en haut à droite et un fin rail vertical avec un point orange. Par-dessus l'image, des **objets 3D interactifs** : les perles du mala sont en Three.js et réagissent (« read the mala · touch a bead »). Petites capitales espacées, beaucoup de noir, une seule teinte forte (bleu nuit).
- **Idée pour nous :** une photo macro d'un objet imprimé comme décor, où la caméra « entre » dans les couches. Des éléments 3D réels et touchables, comme des pastilles de filament, se superposent à la photo.

### 1.4 anda.ai (site refait « comme une œuvre vivante » par Opus 5.5)

- Live : https://anda.ai · post : https://x.com/ICPandaDAO/status/2104232355590463967
- Mesuré : un seul canvas, **environ 282 Ko** (sans three, en WebGL maison), plus de 20 000 px de scroll. Polices : Instrument Serif (italique d'accent), Clash Display, General Sans et JetBrains Mono.
- **15 000 particules** changent de forme au fil du scroll : hélice ADN, nuage, puis grille de « log » en caractères. La **musique est composée en direct dans le navigateur** (Web Audio, aucun fichier audio) derrière un bouton « Sound ». Un rail vertical PAST ↔ FUTURE avec index « 00, 01… » et une étiquette « SCROLL THROUGH TIME ». Les titres mêlent grotesque grasse et serif italique.
- **Idée pour nous :** un nuage de particules qui **se dépose couche par couche** et forme l'objet (ou le pic du logo), puis se redisperse pour la section suivante. Coût très faible.

### 1.5 Paul Kalkbrenner : SOTD Awwwards et Developer Award (sept. 2026, pas fait par IA), la référence typographique « suisse »

- Live : https://www.paulkalkbrenner.net · post du studio : https://x.com/Holographikco/status/2095076946484847069
- Mesuré : Webflow + **gsap.min.js + ScrollTrigger + lenis.min.js**. Police **ABC Diatype Plus Variable**, plus de 12 700 px de scroll.
- Le nom géant tient la largeur de l'écran, avec **une photo glissée dans le mot**. Plus bas, une grille aux **filets visibles**, de gros ronds noirs en ponctuation et la phrase « the Pulse of Electronic M… » qui défile hors cadre. Une photo plein cadre, puis un **vinyle qui tourne avec le scroll** (photo circulaire). Noir et blanc granuleux, lecteur « Now playing » et « Sound OFF ».
- **Idée pour nous :** c'est le style international suisse appliqué au motion. Même recette avec **ink/paper et le rouge #E5231C en ronds de ponctuation**, et la photo d'un objet imprimé glissée dans « Swiss3Design ».

### 1.6 Zeus 3D, studio d'impression 3D à Lagos (site « built with Claude »), le minimum à dépasser

- Live : https://zeus3d-sigma.vercel.app · post : https://x.com/uche_ui/status/2090849960463835318
- Mesuré : 2 vidéos, environ 3,2 Mo, DM Sans et DM Mono. Pas de three, pas de GSAP.
- Hero vidéo : un salon avec un nez de F1 imprimé et le titre « If You Can Imagine It, We Can Print It. » sur fond de grille photo.
- **Leçon :** c'est ce qu'un Claude « par défaut » livre à un imprimeur 3D. Propre, mais générique. Il faut viser NODAL et Kalkbrenner, pas ça.

### 1.7 motionsites.ai (Viktor Oddy), la bibliothèque de prompts qu'a citée le propriétaire

- Live : https://motionsites.ai. Plus de 500 prompts de sites (100+ scènes 3D, gradients, fonds vidéo, catégorie Ecommerce, MCP). Tutoriel « Opus 5.5 pour des sites 3D à 50 k$ » : https://x.com/viktoroddy/status/2102743819058122824
- Mesuré sur la home : **20 balises `<video>`, environ 141 Mo transférés**, sans canvas. L'esthétique repose sur des fonds vidéo générés.
- **Leçon :** c'est bien pour trouver des idées de composition. Mais leur stack de base (React + Vite + Motion) et leurs fonds vidéo sont à adapter : chez nous, les médias lourds iraient sur R2 ou `public/` et ne passeraient jamais par un import.

### 1.8 messenger.abeto.co (site-jeu WebGL, 5,8 M vues)

- https://messenger.abeto.co · post : https://x.com/probiex007/status/2066516721259917320. Mesuré : three r180, environ 5,7 Mo. C'est la preuve qu'un site-jeu WebGL peut devenir viral grand public ; le format reste peu transposable à une boutique.

---

## 2. Catalogue : posts X notables (sans visite ou sans lien public)

| Post                                                    | Ce que c'est                                                  | Pourquoi c'est notable / technique                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://x.com/llama3dstudio/status/2103590715695706546  | Site produit d'une **mallette de poker**, Opus 5.5            | « Aucun modèle 3D » : cartes et mallette en code, animées au scroll, Three.js. C'est le format « objet-produit procédural » dont on a besoin.        |
| Bijan Bowen, site de montre (cité par favtutor)         | Site de marque horlogère, Opus 5.5                            | Montres 3D avec reflets réalistes, **vue éclatée du mouvement**, coutures du cuir. Corrigé au 2e passage.                                            |
| https://x.com/higgsfield_ai/status/2102536138884092185  | « A human eye you can take apart »                            | Un objet 3D qu'on démonte pour l'inspecter (comparatif Opus 5.5 / GPT-6 Sol).                                                                        |
| https://x.com/robertiuoras/status/2102555925924253960   | Site d'hôtel en 1 prompt                                      | 1 fichier HTML, **0 image**, aurores boréales en **shader WebGL live**, environ 16 min dans Claude Code.                                             |
| https://x.com/SammmAing/status/2090638984485507079      | Anneau qui brûle puis explose en onde de choc                 | **Un seul fragment shader** plein écran, OGL, 657 lignes, **23 Ko**.                                                                                 |
| https://x.com/xikhar/status/2104001664793600012         | Monde 3D (828 k vues, 6,2 k likes)                            | Blender + génération d'images + three.js, Opus 5.5 en effort medium.                                                                                 |
| https://x.com/chetanankola/status/2103001194696458512   | Route qui « oublie où est le bas »                            | Pliée à 90° sur un mur, elle devient partition musicale. Three.js, idée poétique forte.                                                              |
| https://x.com/akakuma0219/status/2103820733159981151    | **Ville miniature (箱庭)** « Le 7e district »                 | Diorama isométrique Three.js avec mode prévis caméra, puis Seedance 2.5 pour la vidéo. Esthétique « maquette » très proche d'un objet imprimé.       |
| https://x.com/techartist_/status/2103933640392786274    | **Annecy** en voyage en bateau jouable                        | Three.js + **TSL** ; canaux, pont, lac de montagne. Une ambiance alpine réalisable.                                                                  |
| https://x.com/shadersweden/status/2099979646108405823   | « Liquid glass, but actually liquid »                         | Hero Three.js avec **simulation de fluide TSL en compute shaders** (1,1 k likes).                                                                    |
| https://x.com/Acoramaa/status/2104145227573248467       | « Magic eye » audio-réactif                                   | 72 plaques autour d'un œil mécanique, iris à 9 lames, lentille qui sort sur les basses.                                                              |
| https://x.com/thebuggeddev/status/2081059128626344201   | Recréation de la page « Books » de Trevor Noah (Fable 5)      | Livres en **pure math Three.js** + GSAP. Repo : https://github.com/thebuggeddev/books (le déploiement est en pause).                                 |
| https://x.com/Oluwaphilemon1/status/2064368803006337114 | Recette « How I built with Claude » (349 k vues, 3 k signets) | Chapitres au scroll avec transitions de couleur fluides + fond Three.js « texture peinte » qui réagit au curseur + GSAP ScrollTrigger + Lenis.       |
| https://x.com/Souradip3000/status/2103876499262800291   | Site 3D d'une agence forestière                               | En un prompt, un fichier HTML unique, à partir d'une référence Pinterest.                                                                            |
| https://x.com/AndreiProvkin/status/2103919236653428985  | Monde entièrement procédural                                  | Zéro asset téléchargé, son compris. Opus 5.5 planifie à partir d'une image de référence.                                                             |
| https://x.com/mlperego/status/2104197677135143326       | Outil Three.js (Opus 5.5, en 2 h)                             | Cuit l'AO et l'épaisseur, génère LOD, tuiles SDF et **impostors** (Lucy : 100 k triangles → 19 k impostors). Utile pour alléger nos meshes produits. |

### Prompts « motion en code » à étudier (grammaire réutilisable pour les transitions du site)

- https://x.com/twoclipping/status/2103835273813496100 (104 k vues, **3,4 k signets**) : un film de lancement façon keynote Apple, entièrement en code.
  - **Chaque scène naît de la précédente** : rien ne fond, ne floute ni ne coupe. Les objets changent de forme : texte qui monte d'une ligne de masque, icônes qui pop sur un ressort, forme noire qui inonde le cadre puis se contracte dans la scène suivante.
  - **Interdits** : crossfade, blur-in, flips 3D, particules, glows, pauses de plus d'une seconde, « tout ce qui ressemble à un template ».
  - Montage à 120 BPM, **un événement par temps**. Un curseur « réel » pilote chaque changement ; zoom caméra à la Screen Studio.
  - Palette : toile off-white chaude et UI noire ; Archivo en largeur 125 et graisse 800 pour le wordmark, Geist pour l'UI.
- https://x.com/notdwd/status/2104138101102621133 : un reveal « prompt → site » de 7,5 s en un seul plan (la boîte de prompt devient la landing page).
- Outils : **HyperFrames** (HeyGen, HTML + CSS + timeline GSAP en pause → MP4) : https://github.com/heygen-com/hyperframes (connecteur Claude : https://claude.com/connectors/hyperframes).

---

## 3. Pipelines et skills tendance (juillet à septembre 2026)

| Outil                                                                                                                                                 | Ce que ça fait                                                                                                                                                                                                                                                                                                                  | Notes pour nous                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude Code + Higgsfield MCP** (`https://mcp.higgsfield.ai/mcp`) : https://x.com/zeuuss_01/status/2073529429838696592 (570 k vues, 6,1 k signets)   | Claude code le site ; Higgsfield rend les clips héros, les transitions, les boucles et les stills. GSAP ScrollTrigger + Lenis ; extraction de frames ; « film grain, particles, vignette, glass cards, color tints, scroll pacing ».                                                                                            | Exige un **compte Higgsfield** (crédits). Pratique pour des macros « matière » (couches de filament en gros plan) et un film de marque. Les assets vont sur R2.  |
| **scroll-world** : https://github.com/oso95/scroll-world (environ 9,5 k étoiles) · présentation : https://x.com/heynavtoor/status/2083221614595051602 | Skill Claude Code : dioramas isométriques (GPT Image 2), vols caméra (Seedance via Monid), **connecteurs générés à partir des frames de bord des deux scènes voisines** (couture identique au pixel, donc zéro coupe). Moteur de scrub vanilla JS (blob-seek, lazy load, fondu de couture), **chaîne 9:16 native pour mobile**. | Environ 27 $ pour 6 scènes en 1080p. Exige **Monid** et/ou **Higgsfield**, plus ffmpeg. Attention au CSP (`blob:` en media-src) et au poids ; à héberger sur R2. |
| **scroll-craft** (Nate Herk) : https://github.com/nateherkai/scroll-craft (2,8 k étoiles)                                                             | Skill « premium scroll sites » : **8 grammaires de page** (filmic one-shot, editorial, gallery…), **une interaction signature par site**, une « fingerprint gate » anti-répétition, et une vérification en navigateur headless qui détecte les zones de scroll mortes et produit une planche contact.                           | Bonne discipline de process à imiter, même sans installer le skill.                                                                                              |
| **ThreeUI** : https://threeui.com                                                                                                                     | Composants Three.js procéduraux, prompts, MCP et skills.                                                                                                                                                                                                                                                                        | Base de départ légère (100 à 200 Ko par composant).                                                                                                              |
| **Spline V2** : https://x.com/splinetool/status/2090500256190603636                                                                                   | Éditeur 3D reconstruit « pour l'ère agentique » : moteur WebGPU, **MCP pour que Claude Code édite les scènes**, PBR/HDR.                                                                                                                                                                                                        | Optionnel ; runtime externe, donc à mesurer.                                                                                                                     |
| **GSAP**, 100 % gratuit depuis avril 2025 (Webflow)                                                                                                   | SplitText réécrit (-50 % de poids, accessible, masques), MorphSVG, DrawSVG, ScrollSmoother, Flip. Démos : « Shader on Scroll » (`ScrollTrigger.getVelocity()` → distorsion et grain dans le shader) https://demos.gsap.com/demo/shader-on-scroll/ et « Three.js Scroll Waypoints ».                                             | On l'installe via npm, pas par CDN : le CSP et le nonce restent sous contrôle.                                                                                   |
| **Lenis** 1.3.x (darkroom)                                                                                                                            | Tourne sur le scroll natif (sticky et ancres fonctionnent), synchronisé avec ScrollTrigger et WebGL sur une seule boucle, plugin **snap**, moins de 5 Ko.                                                                                                                                                                       | Le standard de fait (NODAL, Kalkbrenner).                                                                                                                        |
| **kugiri** (edo_lunardi) : https://x.com/edo_lunardi/status/2096176912288678308                                                                       | Splitter de texte en lignes, mots et caractères qui coupe **là où le navigateur coupe réellement**.                                                                                                                                                                                                                             | Utile pour les reveals de titres en fr/de/it/en, où les longueurs varient.                                                                                       |
| Liquid Orb Editor (WebGPU) : https://lersent001.github.io/orb/                                                                                        | Orbe « liquid glass » temps réel.                                                                                                                                                                                                                                                                                               | Exemple de micro-élément shader réutilisable.                                                                                                                    |

---

## 4. Ce qui fait « premium » (motifs communs aux meilleurs exemples)

1. **Un seul plan continu.** Chaque état naît du précédent (morph, masque, flood) et il n'y a jamais de crossfade générique. C'est la règle n°1 des prompts les plus partagés, et la signature de NODAL comme de Kalkbrenner.
2. **L'objet est du code, pas une vidéo.** Il est net à toute résolution, léger (de 23 Ko à 1,5 Mo), modifiable avec précision, et on peut le démonter, l'annoter et le paramétrer.
3. **Le scroll est une timeline de chapitres** : numéros « 01 · 02 · 03 », rail ou barre de progression, compteur « 0 / 5 », et un objet pinné qui tourne, s'éclate et s'annote pendant que le texte change.
4. **Le fond change d'ambiance d'un chapitre à l'autre** (noir ↔ papier chez NODAL). Une palette très restreinte avec **un seul accent**.
5. **Typographie éditoriale** : grotesque ou mono géante + italique serif d'accent + étiquettes mono techniques et tableaux de specs à filets. Grille visible, ronds en ponctuation (Kalkbrenner).
6. **Des détails « faits main »** : intro en wireframe qui se scanne, loader qui a du sens, grain et vignette discrets, particules au pointeur, parallaxe à la souris.
7. **Le son en option** (Web Audio génératif, zéro fichier), désactivé par défaut (« Sound OFF »).
8. **La légèreté affichée comme argument** (« 290 Ko en gzip ») : chez eux c'est du marketing, chez nous c'est une contrainte (Worker à 10 MiB gzip, cold start).
9. **Une idée propre au sujet, pas un effet** : les lentilles de NODAL calculées depuis une vraie prescription optique, le mala de Trinetra qu'on touche, la route de Chetan qui devient partition. Ce qui sépare le « slop » du mémorable, c'est la vérité du sujet.

### Pièges repérés

- Les sites à vidéo scrollée sont lourds (motionsites.ai : 141 Mo) et fragiles sur mobile ; scroll-world règle le mobile avec une chaîne 9:16 dédiée.
- Les démos virales sont souvent des **jeux**, pas des boutiques : il faut garder l'achat (prix CHF, ajout au panier) toujours à portée.
- Le motion de fond n'a rien à voir avec une animation qui raconte le produit. Il faut aussi `prefers-reduced-motion`, le clavier et le contraste sur les frames composées (scroll-craft vérifie ce contraste).
- Contraintes chez nous : Three.js reste derrière `next/dynamic({ ssr:false })` ; les médias lourds vont dans `public/` ou R2, jamais en import ; un nonce CSP sur tout script inline ; `blob:` doit être autorisé si on scrubbe des vidéos.

---

## 5. Idées concrètes pour Swiss3Design (impression 3D multicolore, ink/paper + #E5231C, mark = pic en couches)

1. **« Imprimé sous vos yeux »** : le hero montre l'objet phare **qui s'imprime couche par couche au scroll**. Un clipping plane monte avec la position du scroll, une ligne de buse trace le contour de la couche courante, et chaque **changement de filament** fait un petit « flash » coloré, là où l'impression multicolore devient spectaculaire. À la fin, le plan de coupe dessine le **pic du logo** en couches rouges.
2. **Vue éclatée par couleur**, notre « Then you take it apart. » : l'objet multicolore se sépare en **un corps par filament** (les meshes du 3MF). Chacun porte une étiquette mono : nom du filament, grammes, temps d'impression, hauteur de couche. Les données viennent vraiment de la fiche produit.
3. **Page produit façon NODAL** : l'objet reste pinné et tourne ; les chapitres sont Rendu → Matière (macro des couches) → Éclaté → Preuve (dimensions, poids, tolérances) → Commander, avec des stats en bandeau (« 0,12 mm · 4 couleurs · 38 g · 6 h 40 ») et le fond qui passe papier ↔ encre.
4. **Configurateur paramétrique « change un chiffre »** pour `/custom` (devis) : taille, remplissage et couleurs se règlent au curseur, et le mesh, le **prix en centimes CHF** et le temps d'impression se mettent à jour en direct, comme la prescription optique de NODAL.
5. **Grille suisse vivante** à la Kalkbrenner : « Swiss3Design » en grotesque géante avec la photo d'un objet glissée dans le mot, une grille aux filets visibles, et des **ronds rouges #E5231C** en ponctuation qui roulent et s'alignent au scroll.
6. **Shader « courbes de niveau »** en fond discret : des lignes topographiques façon carte nationale suisse, qui sont aussi des couches d'impression. Elles se resserrent avec la vitesse de scroll (`ScrollTrigger.getVelocity()` → uniform) et c'est l'identité visuelle (pic alpin + couches).
7. **Diorama alpin « scroll-world » maison** : une maquette isométrique procédurale en Three.js, qu'on peut donc garder légère. La caméra survole les Alpes, entre dans l'atelier, passe l'imprimante, l'emballage, puis la livraison. Esthétique « objet imprimé » (箱庭 d'akakuma), contour-lines comme matière.
8. **Nuage de particules qui se dépose** (façon anda.ai) : des milliers de points tombent en strates et forment l'objet ou le logo, puis se redispersent pour former la catégorie suivante. Environ 300 Ko et aucun asset.
9. **Navigation en un seul plan** : la carte produit se _transforme_ en page produit (View Transitions API + GSAP Flip) et le panier « avale » l'objet, sans aucun crossfade. La grammaire vient du prompt twoclipping, appliquée à l'e-commerce.
10. **Pastilles de filament vivantes** : au survol d'un coloris, la couleur _coule_ le long des couches de l'objet (masque shader ondulant par couche).
11. **Loader signature** : une buse trace le pic du logo d'un seul trait (DrawSVG, gratuit) et le trait devient la barre de progression.
12. **Son optionnel** : un murmure génératif de moteur pas-à-pas (Web Audio) synchronisé aux couches du hero, désactivé par défaut, avec un bouton « Son » discret.
13. **Film de marque de 15 à 30 s en code** (HyperFrames + GSAP) : il sert à la fois de poster du hero, d'image OG animée et de contenu social, avec la même grammaire.

### Comptes et services qu'on pourrait demander au propriétaire (optionnels)

- **Higgsfield** (MCP pour Claude Code) : macros de matière, film de marque, stills de dioramas.
- **Monid** (Seedance) : seulement si on retient la voie vidéo de scroll-world.
- **ThreeUI Pro** : composants et MCP, si on veut accélérer.
- **Spline** : seulement si on veut un éditeur visuel piloté par MCP.

### Comptes X à suivre pour la veille

@MengTo, @SammmAing, @chetanankola, @akakuma0219, @techartist_, @shadersweden, @AndreiProvkin, @viktoroddy, @higgsfield_ai, @edo_lunardi, @Holographikco.

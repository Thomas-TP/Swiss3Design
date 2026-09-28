# Verdict du juge « jury Awwwards » : Strates, G1 (Atelier), Studio

> Grille : originalité (hors « motion slop »), effet des 5 premières secondes, mémorabilité, cohérence
> entre l'idée et la marque, typographie et direction artistique, qualité du mouvement, plaisir du
> configurateur, respect des décisions du propriétaire, craft sous contraintes (LCP, bundle, CSP,
> mobile, reduced motion), passage à l'échelle (N = 1 → 50, tunnel). Chaque critère est noté sur 10,
> pour un total sur 100. Notation exigeante : 10 veut dire « niveau SOTM », pas « correct ».

## Tableau de synthèse

| Critère                   | Strates | G1 (Atelier) | Studio |
| ------------------------- | ------- | ------------ | ------ |
| Originalité               | 8       | 7            | 7      |
| 5 premières secondes      | 6       | 6            | 8      |
| Mémorabilité              | 9       | 7            | 9      |
| Cohérence idée ↔ marque   | 10      | 8            | 7      |
| Typo et DA                | 9       | 6            | 6      |
| Qualité du mouvement      | 9       | 8            | 7      |
| Plaisir du configurateur  | 8       | 7            | 9      |
| Décisions du propriétaire | 7       | 7            | 9      |
| Craft sous contraintes    | 8       | 8            | 7      |
| Échelle et tunnel         | 8       | 8            | 7      |
| **Total**                 | **82**  | **72**       | **76** |

**Gagnant : Strates**, à condition de lui greffer le moment « votre nom » de Studio et la
personnalisation dès le héros (voir § 4). Sans ces greffes, Strates reste un très beau site de
marque qui _montre_ une impression au lieu de faire _régler_ un objet, alors que la personnalisation
est l'axe imposé.

---

## 1. Strates : 82/100

| Critère                   | Note | Justification                                                                                                                                                                                                                                                                                      |
| ------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Originalité               | 8    | Les courbes de niveau sont un motif connu, mais « une couche d'impression = une courbe de niveau, et la couleur multiple = une teinte hypsométrique » est une idée de fond, pas un habillage. La bascule de l'élévation au plan est inédite dans la catégorie.                                     |
| 5 premières secondes      | 6    | Le fondu du poster SVG vers la matière au pixel près relève du vrai craft, mais il reste discret. L'intro s'arrête à 18 % d'impression, ce qui donne un premier écran calme plutôt que saisissant.                                                                                                 |
| Mémorabilité              | 9    | La caméra qui passe en vue de dessus, où les couches deviennent des cercles puis un champ de courbes plein écran, est l'image qu'on raconte après la visite. Les 404 et la copie (« Point non coté », « Altitude 404 m ») se retiennent.                                                           |
| Cohérence idée ↔ marque   | 10   | Le mark en 6 strates, les Alpes, le procédé FDM, le style suisse et le modèle AMS disent la même chose. Rien n'est plaqué.                                                                                                                                                                         |
| Typo et DA                | 9    | Cadre de carte à graduations, coordonnées de Gland et Pully, cartouche en pied de page, point rouge final, Archivo géante avec un `wdth` lié à la vitesse : un vrai système. Seule réserve, Archivo est une grotesque assez répandue.                                                              |
| Qualité du mouvement      | 9    | Principes précis (addition, quantification, unités vraies), ease `s3d.pas` quantifiée maison, courbes nommées et durées justifiées, transition « Coupe » en 8 paliers. C'est la grammaire de mouvement la plus propre des trois.                                                                   |
| Plaisir du configurateur  | 8    | La barre altimétrique dont on glisse les frontières (légende hypsométrique), la bande de mesure et les réglettes graduées sont remarquables. Le sous-verre qui nomme un sommet fictif est génial. Il manque un moment de pur plaisir équivalent au nom tapé en direct.                             |
| Décisions du propriétaire | 7    | Estimation de prix en fourchette, parcours STL vers devis, attribution d'Ian : tout y est. Mais le héros montre une impression au lieu d'un réglage, et le Studio n'arrive qu'au chapitre 03. Le préréglage du Lavaux (côtes, 40 par défaut, avec torsion) ressemble dangereusement au vase d'Ian. |
| Craft sous contraintes    | 8    | Poster SVG généré par le même code (LCP et CLS réglés), un seul contexte, budgets chiffrés, pas de pin sur mobile. Le champ de courbes plein écran sur beaucoup de pages et les 8 scènes en scissor alourdissent le GPU et le périmètre.                                                           |
| Échelle et tunnel         | 8    | Planche éditoriale à N = 1, filtres en légende de carte et cartes « Alt. 209 mm » à N = 50. Tunnel intouché.                                                                                                                                                                                       |

**Idées les plus fortes**

- La bascule de l'élévation au plan : le vase vu de dessus devient une carte, puis le fond du site.
- Le poster SVG isoligne généré au build, calé au pixel sous le canvas (« le dessin devient matière ») : LCP propre et motion dans la même idée.
- Le multicolore expliqué comme une teinte hypsométrique : c'est à la fois l'image de marque et la vérité AMS (3 changements, pas 300 purges).
- La barre altimétrique comme contrôle des bandes de couleur.
- Le sous-verre « Relief » : une carte en courbes empilées, avec une gravure « Pointe [Nom] 2 431 m ».
- L'ease quantifiée `s3d.pas` et la transition « Coupe ».
- La copie : « Tout relief commence par une couche. », « Terrain vierge. », « Point non coté. ».

**Défauts fatals (à corriger avant de construire)**

- **Préréglage du héros trop proche du Vase spirale** (côtes torsadées, 40 par défaut, sur une bouteille). Sur la page d'accueil d'un site qui vend aussi le vase d'Ian, le public lira un dérivé. Il faut passer par défaut au motif « gradins façon terrasses de Lavaux », plus juste pour la marque de toute façon, et interdire par test tout préréglage « côtes torsadées » proche de la silhouette d'Ian.
- **La personnalisation n'est pas dans le héros.** Le héros montre une impression que le visiteur subit. Il faut au moins un geste de réglage avant la fin du premier pin.
- **Risque de papier peint topo.** Le champ de courbes en fond, en footer, sur l'auth et sur la 404 finit par évoquer un template de marque outdoor. Il faut le limiter à 3 moments forts.
- **Périmètre** : 8 scènes, son génératif et 5 objets. Il faut couper à P1 et P2.

---

## 2. G1 (Atelier) : 72/100

| Critère                   | Note | Justification                                                                                                                                                                                                                                                                     |
| ------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Originalité               | 7    | La vérité du procédé est défendable, mais l'esthétique HUD, mono et télémétrie est une tendance de 2024-2026 qui fait facilement « interface de dev ». La tour de purge et les vrais trajets calculés sont, eux, originaux.                                                       |
| 5 premières secondes      | 6    | Aperçu de trancheur en SVG, puis canvas : c'est propre, mais tout le spectacle est lié au scroll. Sans scroll, le premier écran est une image fixe.                                                                                                                               |
| Mémorabilité              | 7    | L'éclaté par filament et la tour de purge qui gagne un palier restent en tête. « G28 : retour à l'origine » ne parle qu'aux makers.                                                                                                                                               |
| Cohérence idée ↔ marque   | 8    | Rouge = buse chaude, papier = plateau : très juste. Le lien avec le pic alpin et la Suisse est plus faible (révélation du mark par hachures seulement).                                                                                                                           |
| Typo et DA                | 6    | Martian Mono en display sur tous les titres : froid, peu lisible sur les mots allemands longs et proche de l'interface de Bambu Studio. Le « Registre » en tableau à filets est en revanche une vraie proposition suisse.                                                         |
| Qualité du mouvement      | 8    | Courbes `g0`, `g1` et `retract` justifiées, durées en doublement, pas de snap, pas de bouton magnétique « sans cause physique » : discipline exemplaire, mais peu de moments d'émotion.                                                                                           |
| Plaisir du configurateur  | 7    | Simulation ×1, ×10 ou ×100 qui annonce la durée réelle, réglette Z façon trancheur, rapport de tranchage : honnête, mais on règle un logiciel plus qu'on ne crée un cadeau. Aucun prix affiché sans coefficients.                                                                 |
| Décisions du propriétaire | 7    | Le texte personnel n'entre jamais dans l'URL (nLPD), l'attribution passe en JSON-LD (`isBasedOn` + `license`), l'accueil est à double intention. Mais le préréglage « Onde » (24 nervures torsadées) frôle lui aussi le vase d'Ian, et la personnalisation n'arrive qu'en second. |
| Craft sous contraintes    | 8    | Formulaire Studio SSR fonctionnel sans JS (GET plus poster), pin coupé sous 768 px de hauteur, réglette tactile. Le calcul des vrais trajets de tous les objets est un gouffre de temps.                                                                                          |
| Échelle et tunnel         | 8    | Le Registre (tableau et grille) tient à N = 1 comme à N = 50, et les lignes S-01 à S-04 « configurable, sur devis » ne créent aucun faux produit.                                                                                                                                 |

**Idées les plus fortes**

- La **tour de purge** qui grandit à chaque changement de couleur : le coût est affiché, visible et chiffré.
- L'**éclaté par filament** : les bandes s'écartent de 12 mm, chacune étiquetée avec ses couches et ses grammes.
- **Aucun texte personnel dans l'URL**, et un partage avec un texte d'exemple.
- Le **formulaire Studio SSR sans JS**, qui reste un vrai repli.
- La simulation ×1, ×10 ou ×100 qui annonce la vraie durée.
- La révélation du mark raster par un masque de hachures, sans redessin.
- La vue « Registre » en tableau et l'attribution en JSON-LD avec un test e2e du bloc.

**Défauts fatals**

- Une **direction artistique d'outil**, pas de marque : un acheteur de cadeau B2C voit un trancheur. Les codes G parlent à 2 % du public.
- L'esthétique de l'aperçu de trancheur est celle de Bambu Studio : un dérivé de logiciel, pas une signature.
- Pas de CHF par défaut : sur un configurateur, l'absence de chiffre tue l'élan (la Forge disait « jamais bloquer sans chiffre »).
- Le préréglage d'Onde, avec ses nervures torsadées, est trop proche du Vase spirale.

---

## 3. Studio : 76/100

| Critère                   | Note | Justification                                                                                                                                                                                                                                                                                       |
| ------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Originalité               | 7    | Un configurateur en héros est une première dans la catégorie. Mais le carrousel de motifs qui se fondent et le vase qui se défait en particules sont deux des tropes Three.js les plus vus.                                                                                                         |
| 5 premières secondes      | 8    | Le canvas prend le relais au pixel, puis une vague de couleur monte les couches dès l'arrivée : c'est le meilleur démarrage des trois.                                                                                                                                                              |
| Mémorabilité              | 9    | Taper son nom sur la page d'accueil et le voir extrudé en 3D, c'est le moment qu'on partage.                                                                                                                                                                                                        |
| Cohérence idée ↔ marque   | 7    | La personnalisation est juste, mais le système visuel (Bricolage Grotesque, grain papier, filet triple) n'est lié ni au mark ni à la Suisse. La désintégration en particules trahit la « vérité du procédé » que le concept revendique.                                                             |
| Typo et DA                | 6    | Bricolage Grotesque et grain SVG, c'est le costume de milliers de landing pages de 2024-2025. Aucune grille signature.                                                                                                                                                                              |
| Qualité du mouvement      | 7    | « Un seul plan » et `steps()`, c'est bien. Mais un pin de 320 vh en 5 temps ressemble à une bande-démo de fonctionnalités, et l'interpolation pondérée entre nervures et voronoï passe par des formes intermédiaires laides.                                                                        |
| Plaisir du configurateur  | 9    | Annuler/Rétablir, « Surprenez-moi », badge « Imprimable » avec la correction proposée, gravure sans CSG (contours en trous et contrepoinçons en îlots), 3MF plus tard, outil WebMCP : le plus complet et le plus joyeux.                                                                            |
| Décisions du propriétaire | 9    | La personnalisation est au cœur, le concept interdit explicitement toute silhouette proche du vase d'Ian, et le Studio passe en P1. Seul écart : le nom passe dans l'URL.                                                                                                                           |
| Craft sous contraintes    | 7    | 40 k particules, shader de morph et `TextGeometry` avec police JSON dans le chunk du héros, tout cela gonfle le chunk (≤ 210 Ko est optimiste). Nom dans `?nom=` : nLPD, capture d'URL par PostHog, fuite par le referrer. Bons points : la parité CPU/GLSL testée et l'input sorti du pin sur iOS. |
| Échelle et tunnel         | 7    | La vitrine sur socle et la rangée « À configurer » sont correctes, moins pensées que le Registre ou la légende de carte.                                                                                                                                                                            |

**Idées les plus fortes**

- **Le nom tapé en direct**, réextrudé à chaque frappe, sur l'accueil.
- La **vague de couleur le long de Y** au changement de pastille (le ripple d'iyO, transposé aux couches).
- La **suite d'outils du configurateur** : Annuler/Rétablir, « Surprenez-moi », badge « Imprimable » avec correction, lien copiable, outil WebMCP `studio_configure`.
- La **gravure sans CSG** et le **test de parité** entre le déplacement CPU (export) et GLSL (affichage).
- L'**interdiction explicite de toute silhouette proche du Vase spirale**.
- Le **Studio avant le héros** dans le phasage : l'axe central d'abord.
- Le STL généré dans un Web Worker, et le Studio en disque rouge central dans la BottomNav.
- Reduced motion : 3 vignettes SSR légendées, chacune liée à son état dans le Studio.

**Défauts fatals**

- **Le vase qui se désintègre en particules pour se redéposer en carte** : c'est le cliché GPGPU par excellence et c'est faux physiquement. Un jury le classe comme « démo Three.js ».
- **Le nom dans l'URL** (`?nom=`) : fuite de donnée personnelle (historique, PostHog, referrer). Il faut le bannir.
- **DA générique** : Bricolage et grain. Avec le logo masqué, on ne sait pas de quelle marque il s'agit.
- **Héros surchargé** : cinq démonstrations dans un seul pin, ce qui coûte en poids, en longueur de scroll et en attention.

---

## 4. Gagnant et greffes

### Gagnant : **Strates**

C'est le seul concept où l'idée, la marque, le procédé et le multicolore forment une seule image.
Un jury Awwwards récompense ce genre d'évidence (Oryzo, iyO : une idée difficile, menée jusqu'au
bout). Sa typographie et sa grammaire de mouvement sont les plus abouties. Ses faiblesses (héros
passif, préréglage proche d'Ian, risque de papier peint) se corrigent par des greffes, alors que
celles de Studio (DA générique, trope de particules) et de G1 (esthétique d'outil) sont structurelles.

### Greffes obligatoires

1. **(Studio) « Votre sommet » : le nom en direct, mais à la manière de Strates.** À la fin du pin
   du héros, en vue de plan, le champ de courbes se resserre en un massif. Un vrai `<input>` SSR
   « Votre nom » apparaît (hors pin sur mobile) et la carte ou le sous-verre en relief s'imprime
   **couche par couche**, sans particules, avec « Pointe [Nom] · 2 431 m ». Le geste de
   personnalisation arrive ainsi dans le premier écran d'intérêt, et le défaut fatal n° 2 de Strates
   disparaît.
2. **(G1) Aucun texte personnel dans l'URL.** L'état partagé ne porte que la forme et les couleurs,
   avec un texte d'exemple. Le nom reste en mémoire et dans `sessionStorage` jusqu'à l'envoi du
   devis.
3. **(Studio) Interdire par test toute silhouette proche du Vase spirale**, et changer le préréglage
   du héros Lavaux : motif « gradins façon terrasses », 3 bandes hypsométriques, sans côtes
   torsadées.
4. **(Studio) La vague de couleur le long de Y** à chaque changement de pastille dans le Studio (le
   front monte couche par couche, avec un liseré rouge) : c'est le « S6 band-ripple » de Strates,
   qui devient la micro-interaction signature.
5. **(Studio) Les outils du configurateur** : Annuler/Rétablir, « Surprenez-moi » (une nouvelle graine
   de massif), badge « Imprimable » avec la correction proposée, « Copier le lien », gravure sans
   CSG, test de parité CPU/GLSL, STL en Web Worker, outil WebMCP `studio_configure`.
6. **(G1) La tour de purge et l'éclaté par bandes** : dans la vue « Coupe » du Studio et au beat B2
   du héros, chaque changement de filament fait gagner un palier à une petite tour. Une commande
   « Éclater » sépare les bandes de 12 mm, chacune étiquetée (« Glacier · couches 210–590 ·
   14 g »).
7. **(G1) Le formulaire Studio SSR sans JS** (GET plus poster SVG), repli réel en plus des posters en
   reduced motion.
8. **(G1) Simulation ×1, ×10 ou ×100** qui annonce la vraie durée, et **réglette Z verticale** au
   pouce sur mobile pour scrubber l'impression sans pin.
9. **(G1) Attribution d'Ian en JSON-LD** (`isBasedOn` + `license`) et test e2e du bloc d'attribution.
10. **(G1) Révélation du mark par un masque de hachures** comme micro-loader dans le header : aucune
    modification du raster, donc aucune validation de marque nécessaire.
11. **(Studio) Phasage : le Studio avant le héros.** P1 = fondations et Studio Lavaux et Cartouche,
    avec l'envoi vers le devis ; P2 = héros, « Coupe » et chrome.
12. **(G1) Vue « Registre »** comme vue liste de la boutique à N = 50, en complément des cartes
    cotées en altitude.
13. **(Studio) Studio en disque rouge central dans la BottomNav**, et reduced motion en 3 vignettes
    SSR liées chacune à un état du Studio.

### Coupes recommandées dans Strates

- Limiter le champ de courbes plein écran à trois moments (fin du héros, footer, 404). Nulle part
  ailleurs.
- Réduire les 8 scènes du Stage à 4 en P1 et P2 : `print-hero`, `studio-object`, `product-viewer`,
  `thumb-baker`.
- Le son et la plaque « Signal » passent en « plus tard ».
- Les 5 premières secondes : l'intro doit aller jusqu'à 35–40 % et déclencher un premier changement
  de filament visible (flash, étiquette et palier de la tour de purge) **avant** tout scroll. Le
  premier écran doit montrer le multicolore, pas seulement un socle gris.

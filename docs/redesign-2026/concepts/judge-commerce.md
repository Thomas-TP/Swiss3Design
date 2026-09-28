# Verdict du juge « e-commerce et marque » : Strates, G1 (Atelier), Studio

> Lecture : les 3 concepts, `research/critique.md`, `research/codemap.md`, puis des vérifications
> dans le dépôt :
> - `src/app/api/quote-upload/route.ts` : 30 Mo, 10 envois par heure et par IP, contrôle de signature ;
> - `src/lib/file-signature.ts` : un STL binaire passe si `84 + n×50 = taille`, donc la sortie de
>   `STLExporter` est acceptée, et un 3MF passe s'il est un zip ;
> - le zod de `custom/actions.ts` : `colors` et `dimensions` ≤ 200 caractères, `description` ≤ 4000 ;
> - `research/assets.md` : le Vase spirale est une **bouteille à 40 nervures fines torsadées**, en
>   blanc et noir, à CHF 24.
>
> Grille : 10 critères notés sur 10, pour un total sur 100.

## Grille

| # | Critère | Strates | G1 Atelier | Studio |
|---|---|---|---|---|
| 1 | Clarté du prix et des CTA | **8** | 5 | 7 |
| 2 | Chemin vers le produit achetable (N = 1) | 6 | 6 | **7** |
| 3 | Chemin vers une commande perso (Studio → devis) | 8 | 8 | **9** |
| 4 | Confiance et crédibilité suisse | **9** | 7 | 6 |
| 5 | Honnêteté (LCD art. 3, étiquettes, multicolore) | 7 | 6 | **8** |
| 6 | Respect de la licence CC BY-ND | 7 | **9** | **9** |
| 7 | Adéquation à la marque | **9** | 5 | 8 |
| 8 | Passage de N = 1 à N = 50 | 8 | 8 | 8 |
| 9 | Robustesse i18n (fr/de/it/en, de-CH) | **8** | 6 | 7 |
| 10 | Accessibilité | **9** | 8 | 8 |
| | **Total** | **79** | **68** | **77** |

---

## Strates : 79/100

1. **Prix et CTA, 8.** C'est le seul concept qui affiche des CHF : fourchette en centimes, libellée
   « Estimation », prix ferme sous 1 jour ouvré, un CTA rouge par écran. Mais ±8 % calibré sur un seul
   vase monochrome est trop serré pour du multicolore et pour une carte de visite.
2. **Chemin vers le produit, 6.** La planche éditoriale N = 1 est bonne. En revanche, la fiche produit
   place « Commander » en **dernier chapitre** (Rendu → Matière → Fiche → Commander), et à l'accueil
   la Collection n'arrive qu'au chapitre 04, après 3 sections pinnées.
3. **Commande perso, 8.** Le parcours est complet : `sessionStorage` vers `/custom#studio`, formulaire
   prérempli (couleurs par bandes en mm), lien de configuration, `source: "studio"`, vérification de
   la signature, maillage d'export ≤ 12 Mo. Il manque la modération des textes libres et la gestion
   de la limite de 10 envois par heure en cas de renvois.
4. **Confiance suisse, 9.** Coordonnées de Gland et de Pully, cartouche, aucune croix ni armoirie,
   aucun « Swiss made » (seuil LPM), « imprimé à Gland et à Pully », seuil de port dynamique.
5. **Honnêteté, 7.** Étiquette « Objet Studio · configuration d'exemple », palette tirée de
   l'inventaire réel (sinon « indicative »), et une précision juste : le multicolore s'imprime en mode
   standard, la spirale reste monochrome. Mais le héros est presque un clone visuel du seul produit
   en vente (voir les défauts rédhibitoires).
6. **Licence, 7.** Le vase de Ian est exclu du Studio, tourné seulement, jamais dans une teinte non
   vendue, et `attribution.ts` évolue vers des colonnes en base. Le lien vers le deed de la licence
   n'est pas spécifié, et le vase du héros a l'air d'un remix.
7. **Marque, 9.** Le mark en 6 strates devient la thèse, le rouge signifie la chaleur (buse), et la
   cartographie fédérale donne la grammaire. C'est la meilleure adéquation des trois.
8. **N = 1 à N = 50, 8.** Grille 1/2/3, filtres SSR, bascule grille/liste, crédits par slug puis en
   base.
9. **i18n, 8.** `Intl.NumberFormat`, pas de ß, tests en allemand, `autoSplit`. Les jeux de mots
   cartographiques (« Point non coté », « Terrain vierge », « 404 m au-dessus du Léman ») seront
   coûteux à adapter en de et en it.
10. **Accessibilité, 9.** Vue Élévation en SVG 2D comme repli sans WebGL, interrupteur « Réduire les
    animations » posé avant le paint, `range` natifs avec `aria-valuetext`, `fieldset`, aucun pin sur
    mobile.

**Idées fortes**

- Le **poster SVG d'isolignes généré au build par le même code** que la scène (LCP = h1, CLS 0), puis
  le canvas calé au pixel dessus.
- Le **prix en fourchette** en centimes via `estimate.ts` (pur TS, réutilisable par le serveur en P6).
- La **barre altimétrique** qui édite les bandes de couleur, et la bande de mesure
  « mm · couches · g · h · changements · CHF ».
- Le **sous-verre Relief**, preuve parfaite du multicolore par bandes.
- La **précision sur le procédé** : le mode spirale reste monochrome.
- Le **test Vitest de variété (manifold)** sur 200 jeux de paramètres, contre les configurations non
  imprimables vendues.
- La **règle sur les armoiries** pour le porte-nom.
- Les **transitions de page « Coupe »** et le header ancré.

**Défauts rédhibitoires (à corriger avant d'adopter)**

1. **Le vase du héros par défaut ressemble au Vase spirale** : 40 côtes par défaut, torsadées, profil
   bouteille disponible. En 3 couleurs sur la page d'accueil d'un site qui vend un vase torsadé en
   blanc ou en noir à CHF 24, le visiteur comprendra « ce vase existe en multicolore ». C'est un
   risque LCD art. 3, et la pièce ressemble à un dérivé de Ian. Il faut changer les défauts et
   interdire cette silhouette dans les préréglages (règle de Studio).
2. **« Commander » en dernier chapitre de la fiche produit** : il faut une zone d'achat collante dès le
   premier écran.
3. **Métaphore saturée sur les pages transactionnelles** : « Alt. 209 mm » sur les cartes, filtres en
   « légende », panier « Terrain vierge », suivi en profil de randonnée. La clarté passe avant le clin
   d'œil : sur le panier, le suivi et la carte produit, l'unité réelle doit toujours s'afficher en
   premier.
4. **Titre h1 « Tout relief commence par une couche. »** : il ne dit ni quoi, ni où, ni qu'on peut
   personnaliser. Il faut un surtitre SSR explicite.

---

## G1 (Atelier) : 68/100

1. **Prix et CTA, 5.** Aucun CHF sans coefficients (honnête, mais cela vend moins), et une estimation
   à ±20 %. Le Registre, lui, affiche bien les prix.
2. **Chemin vers le produit, 6.** Le tableau Registre est net, mais « L'objet du moment » n'arrive
   qu'au chapitre 04 et « 05 Commander » est en fin de fiche.
3. **Commande perso, 8.** Le **tiroir d'envoi directement dans le Studio** (e-mail, quantité,
   remarque, puis `submitQuoteRequest`) est le chemin le plus court. Il y a aussi une modération
   humaine explicite et un formulaire SSR en GET qui marche sans JS. Mais il duplique l'UI du devis :
   deux formulaires à maintenir.
4. **Confiance, 7.** La réassurance est factuelle, mais les montants « 8,90 CHF / dès 60 CHF » sont
   **écrits en dur**, alors qu'ils viennent de `getShippingSettings()`. Aucun garde-fou Swissness.
5. **Honnêteté, 6.** L'éclaté par filament avec les grammes est très honnête. Mais le héros met en
   scène une **buse qui suit la spirale du mode vase, 3 filaments et une tour de purge** : le mode
   spirale multicolore est physiquement douteux, et cela contredit la thèse « vérité du procédé ».
6. **Licence, 9.** Viewer seul, ni tranchage ni recoloration, **JSON-LD `isBasedOn` + `license`** et un
   **test e2e du bloc d'attribution**.
7. **Marque, 5.** Le registre trancheur et G-code (Martian Mono en titres, « G28 », « Job en file »,
   panier « File d'impression ») parle aux makers, pas à l'acheteur d'un cadeau, d'une carte de visite
   ou d'un porte-nom. La marque vend des objets de design, pas un atelier de fabrication. La
   révélation du mark par hachures est un nouveau visuel de marque, à faire valider.
8. **N = 1 à N = 50, 8.** Bascule tableau/grille, index de catégories collant, lignes S-01 à S-04
   « sur devis » sans faux produit.
9. **i18n, 6.** Une mono large (`wdth 112`) en titre, face aux mots allemands longs
   (« Filamentwechsel »), et un jargon difficile à traduire. Bons exemples de/it, pas de ß.
10. **Accessibilité, 8.** Formulaire sans JS, `<output>`, sélecteur de couche en mouvement réduit,
    résumé `aria-live`. Mais le HUD en micro-mono de 11 px est difficile à lire.

**Idées fortes**

- **Les textes personnels n'entrent jamais dans l'URL** (nLPD), et « Partager » envoie un texte
  d'exemple.
- JSON-LD `isBasedOn` + `license`, et le test e2e de l'attribution.
- La **réglette Z verticale** (façon Bambu) : un scrub au pouce sur mobile et un contrôle clavier.
- « Simuler ×1 / ×10 / ×100 » avec la durée réelle annoncée.
- L'éclaté par filament (« PLA Encre · couches 1–300 · 14 g ») : le multicolore expliqué honnêtement.
- La règle **« le serveur ne croit jamais le prix client »**.
- **Imprimer puis photographier une vraie Onde et une vraie Carte**, pour calibrer les grammes et
  prouver le multicolore.
- La ligne « configurable, sur devis » dans la boutique.

**Défauts rédhibitoires**

- Une identité machine qui éloigne la clientèle B2C.
- Une scène héroïque multicolore en mode vase, techniquement fausse.
- Aucun prix en Tier A.
- Des montants de port écrits en dur.

---

## Studio : 77/100

1. **Prix et CTA, 7.** « Réglez-le. On l'imprime. » est la meilleure promesse des trois (claire, et
   l'action est dans le titre), avec un seul CTA rouge. Mais la v1 n'affiche aucun prix
   (« estimation atelier sous 24 h ») tant que les coefficients ne sont pas validés.
2. **Chemin vers le produit, 7.** La fiche produit est la meilleure : **01 Objet, galerie et achat
   collant**, et « Un vase à vous ? » renvoie vers notre objet, pas vers un remix. En boutique N = 1,
   la vitrine sur socle permet l'achat direct. En revanche, le héros est pinné sur 320 vh (200 svh sur
   mobile) avant d'atteindre quoi que ce soit d'achetable.
3. **Commande perso, 9.** C'est le seul concept qui construit **l'axe central en premier** (P1). Il
   apporte aussi :
   - une saisie « Votre nom » dans le héros, qui amorce le Studio ;
   - un badge « Imprimable » qui indique la correction à faire ;
   - Annuler/Rétablir et « Surprenez-moi » ;
   - « Garder » dans Mes créations ;
   - le STL généré dans un Web Worker, puis `/custom` prérempli ;
   - un 3MF en v2 via fflate ;
   - l'outil WebMCP `studio_configure`.
4. **Confiance, 6.** « Un humain vérifie chaque pièce », une FAQ et un seuil de port dynamique. Mais :
   - l'identité suisse est plus faible ;
   - **le nom passe dans l'URL** (`?nom=`) : il atterrit dans les logs, dans le `$current_url` de
     PostHog et dans le Referer (nLPD) ;
   - le grain est posé sur `body::after`, donc sur le checkout et le compte.
5. **Honnêteté, 8.** Étiquettes « Rendu » et « Illustration », « teintes indicatives », et une
   précision juste : un changement de couleur à une hauteur donnée s'imprime même sans AMS, et le site
   le dit. Le badge « Imprimable » est une promesse : il doit rester couplé à la validation de
   l'atelier.
6. **Licence, 9.** **Garde explicite : aucun préréglage ne reproduit la silhouette du vase de Ian.**
   Le deed est lié, et la légende courte est reprise sur la carte produit.
7. **Marque, 8.** La règle en « strates » et les révélations quantifiées sont justes. Bricolage et le
   grain papier sont plus « tendance 2026 » que suisses.
8. **N = 1 à N = 50, 8.** L'index Studio, avec des vues ciselées (scissor) dans un seul contexte, la
   grille 3/2/1, les puces de filtres et Flip.
9. **i18n, 7.** `hyphens`, `balance`, `Intl`, pas de ß. Mais « Röstigraben » est une blague
   intraduisible, et le nom est encodé dans l'URL.
10. **Accessibilité, 8.** Boutons d'orbite, couleurs nommées, configurateur complet en mouvement
    réduit. Mais les pins sont longs, y compris sur mobile.

**Idées fortes**

- Le héros « vase → filament → carte portant *votre* nom », avec un vrai `<input>` SSR hors pin sur
  mobile : un hameçon de personnalisation dès l'accueil.
- La garde anti-silhouette pour le Vase spirale.
- La zone d'achat collante dès le chapitre 01 de la fiche produit.
- Le badge Imprimable.
- Mes créations dans Favoris.
- Le 3MF sans WASM.
- La gravure sans CSG (contours des glyphes en `holes`).
- `Disallow: /studio/*?c=`.
- Le WebMCP `studio_configure`.
- La télémétrie SSR calculée par la même fonction pure.
- Le phasage « le Studio d'abord ».

**Défauts rédhibitoires**

- `?nom=` dans l'URL.
- Le grain global, qui touche le tunnel Stripe.
- Un pin de 320 vh (200 svh sur mobile) avant le produit.
- La particule de 40 k + vase + carte dans un seul héros : c'est le plus gros risque de budget et de
  performance sur les appareils bas de gamme, de tous les concepts.

---

## Vainqueur : **Strates** (79)

Strates gagne sur ce qui fait vendre durablement une petite marque suisse :

- un **prix chiffré** ;
- une **crédibilité suisse** sans risque juridique ;
- l'**adéquation au mark** ;
- l'**accessibilité**, et un repli sans WebGL qui reste utile.

Studio est à 2 points et porte mieux l'axe « personnalisation », mais ses défauts touchent la
confiance (données personnelles dans l'URL, grain sur le checkout). Les défauts de Strates sont tous
corrigeables sans changer de thèse.

### Greffes obligatoires sur Strates

**Depuis Studio**

1. **Garde anti-silhouette** : aucun préréglage ni défaut du vase Lavaux ne doit approcher « bouteille
   + ~40 nervures torsadées ». Nouveau défaut du héros : profil galet ou amphore, motif gradins de
   Lavaux ou voronoï, 3 bandes. C'est aussi plus signature.
2. **Surtitre et h1 explicites** : garder « Tout relief commence par une couche. » comme accroche,
   mais mettre au-dessus un surtitre SSR du type « Objets imprimés en 3D, multicolores, réglables ·
   Gland & Pully ». Ajouter la promesse « Réglez-le. On l'imprime. » comme sous-titre ou comme titre
   du chapitre Studio.
3. **Fiche produit : chapitre 01 = galerie + zone d'achat collante** (prix, couleur, Ajouter au
   panier). Les chapitres Rendu, Matière et Fiche passent en dessous.
4. **Hameçon « Votre nom »** à l'accueil (chapitre 03 Studio, pas dans le pin du héros), avec la
   carte Cartouche qui se réextrude en direct, puis « Continuer dans le Studio ». Le nom passe par
   `sessionStorage`, **jamais par l'URL**.
5. **Badge Imprimable** avec la correction à faire, Annuler/Rétablir, « Mes créations » dans Favoris,
   l'outil WebMCP `studio_configure`, `Disallow` des URL d'état, et le 3MF (fflate) en P4.
6. **Phasage** : remonter le Studio Lavaux et Cartouche en P1, à égalité avec le héros. Le héros
   n'est que la bande-annonce du Studio.

**Depuis G1 (Atelier)**

7. **Textes personnels exclus de l'état partageable** (`#c=` : forme et couleurs seulement, texte
   d'exemple au partage). PostHog capture l'URL complète, et le replay doit masquer `/studio`.
8. **JSON-LD `isBasedOn` + `license`** sur la fiche du Vase spirale, un **test e2e** du bloc
   d'attribution, et le lien vers le deed CC BY-ND 4.0. Aucune formulation ne doit suggérer que Ian
   approuve ou soutient la boutique.
9. **Tiroir « Envoyer à l'atelier » dans le Studio**, qui appelle la même Server Action et remplace
   la redirection vers `/custom`. Un seul composant de formulaire est partagé (pas de doublon), et
   `/custom` reste le repli sans JS via un formulaire GET.
10. **Éclaté par filament** (grammes et couches par bande) dans le chapitre 02 « La carte » :
    l'explication honnête du coût des changements de couleur.
11. **Calibrage réel** : fourchette **±15 %** tant que le propriétaire n'a pas imprimé et pesé
    3 pièces Studio (Lavaux 3 bandes, Cartouche, Relief). On ne resserre à ±8 % qu'après. « Le
    serveur ne croit jamais le prix client » s'applique dès P6.
12. **Réglette Z verticale** comme contrôle de scrub tactile et clavier du héros sur mobile (sans
    pin).

**Correctifs propres à Strates**

13. **Métaphore bornée** : sur les cartes, le panier, le suivi et le checkout, l'unité réelle vient
    d'abord (« Hauteur 209 mm »), le clin d'œil ensuite.
14. **Modération des textes** (nom, carte, porte-nom) avant impression : aucune marque tierce, aucune
    injure. À mentionner dans le Studio et dans les CGV le cas échéant.
15. **Limite de 10 envois par heure sur `/api/quote-upload`** : réutiliser le `fileKey` si la
    configuration n'a pas changé (hachage des paramètres), et expliquer l'erreur 429 en 4 langues.
16. **Pas d'animation de `wdth` sur l'élément LCP ni sur un titre qui déplace le contenu en dessous**
    (risque de CLS et d'INP en allemand). Réserver `wdth` aux titres de chapitre dont la boîte a une
    largeur fixe.

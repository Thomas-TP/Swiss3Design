# Refonte 2026 — « La Forge » : plan produit complet

> **Statut : proposition — aucune ligne de code n'est encore modifiée.**
> Document de référence pour transformer Swiss3Design d'une *boutique* d'objets
> imprimés en 3D en une *plateforme* d'impression 3D de référence : commande
> d'une pièce sur mesure en moins de 60 secondes, prix instantané, suivi de
> fabrication honnête. Rédigé à partir d'un audit du code réel (juillet 2026),
> pas de suppositions.
>
> Réalité assumée : projet solo, une imprimante **Bambu Lab P1S + AMS 2 Pro**
> (256 × 256 × 256 mm, 4 couleurs), livraison **Suisse uniquement**, budget
> infra ~5 CHF/mois, l'IA code tout. Chaque proposition ci-dessous est
> implémentable dans ces contraintes — rien qui exige une ferme d'imprimantes,
> un data-center ou une équipe.

---

## 0. Résumé exécutif

**Le diagnostic en une phrase :** le site vend très bien des *objets finis*
(catalogue, panier, checkout : déjà au niveau), mais la moitié « impression
3D sur mesure » — le vrai différenciateur — est un **formulaire de contact
déguisé** : pas de prix, pas de délai, pas de retour visuel, dépendance totale
à une réponse humaine.

**Le pari produit :** faire de la commande d'une pièce sur mesure une
expérience **aussi immédiate qu'un achat catalogue**. Glisser un fichier →
voir sa pièce en 3D → prix ferme en quelques secondes → payer. C'est ce
qu'aucun petit atelier ne propose, et c'est réalisable avec la stack actuelle
(Three.js est déjà dans le projet, le parsing STL est du calcul pur, le
checkout existe déjà).

**Les 5 chantiers, par ordre de retour sur effort :**

| # | Chantier | Effet attendu |
|---|---|---|
| 1 | **La Forge** — devis instantané : upload → analyse → prix → paiement | Le formulaire de devis (conversion quasi nulle par nature) devient un tunnel d'achat |
| 2 | **Homepage à double intention** — « Acheter un objet » / « Imprimer ma pièce » | Le visiteur comprend l'offre en < 5 s, chaque intention a son tunnel |
| 3 | **Suivi de fabrication** — timeline honnête commande → impression → QC → expédition | Confiance, moins d'e-mails « où en est ma commande ? » |
| 4 | **Transparence prix & matières** — page matières comparées, coûts expliqués | Lève l'objection n°1 du sur-mesure : « combien ça va coûter ? » |
| 5 | **Bibliothèque & recommande** — fichiers analysés conservés, re-commande 1 clic | Récurrence (pièces techniques = besoin répétitif) et socle B2B |

---

## 1. Audit critique de l'existant

### 1.1 Méthode

Audit du code source (`src/app/[locale]/**`, `src/db/schema.ts`,
`src/lib/**`) et des parcours qu'il implémente. Chaque constat cite le
fichier concerné.

### 1.2 Ce qui est déjà au niveau (à ne pas casser)

Le socle transactionnel est **meilleur que la moyenne du e-commerce suisse** :

- **Checkout 2 étapes** (`checkout/checkout-flow.tsx`) : autocomplétion
  d'adresse GeoAdmin, Stripe Payment Element préchargé pendant la saisie,
  TWINT/Apple Pay/Google Pay, invité possible avec vérification e-mail,
  finalisation idempotente (`lib/orders.ts`). À conserver tel quel.
- **Fiche produit** : galerie + viewer 3D Three.js teinté par couleur,
  avis d'acheteurs vérifiés, JSON-LD, produits liés. Solide.
- **i18n 4 langues**, mode sombre, navigation basse mobile « app-like ».
- **Suivi invité** `/track` + conversion invité → compte.
- **Admin complet**, e-mails transactionnels 4 langues, relance panier nLPD.

L'erreur classique d'une « refonte totale » serait de tout redessiner. Ici,
80 % de l'effort doit aller sur le sur-mesure et la lisibilité de l'offre,
pas sur le tunnel d'achat catalogue.

### 1.3 Problèmes majeurs

Format : **problème → pourquoi c'en est un → impact utilisateur → impact
business → aujourd'hui vs idéal.**

**P1 — Le devis sur mesure est une boîte noire** (`custom/quote-form.tsx`,
`custom/actions.ts`, schéma `quote_requests`)

- *Pourquoi.* Le client remplit e-mail + description (min. 10 caractères),
  le fichier 3D est **optionnel**, aucun prix ni délai n'est annoncé, l'écran
  de succès dit en substance « on vous répondra ». Toute la valeur dépend
  d'une réponse humaine asynchrone (`status: received → quoted → …`).
- *Impact utilisateur.* Incertitude totale : « ça va coûter 15 ou 150 CHF ? »,
  « réponse dans 2 h ou 5 jours ? ». L'utilisateur pressé (cas majoritaire :
  pièce cassée à remplacer) part chez un concurrent ou sur un site étranger.
- *Impact business.* Le canal au plus fort potentiel de marge a la friction
  d'un formulaire SAV. Chaque devis coûte du temps d'atelier (chiffrage
  manuel, allers-retours quand le fichier manque). Non scalable.
- *Aujourd'hui :* formulaire → e-mail → chiffrage manuel → fil de discussion
  → paiement. *Idéal :* upload → analyse automatique → **prix ferme
  instantané** pour les cas standards (STL sain, matière courante), le fil
  de discussion ne restant que pour les cas hors norme. Voir § 5.1.

**P2 — La promesse de la plateforme est invisible sur la homepage**
(`app/[locale]/page.tsx`)

- *Pourquoi.* Hero générique e-commerce : badge, titre, deux CTA dont
  « sur mesure » en bouton secondaire fantôme. Rien ne montre *ce qu'on peut
  faire* (déposer un fichier, choisir 4 couleurs, recevoir en X jours).
- *Impact utilisateur.* Le visiteur « j'ai un fichier STL » — l'intention la
  plus qualifiée qui puisse arriver sur le site — ne voit pas en < 5 s que
  c'est possible, encore moins que c'est simple.
- *Impact business.* Perte du trafic le plus monétisable ; le site se
  positionne de fait comme une petite boutique déco, en concurrence frontale
  avec des marchands généralistes, au lieu d'occuper la niche « impression à
  la demande en Suisse » où la concurrence locale est faible.
- *Aujourd'hui :* un seul hero, une seule hiérarchie. *Idéal :* homepage à
  **double intention** avec zone de dépôt de fichier fonctionnelle dès le
  hero. Voir § 6.1.

**P3 — Aucun prix de référence pour le sur-mesure, nulle part**

- *Pourquoi.* Ni fourchette, ni exemples (« ce crochet : 12 CHF », « ce
  boîtier : 38 CHF »), ni logique tarifaire expliquée.
- *Impact utilisateur.* L'ancrage mental par défaut est « l'impression 3D
  c'est cher » ou l'inverse — les deux tuent la conversion : le premier fait
  fuir, le second produit des devis refusés (déception).
- *Impact business.* Devis chiffrés puis refusés = travail gratuit. Le taux
  `quoted → paid` est mécaniquement bas quand le prix arrive après
  l'engagement émotionnel.
- *Idéal :* grille publique (« dès 9 CHF, la plupart des pièces entre 15 et
  60 CHF »), exemples réels chiffrés, et à terme le prix vivant de la Forge.

**P4 — Le client n'a aucun retour visuel ni technique sur son fichier**

- *Pourquoi.* Le viewer 3D existe (`components/product-viewer-3d.tsx`) mais
  seulement pour les produits du catalogue. Un upload client part dans R2
  sans validation : fichier corrompu, non étanche, trop grand pour le
  plateau (256 mm), parois trop fines — tout est découvert par l'atelier,
  après coup.
- *Impact utilisateur.* Aucun « votre fichier est bon » rassurant ; en cas de
  problème, un aller-retour e-mail de plus (des jours perdus).
- *Impact business.* Temps d'atelier consommé par du contrôle qualité
  amont qui devrait être automatique ; devis retardés = devis perdus.
- *Idéal :* analyse à l'upload (étanchéité, dimensions vs plateau, épaisseurs)
  avec verdict clair et suggestions. Voir § 5.2.

**P5 — Après paiement, silence radio jusqu'à l'expédition**

- *Pourquoi.* Les statuts existent en base (`in_production`, `done`,
  `trackingNumber`) mais le client ne voit qu'un état sec dans son compte.
  Pas de timeline, pas d'estimation, pas de notification intermédiaire.
- *Impact utilisateur.* Anxiété post-achat, surtout pour du sur-mesure
  (« ont-ils vu ma commande ? »).
- *Impact business.* E-mails de relance clients à traiter à la main ;
  occasion manquée de créer le moment « waouh » (voir sa pièce passer en
  fabrication) qui génère bouche-à-oreille et réachat.
- *Idéal :* timeline de fabrication avec ETA calculée (le moteur de prix
  connaît le temps d'impression estimé — autant le réutiliser). Voir § 5.3.

### 1.4 Problèmes secondaires

| Constat | Fichier | Correctif proposé |
|---|---|---|
| Panier 100 % localStorage : pas de synchro multi-appareils pour les connectés | `lib/cart.tsx` | Synchro D1 pour utilisateurs connectés (fusion à la connexion), localStorage reste la source invité |
| Vérification e-mail invité au checkout = étape de friction | `checkout-flow.tsx` (`GuestEmailVerification`) | À conserver (anti-fraude, qualité des e-mails transactionnels) mais mesurer son taux d'abandon ; si > 5 %, passer en vérification différée post-commande |
| Pas de page « comment ça marche » ni FAQ structurée | — | Page `/aide` + bloc processus sur la homepage (voir § 3) |
| Pas de comparaison des matières côté client (PLA vs PETG…) | admin `materials/` seulement | Page `/matieres` avec tableau comparatif + assistant de choix (voir § 5.4) |
| `custom` demande l'e-mail même connecté (prérempli mais affiché) | `quote-form.tsx` | Dans la Forge : champ masqué si session active |
| Le multicolore — LE différenciateur — n'est montré qu'en panneau statique | `page.tsx` § multicolore | Démo interactive : recolorer un modèle 3D en direct dans le hero (le viewer teinté existe déjà) |

---

## 2. Redéfinition du produit (from zero)

**Pourquoi ce produit existe.** Obtenir un objet physique sur mesure en
Suisse est aujourd'hui soit lent (ateliers traditionnels, devis en jours),
soit opaque (plateformes industrielles étrangères, minimums de commande,
douane), soit bricolé (acheter sa propre imprimante). Swiss3Design existe
pour rendre ça **immédiat, transparent et local**.

**La promesse principale (une phrase, testable) :**

> **« Votre pièce, imprimée en Suisse : prix en 10 secondes, chez vous en
> quelques jours. »**

Chaque mot est un engagement mesurable : *prix en 10 secondes* (la Forge),
*imprimée en Suisse* (confiance, nLPD, pas de douane), *quelques jours*
(délai affiché et tenu, pas de promesse J+1 intenable avec une imprimante).

**Les trois publics, par ordre de priorité :**

1. **Le réparateur** — une pièce cassée, un fichier trouvé ou modélisé, veut
   un prix et une date *maintenant*. C'est lui que la Forge sert d'abord.
2. **L'acheteur déco/cadeau** — veut un bel objet fini, multicolore. Le
   catalogue actuel le sert déjà bien ; on ne touche presque rien.
3. **Le pro / l'artisan** (B2B léger) — petites séries, prototypes,
   re-commandes. Servi en phase 3 par la bibliothèque + commande récurrente.

**Comment rendre la commande aussi simple qu'un achat Amazon.** Amazon a
résolu trois choses : prix visible avant tout engagement, confiance par
défaut, zéro re-saisie. Transposé ici :

- *Prix avant engagement* → le prix apparaît **pendant** la configuration,
  recalculé en direct à chaque choix (matière, couleurs, remplissage,
  quantité), jamais « à la fin ».
- *Confiance par défaut* → verdict technique automatique sur le fichier
  (« imprimable ✓ »), délai daté (« expédiée le mardi 14 »), fabrication
  locale visible.
- *Zéro re-saisie* → la Forge débouche dans le **même panier et le même
  checkout** que le catalogue. Pas de tunnel parallèle. Adresses mémorisées,
  re-commande en un clic depuis la bibliothèque.

**Ce qu'on refuse (anti-scope, aussi important que le reste) :**

- Pas de place de marché multi-ateliers, pas de « réseau de makers ».
- Pas de promesse de délai que la capacité (1 × P1S) ne tient pas : le délai
  affiché vient d'une file de production réelle, quitte à afficher J+6.
- Pas de chatbot IA de façade : chaque automatisation proposée repose sur du
  calcul déterministe et explicable (géométrie, formule de prix, file).
- Pas de compte obligatoire, jamais.

---

## 3. Architecture cible

### 3.1 Sitemap

```
/                        Homepage double intention (catalogue | Forge)
/shop                    Catalogue (inchangé structurellement)
/products/[slug]         Fiche produit (inchangée)
/forge                   ★ NOUVEAU — devis instantané : upload → analyse → prix → panier
/custom                  CONSERVÉ — demande accompagnée (fil de discussion) ; la Forge
                         s'y ajoute, elle ne le remplace pas
/matieres                ★ NOUVEAU — comparateur PLA/PETG/TPU + assistant de choix
/aide                    ★ NOUVEAU — comment ça marche, FAQ, délais, retours
/cart → /checkout        Tunnel unique catalogue + Forge (inchangé)
/track                   Suivi invité, enrichi de la timeline de fabrication
/account                 Espace client
  /account/library       ★ NOUVEAU — bibliothèque de fichiers analysés + re-commande
  /account/orders/[id]   + timeline de fabrication
  (quotes/ devient l'historique des demandes « aide-atelier »)
/pro                     ★ PHASE 3 — offre B2B : récurrence, facturation, séries
/a-propos, /legal/*      inchangés
```

**Aucune page ni fonctionnalité supprimée** (décision produit du
2 juillet 2026) : `/custom` reste la demande accompagnée avec fil de
discussion, `/favorites` garde sa place dans la navigation. La Forge et les
nouvelles pages sont **purement additives**.

### 3.2 Navigation

- **Mobile (barre basse, conservée)** : Boutique · **Forge** (bouton central
  mis en avant, forme distinctive) · Panier · Compte.
- **Desktop (header)** : Boutique · Forge · Matières · Aide — panier et
  compte à droite. « À propos » descend dans le footer.
- Règle : **jamais plus de 4 destinations** dans la navigation principale.
  Tout le reste vit dans le footer ou dans le compte.

### 3.3 Logique des parcours

```
Intention « objet fini »   : / → /shop → produit → panier → checkout   (2–3 clics, existant)
Intention « ma pièce »     : / (drop du fichier n'importe où) → /forge
                             → analyse (3–8 s) → config + prix vivant
                             → panier → checkout                        (< 60 s si fichier sain)
Cas hors norme             : /forge → verdict « à faire vérifier »
                             → /forge/aide-atelier (fil de discussion existant,
                               SLA affiché : réponse < 24 h ouvrées)
Post-achat                 : e-mail confirmation → timeline /track ou compte
                             → e-mail « en fabrication » → « expédiée » + n° suivi
Récurrence                 : compte → bibliothèque → re-commander (1 clic, prix rafraîchi)
```

Le point architectural clé : **la Forge produit des articles de panier
standards** (snapshot prix + paramètres + clé R2 du fichier), pas un objet
« devis » parallèle. Un seul checkout, un seul webhook Stripe, une seule
logique d'idempotence (`lib/orders.ts`) — la table `quote_requests` ne sert
plus qu'à l'escalade humaine.

---

## 4. Système de design

La charte (rouge `#E5231C` / encre / papier, Geist Sans, cube isométrique)
est saine et déjà appliquée avec rigueur — **on la garde**. Toute nouvelle
déclinaison visuelle reste soumise à validation avant usage (contrainte de
marque). Le travail est de la *systématiser*, pas de la remplacer.

**Tokens (déjà largement en place dans `globals.css`, à figer comme
contrat) :** `paper / surface / line / ink / soft / accent / accent-dark /
night`. Rayons : `rounded-xl` champs, `rounded-card` panneaux, `rounded-full`
actions. Espacement : échelle 4-8-12-16-24-32-48-64, sections en `py-14/16`.

**Règles d'interaction (héritées du code existant, érigées en loi) :**

1. Feedback < 100 ms sur toute action (état `pending`, squelettes, jamais de
   spinner plein écran).
2. Un seul CTA accent par écran ; le reste en bordure/fantôme.
3. Toute attente > 1 s est **narrée** (« Analyse du maillage… 214 000
   triangles ») — une attente expliquée est perçue moitié moins longue,
   et dans la Forge elle *démontre la compétence technique* de l'atelier.
4. Les animations (`motion`, `Reveal`) signifient quelque chose (hiérarchie,
   causalité) ou n'existent pas. Pas de décoration mouvante.
5. Chaque état vide dit quoi faire ensuite (panier vide → « Déposer un
   fichier ou voir la boutique »).
6. Prix : toujours `formatChf`, toujours TTC port inclus dès que l'adresse
   est connue, jamais de « à partir de » sans exemple concret chiffré.

**Patterns interdits** (même s'ils sont « standards ») : pop-up newsletter,
bannière cookie surdimensionnée (analytics sans cookie — on n'en a pas
besoin), carrousels automatiques, compte-à-rebours artificiels, faux
« 3 personnes regardent cet article », chat proactif.

---

## 5. Innovations fonctionnelles

### 5.1 La Forge — moteur de devis instantané ★ cœur de la refonte

**Expérience.** L'utilisateur dépose un `.stl` (v1 ; `.3mf` en v2, `.step`
via escalade). En 3 à 8 secondes, il voit : sa pièce en 3D (viewer Three.js
existant, réutilisé), un verdict d'imprimabilité, et un **prix vivant** qui
se recalcule à chaque réglage. Il ajoute au panier. C'est tout.

**Pipeline technique (aucune dépendance externe, tient sur la stack
actuelle) :**

1. *Client (instantané, gratuit en CPU serveur)* — parsing STL
   binaire/ASCII en TypeScript dans un Web Worker : volume du maillage
   (somme des tétraèdres signés), boîte englobante, nombre de triangles,
   étanchéité (chaque arête partagée par exactement 2 triangles), aires par
   tranche de hauteur. Affichage immédiat du modèle + métriques.
2. *Serveur (source de vérité du prix)* — à l'ajout au panier, le Worker
   re-parse le fichier depuis R2 (STL binaire = lecture séquentielle
   triviale, 50 octets/triangle ; plafond 64 Mo ≈ 1,3 M triangles, largement
   dans le budget CPU Workers) et recalcule le prix. Le prix client n'est
   qu'un aperçu ; **le serveur ne fait jamais confiance aux chiffres du
   navigateur.** Tolérance de réconciliation 1 % ; au-delà → prix serveur.
3. *Snapshot* — l'article de panier fige : clé R2, hash du fichier, matière,
   couleurs, remplissage, quantité, prix, temps d'impression estimé. Même
   principe de snapshot que `order_items` aujourd'hui.

**Formule de prix (paramètres en D1, éditables dans l'admin) :**

```
prix_unitaire = max(
  prix_minimum,                                   # forfait plancher (9 CHF)
  matière + machine + couleurs + préparation
) × marge

matière      = volume_maillage_cm³ × taux_matière_effectif × densité(g/cm³) × CHF_par_g
               # taux_matière_effectif ≈ 0,35 (parois + remplissage 15 %) — recalibrable
machine      = temps_estimé_h × taux_horaire_CHF
               # temps_estimé = a·volume + b·(hauteur/hauteur_couche)·aire_moyenne_couche
couleurs     = purge_g_par_changement × nb_changements_estimés × CHF_par_g × facteur
               # nb_changements ≈ (nb_couleurs − 1) × couches_multicolores
préparation  = forfait fixe (lancement machine, contrôle, emballage)
```

Le poste **couleurs** est le différenciateur honnête : sur une AMS, chaque
changement de filament purge du plastique — c'est le vrai coût du
multicolore, et personne ne le montre. La Forge l'affiche : « 4 couleurs :
+11.20 CHF (déchets de purge) — astuce : 2 couleurs = −8.40 CHF ». Les
coefficients `a`, `b` et la purge se calibrent par régression sur les
exports Bambu Studio des impressions déjà réalisées (temps réel, grammes
réels) — boucle d'amélioration continue avec les données de l'atelier.

**Prix ferme vs indicatif.** Si le fichier est sain (étanche, dans le
plateau, < plafond triangles, épaisseurs ≥ 0,8 mm détectables) → **prix
ferme, commandable immédiatement**. Sinon → prix indicatif plafonné
(« au plus 52 CHF, confirmation atelier sous 24 h ouvrées ») et escalade
vers `/forge/aide-atelier` avec l'analyse pré-remplie. On ne bloque jamais
sans donner un chiffre.

### 5.2 Vérificateur de fichier (inclus dans la Forge, valeur autonome)

Verdicts en langage humain, pas en jargon :

- ✅ « Maillage étanche, prêt à imprimer »
- ⚠️ « 3 trous détectés dans le maillage — réparation automatique possible,
  ou notre atelier vérifie gratuitement »
- ❌ « 312 mm de large : dépasse notre plateau (256 mm). Réduire à 82 % ? »
  (bouton : appliquer l'échelle, prix recalculé)
- ⚠️ « Parois < 0,8 mm par endroits : fragiles à l'impression » (zones
  surlignées en rouge sur le modèle 3D)

Chaque verdict a une action associée. Le vérificateur est aussi un aimant
SEO/acquisition : « vérifier gratuitement si un STL est imprimable » est une
recherche fréquente sans bonne réponse suisse.

### 5.3 Suivi de fabrication honnête

Pas de webcam ni de télémétrie gadget : une **timeline pilotée par
l'atelier**, avec des dates estimées issues du moteur de prix (temps
d'impression connu) et de la file réelle.

```
Confirmée ✓ → En file (position 3 · lancement estimé jeudi)
→ En impression (≈ 7 h 30 · PETG anthracite + rouge)
→ Contrôle qualité → Expédiée (n° suivi Poste) → Livrée
```

- Schéma : statuts + horodatages sur `orders` (le cycle de vie de
  `quote_requests` sert de modèle éprouvé).
- Visible dans le compte **et** sur `/track` (invités). E-mail aux deux
  transitions qui comptent : « en fabrication » et « expédiée » — pas plus,
  pas de spam de micro-étapes.
- Coût admin : deux taps par commande dans le back-office. Bénéfice : la
  question SAV n°1 disparaît, et « voir sa pièce en fabrication » est le
  moment le plus partageable du parcours.

### 5.4 Comparateur & assistant matières (`/matieres`)

Tableau comparatif honnête des matières réellement proposées (résistance,
extérieur/UV, contact alimentaire, flexibilité, prix relatif, couleurs
disponibles) + assistant en 3 questions maximum (« Usage ? Dehors ?
Sollicitations mécaniques ? ») → recommandation motivée. Arbre de décision
statique et explicable — pas d'appel IA, pas de coût, pas d'aléa. La
recommandation se reporte d'un clic dans la Forge.

### 5.5 Bibliothèque de pièces & re-commande (`/account/library`)

Chaque fichier passé par la Forge est conservé (R2 — droit à l'effacement
nLPD respecté : purge sur suppression du compte, déjà en place) avec son
analyse et ses derniers réglages. Re-commander = 1 clic, prix recalculé aux
paramètres du jour. C'est la brique qui transforme un acheteur ponctuel en
client récurrent, et le socle de l'offre pro.

### 5.6 Conseils de réduction de coût en direct

Le prix vivant rend chaque levier **manipulable** : curseurs remplissage /
quantité / couleurs avec impact CHF immédiat, et suggestions calculées
(« −20 % de hauteur = −15 % ») puisque la formule est locale et
instantanée. Aucun concurrent grand public ne montre *pourquoi* un prix
bouge ; ici la transparence devient l'argument de vente.

### 5.7 Offre pro légère (`/pro`, phase 3)

Profil entreprise (raison sociale sur factures PDF), bibliothèque partagée,
commandes récurrentes, tarifs dégressifs par quantité affichés dans la Forge
(la remise quantité est déjà dans la formule). Pas de portail séparé, pas de
SSO d'entreprise : les pros veulent surtout re-commander vite et avoir une
facture propre.

---

## 6. Détail page par page

### 6.1 Homepage `/`

- **Objectif utilisateur :** comprendre l'offre et s'auto-router en < 5 s.
- **Objectif business :** répartir le trafic entre les deux tunnels sans en
  sacrifier un ; prouver la crédibilité technique d'emblée.
- **Problèmes actuels :** hero mono-intention (P2), multicolore statique,
  processus de fabrication jamais expliqué, aucun prix sur mesure (P3).
- **Structure (wireframe texte) :**

```
[Header / barre basse]
HERO — double intention, 60/40
  ├─ Titre : « Objets design & pièces sur mesure, imprimés en Suisse »
  ├─ Carte A « La boutique » : 3 produits phares, CTA plein → /shop
  └─ Carte B « La Forge » : ZONE DE DÉPÔT ACTIVE (drag & drop fonctionnel
     dès la homepage → redirige vers /forge avec le fichier en mémoire)
     + « Prix en 10 secondes · dès 9 CHF » + exemples chiffrés réels
BANDEAU PREUVE — Fabriqué à Gland (VD) · Livraison offerte dès X CHF ·
     Paiement suisse (TWINT) · note moyenne avis
DÉMO MULTICOLORE — viewer 3D interactif : l'utilisateur recolore un modèle
     en direct (4 pastilles) — réutilise product-viewer-3d teinté
PROCESSUS — 3 étapes illustrées : Déposez / Validez le prix / Recevez
SÉLECTION — grille produits phares (existant, conservé)
```

- **Interactions :** le drop de fichier fonctionne sur *toute* la page
  (overlay « Déposez pour lancer la Forge » au dragover) — le geste le plus
  qualifié ne doit jamais tomber à côté.
- **Responsive :** mobile = cartes A/B empilées, zone de dépôt devient
  bouton « Choisir un fichier » (le drag & drop n'existe pas au doigt).
- **Impact conversion attendu :** l'entrée Forge passe d'un lien fantôme à
  ~50 % de la surface du hero ; mesure : part des sessions atteignant
  `/forge`.

### 6.2 La Forge `/forge`

- **Objectif utilisateur :** prix fiable et pièce validée sans parler à
  personne. **Objectif business :** convertir le sur-mesure sans temps
  d'atelier.
- **Structure :** une seule vue en 2 colonnes (pas de wizard multi-écrans) :

```
GAUCHE (55 %) : viewer 3D de LA PIÈCE DU CLIENT
  toolbar : rotation auto · mesures · zones fragiles · vue plateau 256³
  bandeau verdict : ✅ / ⚠️ / ❌ + actions (réparer, mettre à l'échelle)
DROITE (45 %) : configurateur à PRIX VIVANT
  Matière [PLA|PETG|TPU + lien /matieres]   Couleurs [1–4 pastilles]
  Remplissage [léger|standard|solide]        Quantité [− n +]
  ────────────────────────────────────────
  PRIX : 34.50 CHF   ← se recalcule à CHAQUE interaction, animation compteur
  détail dépliable : matière 9.80 + machine 16.40 + couleurs 5.10 + prépa 3.20
  Expédiée le : mardi 14 juillet
  [ Ajouter au panier ]   « Besoin d'un humain ? → aide-atelier »
```

- **États :** vide (dépôt + exemples de fichiers à essayer), analyse
  (progression narrée sur le modèle en fil de fer), verdict ⚠️/❌ (actions),
  hors gabarit (escalade pré-remplie).
- **Animations :** wireframe → solide à la fin de l'analyse (la pièce
  « devient réelle ») ; changement de couleur appliqué au modèle en < 16 ms.
- **Responsive :** mobile = viewer en haut (45 vh, sticky), configurateur en
  dessous, prix + CTA en barre basse fixe.
- **Justification UX :** une seule vue = le prix et la pièce restent
  toujours visibles ensemble ; c'est la co-présence pièce/prix qui crée la
  confiance, un wizard la casserait.

### 6.3 Demande accompagnée `/custom` (conservée, améliorée)

Mêmes actions serveur, même fil de discussion, mais (1) l'analyse de la Forge pré-remplit la demande quand elle existe,
(2) un **SLA affiché** (« réponse sous 24 h ouvrées » + fourchette de prix
indicative), (3) e-mail masqué si connecté. Le statut `received → quoted →
paid` existant continue de fonctionner tel quel.

### 6.4 Boutique `/shop` et fiche produit — retouches seulement

Structure conservée. Trois ajustements : badge « Stock — expédiée demain »
vs « À la demande — délai X j » sur les cartes (l'info existe en base,
`saleType`/`stock`) ; filtres matière/couleur en plus des catégories ;
sur la fiche, date d'expédition estimée à côté du prix (même moteur de délai
que la Forge). Rien d'autre — ce tunnel convertit déjà.

### 6.5 Panier & checkout — ne pas toucher, sauf

Le tunnel est au niveau (cf. § 1.2). Seuls ajouts : rendu correct des
articles Forge (vignette du modèle générée à l'analyse, paramètres résumés,
lien « modifier dans la Forge ») ; synchro panier D1 pour les connectés ;
mesure du taux d'abandon à l'étape vérification e-mail invité (cf. § 1.4).

### 6.6 Compte, login, `/track`

- **Login/inscription :** existant sain (Google OAuth, 2FA). Une seule
  retouche : à l'inscription post-Forge, rattacher automatiquement le
  fichier analysé à la bibliothèque (le mécanisme de rattachement
  invité → compte existe déjà pour les commandes — le réutiliser).
- **Dashboard compte :** réordonner autour de la récurrence — dernière
  commande + sa timeline en premier, bibliothèque ensuite, favoris ensuite.
- **`/track` :** afficher la timeline de fabrication complète (§ 5.3) au
  lieu du statut sec — page déjà appréciée des invités, elle devient un
  argument de vente.

### 6.7 `/matieres` et `/aide`

Nouvelles pages, contenu statique + composants existants (tableaux, accordéons).
`/matieres` : comparateur + assistant (§ 5.4). `/aide` : comment ça marche,
délais, retours, qualité, fichiers acceptés — chaque réponse se termine par
le CTA pertinent (Forge ou boutique). Les deux pages sont des atterrissages
SEO à intention forte (« impression 3D PETG suisse », « délai impression 3D
sur mesure »).

---

## 7. CRO — optimisation de la conversion

**Réalité statistique d'abord :** avec le trafic d'un site de niche, l'A/B
testing classique est du théâtre (des mois pour une significativité). La
méthode : **mesures séquentielles** (avant/après par période) sur Cloudflare
Web Analytics + données de commande D1, et gros leviers plutôt que
micro-optimisations.

**Entonnoirs mesurés :**

```
Catalogue : visite → fiche → panier → checkout → payé
Forge     : visite → upload → analyse OK → config → panier → payé
            + taux « prix ferme » vs « escalade humaine » (cible : > 70 % ferme)
Récurrence: % clients avec 2e commande < 90 j
```

**Leviers classés par impact estimé :**

| Levier | Mécanisme | Attente |
|---|---|---|
| Prix instantané (Forge) | Supprime l'incertitude n°1 du sur-mesure | Conversion sur-mesure ×3 à ×5 (base actuelle quasi nulle) |
| Date d'expédition datée partout | « Mardi 14 » bat « 3–5 jours » (concret > abstrait) | +abandon panier ↓ |
| Hero double intention + drop global | Route l'intention la plus chaude sans clic | Sessions → /forge ↑↑ |
| Détail du prix dépliable | La transparence désamorce la comparaison prix | Taux config → panier ↑ |
| Timeline fabrication + 2 e-mails | Confiance post-achat, partage | Réachat ↑, SAV ↓ |
| Curseurs à impact CHF direct | L'utilisateur s'auto-convainc en manipulant | Panier moyen ↑ (remplissage/quantité) |
| Badge stock vs à-la-demande sur cartes | Attentes justes = moins de déceptions | SAV ↓ |

**Frictions supprimées :** devis asynchrone pour cas standards (l'attente
*est* la friction), re-saisie e-mail connecté, silence post-achat, absence
de fourchettes de prix. **Frictions conservées sciemment :** vérification
e-mail invité (qualité > vitesse ici — sous surveillance), validation
serveur du prix (sécurité non négociable).

---

## 8. Workflow de développement

Chaque lot suit ce cycle, aligné sur l'outillage du dépôt :

1. **Développement** sur branche (stacked si multi-phases — merger le sommet
   de pile dans `main`, cf. pièges dans `docs/deploiement-cloudflare.md`).
2. **Tests** : Vitest sur la logique pure (le moteur de prix et le parseur
   STL sont des cibles idéales : entrées/sorties déterministes, fichiers de
   fixture) + `npm run lint` + `npm run typecheck`.
3. **Validation locale** : `npm run dev`, parcours complet au navigateur.
4. **Préview production** : `npm run preview` — obligatoire ici : la Forge
   ajoute des Web Workers et du contenu inline → la **CSP à nonce**
   (prod uniquement) doit être vérifiée avant tout déploiement.
5. **Tests complets** : responsive (barre basse mobile), 4 langues (toute
   chaîne dans `messages/{fr,de,it,en}.json`), thème sombre, perf (parsing
   en Web Worker, jamais sur le thread principal).
6. **Correction** puis **validation finale** (revue du diff).
7. **Production** : push sur `main` → **vérifier que le Worker a réellement
   été déployé** (`modified_on`), déploiement manuel sinon (règle d'or 9).

Rappels non négociables hérités des règles d'or : jamais de `redirect()`
dans une Server Action ; argent en centimes ; bindings dans le handler ;
prix toujours recalculé serveur.

---

## 9. Roadmap d'implémentation

Phases indépendamment livrables, chacune utile seule. Efforts en sessions
de travail IA (~une demi-journée équivalent).

| Phase | Contenu | Effort | Dépend de |
|---|---|---|---|
| **0 — Quick wins** | Badges stock/délai sur cartes produit · SLA + fourchette de prix affichés sur `/custom` · exemples de prix réels sur la homepage · e-mail masqué si connecté | 1–2 | — |
| **1 — Moteur de prix** | Parseur STL (lib pure + tests fixtures) · formule + table `pricing_params` + admin · calibration sur historique Bambu Studio | 3–4 | — |
| **2 — La Forge v1** | Page `/forge` : upload → analyse Web Worker → viewer → config → prix vivant → article de panier snapshot · re-parse serveur · passerelles Forge ↔ `/custom` (conservé) | 5–7 | 1 |
| **3 — Homepage & nav** | Hero double intention · drop global · démo multicolore interactive · nav (Forge au centre mobile) · pages `/matieres` + `/aide` | 3–4 | 2 |
| **4 — Fabrication visible** | Statuts + horodatages sur `orders` · timeline compte + `/track` · 2 e-mails · admin 2-taps | 2–3 | — |
| **5 — Bibliothèque & récurrence** | `/account/library` · re-commande 1 clic · rattachement fichier à l'inscription · synchro panier D1 | 2–3 | 2 |
| **6 — Pro & extensions** | `/pro` : profil entreprise, factures PDF, dégressif quantité · `.3mf` · assistant matières | 3–4 | 2, 5 |

**Ordre recommandé : 0 → 1 → 2 → 3 → 4 → 5 → 6.** La phase 1 est du calcul
pur testable sans UI (risque technique purgé en premier) ; la phase 2 est le
produit ; la phase 3 lui amène le trafic ; les suivantes construisent la
récurrence. Chaque phase se termine par le cycle du § 8, validation humaine
comprise avant `main`.

**Décisions prises par défaut (à invalider si désaccord) :**

1. STL seul en v1 (binaire + ASCII) — 3MF/STEP escaladent vers l'atelier.
   *Justification :* STL = 90 % des fichiers amateurs, parsing trivial et
   fiable ; STEP exigerait un noyau CAO, hors de portée raisonnable sur
   Workers.
2. Le prix serveur fait foi, tolérance 1 % avec le calcul client.
   *Justification :* sécurité (manipulation triviale sinon) sans sacrifier
   l'instantanéité perçue.
3. La Forge alimente le panier standard, pas la table `quote_requests`.
   *Justification :* un seul tunnel de paiement éprouvé et idempotent à
   maintenir ; les devis restent le chemin d'exception.
4. Pas de rendu serveur des vignettes 3D en v1 (capture canvas côté client
   à l'analyse). *Justification :* le rendu 3D serveur sur Workers est
   coûteux/fragile ; la capture client est gratuite et suffisante.
5. Délais exprimés en date d'expédition, jamais en date de livraison.
   *Justification :* la Poste n'est pas sous notre contrôle ; on ne promet
   que ce qu'on tient.

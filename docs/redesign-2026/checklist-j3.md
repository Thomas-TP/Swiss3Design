# Refonte « Strates » · Checklist du propriétaire pour le jalon J3

> Document d'exécution rédigé par WP-99 (09.10.2026). Il dit **quoi regarder sur la
> preview avant de fusionner**, **quoi faire pour fusionner**, **quoi vérifier juste
> après** et **comment revenir en arrière** si quelque chose tourne mal.
> La fusion elle-même n'est lancée que sur votre accord explicite (brief §9.1, §11.2 n° 7).
> Les règles d'or d'`AGENTS.md` priment sur tout ce qui suit (rappelées là où elles comptent).

> **Mise à jour du 14.10.2026 : achat direct du Studio.** Ce lot ajoute une **migration
> Postgres** (colonne `order_items.studio`) et change les prix et la livraison : la section
> **1.4** donne l'**ordre exact** des opérations. Le retour arrière n'est donc plus « de code
> seulement » (voir 1.4 et la section 4).
>
> **Mise à jour du 15.10.2026 : stock de filament.** Seconde migration additive (`0010`, tables
> `filament_*`) et seed des références, à appliquer elles aussi avant la fusion ; le Studio ne vend
> que les couleurs en stock (section **1.4**, étape 2).
>
> **Mise à jour du 15.10.2026 : couleurs de la boutique.** Les articles de la boutique proposent
> les **mêmes couleurs que « Sur mesure »** (les références du stock), la matière est **PLA
> partout**, et la page admin « Palette boutique » n'existe plus. Troisième migration additive
> (`0011`, deux tables) : section **1.4**, étape 2, ordre **0010, 0011, seed des références**.
>
> **Mise à jour du 25.10.2026 : la boutique devient Kreya.** Nom, logo « Pic en strates »,
> icônes, e-mails (`shop@`, `account@`, `studio@`, `news@` sur kreya.ch), textes en 4 langues,
> identité légale, numéros de commande `KRY-` (les `S3D-` restent valables). La fusion attache
> **kreya.ch** au Worker de production et fait de swiss3design.ch une redirection 301 : c'est
> une **bascule de domaine**, à dérouler avec la section **2 bis** (Stripe, cron, Google, PostHog,
> annonce aux clients).
>
> **Mise à jour du 16.10.2026 : atelier 3D de « Sur mesure ».** Peinture par zone, taille et
> orientation ; le devis reçoit un 3MF peint (prêt pour Bambu Studio). Quatrième migration
> additive (`0012`, une table `quote_color_projects`) : section **1.4**, étape 2 bis.

**Où en est-on.** La branche `claude/redesign-2026` contient tous les packages, les vagues de
correctifs R1 et R16 et ce lot WP-99. Elle est **à jour avec `main`** (aucun commit de `main`
qu'elle n'ait pas, au 09.10.2026) : plus de 500 fichiers, aucun changement de schéma Postgres, de binding Cloudflare,
de CSP ni de `src/middleware.ts` par rapport à `main`. Seuls `package.json` (gsap, lenis, d3-contour,
earcut, opentype.js en dev, `three` figé à `0.186.1`) et `public/_headers` (cache des posters et
des glyphes) touchent à l'infrastructure. **Le retour arrière est donc un retour de code
seulement** (voir section 4).

---

## 1. Avant la fusion : à regarder sur la preview

URL : https://swiss3design-preview.thomastp.workers.dev (Worker `swiss3design-preview`, branche
Neon `preview`, Stripe en mode test, analytics **non mesurées** : la mesure ne tourne que sur
`swiss3design.ch`). Vérifiez d'abord que la preview sert bien le dernier commit de la branche
(`git log -1` du dépôt, et la date du dernier déploiement du Worker `swiss3design-preview`).

### 1.1 Décisions encore à vous (sans réponse, le défaut du brief s'applique)

| Décision                                                                                        | Défaut appliqué aujourd'hui                                                                                                                                                                                                           | À faire                                                                                                                                      |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventaire réel des bobines (§11.2 n° 2)                                                        | **Fait le 14.10.2026** : Bambu Lab PLA Matte (15.10.2026, ex-Polymaker), hex officiels, mention « teinte à l'écran approximative »                                                                                                    | Confirmer les huit bobines (`src/lib/studio/filaments.ts`)                                                                                   |
| Coefficients de prix (§11.2 n° 3)                                                               | **Fait le 14.10.2026** : prix ferme par objet (`src/lib/studio/price.ts`), achat direct au panier                                                                                                                                     | Relire les prix par défaut : vase 44.90, montagne 49.90, porte-nom 24.90, carte 17.90 (4.90 pièce à 10)                                      |
| Mention du **stockage local du Studio** dans la politique de confidentialité (§11.2 n° 4, nLPD) | **Fait le 09.10.2026** : section « Studio et fichiers déposés » dans les 4 langues (créations, textes de session, configuration transmise au devis, cookie technique de 24 h des fichiers déposés), date de mise à jour au 09.10.2026 | Relire la version française, seule à faire foi                                                                                               |
| Accroches de l'annexe C du brief (§11.2 n° 6)                                                   | Textes de l'annexe C                                                                                                                                                                                                                  | Relire les 4 langues                                                                                                                         |
| Nom de marque : **« Kreya »** choisi le 08.10.2026                                              | Le site s'appelle encore Swiss3Design partout                                                                                                                                                                                         | Acheter `kreya.ch` (Infomaniak, vous), puis la bascule est un paquet à part **après J3**                                                     |
| Netteté du canvas 3D sur très grand écran (WP-99, `measures-wp99-canvas.md`)                    | Budget de pixels du tampon : **8 Mpx** en C2. Un 4K à 150 % et un 27 pouces Retina sont rendus à 1,17 et 1,23 au lieu de 1,5                                                                                                          | Regarder l'accueil sur un tel écran ; si la netteté compte plus que le gain, `STAGE_PIXEL_BUDGET[2]` à `14_000_000` (`stage/pixel-ratio.ts`) |
| Registre de l'italien (`messages/it.json`, ≈ 150 chaînes historiques)                           | **Fait le 10.10.2026** : tout l'italien du site au « Lei » (≈ 142 chaînes, pages légales, e-mails, désinscription)                                                                                                                    | Relire les descriptions de produits en italien dans l'admin (base de production)                                                             |
| Licence de la police Geist (OFL)                                                                | **Fait le 09.10.2026** : texte officiel (`OFL.txt` du dépôt vercel/geist-font) dans `src/fonts/OFL-Geist.txt`, à côté de celui d'Archivo, cité par `LICENSE.md`                                                                       | —                                                                                                                                            |

Texte proposé pour la politique de confidentialité (français, à compléter dans les autres langues
par la même mécanique que le reste du fichier) : « Le Studio garde dans le stockage local de votre
navigateur vos créations enregistrées (« Mes créations ») et, le temps de la session, les textes que
vous saisissez ; ces textes ne quittent votre appareil qu'au moment où vous envoyez votre demande à
l'atelier. »

### 1.2 Parcours à dérouler (clair **et** sombre, 4 langues pour au moins deux d'entre eux)

Cochez chaque ligne ; notez l'URL et le navigateur si quelque chose cloche.

**Public, bureau (1440 px) puis mobile (375 px)**

- [ ] Accueil `/fr` : le titre est lisible au premier coup d'œil, le héros s'imprime sans à-coup, la
      palette et le motif changent l'objet ; au défilement, la bascule en plan puis les chapitres
      00 à 06. Pas de saut entre le poster et le canvas.
- [ ] Boutique `/fr/shop`, une fiche produit (Vase spirale) : galerie, vue 3D, ajout au panier,
      zone d'achat collante, attribution de Ian (nom, licence, lien) visible.
- [ ] Studio `/fr/studio`, puis chacun des 4 objets (`lavaux`, `cartouche`, `montagne`, `borne`) :
      régler, annuler/rétablir, « Surprenez-moi », badge Imprimable, copier le lien, garder,
      saisir un texte (accents compris), « Envoyer à l'atelier » (la demande part vers la base
      de la preview, aucun e-mail réel).
- [ ] Sur mesure `/fr/custom` : demande avec fichier, et demande reprise depuis le Studio.
- [ ] L'Atelier `/fr/a-propos`, `/fr/contact`, légal (3 pages), 404 (`/fr/n-importe-quoi`).
- [ ] Panier, tunnel de paiement jusqu'à la page de confirmation, avec **une carte de test Stripe**
      (`4242 4242 4242 4242`, date future, CVC quelconque) : le formulaire Stripe s'affiche, rien
      ne défile ni ne bouge autour (ni Lenis, ni transformation, ni canvas dans le tunnel).
- [ ] Compte : inscription, connexion, commandes, devis, favoris.
- [ ] `de`, `it`, `en` : parcourez l'accueil, la boutique, le Studio et le tunnel. En allemand, aucun
      mot ne dépasse de sa boîte, aucun « ß » (les cinq-six mots longs : « Filamentwechsel »,
      « Schichthöhe », « Versandkostenfrei »).

**Transversal**

- [ ] Thème sombre sur toutes les pages ci-dessus : aucun flash blanc, textes lisibles.
- [ ] Mouvement réduit : interrupteur du pied de page **et** préférence du système : tout reste
      utilisable, contenu à son état final, aucune animation de défilement.
- [ ] Clavier seul (Tab, flèches, Page bas) : tout est atteignable, le focus se voit, le canvas ne
      « traîne » pas derrière le texte.
- [ ] Une connexion lente ou un petit téléphone : le site reste fluide (le palier C0 remplace le canvas
      par des posters).
- [ ] Console du navigateur (F12) sur 3 pages : aucune erreur rouge, aucune violation CSP.
- [ ] `/fr/admin` (compte administrateur, clair et sombre) : liste, détail d'une commande, d'un devis
      et d'un produit lisibles, rien ne déborde sur mobile.

### 1.4 Achat direct du Studio : l'ordre exact (vos étapes)

Les objets du Studio s'achètent au panier ; la livraison est offerte partout en Suisse ; les
filaments sont les Bambu Lab PLA Matte. **Respectez cet ordre** : la migration d'abord
(le webhook de paiement lit `order_items` : sans la colonne, plus aucune commande n'est
enregistrée comme payée).

1. **Migration en production, AVANT la fusion** (additive, sans risque pour l'ancien code) :
   `ALTER TABLE "order_items" ADD COLUMN "studio" jsonb;` (identique à
   `drizzle-pg/0009_cuddly_viper.sql`). Vérification :
   `SELECT column_name FROM information_schema.columns WHERE table_name='order_items' AND column_name='studio';`.
   La branche Neon **preview** l'a déjà reçue (14.10.2026).
2. **Stock de filament et couleurs de la boutique, AVANT la fusion** (additifs eux aussi), dans
   cet ordre : `drizzle-pg/0010_filament_stock.sql` (7 tables `filament_*`), puis
   **`drizzle-pg/0011_shop_colors.sql`** (`product_filament_exclusions` et `order_item_filaments`,
   deux tables sans donnée ; elle référence `filament_refs`, donc APRÈS la 0010), puis
   `scripts/seed-filament-refs.sql` (19 références, aucune bobine). Vérifications :
   `SELECT count(*) FROM filament_refs;` doit donner 19 ;
   `SELECT to_regclass('public.product_filament_exclusions'), to_regclass('public.order_item_filaments');`
   doit rendre les deux noms (et `SELECT count(*) FROM product_filament_exclusions;` donner 0).
   Le code tolère l'absence de la 0011 (aucune exclusion, rien de réservé : le paiement ne
   dépend jamais d'elle), mais sans elle les cases décochées de la fiche produit ne s'enregistrent
   pas. La preview a reçu la 0010 et le seed le 15.10.2026,
   plus `scripts/seed-filament-stock-preview.sql` (stock de test, **jamais en production**) ;
   la 0011 et **`scripts/seed-preview-shop-pla.sql`** (articles de démo en PLA, poids,
   une exclusion de démonstration) sont à y jouer à la main.
   **2 bis. Atelier 3D (projets de couleurs des devis), AVANT la fusion** : `drizzle-pg/0012_quote_color_projects.sql` (une table, référence `quote_requests`).
   Vérification : `SELECT to_regclass('public.quote_color_projects');` rend le nom. Sans elle, une
   demande avec projet de couleurs passe quand même (le 3MF reste dans le R2, le résumé est perdu).
   La preview l'a reçue le 16.10.2026.
   **Production : matière.** `SELECT material, count(*) FROM products GROUP BY 1;` ; si autre chose
   que `PLA` apparaît, `UPDATE products SET material = 'PLA' WHERE material <> 'PLA';` (le formulaire
   admin impose désormais PLA à chaque enregistrement ; la boutique l'affiche telle quelle).
   **Articles de la boutique : le filament est contrôlé comme au Studio.** Tout article qui a un
   poids (« en stock » comme « à la demande ») réserve poids × quantité + 10 %, et une couleur sans bobine en stock est
   « épuisée » (grisée sur la fiche, bloquante au panier et au paiement). Renseignez le **poids** de
   chaque article (sans poids, la couleur n'est pas suivie et la vente passe), et saisissez le stock
   de bobines avant de vendre.
   **Sans bobine en stock, chaque couleur du Studio est « épuisée » et le Studio ne vend rien** :
   saisissez la commande Bambu reçue juste après le déploiement (`/admin/filaments` → réception,
   pesée), ou préparez avant la fusion une version de production du seed de stock.
3. **Déploiement** : fusion dans `main` (section 2), puis vérification du déploiement (3.1).
4. **Réglages de port à 0**, d'abord sur la preview puis en production : `shipping_cents` = `0` et
   `free_shipping_over_cents` = `0` dans la table `settings`. Hyperdrive met les SELECT en cache
   **60 s** : comptez une minute avant que le site le voie. Le code n'en dépend pas pour le Studio
   (une ligne du Studio ne porte jamais de port) ; sans cette étape, un panier **de la boutique seule**
   paie encore 8.90 CHF alors que les textes annoncent la livraison offerte.
5. **Vase spirale à 34.90 CHF** (admin → Produits, ou SQL).
6. **Resynchroniser le flux Stripe** (catalogue agentique) après la bascule du port : le flux ne
   porte plus de seuil de gratuité ; sans action, le cron le remet à jour (quotidien).

À relire avant la fusion : les textes légaux (CGV, confidentialité, livraison, version française
qui fait foi ; dates réglées sur le jour du dernier commit, à recaler sur la fusion), la nouvelle
section CGV « Objets du Studio » et l'engagement de **relecture des textes sous 2 jours ouvrés**.

Couleurs de la boutique, à regarder sur la preview une fois la 0011 et le seed PLA joués :

- [ ] Fiche d'un article (`/fr/products/lampe-voronoi`) : toutes les couleurs du « Sur mesure »
      sont proposées, la première est la blanche, le nom de la couleur choisie s'affiche ; sur
      « Support de casque », **Sakura Pink est absente** (exclusion de démonstration).
- [ ] Un article de la boutique (vase, lampe, support de casque…), couleur sans bobine ou trop
      peu de grammes : la pastille est **grisée et barrée**, annoncée « épuisée » (comme au Studio) ;
      choisie quand même, elle bloque « Ajouter au panier » et « Acheter ».
- [ ] Panier : une ligne dont la couleur manque de grammes (en cumulant avec un objet du Studio de la
      même couleur) affiche « Couleur épuisée : … » et **« Commander » est désactivé** ; un panier
      d'avant (couleur « Blanc », « Noir » ou « Bleu » enregistrée dans le navigateur) se relit et se paie.
- [ ] Paiement d'un article de la boutique : la commande est créée ; dans l'admin, la commande montre le
      bloc « Filament de la commande » avec la couleur de l'article (poids × quantité + 10 %), et
      `/admin/filaments` voit ces grammes réservés ; « Décompter du stock » les libère.
- [ ] Admin → Produits → un produit : la matière est un texte fixe « PLA », les couleurs sont des
      pastilles à cocher/décocher (enregistrer, rouvrir, la fiche publique suit) ; plus de « Palette
      boutique » dans le menu ; l'onglet Références de `/admin/filaments` n'a plus de « couleur de la
      boutique » (la case « Proposée en sur mesure et en boutique » la remplace).
- [ ] `/fr/shop` : plus de filtre par couleur (la puce de matière n'apparaît que s'il y en a plusieurs).

Parcours de test sur la preview (carte `4242 4242 4242 4242`), après avoir marqué « reçue » la
commande Bambu de test dans `/admin/filaments` (sinon toutes les couleurs du Studio sont épuisées) : un objet du Studio de chaque type
(la Cartouche à 1 et à 10 pièces), une commande mixte (boutique + Studio), puis dans l'admin :
résumé de la ligne, bobines à charger, « Télécharger le STL », « Textes relus ».

### 1.3 Contrôles techniques (fait par l'agent, à relire dans son compte rendu)

- [ ] CI de la branche : `quality` (lint, format, typecheck, migrations sur base jetable, tests, `bun audit`)
      et CodeQL verts ; « Workers Builds: swiss3design-preview » vert.
- [ ] `bunx opennextjs-cloudflare build` puis `bunx wrangler deploy --dry-run` : le **gzip** de la ligne
      `Total Upload` est celui que la règle d'or 10 d'`AGENTS.md` annonce (mesuré dans un dossier
      de 41 caractères ; WP-99 a mesuré **2 456 KiB** le 09.10.2026, cible ≈ 3 250 et plafond 3 185 tenus,
      voir `measures-wp99.md`). Cette valeur n'est pas cette checklist : relisez le dernier `measures-*.md`.
      Le hook `webpack()` de `next.config.ts` (règle d'or 10) doit rester en place : sans lui le Worker
      repasse à ≈ 3 336 KiB.
- [ ] `bun scripts/check-worker-bundle.ts` : **0** signature three / gsap / lenis dans le Worker.
- [ ] `bun run preview` (CSP de production avec nonce) : 0 violation CSP et 0 erreur d'hydratation sur
      `/fr`, `/fr/studio/lavaux`, `/fr/shop`.

---

## 2. La fusion dans `main`

> Rappel (`AGENTS.md`, règle d'or 9 et « Workflow & etiquette ») : `main` est protégé, une PR est
> **obligatoire**, jamais de `--admin`, jamais de `git merge` local poussé sur `main`.

1. Vérifier que `claude/redesign-2026` est à jour avec `main` :
   `git fetch origin && git rev-list --count HEAD..origin/main` doit répondre **0**.
   Sinon : fusionner `origin/main` dans la branche, ou `gh pr update-branch <n>` une fois la PR ouverte.
2. Ouvrir **une seule** PR, base `main`, tête `claude/redesign-2026` (la refonte est une fonctionnalité en
   phases : pas une PR par package, voir la section « Multi-phase features » d'`AGENTS.md`) :
   `gh pr create --base main --head claude/redesign-2026`. Le corps de la PR renvoie vers
   `docs/redesign-2026/DESIGN-BRIEF.md` et ce fichier.
3. Attendre les contrôles verts : `quality`, CodeQL et « Workers Builds: swiss3design-preview ».
4. Fusionner (`gh pr merge <n> --merge`, comme les autres PR du dépôt).
5. Vérifier que le commit de fusion contient bien le dernier paquet :
   `git log --oneline origin/main -- docs/redesign-2026/checklist-j3.md`.
6. **Ne jamais s'arrêter là** : la section suivante est obligatoire (règle d'or 9, la fusion ne prouve
   pas le déploiement ; Cloudflare s'est déjà trompé de Worker ou n'est pas parti).

---

## 2 bis. Bascule vers kreya.ch (la même séance que la fusion)

Ce que la fusion fait seule : `wrangler.jsonc` rattache **kreya.ch** et **www.kreya.ch** au Worker
`swiss3design` (domaines personnalisés : Cloudflare crée les enregistrements DNS), garde
swiss3design.ch, et `src/middleware.ts` redirige toute page lue sur l'ancien domaine (GET, HEAD) en
**301 vers la même adresse sur kreya.ch**. L'ancien domaine sert encore, sans redirection, les
webhooks Stripe, le cron, les Server Actions et MCP (un 301 sur un POST les casserait).

**Avant la fusion**

1. Zone Cloudflare kreya.ch : aucun enregistrement A, AAAA ou CNAME sur `kreya.ch` ni
   `www.kreya.ch` (le déploiement les crée ; un enregistrement existant le ferait échouer). Les
   enregistrements e-mail (MX, SPF, DKIM, DMARC) ne gênent pas.
2. Stripe (live), à faire par l'agent avec votre accord ou par vous au dashboard :
   nom public et libellé de relevé **KREYA**, nom de marque « Kreya » ; domaine de moyens de
   paiement **kreya.ch** ajouté (Apple Pay, Google Pay, Link).

**Juste après le déploiement (3.1)** 3. Webhook Stripe live : changer son URL vers `https://kreya.ch/api/stripe/webhook`. Une
modification d'URL **garde le même secret** : rien à changer côté Cloudflare. Idem pour le hook
Agentic Commerce s'il pointe vers l'ancien domaine. 4. Worker cron (`workers/cron`, déployé à part) : `cd workers/cron && bunx wrangler deploy` (l'URL
de maintenance pointe désormais vers kreya.ch). 5. Flux catalogue Stripe : resynchroniser (les liens produits passent sur kreya.ch). 6. Connexion Google : tester une connexion sur kreya.ch (origines et redirection déjà ajoutées par
vous le 09.10.2026). 7. Passkeys : elles sont liées au domaine. Les 2 passkeys existantes (un seul compte) ne marchent
plus sur kreya.ch : se connecter par e-mail, puis en recréer une dans le compte. 8. Sessions : chacun est déconnecté une fois (les cookies de swiss3design.ch ne valent pas sur
kreya.ch). 6 bis. **Google Auth Platform** (console Google Cloud du projet OAuth, à faire par vous) →
**Branding** :

- nom de l'application : **Kreya** ;
- logo : `public/brand/app/kreya-oauth-120.png` (120 × 120 px, aussi dans le dossier
  « Kreya - identité visuellepp ») ;
- e-mail d'assistance : `contact@kreya.ch` ;
- page d'accueil `https://kreya.ch`, confidentialité `https://kreya.ch/fr/legal/privacy`,
  conditions `https://kreya.ch/fr/legal/terms` ;
- domaines autorisés : ajouter **kreya.ch** (garder swiss3design.ch tant que l'ancien domaine
  sert encore des requêtes).

Dans **Clients**, les origines et l'URI de redirection `https://kreya.ch/api/auth/callback/google`
sont déjà là depuis le 09.10.2026 (à revérifier). Google peut demander une **vérification de la
marque** après un changement de nom ou de logo (quelques jours) : la page d'accueil doit alors
être en ligne sur kreya.ch, d'où cette étape après le déploiement. La connexion Google
continue de fonctionner pendant l'examen. 9. Google Search Console : outil « Changement d'adresse » de swiss3design.ch vers kreya.ch, puis
soumettre `https://kreya.ch/sitemap.xml`. 10. PostHog (projet 285063) : ajouter kreya.ch aux URL autorisées ; la mesure ne démarre que sur
kreya.ch (`ANALYTICS_HOSTNAME`). 11. Annonce : bandeau du site pendant 2 semaines et e-mail aux clients (admin → E-mails →
Annonces). 12. Garder swiss3design.ch (et son renouvellement) au moins 2 ans : liens, e-mails et favoris
anciens.

**Retour arrière de la bascule** : revenir au commit précédent suffit pour le code ; remettre l'URL
du webhook Stripe sur swiss3design.ch (même secret).

---

## 3. Juste après la fusion

### 3.1 Le déploiement a-t-il eu lieu ?

- [ ] Dashboard Cloudflare → Workers & Pages → **`swiss3design`** → Deployments : un déploiement tout neuf,
      `modified_on` changé, **et c'est bien le Worker de prod** (pas `swiss3design-preview`). Dans
      Claude : le connecteur Cloudflare (`workers_list`) donne le même `modified_on`.
- [ ] Journal du build : `Total Upload: … / gzip: …` (comparez au budget de la règle d'or 10 : environ
      2 456 KiB attendus ; un chiffre voisin de 3 336 KiB voudrait dire que le hook `webpack()` n'a pas
      tourné, par exemple un `next build` nu sous Turbopack au lieu de `opennextjs-cloudflare build`).
- [ ] Rien après 10 minutes ? Repli manuel depuis une machine avec les identifiants Cloudflare :
      `$env:CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE = "<chaîne de connexion de prod>"` puis,
      **dans la même commande**, `bun run deploy` (voir `docs/deploiement-cloudflare.md`).
- [ ] Surveiller les erreurs pendant les premières minutes : `bunx wrangler tail swiss3design`
      (ou le journal en direct du dashboard).

### 3.2 Fumée (cinq minutes, navigateur privé, hors admin)

| URL                                                                                                  | Attendu                                                             |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `https://swiss3design.ch/` → `/fr`                                                                   | redirige vers la langue du navigateur, héros affiché, pas de 5xx    |
| `/fr`, `/de`, `/it`, `/en`                                                                           | 200, un seul `h1`, texte lisible                                    |
| `/fr/shop`, `/fr/products/vase-spirale`                                                              | produit, prix en CHF, ajout au panier, vue 3D                       |
| `/fr/studio`, `/fr/studio/lavaux`, `/fr/studio/cartouche`, `/fr/studio/montagne`, `/fr/studio/borne` | objet réglable, prix ferme en direct, « Ajouter au panier »         |
| `/fr/custom`, `/fr/a-propos`, `/fr/contact`, `/fr/legal/terms`                                       | 200                                                                 |
| `/fr/n-importe-quoi`                                                                                 | 404 habillée, statut 404                                            |
| `/fr/cart`, `/fr/checkout` (avec un article au panier)                                               | le formulaire Stripe en mode **live** s'affiche (ne rien payer ici) |
| `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/manifest.webmanifest`                                  | 200                                                                 |
| `/mcp`, `/.well-known/ucp`, `/.well-known/acp.json` (surfaces agents)                                | 200 comme avant                                                     |
| En-têtes d'une page (`curl -sI https://swiss3design.ch/fr`)                                          | `content-security-policy` avec un `nonce-`, HSTS, `x-frame-options` |

Console du navigateur sur `/fr` et le Studio : 0 violation CSP (la règle d'or 4 : le nonce ne se voit
qu'en production).

### 3.3 Paiement

La prod tourne en **Stripe live** : testez de préférence en mode test sur la preview **avant** la
fusion (section 1.2). Après la fusion, un seul passage réel suffit :

- [ ] Commande du produit le moins cher avec **votre carte**, jusqu'à la page de confirmation ;
      l'e-mail de confirmation arrive ; la commande passe en « payée » dans `/fr/admin/orders`.
- [ ] **Remboursement** depuis le dashboard Stripe (Paiements → le PaymentIntent de la commande) : l'application
      n'a pas d'interface de remboursement. Puis passer la commande en annulée dans l'admin si besoin.
- [ ] Une demande de devis depuis le Studio (avec un STL) arrive dans `/fr/admin/quotes` avec le lien du
      fichier et la description complète.

### 3.4 Mesure d'audience (PostHog, projet 285063, région UE)

Piège connu : **le navigateur où vous êtes passé par `/admin` est exclu de la mesure** (`localStorage["s3d-internal"] = "1"`).
Testez dans une fenêtre privée où vous n'êtes jamais allé dans l'admin, et acceptez/ignorez le bandeau (« Refuser » coupe tout).

Événements attendus (noms et propriétés inchangés par la refonte) et les quatre actions du projet :

| Action PostHog   | Événement sur lequel elle repose                                                          | Où il part                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Achat            | `Order Completed`                                                                         | page de confirmation du paiement (`checkout/success/page.tsx`, dédoublonné par numéro) |
| Ajout au panier  | `Product Added` (`source` : `product_page`, `catalog`, `buy_now`, `studio` avec `object`) | `components/add-to-cart.tsx` (fiche, cartes, planches, favoris, « Acheter »)           |
| Demande de devis | `Quote Requested` (`source` : `form` ou `studio`, `object`)                               | `components/quote/quote-request-form.tsx` (page `/custom` et tiroir du Studio)         |
| Inscription      | `Signed Up` (`method`, `needs_verification`)                                              | `account/register/register-form.tsx`                                                   |

- [ ] Dans PostHog → Activité en direct : après vos parcours de fumée, voir `$pageview`, `Product Viewed`,
      `Product Added`, `Cart Viewed`, `Studio Viewed`, `Studio Configured`, `Studio Sent`, `Quote Requested`,
      `Hero Customized`, `Page Not Found` (nouveaux : `Hero Customized`, `Studio Viewed`, `Studio Configured`,
      `Studio Sent`, `Studio Link Copied`, `Studio Saved`).
- [ ] Vérifier que les **quatre actions** comptent bien ces événements (elles reposent sur des noms
      d'événements, pas sur des sélecteurs : le nouveau DOM ne les casse pas).
- [ ] Aucune propriété ni URL ne contient de texte saisi (un nom, une adresse) : ouvrir un `Studio Sent` et un
      `$pageview` de `/studio/montagne`.
- [ ] Web vitals : LCP, INP et CLS de `/fr` (budgets du brief §4.11 : LCP ≤ 2,0 s, INP ≤ 150 ms, CLS ≤ 0,05).
- [ ] Trois replays (accueil, Studio, boutique) : poids raisonnable, textes saisis masqués (champs et
      `.ph-mask`), compteurs décoratifs absents (`ph-no-capture`).

---

## 4. Retour arrière

> **Achat direct du Studio (14.10.2026).** La colonne `order_items.studio` est additive : **ne pas la
> supprimer** en cas de retour arrière (l'ancien code l'ignore, rien ne casse). Une commande du
> Studio déjà payée reste valide : elle porte son prix et ses textes ; l'ancien admin n'affiche que
> son nom (objet et dimensions), la configuration complète est dans `order_items.studio` (SQL). Les
> réglages de port à 0 se remettent à 890 / 6000 dans la table `settings` si l'on veut revenir au tarif.

**Quand** : paiement impossible, 5xx répétés, Studio qui plante au chargement, page blanche, perte de
commandes. Dans le doute sur le paiement ou une erreur générale, **revenir d'abord, comprendre ensuite**.

1. **Revenir** (instantané, sans reconstruction) : dashboard Cloudflare → `swiss3design` → **Deployments** →
   le déploiement précédent la fusion → **Rollback**. Ou, depuis une machine connectée :
   `bunx wrangler rollback` (en visant le Worker `swiss3design`, **jamais** `--env preview` par erreur).
2. **Base de données : rien à défaire.** Les quatre migrations de la refonte (`0009`, colonne
   `order_items.studio` ; `0010`, tables `filament_*` ; `0011`, tables `product_filament_exclusions` et
   `order_item_filaments` ; `0012`, table `quote_color_projects`) sont additives : l'ancien code les ignore, on les laisse en place. Les anciennes
   tables de la palette de la boutique (`materials`, `filament_colors`, `product_colors`) n'ont jamais été
   touchées : l'ancien code retrouve sa palette et ses couleurs de produits tels qu'ils étaient.
   Les commandes passées entre-temps gardent leur couleur (nom et hex figés dans `order_items`)
   et leurs lignes `order_item_filaments` restent inertes. Aucun changement de binding, de CSP ni de secret par rapport à `main`. N'exécutez ni `db:push:pg` ni `wrangler secret put`
   dans ce cas (règle d'or 7 : un secret partagé écrasé par erreur verrouille les comptes 2FA).
3. **Données du navigateur des visiteurs** : les clés `s3d-motion`, `s3d-creations-v1` (localStorage) et
   `s3d-studio-texts-v1`, `s3d-studio-upload-v1`, `s3d-quote-handoff-v1`, `s3d-webgl-lost` (sessionStorage)
   restent inertes avec l'ancien code. Les demandes de devis envoyées depuis le Studio sont des lignes
   ordinaires de `quote_requests` (le fichier STL est dans R2, la description est du texte) : elles restent
   exploitables dans l'admin.
4. **Rendre le retour durable** : le Rollback du dashboard dure jusqu'au prochain déploiement. Tant que la
   branche n'est pas corrigée, **ne fusionnez rien d'autre dans `main`** (le prochain déploiement
   remettrait la refonte), ou annulez-la proprement par une PR : `git revert -m 1 <commit de fusion>` sur une
   branche, PR vers `main`, mêmes contrôles verts, puis vérifier le déploiement comme en 3.1.
5. **Commandes en cours** : un client qui avait payé pendant la fenêtre est servi par le webhook Stripe
   (idempotent) ; vérifiez `/fr/admin/orders` et le tableau de bord Stripe (paiements sans commande ? voir
   `docs/audit-remediation-2026-09.md` et `docs/runbook.md`).
6. Écrire ce qui s'est passé (URL, heure, message d'erreur de `wrangler tail`) avant de relancer, pour que la
   correction parte de la cause.

---

## 5. Après J3 (hors de cette checklist)

- Renommage **Kreya** (paquet dédié : textes, métadonnées, JSON-LD, e-mails, logo, domaine `kreya.ch`).
- Éventuelles options du brief §11.2 n° 8 (police suisse premium, redessin du mark, rendus Blender,
  image « Illustration », impression de trois pièces pour calibrer l'estimation).
- Reprise éventuelle des écarts notés dans les `measures-*.md` (Safari et Firefox non essayés, iGPU non
  mesuré, replays PostHog à mesurer sur la prod).

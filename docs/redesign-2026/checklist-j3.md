# Refonte « Strates » · Checklist du propriétaire pour le jalon J3

> Document d'exécution rédigé par WP-99 (09.10.2026). Il dit **quoi regarder sur la
> preview avant de fusionner**, **quoi faire pour fusionner**, **quoi vérifier juste
> après** et **comment revenir en arrière** si quelque chose tourne mal.
> La fusion elle-même n'est lancée que sur votre accord explicite (brief §9.1, §11.2 n° 7).
> Les règles d'or d'`AGENTS.md` priment sur tout ce qui suit (rappelées là où elles comptent).

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

| Décision                                                                                        | Défaut appliqué aujourd'hui                                                                                               | À faire                                                                                                        |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Inventaire réel des bobines (§11.2 n° 2)                                                        | Teintes **indicatives**, mention « Teintes indicatives » dans le Studio                                                   | Fournir marque, nom, hex, matière : `src/lib/studio/filaments.ts`                                              |
| Coefficients de prix (§11.2 n° 3, `PRICING.validated`)                                          | `false` : aucun CHF affiché, seulement grammes, durée, changements                                                        | Fournir les coefficients pour activer la fourchette                                                            |
| Mention du **stockage local du Studio** dans la politique de confidentialité (§11.2 n° 4, nLPD) | **Non faite** : la section « Cookies et stockage local » ne parle que du panier, des favoris, du paiement et de la mesure | Valider un texte (proposition ci-dessous) ; il touche `legal/privacy/content.tsx`, hors périmètre des packages |
| Accroches de l'annexe C du brief (§11.2 n° 6)                                                   | Textes de l'annexe C                                                                                                      | Relire les 4 langues                                                                                           |
| Nom de marque : **« Kreya »** choisi le 08.10.2026                                              | Le site s'appelle encore Swiss3Design partout                                                                             | Acheter `kreya.ch` (Infomaniak, vous), puis la bascule est un paquet à part **après J3**                       |

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
- [ ] Studio `/fr/studio`, puis chacun des 4 objets (`lavaux`, `cartouche`, `relief`, `borne`) :
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

### 1.3 Contrôles techniques (fait par l'agent, à relire dans son compte rendu)

- [ ] CI de la branche : `quality` (lint, format, typecheck, migrations sur base jetable, tests, `bun audit`)
      et CodeQL verts ; « Workers Builds: swiss3design-preview » vert.
- [ ] `bunx opennextjs-cloudflare build` puis `bunx wrangler deploy --dry-run` : le **gzip** de la ligne
      `Total Upload` est celui que la règle d'or 10 d'`AGENTS.md` annonce (mesuré dans un dossier
      de 41 caractères ; la cible acceptée est ≈ 3 250 KiB). Cette valeur n'est pas cette checklist :
      relisez le dernier `measures-*.md`.
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

## 3. Juste après la fusion

### 3.1 Le déploiement a-t-il eu lieu ?

- [ ] Dashboard Cloudflare → Workers & Pages → **`swiss3design`** → Deployments : un déploiement tout neuf,
      `modified_on` changé, **et c'est bien le Worker de prod** (pas `swiss3design-preview`). Dans
      Claude : le connecteur Cloudflare (`workers_list`) donne le même `modified_on`.
- [ ] Journal du build : `Total Upload: … / gzip: …` (comparez au budget de la règle d'or 10).
- [ ] Rien après 10 minutes ? Repli manuel depuis une machine avec les identifiants Cloudflare :
      `$env:CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE = "<chaîne de connexion de prod>"` puis,
      **dans la même commande**, `bun run deploy` (voir `docs/deploiement-cloudflare.md`).
- [ ] Surveiller les erreurs pendant les premières minutes : `bunx wrangler tail swiss3design`
      (ou le journal en direct du dashboard).

### 3.2 Fumée (cinq minutes, navigateur privé, hors admin)

| URL                                                                                                | Attendu                                                             |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `https://swiss3design.ch/` → `/fr`                                                                 | redirige vers la langue du navigateur, héros affiché, pas de 5xx    |
| `/fr`, `/de`, `/it`, `/en`                                                                         | 200, un seul `h1`, texte lisible                                    |
| `/fr/shop`, `/fr/products/vase-spirale`                                                            | produit, prix en CHF, ajout au panier, vue 3D                       |
| `/fr/studio`, `/fr/studio/lavaux`, `/fr/studio/cartouche`, `/fr/studio/relief`, `/fr/studio/borne` | objet réglable, estimation en grammes et durée, aucun CHF           |
| `/fr/custom`, `/fr/a-propos`, `/fr/contact`, `/fr/legal/terms`                                     | 200                                                                 |
| `/fr/n-importe-quoi`                                                                               | 404 habillée, statut 404                                            |
| `/fr/cart`, `/fr/checkout` (avec un article au panier)                                             | le formulaire Stripe en mode **live** s'affiche (ne rien payer ici) |
| `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/manifest.webmanifest`                                | 200                                                                 |
| `/mcp`, `/.well-known/ucp`, `/.well-known/acp.json` (surfaces agents)                              | 200 comme avant                                                     |
| En-têtes d'une page (`curl -sI https://swiss3design.ch/fr`)                                        | `content-security-policy` avec un `nonce-`, HSTS, `x-frame-options` |

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

| Action PostHog   | Événement sur lequel elle repose                                  | Où il part                                                                             |
| ---------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Achat            | `Order Completed`                                                 | page de confirmation du paiement (`checkout/success/page.tsx`, dédoublonné par numéro) |
| Ajout au panier  | `Product Added` (`source` : `product_page`, `catalog`, `buy_now`) | `components/add-to-cart.tsx` (fiche, cartes, planches, favoris, « Acheter »)           |
| Demande de devis | `Quote Requested` (`source` : `form` ou `studio`, `object`)       | `components/quote/quote-request-form.tsx` (page `/custom` et tiroir du Studio)         |
| Inscription      | `Signed Up` (`method`, `needs_verification`)                      | `account/register/register-form.tsx`                                                   |

- [ ] Dans PostHog → Activité en direct : après vos parcours de fumée, voir `$pageview`, `Product Viewed`,
      `Product Added`, `Cart Viewed`, `Studio Viewed`, `Studio Configured`, `Studio Sent`, `Quote Requested`,
      `Hero Customized`, `Page Not Found` (nouveaux : `Hero Customized`, `Studio Viewed`, `Studio Configured`,
      `Studio Sent`, `Studio Link Copied`, `Studio Saved`).
- [ ] Vérifier que les **quatre actions** comptent bien ces événements (elles reposent sur des noms
      d'événements, pas sur des sélecteurs : le nouveau DOM ne les casse pas).
- [ ] Aucune propriété ni URL ne contient de texte saisi (un nom, une adresse) : ouvrir un `Studio Sent` et un
      `$pageview` de `/studio/relief`.
- [ ] Web vitals : LCP, INP et CLS de `/fr` (budgets du brief §4.11 : LCP ≤ 2,0 s, INP ≤ 150 ms, CLS ≤ 0,05).
- [ ] Trois replays (accueil, Studio, boutique) : poids raisonnable, textes saisis masqués (champs et
      `.ph-mask`), compteurs décoratifs absents (`ph-no-capture`).

---

## 4. Retour arrière

**Quand** : paiement impossible, 5xx répétés, Studio qui plante au chargement, page blanche, perte de
commandes. Dans le doute sur le paiement ou une erreur générale, **revenir d'abord, comprendre ensuite**.

1. **Revenir** (instantané, sans reconstruction) : dashboard Cloudflare → `swiss3design` → **Deployments** →
   le déploiement précédent la fusion → **Rollback**. Ou, depuis une machine connectée :
   `bunx wrangler rollback` (en visant le Worker `swiss3design`, **jamais** `--env preview` par erreur).
2. **Base de données : rien à faire.** La refonte ne contient aucune migration Postgres ni aucun changement
   de binding, de CSP ou de secret par rapport à `main`. N'exécutez ni `db:push:pg` ni `wrangler secret put`
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

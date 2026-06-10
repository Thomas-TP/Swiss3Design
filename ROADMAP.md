# Swiss3Design — Feuille de route (version finalisée)

> Boutique en ligne d'impressions 3D · Basée à Gland (VD) · **Livraison Suisse uniquement**
> Imprimante : Bambu Lab P1S + AMS 2 Pro (multicolor jusqu'à 4 couleurs)
> Hébergement & données : **100 % Cloudflare**

## ✅ Décisions verrouillées

| Sujet | Choix |
|---|---|
| Framework | **Next.js 15 + React 19** via **OpenNext for Cloudflare** |
| Animations / rendu | **Motion** (ex-Framer Motion) + **View Transitions** |
| Comptes clients | **Oui** (Better Auth sur D1) |
| Paiement | **Stripe Payment Element personnalisé** (intégré, pas la page hébergée) — cartes + **TWINT** + Apple/Google Pay |
| Langues | **FR / DE / IT / EN** avec **détection auto du navigateur** (repli FR) via `next-intl` |
| Frais de port | **Tarif unique Suisse** (La Poste, prix identique partout) + **gratuit dès un montant seuil** |
| Modèle de vente | **Hybride** : stock pré-imprimé (best-sellers) + impression à la demande (délai affiché) |
| Devis sur mesure | **Oui** : upload fichier client (STL/3MF) + workflow de devis manuel |
| Domaine | **swiss3design.ch** (libre, à réserver) |
| Implémentation | **L'IA code l'intégralité** (niveau d'accompagnement maximal) |

---

## 1. Vision & principes

- **Style** : moderne, sobre, « business », pas traditionnel. Espace blanc, typographie soignée, micro-animations discrètes (Motion + View Transitions pour un effet « app native »).
- **UX** : mobile-first, **barre de navigation en bas** (style app), parcours d'achat ultra-court.
- **Différenciateur** : mise en avant du **multicolor 4 couleurs**.
- **Périmètre** : B2C, livraison **Suisse uniquement** (blocage étranger au checkout).

---

## 2. Stack technique (tout Cloudflare)

| Besoin | Outil |
|---|---|
| Framework | Next.js 15 (App Router) + React 19, déployé via **OpenNext** sur **Cloudflare Workers** |
| Animations | **Motion** + View Transitions API |
| Base de données | **Cloudflare D1** (SQLite) + **Drizzle ORM** |
| Fichiers (images, STL/3MF) | **Cloudflare R2** (pas d'egress) |
| Optimisation images | **Cloudflare Images** |
| Sessions / cache / panier | **Workers KV** |
| Tâches async (emails, devis) | **Cloudflare Queues** |
| Auth clients | **Better Auth** (sur D1/Drizzle) |
| Auth admin | **Cloudflare Access** (Zero Trust, gratuit ≤ 50 users) protégeant `/admin` |
| Paiement | **Stripe Payment Element** (PaymentIntents + webhook) en CHF |
| i18n | **next-intl** (routing `/fr` `/de` `/it` `/en`, détection auto) |
| Emails | **Resend** |
| UI | **Tailwind CSS** + **shadcn/ui** (Radix) + **Lucide** |
| Analytics | **Cloudflare Web Analytics** (sans cookie) |

---

## 3. Modèle de données (D1 / Drizzle)

- **products** : id, nom, slug, description, prix (centimes CHF), multicolor (bool), matière, dimensions, poids, **type_vente** (`stock` | `a_la_demande`), **delai_production** (jours, si à la demande), actif, mis_en_avant.
- **product_images** : id, product_id, url R2, ordre, alt.
- **product_variants** : id, product_id, nom (couleur/taille), prix, **stock** (NULL si à la demande), sku.
- **product_translations** : product_id, locale (fr/de/it/en), nom, description. *(textes traduits)*
- **categories** + **category_translations** + **product_categories**.
- **customers** : id, email, nom, créé_le (géré par Better Auth).
- **customer_addresses** : id, customer_id, rue, NPA (4 chiffres), ville, canton.
- **orders** : id, numéro, customer_id, email, statut (`en_attente` → `payée` → `en_production` → `expédiée` → `livrée`), total, frais_port, adresse (snapshot JSON), stripe_payment_intent, créée_le.
- **order_items** : id, order_id, product/variant_id, nom (snapshot), prix (snapshot), quantité.
- **quote_requests** (devis sur mesure) : id, customer_id/email, fichier_url (R2), description, dimensions souhaitées, matière, couleurs, statut (`reçu` → `chiffré` → `accepté` → `payé` → `produit`), prix_proposé, message_admin, créé_le.
- **inventory_log** : mouvements de stock (traçabilité).
- **discount_codes** (optionnel) : code, type, valeur, expiration.

> Principe : prix/nom **figés (snapshot)** dans `order_items` au moment de l'achat. Les traductions vivent dans des tables `_translations` séparées.

---

## 4. Architecture

### Pages publiques (préfixées par langue)
- **Accueil** : hero sobre, focus multicolor, produits vedettes, réassurance (fait à Gland, livraison Suisse).
- **Catalogue** : grille filtrable (catégorie, couleur, matière, prix, stock/à la demande), tri.
- **Fiche produit** : galerie, variantes, badge stock **ou** délai de production, prix, ajout panier, specs.
- **Devis sur mesure** : upload STL/3MF (→ R2), formulaire (matière, couleurs, dimensions), suivi du devis dans l'espace client.
- **Panier** → **Checkout custom** (Stripe Payment Element, adresse Suisse uniquement) → **Confirmation**.
- **Espace client** : commandes, suivi, adresses, **mes devis**.
- **Pages légales** : Mentions, CGV, Confidentialité (nLPD), Livraison & retours.

### Navigation
- **Barre fixe en bas (mobile)** : Accueil · Catalogue · Recherche · Panier · Compte (badge panier). Icônes Lucide.
- **Header discret (desktop)** : logo, menu, sélecteur de langue, panier.

### Panel admin (`/admin`, Cloudflare Access)
- **Dashboard** : CA, commandes du jour, **alertes stock bas**, **devis en attente**.
- **Produits** : CRUD, upload images R2, variantes, traductions FR/DE/IT/EN, type stock/à la demande.
- **Stock** : édition rapide, seuils d'alerte.
- **Commandes** : liste, détail, changement de statut, marquer expédiée.
- **Devis** : voir fichiers clients, chiffrer, envoyer le prix, transformer en commande payable.
- **Réglages** : seuil livraison gratuite, infos boutique.

---

## 5. Paiement (Stripe personnalisé)

- **Stripe Payment Element** intégré dans ta page de checkout (les données carte restent dans l'iframe Stripe → conformité PCI SAQ A préservée).
- Moyens : **Cartes**, **TWINT**, **Apple/Google Pay**, en **CHF**.
- Flux : créer un **PaymentIntent** côté Worker → confirmer côté client → **webhook** valide le paiement, crée/confirme la commande, décrémente le stock, déclenche l'email.
- **Devis** : une fois chiffré, le client paie via un PaymentIntent dédié au montant validé.
- **Restriction Suisse** : pays limité à `CH` + contrôle serveur sur l'adresse.
- **TVA** : non requise tant que CA < 100 000 CHF/an (champ prévu, activable plus tard ; taux 8.1 %).

---

## 6. Livraison

- **La Poste Suisse**, **tarif unique national** (ex. 7–9 CHF) + **gratuit dès un seuil** (ex. 60 CHF) — réglable dans l'admin.
- Adresses CH : NPA 4 chiffres + canton. **Pays = CH uniquement.**
- Évolution : API Poste Suisse pour étiquettes.

---

## 7. Conformité (Suisse)

- **nLPD** : politique de confidentialité ; analytics sans cookie (Cloudflare).
- **CGV** + **Mentions légales** (vendeur, adresse Gland).
- Pas de droit de rétractation légal obligatoire en CH, mais politique de retour claire.
- Inscription registre du commerce si CA ≥ 100 000 CHF.

---

## 8. Phases de réalisation

0. **Cadrage** : domaine `swiss3design.ch`, comptes Cloudflare (Workers Paid 5 $/mois) + Stripe, gamme initiale + photos.
1. **Design** : charte sobre (accent + neutres), maquettes (accueil, catalogue, fiche, devis, checkout, nav bas, espace client, admin).
2. **Setup** : Next.js + Tailwind + shadcn/ui + Motion ; D1, R2, KV, Queues ; schéma Drizzle + migrations ; i18n next-intl.
3. **Auth & comptes clients** : Better Auth, espace client.
4. **Catalogue multilingue** : produits + variantes + traductions + images R2 ; gestion stock vs à la demande.
5. **Panier & Checkout custom** : Stripe Payment Element, webhook, restriction Suisse, frais de port, confirmation.
6. **Module devis sur mesure** : upload R2, workflow devis ↔ admin, paiement du devis.
7. **Panel admin** (Cloudflare Access) : produits, stock, commandes, devis, réglages.
8. **Emails** : Resend (confirmation client, notif admin, réponses devis).
9. **Légal + SEO + perf** : pages légales, metadata multilingue, sitemap, Open Graph, données structurées, Lighthouse, accessibilité.
10. **Lancement** : DNS Cloudflare, tests paiement test→live, analytics, monitoring.
11. **Post-lancement** : codes promo, avis produits, API Poste, etc.

---

## 9. Budget mensuel (démarrage)

| Poste | Coût |
|---|---|
| Cloudflare Workers Paid (D1 + R2 + KV + Queues inclus) | ~5 $/mois |
| Domaine `.ch` | ~10–12 CHF/an |
| Cloudflare Access (≤ 50 users) | Gratuit |
| Stripe | 0 fixe + ~2.9 % + 0.30 CHF/tx (TWINT ~1.3 %) |
| Resend | Gratuit jusqu'à ~3 000 emails/mois |
| Cloudflare Web Analytics | Gratuit |

➡️ **~5–6 CHF/mois** + commissions à la vente.

---

## 10. Prochaine étape

Tout est arbitré. Étapes suivantes au choix :
1. **Maquettes / direction visuelle** (palette, typo, accent) — recommandé avant de coder.
2. **Schéma de base de données détaillé** (DDL Drizzle complet).
3. **Initialisation du projet** (setup technique Phase 2).

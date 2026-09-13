# Remédiation de l'audit — septembre 2026

État de travail du 13 septembre 2026. Les changements restent en validation sur preview ; ce document ne constitue pas une confirmation de déploiement en production.

## Incident 1102 : cause mesurée

Le 13 septembre à 18:18:20 UTC, la preview a répondu HTTP 503 sur /fr. Le tail Cloudflare indique outcome=exceededCpu, cpuMs=10, wallMs=13 et « Worker exceeded CPU time limit. ». Ray ID : a3a92764b846bb10. Une fiche produit française a également échoué après une courte succession de navigations. L'incident est indépendant de la langue.

Des requêtes précédentes étaient tolérées à plusieurs centaines de millisecondes CPU. Cloudflare documente cette tolérance ponctuelle, puis l'arrêt lorsque la limite est dépassée régulièrement. Réduire le prefetch aide le volume, mais ne suffit pas à faire tenir le rendu Next.js dynamique dans 10 ms.

Le changement d'offre Workers nécessite l'accord du propriétaire : [Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/) commence à 5 USD/mois, hors dépassements. Prévoir ensuite une limite CPU explicite, puis rejouer le scénario. Ne pas annoncer cet incident résolu avant cette vérification. [Limites CPU](https://developers.cloudflare.com/workers/platform/limits/#cpu-time).

## Correctifs implémentés

- Paiements : verrouillage transactionnel, contrôle montant/devise/identifiant, protection des statuts avancés contre les événements rejoués ou livrés dans le désordre.
- Stock : réservation atomique, agrégation des couleurs partageant le même stock, restitution idempotente après expiration confirmée. Les erreurs réseau Stripe conservent la réservation jusqu'au rapprochement.
- Reprise du checkout : clé de tentative persistée dans la session du navigateur ; identité Stripe conservée pour les clients connectés. Les totaux retournés par le serveur alimentent le récapitulatif.
- Devis : version d'offre et prix payé enregistrés, invalidation des sessions connues avant modification, conservation des fichiers de révision et de fabrication payée en cours.
- E-mails métier : file persistante avec clés de déduplication et reprises. Désinscription/achat contrôlés avant une relance. Les messages dépassant la fenêtre de déduplication nécessitent une revue manuelle.
- Remboursements : montant reçu de Stripe conservé sans régression sur un événement ancien ; affichage administration et accès au paiement Stripe. Aucun remboursement réel déclenché par les tests.
- Panier : validation du stockage local, identité produit/variante/couleur, synchronisation entre onglets, restauration par jeton aléatoire expirant, données commerciales relues côté serveur et adresse de relance vérifiée.
- Sécurité : limites de requêtes atomiques Postgres, vérification obligatoire des e-mails, export personnel réservé à une connexion récente, uploads bornés et signatures de conteneurs contrôlées, propriété des fichiers vérifiée, logs CSP minimisés et paramètres d'URL masqués.
- Infrastructure : pool Postgres partagé dans une seule requête puis fermé ; préchargements des liens désactivés par défaut ; redirection HTTPS applicative ; cache long des assets versionnés.
- UX/accessibilité : recherche insensible à la casse, paramètres conservés au changement de langue, sélecteurs natifs, autocomplétion avec annulation des requêtes, lien d'évitement, sémantique des cartes, responsive, respect des animations réduites, chargement 3D au clic.
- SEO : images publiques autorisées dans robots.txt, retrait du suivi de commande du sitemap, suppression de dates artificielles, échappement des données structurées.
- Dépendances : versions compatibles rafraîchies, dépendance Better Auth Cloudflare inutilisée supprimée, esbuild corrigé imposé à l'outillage. Le build OpenNext et la génération Drizzle ont été exécutés avec cette résolution.

## Validation et limites

40 tests passent sur la base Postgres preview isolée, dont concurrence sur le dernier article, rejouement du paiement, retour après expédition, annulation de réservation et reprise d'e-mails. Les envois sont simulés. Un test Stripe API reste non exécuté : la clé locale est une valeur factice. La création d'une session et un paiement Stripe complet ne sont donc pas encore certifiés.

Vase/vase/VASE trouvent le même produit sur preview. Le changement de langue au clavier conserve q=Vase. Axe ne signale aucune violation sur les pages principales contrôlées ni sur le checkout aux largeurs 320/390/768/1440. Cette vérification ne certifie pas toute l'accessibilité, les états connectés ou le Payment Element. Deux débordements accueil/panier identifiés ensuite ont été corrigés et attendent leur revalidation finale.

Les migrations 0001 à 0004 sont additives et appliquées sur preview. Elles ne sont pas encore appliquées en production. La CI Quality est préparée pour créer un Postgres jetable, appliquer les migrations et exécuter les contrôles sans secret de production.

Points encore ouverts : correction/validation 1102, paiement Stripe complet et abonnement aux nouveaux événements webhook, cas de réponse Stripe perdue lors d'un changement de devis, réauthentification forte de toutes les actions administratives sensibles, historique complet des transitions, protection de main, restauration Neon/R2 réellement exercée, alertes opérationnelles et validation finale après déploiement.

La modification supplémentaire proposée pour le cas de réponse Stripe perdue sur les devis a été refusée par la revue automatique avant exécution : périmètre trop large sans tests ciblés suffisants. Elle n'est pas incluse dans le schéma actuel.

## Exploitation après livraison

1. Contrôler les données existantes avant les nouvelles contraintes (prix/stock positifs, total cohérent, identifiant de paiement unique).
2. Appliquer uniquement les migrations nouvelles sur la base de production identifiée, dans une transaction et avec un délai de verrouillage borné. Ne jamais rejouer 0000 sur une base existante.
3. Déployer puis vérifier l'identifiant de version, HTTP/HTTPS, recherche, parcours panier, erreurs Worker et événements Stripe.
4. Surveiller les commandes pending expirées, les erreurs de rapprochement et email_outbox. Ne pas libérer du stock lorsqu'un paiement reste incertain.
5. En cas de retour arrière, arrêter les nouveaux checkouts et rapprocher les réservations avant de revenir à un ancien code qui ne connaît pas la réservation. Un rollback aveugle du Worker vers l'ancien checkout pourrait décrémenter deux fois le stock. Les migrations additives restent en place.

Les propositions de design de l'audit initial restent un backlog produit distinct : photos authentiques, preuves multicolores, contenu traduit du catalogue, délais détaillés, conseils d'entretien et comparaison des options. Ne pas inventer d'avis, de photos de réalisations ou de promesses commerciales pour remplir ces sections.

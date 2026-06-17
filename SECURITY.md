# Politique de sécurité

## Signaler une vulnérabilité

Merci de signaler toute faille de sécurité **en privé**, sans la divulguer
publiquement tant qu'un correctif n'est pas en ligne.

- 📧 Contact : **contact@swiss3design.ch**
- 🔎 Coordonnées machine : [`/.well-known/security.txt`](public/.well-known/security.txt)

Indiquez si possible : description, étapes de reproduction, impact estimé, et
l'URL/route concernée. Une première réponse est visée sous **72 h**.

> Projet privé sans programme de bug bounty : pas de récompense financière, mais
> tout signalement sérieux et responsable est le bienvenu et crédité si souhaité.

## Périmètre

En lien : `swiss3design.ch` (et `www`), l'application Cloudflare Workers et ses
API. Hors périmètre : déni de service, ingénierie sociale, et les services tiers
(Stripe, Cloudflare, Google, Resend, Infomaniak) qui relèvent de leurs propres
programmes.

## Mesures en place

- **Paiements** : Stripe Payment Element — les données carte restent dans l'iframe
  Stripe (conformité **PCI SAQ A**). Stripe est en mode **LIVE** en production.
- **En-têtes** : HSTS (preload), `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`.
- **CSP** : politique stricte avec **nonce par requête** en production (plus
  d'`unsafe-inline`) ; violations rapportées à `/api/csp-report`.
- **Rate-limiting** par IP + route (Workers KV) sur les endpoints sensibles.
- **Auth** : Better Auth (sessions signées, 2FA TOTP, OAuth Google) ; rôle admin
  jamais modifiable côté client.
- **Fichiers** : R2 privé, servi via routes contrôlées — jamais d'URL publique.
- **Confidentialité (nLPD)** : droit à l'effacement (suppression de compte +
  purge des fichiers), analytics sans cookie.
- **Secrets** : jamais committés (Cloudflare secrets en prod, `.dev.vars` en local).

Un audit externe (PentestTools) a déjà été traité ; voir le journal Git.

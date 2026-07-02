# Déploiement — Cloudflare Workers Builds (connexion Git native)

Ce document explique comment le site est déployé et comment (re)connecter GitHub
à Cloudflare si besoin.

> **⚠️ Fiabilité de l'auto-build (juillet 2026)** : l'intégration Git automatique
> de Cloudflare s'est révélée **peu fiable en pratique** — un incident a vu un
> build automatique déployer la config preview sur le Worker de **prod**
> (site cassé, voir historique), et plus tard une série de push sur `main` n'a
> déclenché **aucun build côté prod** (aucun check GitHub, timestamp du Worker
> inchangé pendant 15+ minutes) sans raison identifiée. **Ne considère jamais un
> `git push`/merge sur `main` comme suffisant à lui seul.** Après tout push
> important sur `main` : vérifier que le Worker prod a bien un nouveau
> `modified_on` (`workers_list` côté MCP Cloudflare, ou dashboard → Deployments),
> et si rien ne bouge après quelques minutes, **déployer manuellement** (section
> [Déployer manuellement](#déployer-manuellement--filet-de-sécurité-fiable) plus
> bas) plutôt que d'attendre indéfiniment.

## Pourquoi ce mode de déploiement

- **Avant** : GitHub Actions buildait puis déployait avec `wrangler deploy`,
  authentifié par le secret GitHub `CLOUDFLARE_API_TOKEN`.
- **Problème** : ce token a expiré → le push du 16/06/2026 a échoué sur
  `Unable to authenticate request [code: 10001]` et le site n'a pas été redéployé.
- **Maintenant** : Cloudflare est connecté directement au dépôt GitHub
  (**Workers Builds**). À chaque push sur `main`, Cloudflare **build + applique
  les migrations D1 + déploie**, avec ses propres identifiants — plus aucun token
  à gérer ni à renouveler.
- Le **statut de déploiement** est porté par Cloudflare : Workers Builds publie sur
  chaque commit un **check GitHub** qui n'est vert que si le build **et** le deploy
  ont réellement réussi. L'ancien workflow GitHub Actions a été **supprimé** pour ne
  pas afficher un second « vert » trompeur.

## Pré-requis (déjà en place)

- Dépôt GitHub : `Thomas-TP/Swiss3Design`.
- Worker existant : `swiss3design` (domaine `swiss3design.ch`, bindings D1/R2/KV).
- **Secrets runtime déjà configurés sur le Worker** (Stripe secret, BETTER_AUTH_SECRET,
  OAuth Google, e-mail…). La connexion Git **ne les touche pas** : ils restent.
- `.env.production` est **commité** (clés publiques seulement, dont
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`). Elles sont inlinées automatiquement au
  build → **aucune variable de build à reconfigurer** côté Cloudflare.

## Étapes — connecter GitHub à Cloudflare

1. Aller sur https://dash.cloudflare.com → **Workers & Pages** (ou **Compute**).
2. Ouvrir le Worker existant **swiss3design**.
3. Onglet **Settings** → section **Builds** → cliquer **Connect** (connexion à Git).
   *(Le nom du Worker doit correspondre au `name` de `wrangler.jsonc` — ici les deux
   valent `swiss3design`, donc OK.)*
4. **Autoriser** l'app GitHub « Cloudflare Workers & Pages » (popup GitHub).
   Choisir *Only select repositories* → **Swiss3Design** → valider.
5. De retour sur Cloudflare :
   - **Repository** : `Thomas-TP/Swiss3Design`
   - **Production branch** : `main`
6. **Build configuration** :
   - **Build command** :
     ```
     npx opennextjs-cloudflare build
     ```
   - **Deploy command** :
     ```
     npx wrangler d1 migrations apply swiss3design-db --remote && npx wrangler deploy
     ```
   - **Root directory** : `/` (par défaut)
   - **Build variables** : rien à ajouter (clés publiques déjà dans `.env.production`).
7. **Save and Deploy** → Cloudflare lance un premier build depuis `main`.

> **Pourquoi les migrations sont dans le deploy command** : elles s'appliquent
> (de façon idempotente) **avant** `wrangler deploy`. Si une migration échoue, le
> `&&` bloque le déploiement → l'ancien code reste en ligne sur l'ancien schéma
> (état cohérent, jamais de demi-déploiement). L'environnement Workers Builds
> fournit l'authentification Cloudflare, donc **aucun token n'est requis**.
>
> **Filet de sécurité** : si un jour l'étape migrations échoue pour une raison
> d'authentification, retire-la du deploy command et applique les migrations en
> local avant le push : `npm run db:migrate:remote`.

## Vérifier que ça marche

- Worker **swiss3design → Deployments / Builds** : le build passe de *Building* à
  *Success*. Les logs montrent `opennextjs-cloudflare build`, l'application des
  migrations, puis le deploy.
- Ouvrir https://swiss3design.ch pour confirmer.

## Au quotidien

- `git push` sur `main` (ou merge d'une PR) **devrait** déclencher Cloudflare
  (build + migre + déploie automatiquement en prod) — **mais vérifie toujours**
  (voir l'avertissement de fiabilité en haut de ce document). Ne pas supposer
  que « push = en ligne ».
- Le statut s'affiche en théorie sur le commit via le **check Cloudflare Workers
  Builds** (vert = build + deploy réussis ; rouge = échec, l'ancienne version
  reste en ligne). En pratique ce check peut ne jamais apparaître même quand
  tout va bien côté build — ne pas s'y fier comme unique signal, croiser avec
  le `modified_on` du Worker.
- Pour merger plusieurs branches empilées (feature stack) : voir
  [Merger une pile de PR empilées](#merger-une-pile-de-pr-empilées-piège-a-eviter)
  — un piège a fait échouer un merge silencieusement en juillet 2026.

## Environnement de preview (isolé de la prod)

Worker séparé **`swiss3design-preview`**, accessible en permanence à
**https://swiss3design-preview.thomastp.workers.dev** — toujours la dernière
branche déployée. Totalement isolé de la prod :

| | Production (`swiss3design`) | Preview (`swiss3design-preview`) |
| --- | --- | --- |
| D1 | `swiss3design-db` (données clients réelles) | `swiss3design-preview-db` (vide, migrée) |
| R2 | `swiss3design-files` | `swiss3design-preview-files` (vide) |
| KV | namespace prod | namespace preview dédié |
| Stripe | clé **LIVE** | aucune clé définie (checkout désactivé en preview) |
| E-mails | Resend actif | `RESEND_API_KEY` non définie → e-mails no-op |
| SEO | indexable | `X-Robots-Tag: noindex, nofollow, noarchive` sur tout |
| Secrets | secrets prod | `BETTER_AUTH_SECRET` dédié, généré à part |
| Routes | `swiss3design.ch` + `www` | aucune (uniquement `*.workers.dev`) |

Config dans [`wrangler.jsonc`](../wrangler.jsonc) → bloc `env.preview`. **Important** :
`routes` et `workers_dev` sont des clés *héritables* — le bloc `env.preview` les
réécrit explicitement (`routes: []`, `workers_dev: true`) pour ne jamais hériter
des routes du domaine custom par accident.

### Déployer une branche vers la preview

**Manuellement** (n'importe quand, fiable, méthode utilisée tout au long du
développement du compte — voir aussi la section [Déployer manuellement](#déployer-manuellement--filet-de-sécurité-fiable)) :
```
npx opennextjs-cloudflare build
npx wrangler deploy --env preview
```

**Automatiquement à chaque push de branche** — ⚠️ **deux connexions Git
séparées sont obligatoires**, une par Worker. Un incident (juin 2026) a montré
qu'une connexion Git **unique** sur le Worker `swiss3design` avec juste un
« Non-production branch deploy command » différent **ne suffit pas** : Cloudflare
a fini par déployer sur le mauvais Worker malgré la commande `--env preview`
configurée. Configuration correcte, qui isole structurellement les deux Workers
(chacun a sa propre connexion Git, ses propres bindings, aucun chevauchement
possible) :

1. **Worker `swiss3design` (prod)** → Settings → Builds :
   - Production branch : `main`
   - Builds for non-production branches : **désactivé**
   - Deploy command : `npx wrangler d1 migrations apply swiss3design-db --remote && npx wrangler deploy`
2. **Worker `swiss3design-preview`** → Settings → Builds → **Connect** le
   *même* dépôt ici, séparément :
   - Production branch : `main` (garde preview synchro par défaut)
   - Builds for non-production branches : **activé**
   - Deploy command (déclenché sur push `main`) : `npx wrangler deploy --env preview`
   - Version command (déclenché sur push toute autre branche) : `npx wrangler deploy --env preview`
   - **Les deux commandes doivent explicitement porter `--env preview`** — un
     `wrangler deploy` nu résout sur l'environnement top-level (= la prod) dès
     que `wrangler.jsonc` définit plusieurs environnements, quel que soit le
     Worker dont le pipeline l'exécute.
   - Build command : `npx opennextjs-cloudflare build` (jamais `npm run build`
     nu — ne produit pas `.open-next/`, voir règle d'or n°3 dans `AGENTS.md`).

Avec cette config, chaque push sur une branche autre que `main` redéploie
automatiquement `swiss3design-preview` — toujours la même URL, dernier push
gagnant (pas une URL par branche : volontairement simple, un seul endroit à
ouvrir pour voir l'état du travail en cours). Vérifié en conditions réelles :
un push sur une branche jetable ne fait bouger **que** `swiss3design-preview`,
jamais `swiss3design`.

### Si un jour la preview a besoin de Stripe ou Google OAuth
Définir les secrets/vars sur l'environnement preview précisément (jamais ceux
de prod) : `npx wrangler secret put STRIPE_SECRET_KEY --env preview` avec une
clé **test** Stripe, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` avec un client
OAuth de test autorisant `https://swiss3design-preview.thomastp.workers.dev`.

## Déployer manuellement (filet de sécurité fiable)

Vu le manque de fiabilité documenté de l'auto-build (voir avertissement en
haut), c'est la méthode **utilisée en pratique** chaque fois qu'un doute existe
sur l'état de la prod. Depuis une branche à jour avec `main` :

```
git checkout main && git pull
npx opennextjs-cloudflare build
npx wrangler d1 migrations apply swiss3design-db --remote   # jamais oublier avant deploy si le schema a changé
npx wrangler deploy                                          # sans --env = top-level = prod
```

Pour la preview, remplacer les deux dernières lignes par :
```
npx wrangler d1 migrations apply swiss3design-preview-db --env preview --remote
npx wrangler deploy --env preview
```

**Vérifier après coup** (obligatoire, ne pas supposer que « la commande a
tourné sans erreur » = « c'est en ligne ») :
- `curl -I https://swiss3design.ch/fr` → 200.
- Comparer le `Current Version ID` affiché par `wrangler deploy` avec celui du
  dashboard (Worker → Deployments) si un doute persiste.

## Merger une pile de PR empilées (piège à éviter)

Le développement du compte (2026) a utilisé des branches **empilées** : chaque
phase branchée sur la précédente (`phase1` sur `phase0`, `phase2` sur `phase1`,
etc.), chaque PR ayant pour **base** la branche précédente plutôt que `main`.

**Piège vécu** : merger les PR une par une avec `gh pr merge N --merge` fusionne
chaque PR dans sa branche **base** (la phase précédente) — **pas dans `main`**,
sauf pour la toute première et la toute dernière PR de la chaîne si leur base
est explicitement `main`. Résultat : 9 PR sur 11 se sont marquées « Merged »
sur GitHub sans que leur contenu n'atteigne jamais `main` — aucune erreur, aucun
avertissement, juste un `main` qui reste à l'état d'avant sans que rien ne le
signale. Repéré uniquement en remarquant que le Worker prod ne bougeait pas
après le merge, puis confirmé via `git log --oneline main -- <fichier connu>`.

**Comment merger une pile correctement** — deux options :
1. **Le plus sûr** : une fois toutes les PR de la pile approuvées, merger
   directement en local la branche la **plus haute de la pile** (celle qui
   contient tout, cumulée) dans `main` : `git checkout main && git merge
   <branche-la-plus-haute> --no-ff`, puis push. Ferme les PR intermédiaires
   manuellement sur GitHub une fois `main` à jour (elles n'ont plus de diff).
2. Ou re-cibler chaque PR sur `main` avant de merger (`gh pr edit N --base
   main`) — fonctionne mais casse la lecture en pile sur GitHub (chaque PR
   affichera alors *tout* le diff cumulé, pas juste sa propre phase).

**Avant de merger quoi que ce soit** : vérifier avec `git log --oneline main --
<fichier introduit par la dernière phase>` que le contenu attendu est bien
présent sur `main` après le merge — ne jamais se fier uniquement au badge
« Merged » de GitHub.

## Secrets — règles après l'incident 2FA (juillet 2026)

**Incident (2 épisodes, même semaine)** : après un déploiement, la 2FA (TOTP)
de l'admin s'est mise à échouer avec une erreur serveur (500) au lieu d'un
simple « code invalide ». Un premier correctif à chaud (suppression de la
ligne `two_factor` de l'admin en base + reset du mot de passe) a redonné
l'accès mais n'a pas réglé la cause réelle : la 2FA est restée impossible à
réactiver, avec un message « mot de passe incorrect » alors que le mot de
passe était bon.

**Cause confirmée** (lue dans les logs Cloudflare réels, pas supposée) : le
plugin `twoFactor` de Better Auth embarque un verrouillage de compte après
échecs répétés (NIST SP 800-63B §5.2.2), **actif par défaut**
(`accountLockout.enabled ?? true`). Il exige deux colonnes sur la table
`two_factor` — `failed_verification_count` et `locked_until` — dès qu'une
requête touche ce modèle (enable **autant que** verify/disable), pas
seulement quand le verrouillage se déclenche vraiment. Ces colonnes
n'avaient jamais été ajoutées à `src/db/schema.ts` : Better Auth loggait
`The field "failedVerificationCount" does not exist in the "twoFactor"
Drizzle schema` et renvoyait un 500 brut sur **toute** requête
`/two-factor/*` — enable, verify-totp, disable, generate-backup-codes.
Corrigé par la migration `drizzle/0019_ambitious_bedlam.sql` (deux `ALTER
TABLE ... ADD COLUMN`, additif, sans perte de données).

**La piste initialement suivie était fausse** : le premier diagnostic
soupçonnait un `BETTER_AUTH_SECRET` changé entre l'activation de la 2FA et
la vérification (le chiffrement du secret TOTP échouerait alors au
déchiffrement). Plausible sur le papier, mais jamais confirmé par un
vrai message d'erreur — et le vrai message d'erreur, une fois lu, pointait
ailleurs. **Leçon : sur un site en prod, ne pas itérer sur une théorie non
confirmée par les logs réels — aller chercher la vraie erreur avant de
corriger.** Voir aussi la note sur `wrangler tail`/logs prod plus bas.

**Prévention (schéma) — à faire après toute mise à jour de `better-auth` ou
d'un de ses plugins** (`package.json` → version de `better-auth` a bougé) :
comparer les fichiers `schema.mjs` sous
`node_modules/better-auth/dist/plugins/*/**/schema.mjs` (et
`node_modules/@better-auth/*/dist/**/schema.mjs` pour les plugins hors
paquet principal, ex. `passkey`) avec les tables correspondantes dans
`src/db/schema.ts` — chaque champ déclaré côté plugin doit avoir une colonne
en face. Un `npm run typecheck` ou `npm run build` **ne détecte pas** ce
genre de dérive : la validation de schéma de Better Auth est faite au
runtime, pas à la compilation. (Le message d'erreur suggère aussi `npx
auth@latest generate` — non testé par nous, à vérifier avant de s'y fier.)

**Règles secrets, toujours valables** (hygiène générale, même si ce n'était
pas la cause cette fois) :
- **Ne jamais faire tourner `wrangler secret put BETTER_AUTH_SECRET`** (ou tout
  secret partagé par plusieurs comptes réels) **sur un environnement qui a déjà
  des utilisateurs actifs**, sauf rotation planifiée et assumée (voir plus bas).
- Toute commande `wrangler secret put` doit **explicitement** porter `--env
  preview` quand elle vise la preview — jamais de commande « nue » en espérant
  qu'elle vise le bon environnement par défaut.
- Avant toute commande touchant un secret : relire la commande à voix haute
  (ou la faire relire) en vérifiant le nom du Worker cible, comme pour un
  `rm -rf`.
- **Si une rotation de `BETTER_AUTH_SECRET` est un jour nécessaire** (fuite,
  audit…) : c'est une opération **destructive pour les données déjà chiffrées**
  (2FA, codes de secours, cookies « remember me » actifs). Prévenir tous les
  comptes ayant la 2FA active, prévoir qu'ils devront la redésactiver/réactiver
  après coup, ne jamais le faire silencieusement.
- **Récupération si ça arrive quand même** : désactiver la 2FA du compte
  concerné directement en base (`DELETE FROM two_factor WHERE user_id=...` +
  `UPDATE user SET two_factor_enabled=0 WHERE id=...`) pour redonner l'accès
  par mot de passe seul, puis réactiver une 2FA neuve depuis le compte.

**Obtenir la vraie erreur serveur sans risque** : `wrangler tail` sur le
Worker de prod est bloqué par défaut (il peut streamer des tokens/secrets en
clair). Plus simple et à risque nul : dashboard Cloudflare → Workers & Pages
→ `swiss3design` → onglet **Logs** → *Begin log stream*, reproduire l'action
une fois, lire l'erreur affichée. C'est ce qui a permis de trouver la vraie
cause ci-dessus en quelques secondes, après plusieurs allers-retours à
deviner depuis le code seul.

## Réessayer / revenir en arrière

- **Retry** : depuis GitHub, ouvrir le Check Run échoué → *Details* → **Rerun**
  (ou dashboard Cloudflare → Builds → *Retry*).
- **Rollback** : dashboard → swiss3design → **Deployments** → choisir un
  déploiement précédent → **Rollback**.

## Nettoyage (optionnel)

- GitHub → repo → *Settings → Secrets and variables → Actions* : le secret
  `CLOUDFLARE_API_TOKEN` n'est plus utilisé, tu peux le **supprimer**.
- Le workflow `.github/workflows/deploy.yml` a été supprimé : le check de
  déploiement vient désormais de Cloudflare. Plus aucun workflow GitHub Actions.

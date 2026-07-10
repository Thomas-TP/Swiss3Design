# Contribuer à Swiss3Design

Projet **privé** (solo, l'essentiel du code est écrit par l'IA). Ce guide pose les
conventions humaines. **Les agents IA doivent lire [`AGENTS.md`](AGENTS.md)** —
brief opérationnel, règles d'or et liens vers la doc détaillée.

## Mise en route

```bash
bun install
cp .dev.vars.example .dev.vars   # remplir avec des valeurs de TEST (+ DATABASE_URL Postgres)
bun run db:push:pg               # applique schema.pg.ts à cette base Postgres
bun run dev                      # http://localhost:3000
```

Détails environnement & dépannage : [`docs/runbook.md`](docs/runbook.md).

## Conventions

- **Langue** : commentaires et textes affichés en **français** ; identifiants de
  code en **anglais**. Docs agent (`AGENTS.md`, `docs/architecture.md`,
  `docs/conventions.md`, `docs/playbook.md`, `docs/runbook.md`) en **anglais** ;
  docs humaines (`README`, `ROADMAP`, ce fichier) en français.
- **Argent** : toujours en centimes CHF (`*_cents`), jamais de flottants.
- **i18n** : tout texte visible existe dans les **4 langues** (`messages/*.json`).
- **Base de données** : modifier `src/db/schema.pg.ts` (Postgres, source de
  vérité — `schema.ts` n'est qu'un re-export), puis `bun run db:generate:pg` +
  `bun run db:push:pg` ; **ne jamais éditer** une migration déjà appliquée
  dans `drizzle-pg/`.
- **Secrets** : jamais committés (voir [`SECURITY.md`](SECURITY.md)).
- **Patterns** : pas de `redirect()` en Server Action ; `middleware.ts` reste
  Edge ; finalisation de paiement idempotente — cf. [`docs/conventions.md`](docs/conventions.md).

## Avant de pousser

1. `bun run lint` (Biome — doit passer).
2. Tester en local (`bun run dev`).
3. Si le changement touche la CSP / des scripts inline / le runtime :
   `bun run preview` (reproduit la prod).
4. Messages de commit en français, à l'impératif (ex. « Ajoute le suivi invité »).

## Déploiement

`git push` sur `main` (ou double-clic sur `scripts/push.bat`) **déclenche la mise
en production** via Cloudflare Workers Builds. `main` est la branche de déploiement :
toute pousse part en ligne. Voir [`docs/deploiement-cloudflare.md`](docs/deploiement-cloudflare.md).
Les branches/PR génèrent des **builds de preview** avec une URL de test.

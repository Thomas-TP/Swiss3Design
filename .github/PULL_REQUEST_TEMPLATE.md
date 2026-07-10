<!-- Cloudflare Workers Builds postera l'URL du build de preview sur cette PR. -->

## Résumé

<!-- Quoi et pourquoi, en une ou deux phrases. -->

## Type

- [ ] Fonctionnalité
- [ ] Correction de bug
- [ ] Refactor / technique
- [ ] Docs

## Checklist

- [ ] `bun run lint` passe (Biome)
- [ ] Testé en local (`bun run dev`)
- [ ] `bun run preview` si le changement touche la CSP / scripts inline / runtime
- [ ] Migration générée (`bun run db:generate:pg` + `db:push:pg`) si `src/db/schema.pg.ts` a changé
- [ ] Textes visibles traduits dans les 4 langues (`messages/*.json`)
- [ ] Aucun secret committé

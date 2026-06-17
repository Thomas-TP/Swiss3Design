<!-- Cloudflare Workers Builds postera l'URL du build de preview sur cette PR. -->

## Résumé

<!-- Quoi et pourquoi, en une ou deux phrases. -->

## Type

- [ ] Fonctionnalité
- [ ] Correction de bug
- [ ] Refactor / technique
- [ ] Docs

## Checklist

- [ ] `npm run lint` passe
- [ ] Testé en local (`npm run dev`)
- [ ] `npm run preview` si le changement touche la CSP / scripts inline / runtime
- [ ] Migration générée (`npm run db:generate`) si `src/db/schema.ts` a changé
- [ ] Textes visibles traduits dans les 4 langues (`messages/*.json`)
- [ ] Aucun secret committé

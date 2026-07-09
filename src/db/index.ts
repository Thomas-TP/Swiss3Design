// Client DB canonique de l'app — Postgres (Hyperdrive), voir index.pg.ts.
// L'ancien client D1 vit désormais dans index.d1.ts (getD1Db), conservé
// uniquement pour la Phase 5 (migration des données réelles) — voir
// C:\Users\leole\.claude\plans\foamy-swimming-cook.md.
export { getPgDb as getDb, schema } from "./index.pg";

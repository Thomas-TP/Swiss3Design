// Client DB canonique de l'app — Postgres (Hyperdrive), voir index.pg.ts.
// L'ancien client D1 vit désormais dans index.d1.ts (getD1Db), conservé
// comme filet de secours inactif (voir AGENTS.md).
export { getPgDb as getDb, schema } from "./index.pg";

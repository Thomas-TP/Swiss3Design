import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema.d1";

// D1 conservé pour la Phase 5 (migration des données réelles vers
// Postgres) — plus utilisé par l'app elle-même, voir schema.ts/index.ts
// (désormais Postgres) et C:\Users\leole\.claude\plans\foamy-swimming-cook.md.
export async function getD1Db() {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}

export { schema };

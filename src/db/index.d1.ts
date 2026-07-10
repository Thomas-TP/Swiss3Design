import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema.d1";

// D1 conservé comme filet de secours inactif (voir AGENTS.md) — plus
// utilisé par l'app elle-même, voir schema.ts/index.ts (désormais Postgres).
export async function getD1Db() {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}

export { schema };

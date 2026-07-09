import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema.pg";

// Client Postgres request-scoped (jamais de pool/singleton au niveau
// module) : une connexion partagée entre requêtes échoue sur Workers
// (isolate détruit entre requêtes, cf. doc Cloudflare Hyperdrive + Drizzle).
// Hyperdrive gère lui-même le pooling régional côté Cloudflare — le driver
// ici ouvre une connexion "logique" par requête, réutilisée par Hyperdrive
// en coulisses. postgres.js (pas node-postgres/pg) : better-auth-cloudflare
// exige ce driver précis pour son option `postgres` (typé sur
// drizzle-orm/postgres-js), les deux étant de toute façon supportés par
// Hyperdrive — autant rester cohérent avec un seul driver dans toute l'app.
export async function getPgDb() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.HYPERDRIVE) {
    // Non lié dans cet environnement (ex. "preview", pas encore câblé —
    // voir wrangler.jsonc). Erreur explicite plutôt qu'un crash opaque plus
    // loin dans une requête Postgres.
    throw new Error(
      "Binding HYPERDRIVE absent de cet environnement Cloudflare",
    );
  }
  const sql = postgres(env.HYPERDRIVE.connectionString, { max: 5 });
  return drizzle(sql, { schema });
}

export { schema };

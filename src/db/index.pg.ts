import { after } from "next/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema.pg";

// Pool Postgres request-scoped, jamais de pool/singleton au niveau module
// (une connexion partagée entre requêtes échoue sur Workers — isolate
// détruit entre requêtes, cf. doc Cloudflare Hyperdrive + Drizzle).
// Hyperdrive gère lui-même le pooling régional côté Cloudflare — le driver
// ici ouvre des connexions "logiques" réutilisées par Hyperdrive en
// coulisses. node-postgres (pas postgres.js) : driver recommandé par la doc
// Hyperdrive — meilleure compatibilité avec le cache de prepared statements
// (moins d'aller-retours vers Neon), voir developers.cloudflare.com/hyperdrive.
// `Pool` et pas `Client` : les Server Components de cette app parallélisent
// leurs requêtes indépendantes via `Promise.all` (ex. page produit) — un
// `Client` unique ne supporte qu'une requête à la fois (deprecation warning
// "already executing a query", constaté en test réel, deviendra une erreur
// dure en pg@9). `max: 5` reprend la taille déjà utilisée côté postgres.js ;
// Cloudflare recommande explicitement un petit pool local par Worker.
const requestDatabases = new WeakMap<
  object,
  ReturnType<typeof drizzle<typeof schema>>
>();

export async function getPgDb() {
  const { env, ctx, cf } = await getCloudflareContext({ async: true });
  const requestKey = cf ? ctx : undefined;
  const existing = requestKey && requestDatabases.get(requestKey);
  if (existing) return existing;
  if (!env.HYPERDRIVE) {
    // Non lié dans cet environnement (ex. "preview", pas encore câblé —
    // voir wrangler.jsonc). Erreur explicite plutôt qu'un crash opaque plus
    // loin dans une requête Postgres.
    throw new Error(
      "Binding HYPERDRIVE absent de cet environnement Cloudflare",
    );
  }
  const pool = new Pool({
    connectionString: env.HYPERDRIVE.connectionString,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 5000,
  });
  // node-postgres émet un événement "error" quand Neon/Hyperdrive coupe une
  // connexion inactive côté serveur (constaté en test réel : erreurs Postgres
  // 57P01 "terminating connection due to administrator command"). Sans
  // handler, EventEmitter transforme ça en uncaughtException qui plante le
  // process — cf. le README node-postgres lui-même là-dessus.
  pool.on("error", (err) => {
    console.error("[db] Erreur de connexion Postgres (pool) :", err);
  });
  const db = drizzle(pool, { schema });
  if (requestKey) requestDatabases.set(requestKey, db);
  after(async () => {
    await pool.end();
    if (requestKey) requestDatabases.delete(requestKey);
  });
  return db;
}

export { schema };

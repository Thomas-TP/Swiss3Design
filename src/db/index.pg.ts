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
  const pool = new Pool({
    connectionString: env.HYPERDRIVE.connectionString,
    max: 5,
  });
  // node-postgres émet un événement "error" quand Neon/Hyperdrive coupe une
  // connexion inactive côté serveur (constaté en test réel : erreurs Postgres
  // 57P01 "terminating connection due to administrator command"). Sans
  // handler, EventEmitter transforme ça en uncaughtException qui plante le
  // process — cf. le README node-postgres lui-même là-dessus.
  pool.on("error", (err) => {
    console.error("[db] Erreur de connexion Postgres (pool) :", err);
  });
  return drizzle(pool, { schema });
}

export { schema };

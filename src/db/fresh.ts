import { sql } from "drizzle-orm";

// Hyperdrive met en cache les SELECT (60 s par défaut, sans invalidation à
// l'écriture) — voir developers.cloudflare.com/hyperdrive/concepts/query-caching.
// Une requête qui contient une fonction PostgreSQL STABLE ou VOLATILE n'est
// jamais mise en cache : ajouter `uncached` aux conditions d'une lecture qui
// doit refléter une écriture récente (révocation, revendication d'agent,
// liste affichée juste après une modification). Toujours vrai, coût nul.
// Le dev local (connexion directe à Neon) ne met rien en cache : ce défaut ne
// se voit qu'en preview/prod.
export const uncached = sql`now() IS NOT NULL`;

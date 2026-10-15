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

// Lectures fraîches (règle d'or 6c) pour le code qui ne choisit pas son SQL :
// Better Auth (utilisateurs, sessions, jetons de vérification). Hyperdrive met
// les SELECT en cache 60 s sans jamais les invalider ; constaté sur la preview
// le 15.10.2026 : l'inscription lit « aucun compte pour cet e-mail », et le clic
// sur le lien de vérification dans la minute relisait ce résultat en cache
// (USER_NOT_FOUND, compte jamais confirmé). Chaque SELECT de ce pool est précédé
// d'une CTE inutilisée qui appelle now() : Hyperdrive ne met jamais en cache une
// requête qui contient une fonction STABLE (doc « Query caching »), et Postgres
// n'évalue pas une CTE qui n'est pas référencée. Même principe que `uncached`.
export function freshQueryText(text: string): string {
  return /^\s*select\b/i.test(text)
    ? `WITH __fresh AS (SELECT now()) ${text}`
    : text;
}

export function freshQueryArgs(args: unknown[]): unknown[] {
  const [first, ...rest] = args;
  if (typeof first === "string") return [freshQueryText(first), ...rest];
  if (
    first &&
    typeof first === "object" &&
    !("submit" in first) &&
    typeof (first as { text?: unknown }).text === "string"
  ) {
    const config = first as { text: string };
    return [{ ...config, text: freshQueryText(config.text) }, ...rest];
  }
  return args;
}

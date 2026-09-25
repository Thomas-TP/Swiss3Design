import { headers } from "next/headers";

/**
 * Bloc de données structurées JSON-LD (composant serveur).
 *
 * Lit lui-même le nonce CSP posé par le middleware (prod uniquement, golden
 * rule #4) : chaque page peut ainsi poser ses schémas sans se soucier de la
 * CSP. `<` est échappé pour qu'aucune chaîne (nom de produit, avis…) ne puisse
 * refermer la balise <script>.
 */
export async function JsonLd({ data }: { data: object }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

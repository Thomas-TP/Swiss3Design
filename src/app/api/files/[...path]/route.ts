import { getCloudflareContext } from "@opennextjs/cloudflare";

// Sert les fichiers publics du bucket R2 (images produits)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const key = path.join("/");

  // Seul le préfixe public est servi ; les fichiers clients (devis) restent privés
  if (!key.startsWith("products/")) {
    return new Response("Not found", { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const object = await env.R2.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const contentType =
    object.httpMetadata?.contentType ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    ETag: object.httpEtag,
  };
  // Les SVG historiques peuvent embarquer du script : on bloque toute
  // exécution si le fichier est ouvert directement dans le navigateur.
  if (contentType.includes("svg")) {
    headers["Content-Security-Policy"] = "sandbox";
  }

  return new Response(object.body as unknown as BodyInit, { headers });
}

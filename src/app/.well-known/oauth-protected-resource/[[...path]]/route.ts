import { getCloudflareContext } from "@opennextjs/cloudflare";
import { jsonResponse, preflight } from "@/lib/agent/config";
import { oauthIssuer, protectedResourceMetadata } from "@/lib/agent/oauth";

// Métadonnées de ressource protégée (RFC 9728), une par identifiant :
//   /.well-known/oauth-protected-resource             → https://swiss3design.ch
//   /.well-known/oauth-protected-resource/mcp/account → serveur MCP compte
//   /.well-known/oauth-protected-resource/fr (de, it, en) → racines de langue
// Le champ `resource` reprend toujours exactement l'identifiant demandé.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const issuer = oauthIssuer(env.BETTER_AUTH_URL);
  const resource = path.length > 0 ? `${issuer}/${path.join("/")}` : issuer;
  const metadata = protectedResourceMetadata(issuer, resource);
  if (!metadata)
    return jsonResponse(
      {
        error: "not_found",
        error_description: "No protected resource with this identifier.",
      },
      { status: 404 },
    );
  return jsonResponse(metadata);
}

export const OPTIONS = preflight;

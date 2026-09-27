import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PUBLIC_CORS } from "@/lib/agent/config";
import { authMdDocument } from "@/lib/agent/auth-md";
import { oauthIssuer } from "@/lib/agent/oauth";

// /auth.md : enregistrement et autorisation des agents (profil auth.md),
// référencé par agent_auth.skill et resource_documentation.
export const dynamic = "force-dynamic";

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  return new Response(authMdDocument(oauthIssuer(env.BETTER_AUTH_URL)), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
      "X-Content-Type-Options": "nosniff",
      ...PUBLIC_CORS,
    },
  });
}

import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { PUBLIC_CORS, preflight } from "@/lib/agent/config";
import { getAuth } from "@/lib/auth";

// Métadonnées du serveur d'autorisation (RFC 8414) : l'émetteur est l'origine
// du site, ses points de terminaison vivent sous /api/auth (better-auth).
// Inclut le bloc agent_auth du profil auth.md (src/lib/agent/agent-auth.ts).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getAuth();
  return oauthProviderAuthServerMetadata(auth, { headers: PUBLIC_CORS })(
    request,
  );
}

export const OPTIONS = preflight;

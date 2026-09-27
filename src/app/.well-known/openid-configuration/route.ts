import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { PUBLIC_CORS, preflight } from "@/lib/agent/config";
import { getAuth } from "@/lib/auth";

// Découverte OpenID Connect (le serveur OAuth des agents est aussi un
// fournisseur OIDC : portée openid, jetons d'identité RS256, userinfo).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getAuth();
  return oauthProviderOpenIdConfigMetadata(auth, { headers: PUBLIC_CORS })(
    request,
  );
}

export const OPTIONS = preflight;

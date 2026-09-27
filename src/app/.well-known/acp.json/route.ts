import { getCloudflareContext } from "@opennextjs/cloudflare";
import { jsonResponse, preflight } from "@/lib/agent/config";
import { acpDiscovery } from "@/lib/commerce/acp-protocol";

// Découverte ACP (/.well-known/acp.json) : version, API de checkout et
// services proposés. Publiée seulement quand le paiement par jeton est
// configuré (profil Stripe) — jamais de promesse que l'API ne tiendrait pas.
export const dynamic = "force-dynamic";

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.STRIPE_PROFILE_ID)
    return jsonResponse({ error: "not_found" }, { status: 404 });
  return jsonResponse(acpDiscovery(`${env.BETTER_AUTH_URL}/api/acp`), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}

export const OPTIONS = preflight;

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { jsonResponse, preflight } from "@/lib/agent/config";
import { ucpProfile } from "@/lib/commerce/ucp-protocol";
import { loadBotKey } from "@/lib/web-bot-auth";

// Profil marchand UCP (/.well-known/ucp) : service dev.ucp.shopping (REST),
// checkout + livraison, handler de paiement par Shared Payment Token, clés
// publiques. Publié seulement quand le paiement par jeton est configuré.
export const dynamic = "force-dynamic";

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.STRIPE_PROFILE_ID)
    return jsonResponse({ error: "not_found" }, { status: 404 });
  const key = await loadBotKey(env.WEB_BOT_AUTH_PRIVATE_KEY).catch(() => null);
  return jsonResponse(
    ucpProfile({
      origin: env.BETTER_AUTH_URL,
      networkId: env.STRIPE_PROFILE_ID,
      live: /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY),
      keys: key
        ? [{ ...key.publicJwk, kid: key.keyid, alg: "EdDSA", use: "sig" }]
        : [],
    }),
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}

export const OPTIONS = preflight;

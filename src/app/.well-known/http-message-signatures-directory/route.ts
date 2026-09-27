import { getCloudflareContext } from "@opennextjs/cloudflare";
import { directoryResponseHeaders, loadBotKey } from "@/lib/web-bot-auth";

// Répertoire de clés Web Bot Auth (JWKS) : clé publique du robot du site
// (notifications IndexNow). Réponse signée à chaque requête, donc jamais mise
// en cache : sa signature n'est valable que quelques minutes.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const key = await loadBotKey(env.WEB_BOT_AUTH_PRIVATE_KEY);
  if (!key)
    return Response.json(
      { error: "not_found", error_description: "No bot signing key." },
      { status: 404 },
    );
  return new Response(
    JSON.stringify({ keys: [{ ...key.publicJwk, kid: key.keyid }] }),
    {
      headers: {
        "Content-Type": "application/http-message-signatures-directory+json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
        ...(await directoryResponseHeaders(key, new URL(request.url).host)),
      },
    },
  );
}

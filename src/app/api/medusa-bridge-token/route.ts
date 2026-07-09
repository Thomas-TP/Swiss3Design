import { getServerSession } from "@/lib/session";
import { createMedusaBridgeToken, corsHeadersFor } from "@/lib/medusa-bridge";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Mint un jeton pont court-lived pour le storefront SolidStart : la session
// Better Auth (cookie ou "Authorization: Bearer <token>" via le plugin
// bearer()) prouve qui est l'utilisateur ; ce jeton est ensuite echange par
// Medusa contre son propre token client (auth Module Provider
// better-auth-bridge, apps/medusa).
export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeadersFor(origin);

  const session = await getServerSession();
  if (!session?.user || !session.user.emailVerified) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }

  const { env } = await getCloudflareContext({ async: true });
  const secret = env.BETTER_AUTH_BRIDGE_SECRET;
  if (!secret) {
    return Response.json(
      { error: "server_misconfigured" },
      { status: 500, headers },
    );
  }

  const token = await createMedusaBridgeToken(
    {
      id: session.user.id,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
    },
    secret,
  );
  return Response.json({ token }, { headers });
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeadersFor(request.headers.get("origin")),
  });
}

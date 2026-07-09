import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { corsHeadersFor } from "@/lib/medusa-bridge";

// Route cross-origine pour les préférences de notification (onglet
// Notifications, storefront-next) : concept génuinement D1-only, aucun
// équivalent Medusa (confirmé par recherche - contrairement aux devis,
// migrés dès la Phase 3). Même schéma d'authentification que
// /api/medusa-bridge-token (getServerSession() accepte cookie ou
// Authorization: Bearer via le plugin bearer()) - pas le secret partagé de
// newsletter-bridge.ts, qui est serveur-à-serveur (admin Medusa → app
// racine), pas adapté à un client lisant/écrivant ses propres préférences.
const schema = z.object({
  newsletter: z.boolean(),
  productNews: z.boolean(),
});

export async function GET(request: Request) {
  const headers = corsHeadersFor(request.headers.get("origin"));

  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }

  const db = await getDb();
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, session.user.id))
    .limit(1);

  return Response.json(
    {
      newsletter: prefs?.newsletter ?? false,
      productNews: prefs?.productNews ?? false,
    },
    { headers },
  );
}

export async function POST(request: Request) {
  const headers = corsHeadersFor(request.headers.get("origin"));

  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid" }, { status: 400, headers });
  }

  const db = await getDb();
  await db
    .insert(notificationPreferences)
    .values({ userId: session.user.id, ...parsed.data })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: { ...parsed.data, updatedAt: new Date() },
    });

  return Response.json({ success: true }, { headers });
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeadersFor(request.headers.get("origin")),
  });
}

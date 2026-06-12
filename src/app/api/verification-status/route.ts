import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Interrogé par la page d'inscription pour détecter qu'un e-mail a été
// confirmé depuis un autre appareil et connecter automatiquement celui-ci.
// Ne révèle rien d'autre qu'un booléen « vérifié » (faux si inconnu).

const bodySchema = z.object({ email: z.email() });

export async function POST(request: Request) {
  // La page d'inscription sonde toutes les 3 s : la limite laisse ~10 min de
  // polling légitime tout en freinant l'énumération d'adresses à grande échelle.
  const allowed = await rateLimit(request, "verification-status", {
    limit: 300,
    windowS: 600,
  });
  if (!allowed) return tooManyRequests();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const db = await getDb();
  const [found] = await db
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.email, parsed.data.email.trim().toLowerCase()))
    .limit(1);

  return Response.json({ verified: found?.emailVerified === true });
}

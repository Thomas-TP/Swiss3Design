import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";

// Interrogé par la page d'inscription pour détecter qu'un e-mail a été
// confirmé depuis un autre appareil et connecter automatiquement celui-ci.
// Ne révèle rien d'autre qu'un booléen « vérifié » (faux si inconnu).

const bodySchema = z.object({ email: z.email() });

export async function POST(request: Request) {
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

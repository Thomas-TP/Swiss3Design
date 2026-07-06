import { z } from "zod";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { verification } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { checkoutCodeEmail } from "@/lib/email-templates";
import { createEmailProof } from "@/lib/email-proof";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { corsHeadersFor } from "@/lib/medusa-bridge";

// Vérification d'e-mail pour les commandes sans compte : un code à 6 chiffres
// est envoyé puis échangé contre une preuve signée, exigée par /api/checkout.

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send"),
    email: z.email(),
    locale: z.enum(["fr", "de", "it", "en"]).catch("fr"),
  }),
  z.object({
    action: z.literal("verify"),
    email: z.email(),
    code: z.string().regex(/^\d{6}$/),
  }),
]);

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

const identifierFor = (email: string) => `checkout-otp:${email}`;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  const headers = corsHeadersFor(request.headers.get("origin"));

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Le cooldown par e-mail ne protège pas contre l'envoi massif vers des
  // adresses différentes : limite par IP en plus.
  const allowed = await rateLimit(request, "verify-email", {
    limit: parsed.data.action === "send" ? 8 : 30,
    windowS: 3600,
  });
  if (!allowed) return tooManyRequests(headers);

  const db = await getDb();
  const email = parsed.data.email.trim().toLowerCase();
  const identifier = identifierFor(email);

  const [existing] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1);

  if (parsed.data.action === "send") {
    const sentAt = existing?.createdAt?.getTime() ?? 0;
    if (Date.now() - sentAt < RESEND_COOLDOWN_MS) {
      return Response.json({ error: "too_many_requests" }, { status: 429, headers });
    }

    const code = String(
      (crypto.getRandomValues(new Uint32Array(1))[0] % 900000) + 100000,
    );

    await db.delete(verification).where(eq(verification.identifier, identifier));
    await db.insert(verification).values({
      id: crypto.randomUUID(),
      identifier,
      value: JSON.stringify({ hash: await sha256Hex(`${email}:${code}`), attempts: 0 }),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const sent = await sendEmail(checkoutCodeEmail(email, code, parsed.data.locale));
    // Sans RESEND_API_KEY (dev local), l'envoi est loggé au lieu d'être
    // expédié : on ne traite l'échec comme une erreur qu'en configuration réelle.
    const { env } = await getCloudflareContext({ async: true });
    if (!sent && env.RESEND_API_KEY) {
      return Response.json({ error: "email_failed" }, { status: 502, headers });
    }
    return Response.json({ ok: true }, { headers });
  }

  // action === "verify"
  if (!existing || existing.expiresAt.getTime() < Date.now()) {
    return Response.json({ error: "invalid_code" }, { status: 400, headers });
  }

  let stored = { hash: "", attempts: 0 };
  try {
    stored = { ...stored, ...JSON.parse(existing.value) };
  } catch {
    // valeur illisible — traitée comme code invalide
  }

  if (
    stored.attempts >= MAX_ATTEMPTS ||
    stored.hash !== (await sha256Hex(`${email}:${parsed.data.code}`))
  ) {
    if (stored.attempts + 1 >= MAX_ATTEMPTS) {
      await db.delete(verification).where(eq(verification.identifier, identifier));
    } else {
      await db
        .update(verification)
        .set({
          value: JSON.stringify({ ...stored, attempts: stored.attempts + 1 }),
          updatedAt: new Date(),
        })
        .where(eq(verification.identifier, identifier));
    }
    return Response.json({ error: "invalid_code" }, { status: 400, headers });
  }

  await db.delete(verification).where(eq(verification.identifier, identifier));

  const { env } = await getCloudflareContext({ async: true });
  const proof = await createEmailProof(email, env.BETTER_AUTH_SECRET);
  return Response.json({ proof }, { headers });
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeadersFor(request.headers.get("origin")),
  });
}

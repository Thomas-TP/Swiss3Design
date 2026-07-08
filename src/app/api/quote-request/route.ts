import { z } from "zod";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { sendEmail, getAdminEmails } from "@/lib/email";
import { adminNewQuoteEmail } from "@/lib/email-templates";
import { corsHeadersFor } from "@/lib/medusa-bridge";

// Route cross-origine pour la soumission d'une demande de devis sur mesure
// depuis un storefront externe (storefront-next) - miroir HTTP de
// src/app/[locale]/custom/actions.ts::submitQuoteRequest (même schéma, même
// logique). getServerSession() résout la session aussi bien via le cookie
// (même origine) que via l'en-tête Authorization: Bearer (cross-origine,
// plugin bearer() déjà actif) - identique au pont /api/medusa-bridge-token.
const schema = z.object({
  email: z.email(),
  description: z.string().min(10).max(4000),
  material: z.string().max(100).optional(),
  colors: z.string().max(200).optional(),
  dimensions: z.string().max(200).optional(),
  fileKey: z.string().startsWith("quotes/").max(300).optional(),
  fileName: z.string().max(200).optional(),
  locale: z.enum(["fr", "de", "it", "en"]).catch("fr"),
});

export async function POST(request: Request) {
  const headers = corsHeadersFor(request.headers.get("origin"));

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ status: "error" }, { status: 400, headers });
  }

  try {
    const session = await getServerSession();
    const db = await getDb();
    const { fileKey, ...rest } = parsed.data;
    const [created] = await db
      .insert(quoteRequests)
      .values({
        ...rest,
        fileUrl: fileKey ?? null,
        customerId: session?.user.id ?? null,
      })
      .returning({ id: quoteRequests.id });

    // Notification interne : nouvelle demande à chiffrer.
    // Ne doit jamais faire échouer l'enregistrement de la demande.
    try {
      const adminEmails = await getAdminEmails();
      if (adminEmails.length > 0) {
        await sendEmail(
          adminNewQuoteEmail(
            {
              id: created.id,
              email: rest.email,
              description: rest.description,
              material: rest.material ?? null,
              colors: rest.colors ?? null,
              dimensions: rest.dimensions ?? null,
              fileName: rest.fileName ?? null,
              locale: rest.locale,
            },
            adminEmails,
          ),
        );
      }
    } catch (e) {
      console.error("[email notif admin devis]", e);
    }

    return Response.json({ status: "success" }, { headers });
  } catch (e) {
    console.error("[quote-request]", e);
    return Response.json({ status: "error" }, { status: 500, headers });
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeadersFor(request.headers.get("origin")),
  });
}

import { z } from "zod";
import { sendEmail, getAdminEmails } from "@/lib/email";
import { adminContactEmail, contactConfirmationEmail } from "@/lib/email-templates";
import { corsHeadersFor } from "@/lib/medusa-bridge";

// Route cross-origine pour le formulaire de contact (page « À propos ») des
// storefronts externes (storefront-next). Aucune session requise : ce
// formulaire est accessible aux visiteurs anonymes, comme côté app racine
// (src/app/[locale]/a-propos/actions.ts, dont ceci est le miroir HTTP -
// même schéma, même logique anti-spam/honeypot).
const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(10).max(4000),
  locale: z.enum(["fr", "de", "it", "en"]).catch("fr"),
  // Honeypot anti-spam : si un bot le remplit, on fait comme si tout s'était
  // bien passé sans rien envoyer.
  company: z.string().optional(),
});

export async function POST(request: Request) {
  const headers = corsHeadersFor(request.headers.get("origin"));

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ status: "error" }, { status: 400, headers });
  }

  const { name, email, subject, message, locale, company } = parsed.data;

  if (company) {
    return Response.json({ status: "success" }, { headers });
  }

  try {
    const adminEmails = await getAdminEmails();
    const recipients = adminEmails.length > 0 ? adminEmails : ["contact@swiss3design.ch"];

    const sent = await sendEmail(adminContactEmail({ name, email, subject: subject ?? null, body: message, locale }, recipients));

    if (!sent && process.env.NODE_ENV === "production") {
      return Response.json({ status: "error" }, { status: 502, headers });
    }

    try {
      await sendEmail(contactConfirmationEmail(email, message, locale));
    } catch (e) {
      console.error("[email confirmation contact]", e);
    }

    return Response.json({ status: "success" }, { headers });
  } catch (e) {
    console.error("[contact-message]", e);
    return Response.json({ status: "error" }, { status: 500, headers });
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeadersFor(request.headers.get("origin")),
  });
}

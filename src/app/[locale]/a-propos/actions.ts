"use server";

import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { getDb } from "@/db";
import { queueEmail, drainEmailOutbox } from "@/lib/outbox";
import { getAdminEmails } from "@/lib/email";
import {
  adminContactEmail,
  contactConfirmationEmail,
} from "@/lib/email-templates";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(10).max(4000),
  locale: z.enum(["fr", "de", "it", "en"]).catch("fr"),
  // Honeypot anti-spam : champ caché, invisible pour l'humain. Si un bot le
  // remplit, on fait comme si tout s'était bien passé sans rien envoyer.
  company: z.string().optional(),
});

export interface ContactFormState {
  status: "idle" | "success" | "error";
}

export async function submitContactMessage(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  if (
    !(await rateLimit(
      new Request("https://swiss3design.ch", { headers: await headers() }),
      "contact",
      { limit: 5, windowS: 600 },
    ))
  )
    return { status: "error" };
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: (formData.get("subject") as string) || undefined,
    message: formData.get("message"),
    locale: formData.get("locale"),
    company: (formData.get("company") as string) || undefined,
  });

  if (!parsed.success) {
    return { status: "error" };
  }

  const { name, email, subject, message, locale, company } = parsed.data;

  // Bot détecté (honeypot rempli) : on ignore silencieusement.
  if (company) {
    return { status: "success" };
  }

  try {
    // Destinataires : la boîte de notification admin, avec repli sur l'adresse
    // de contact publique pour ne jamais perdre un message.
    const adminEmails = await getAdminEmails();
    const recipients =
      adminEmails.length > 0 ? adminEmails : ["contact@swiss3design.ch"];

    const db = await getDb();
    const key = "contact:" + crypto.randomUUID();
    await db.transaction(async (db) => {
      await queueEmail(
        db,
        key + ":admin",
        adminContactEmail(
          { name, email, subject: subject ?? null, body: message, locale },
          recipients,
        ),
      );

      await queueEmail(
        db,
        key + ":confirmation",
        contactConfirmationEmail(email, message, locale),
      );
    });
    try {
      await drainEmailOutbox(db);
    } catch {
      console.error("[outbox] reprise par maintenance");
    }
    return { status: "success" };
  } catch (e) {
    console.error("[contact]", e);
    return { status: "error" };
  }
}

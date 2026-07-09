"use server";

import { z } from "zod";
import { sendEmail, getAdminEmails } from "@/lib/email";
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

    const sent = await sendEmail(
      adminContactEmail(
        { name, email, subject: subject ?? null, body: message, locale },
        recipients,
      ),
    );

    // Sans RESEND_API_KEY (dev local), sendEmail renvoie false : on log mais on
    // ne bloque pas le test du formulaire.
    if (!sent && process.env.NODE_ENV === "production") {
      return { status: "error" };
    }

    // Accusé de réception au client — best-effort, ne doit jamais faire échouer
    // l'envoi principal.
    try {
      await sendEmail(contactConfirmationEmail(email, message, locale));
    } catch (e) {
      console.error("[email confirmation contact]", e);
    }

    return { status: "success" };
  } catch (e) {
    console.error("[contact]", e);
    return { status: "error" };
  }
}

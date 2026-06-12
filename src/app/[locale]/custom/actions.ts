"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { sendEmail, getAdminEmails } from "@/lib/email";
import { adminNewQuoteEmail } from "@/lib/email-templates";

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

export interface QuoteFormState {
  status: "idle" | "success" | "error";
}

export async function submitQuoteRequest(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    description: formData.get("description"),
    material: (formData.get("material") as string) || undefined,
    colors: (formData.get("colors") as string) || undefined,
    dimensions: (formData.get("dimensions") as string) || undefined,
    fileKey: (formData.get("fileKey") as string) || undefined,
    fileName: (formData.get("fileName") as string) || undefined,
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return { status: "error" };
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

    return { status: "success" };
  } catch {
    return { status: "error" };
  }
}

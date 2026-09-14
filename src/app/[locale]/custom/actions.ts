"use server";

import { verifyOwnedUpload } from "@/lib/upload";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { queueEmail, drainEmailOutbox } from "@/lib/outbox";
import { getAdminEmails } from "@/lib/email";
import { adminNewQuoteEmail } from "@/lib/email-templates";
import { recordStatusTransition } from "@/lib/status-history";

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
  if (
    !(await rateLimit(
      new Request("https://swiss3design.ch", { headers: await headers() }),
      "quote-submit",
      { limit: 5, windowS: 600 },
    ))
  )
    return { status: "error" };
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
    if (!(await verifyOwnedUpload(fileKey))) return { status: "error" };
    const adminEmails = await getAdminEmails();
    await db.transaction(async (db) => {
      const [created] = await db
        .insert(quoteRequests)
        .values({
          ...rest,
          fileUrl: fileKey ?? null,
          customerId: session?.user.id ?? null,
        })
        .returning({ id: quoteRequests.id });
      await recordStatusTransition(db, {
        entityType: "quote",
        entityId: created.id,
        fromStatus: null,
        toStatus: "received",
        source: "customer",
        actorId: session?.user.id ?? null,
      });

      // Notification interne : nouvelle demande à chiffrer.
      // Ne doit jamais faire échouer l'enregistrement de la demande.
      {
        if (adminEmails.length > 0) {
          await queueEmail(
            db,
            "quote-new:" + created.id,
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
      }
    });
    try {
      await drainEmailOutbox(db);
    } catch {
      console.error("[outbox] reprise par maintenance");
    }

    return { status: "success" };
  } catch {
    return { status: "error" };
  }
}

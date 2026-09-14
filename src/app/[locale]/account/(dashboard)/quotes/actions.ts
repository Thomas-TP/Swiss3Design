"use server";

import { expireQuoteSession } from "@/lib/quote-session";
import { verifyOwnedUpload } from "@/lib/upload";
import { z } from "zod";
import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { quoteRequests, quoteMessages } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { getAdminEmails } from "@/lib/email";
import { recordStatusTransition } from "@/lib/status-history";
import { queueEmail, drainEmailOutbox } from "@/lib/outbox";
import {
  adminQuoteRevisionEmail,
  adminQuoteDeclinedEmail,
} from "@/lib/email-templates";

export interface QuoteActionState {
  status: "idle" | "success" | "error";
}

const reviseSchema = z.object({
  quoteId: z.string().min(1),
  message: z.string().trim().min(5).max(4000),
  fileKey: z.string().startsWith("quotes/").max(300).optional(),
  fileName: z.string().max(200).optional(),
});

const declineSchema = z.object({
  quoteId: z.string().min(1),
  reason: z.string().trim().max(4000).optional(),
});

// Charge un devis en vérifiant qu'il appartient bien au client connecté.
async function loadOwnedQuote(
  db: Pick<Awaited<ReturnType<typeof getDb>>, "select">,
  quoteId: string,
  user: { id: string; email: string },
) {
  const [quote] = await db
    .select()
    .from(quoteRequests)
    .where(
      and(
        eq(quoteRequests.id, quoteId),
        or(
          eq(quoteRequests.customerId, user.id),
          eq(quoteRequests.email, user.email),
        ),
      ),
    )
    .limit(1)
    .for("update");
  return quote ?? null;
}

// Le client demande une modification de son devis (optionnellement avec un
// fichier 3D corrigé). Le devis repart côté atelier pour un nouveau chiffrage.
export async function requestQuoteRevision(
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const session = await getServerSession();
  if (!session) return { status: "error" as const };

  const parsed = reviseSchema.safeParse({
    quoteId: formData.get("quoteId"),
    message: formData.get("message"),
    fileKey: (formData.get("fileKey") as string) || undefined,
    fileName: (formData.get("fileName") as string) || undefined,
  });
  if (!parsed.success) return { status: "error" as const };

  try {
    const db = await getDb();
    const result = await db.transaction(async (db) => {
      const quote = await loadOwnedQuote(db, parsed.data.quoteId, session.user);
      // Une modification ne se demande que sur un devis chiffré encore actif
      if (!quote || !["quoted", "accepted"].includes(quote.status)) {
        return { status: "error" as const };
      }

      if (!(await verifyOwnedUpload(parsed.data.fileKey)))
        return { status: "error" as const };
      await expireQuoteSession(quote);
      await db.insert(quoteMessages).values({
        quoteId: quote.id,
        sender: "customer",
        body: parsed.data.message,
        fileUrl: parsed.data.fileKey ?? null,
        fileName: parsed.data.fileName ?? null,
      });
      await db
        .update(quoteRequests)
        .set({
          status: "revision_requested",
          checkoutSessionId: null,
          offerVersion: quote.offerVersion + 1,
        })
        .where(eq(quoteRequests.id, quote.id));
      await recordStatusTransition(db, {
        entityType: "quote",
        entityId: quote.id,
        fromStatus: quote.status,
        toStatus: "revision_requested",
        source: "customer",
        actorId: session.user.id,
      });

      {
        const adminEmails = await getAdminEmails();
        if (adminEmails.length > 0) {
          await queueEmail(
            db,
            "quote-revision:" + quote.id + ":" + (quote.offerVersion + 1),
            adminQuoteRevisionEmail(
              { id: quote.id, email: quote.email, locale: quote.locale },
              parsed.data.message,
              parsed.data.fileName ?? null,
              adminEmails,
            ),
          );
        }
      }

      revalidatePath("/", "layout");
      return { status: "success" as const };
    });
    try {
      await drainEmailOutbox(db);
    } catch {
      console.error("[outbox] reprise par maintenance");
    }
    return result;
  } catch {
    return { status: "error" as const };
  }
}

// Le client refuse le devis (motif facultatif). Statut → declined.
export async function declineQuote(
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const session = await getServerSession();
  if (!session) return { status: "error" as const };

  const parsed = declineSchema.safeParse({
    quoteId: formData.get("quoteId"),
    reason: (formData.get("reason") as string) || undefined,
  });
  if (!parsed.success) return { status: "error" as const };

  try {
    const db = await getDb();
    const result = await db.transaction(async (db) => {
      const quote = await loadOwnedQuote(db, parsed.data.quoteId, session.user);
      if (
        !quote ||
        !["quoted", "accepted", "revision_requested"].includes(quote.status)
      ) {
        return { status: "error" as const };
      }

      await expireQuoteSession(quote);
      const reason = parsed.data.reason?.trim() || null;
      if (reason) {
        await db.insert(quoteMessages).values({
          quoteId: quote.id,
          sender: "customer",
          body: reason,
        });
      }
      await db
        .update(quoteRequests)
        .set({
          status: "declined",
          checkoutSessionId: null,
          offerVersion: quote.offerVersion + 1,
        })
        .where(eq(quoteRequests.id, quote.id));
      await recordStatusTransition(db, {
        entityType: "quote",
        entityId: quote.id,
        fromStatus: quote.status,
        toStatus: "declined",
        source: "customer",
        actorId: session.user.id,
      });

      {
        const adminEmails = await getAdminEmails();
        if (adminEmails.length > 0) {
          await queueEmail(
            db,
            "quote-declined:" + quote.id + ":" + (quote.offerVersion + 1),
            adminQuoteDeclinedEmail(
              {
                id: quote.id,
                email: quote.email,
                locale: quote.locale,
                quotedPriceCents: quote.quotedPriceCents,
              },
              reason,
              adminEmails,
            ),
          );
        }
      }

      revalidatePath("/", "layout");
      return { status: "success" as const };
    });
    try {
      await drainEmailOutbox(db);
    } catch {
      console.error("[outbox] reprise par maintenance");
    }
    return result;
  } catch {
    return { status: "error" as const };
  }
}

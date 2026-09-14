"use server";

import { expireQuoteSession } from "@/lib/quote-session";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { quoteRequests, quoteMessages } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { queueEmail, drainEmailOutbox } from "@/lib/outbox";
import { quoteReplyEmail, quoteRejectedEmail } from "@/lib/email-templates";
import { QUOTE_STATUSES } from "../ui";
import { recordStatusTransition } from "@/lib/status-history";

// Durée de validité d'un devis, posée (et réinitialisée) à chaque chiffrage.
const QUOTE_VALIDITY_DAYS = 30;

export async function updateQuote(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !(QUOTE_STATUSES as readonly string[]).includes(status)) {
    revalidatePath("/", "layout");
    return;
  }

  const priceRaw = String(formData.get("price") || "").trim();
  let quotedPriceCents: number | null = null;
  if (priceRaw) {
    const value = Number.parseFloat(priceRaw.replace(",", "."));
    if (Number.isFinite(value) && value > 0) {
      quotedPriceCents = Math.round(value * 100);
    }
  }

  const adminMessage =
    String(formData.get("adminMessage") || "").trim() || null;
  const adminNote =
    String(formData.get("adminNote") || "")
      .trim()
      .slice(0, 2000) || null;
  const db = await getDb();
  await db.transaction(async (db) => {
    const [previous] = await db
      .select()
      .from(quoteRequests)
      .where(eq(quoteRequests.id, id))
      .limit(1)
      .for("update");
    if (!previous) return;
    const paid =
      ["paid", "in_production", "done"].includes(previous.status) ||
      !!previous.paidAt;
    if (paid) {
      const allowed: Record<string, string[]> = {
        paid: ["paid", "in_production"],
        in_production: ["in_production", "done"],
        done: ["done"],
      };
      if (
        !allowed[previous.status]?.includes(status) ||
        quotedPriceCents !== previous.quotedPriceCents
      )
        return;
    } else {
      if (["paid", "in_production", "done"].includes(status)) return;
      await expireQuoteSession(previous);
    }

    // « Entrée dans quoted » : premier chiffrage OU re-devis après une demande de
    // modification. C'est ce qui (re)pose la validité, journalise le devis dans le
    // fil, et déclenche l'e-mail au client.
    const enteringQuoted =
      status === "quoted" &&
      (previous.status !== "quoted" ||
        previous.quotedPriceCents !== quotedPriceCents ||
        previous.adminMessage !== adminMessage) &&
      quotedPriceCents != null;
    const validUntil = enteringQuoted
      ? new Date(Date.now() + QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000)
      : null;

    await db
      .update(quoteRequests)
      .set({
        status: status as (typeof QUOTE_STATUSES)[number],
        quotedPriceCents,
        adminMessage,
        adminNote,
        ...(!paid
          ? { checkoutSessionId: null, offerVersion: previous.offerVersion + 1 }
          : {}),
        ...(enteringQuoted ? { validUntil } : {}),
      })
      .where(eq(quoteRequests.id, id));
    await recordStatusTransition(db, {
      entityType: "quote",
      entityId: id,
      fromStatus: previous.status,
      toStatus: status,
      source: "admin",
      actorId: session.user.id,
    });

    // Journalise le (re-)devis dans le fil de discussion
    if (enteringQuoted) {
      await db.insert(quoteMessages).values({
        quoteId: id,
        sender: "admin",
        body: adminMessage ?? "",
        priceCents: quotedPriceCents,
      });
    }

    // E-mails au client — envoyés une seule fois, au premier passage dans le
    // statut. Un échec d'envoi ne bloque jamais la mise à jour.
    if (previous && enteringQuoted) {
      // Devis chiffré (ou re-chiffré) : le client reçoit le prix proposé
      await queueEmail(
        db,
        "quote-reply:" + id + ":" + (previous.offerVersion + 1),
        quoteReplyEmail({
          id,
          email: previous.email,
          locale: previous.locale,
          quotedPriceCents,
          adminMessage,
          validUntil,
        }),
      );
    } else if (
      previous &&
      status === "rejected" &&
      previous.status !== "rejected"
    ) {
      // Demande non retenue : le client est prévenu, avec le message en motif
      await queueEmail(
        db,
        "quote-rejected:" + id + ":" + (previous.offerVersion + 1),
        quoteRejectedEmail({
          email: previous.email,
          locale: previous.locale,
          adminMessage,
        }),
      );
    }
  });
  try {
    await drainEmailOutbox(db);
  } catch {
    console.error("[outbox] reprise par maintenance");
  }

  // Pas de redirect() ici : dans une action de formulaire, il peut laisser
  // l'UI figée sur Cloudflare Workers. On reste sur la page, rafraîchie.
  revalidatePath("/", "layout");
}

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { quoteRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { quoteReplyEmail, quoteRejectedEmail } from "@/lib/email-templates";
import { QUOTE_STATUSES } from "../ui";

export async function updateQuote(formData: FormData) {
  await requireAdmin();
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
    String(formData.get("adminNote") || "").trim().slice(0, 2000) || null;
  const db = await getDb();
  const [previous] = await db
    .select()
    .from(quoteRequests)
    .where(eq(quoteRequests.id, id))
    .limit(1);
  await db
    .update(quoteRequests)
    .set({
      status: status as (typeof QUOTE_STATUSES)[number],
      quotedPriceCents,
      adminMessage,
      adminNote,
    })
    .where(eq(quoteRequests.id, id));

  // E-mails au client — envoyés une seule fois, au premier passage dans le
  // statut. Un échec d'envoi ne bloque jamais la mise à jour.
  try {
    if (
      previous &&
      status === "quoted" &&
      previous.status !== "quoted" &&
      quotedPriceCents != null
    ) {
      // Devis chiffré : le client reçoit le prix proposé
      await sendEmail(
        quoteReplyEmail({
          email: previous.email,
          locale: previous.locale,
          quotedPriceCents,
          adminMessage,
        }),
      );
    } else if (previous && status === "rejected" && previous.status !== "rejected") {
      // Devis refusé : le client est prévenu, avec le message en guise de motif
      await sendEmail(
        quoteRejectedEmail({
          email: previous.email,
          locale: previous.locale,
          adminMessage,
        }),
      );
    }
  } catch (e) {
    console.error("[email devis]", e);
  }

  // Pas de redirect() ici : dans une action de formulaire, il peut laisser
  // l'UI figée sur Cloudflare Workers. On reste sur la page, rafraîchie.
  revalidatePath("/", "layout");
}

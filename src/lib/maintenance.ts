import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { quoteRequests, abandonedCarts } from "@/db/schema";
import { sendEmail } from "./email";
import { abandonedCartEmail } from "./email-templates";
import { SITE_URL } from "./seo";

// Rétention (politique de confidentialité) : fichiers/devis supprimés au plus
// tard 2 ans après la demande. On garde la ligne pour les devis payés/produits
// (valeur comptable), mais on supprime toujours le fichier 3D.
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
// Délai de grâce avant de considérer un fichier comme orphelin (upload en cours)
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
// Statuts dont la ligne de devis peut être entièrement supprimée après 2 ans
const DELETABLE_STATUSES = ["received", "quoted", "rejected"];

// Relance panier : envoyée 1 h après le consentement (laisse le temps de
// finaliser), une seule fois. Purge des paniers à 30 jours (minimisation nLPD).
const ABANDONED_REMINDER_DELAY_MS = 60 * 60 * 1000;
const ABANDONED_PURGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface MaintenanceReport {
  retentionFilesDeleted: number;
  quotesDeleted: number;
  orphansDeleted: number;
  cartRemindersSent: number;
  abandonedCartsPurged: number;
}

export async function runMaintenance(): Promise<MaintenanceReport> {
  const { env } = await getCloudflareContext({ async: true });
  const db = await getDb();
  const now = Date.now();

  // 1) Rétention : devis de plus de 2 ans
  const cutoff = new Date(now - TWO_YEARS_MS);
  const oldQuotes = await db
    .select({
      id: quoteRequests.id,
      fileUrl: quoteRequests.fileUrl,
      status: quoteRequests.status,
    })
    .from(quoteRequests)
    .where(lt(quoteRequests.createdAt, cutoff));

  let retentionFilesDeleted = 0;
  const rowsToDelete: string[] = [];
  for (const q of oldQuotes) {
    if (q.fileUrl) {
      try {
        await env.R2.delete(q.fileUrl);
        retentionFilesDeleted++;
      } catch {
        // déjà absent — sans gravité
      }
    }
    if (DELETABLE_STATUSES.includes(q.status)) {
      rowsToDelete.push(q.id);
    } else if (q.fileUrl) {
      // devis converti (payé/produit) : on garde la ligne, on retire le fichier
      await db
        .update(quoteRequests)
        .set({ fileUrl: null, fileName: null })
        .where(eq(quoteRequests.id, q.id));
    }
  }
  if (rowsToDelete.length > 0) {
    await db
      .delete(quoteRequests)
      .where(inArray(quoteRequests.id, rowsToDelete));
  }

  // 2) Fichiers R2 orphelins : préfixe quotes/ non référencé et plus vieux que
  //    le délai de grâce (upload anonyme jamais transformé en demande).
  const referenced = new Set(
    (
      await db
        .select({ fileUrl: quoteRequests.fileUrl })
        .from(quoteRequests)
        .where(isNotNull(quoteRequests.fileUrl))
    ).map((r) => r.fileUrl as string),
  );

  let orphansDeleted = 0;
  let cursor: string | undefined;
  do {
    const listing = await env.R2.list({
      prefix: "quotes/",
      limit: 1000,
      cursor,
    });
    for (const obj of listing.objects) {
      if (referenced.has(obj.key)) continue;
      if (now - obj.uploaded.getTime() < ORPHAN_GRACE_MS) continue;
      try {
        await env.R2.delete(obj.key);
        orphansDeleted++;
      } catch {
        // ignore
      }
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  // 3) Relance des paniers abandonnés (opt-in) : 1 h après le consentement, une
  //    seule fois, sauf si déjà récupéré (commande) ou désinscrit.
  const reminderCutoff = new Date(now - ABANDONED_REMINDER_DELAY_MS);
  const pendingCarts = await db
    .select()
    .from(abandonedCarts)
    .where(
      and(
        isNull(abandonedCarts.reminderSentAt),
        isNull(abandonedCarts.recoveredAt),
        isNull(abandonedCarts.unsubscribedAt),
        lt(abandonedCarts.consentAt, reminderCutoff),
      ),
    );

  let cartRemindersSent = 0;
  for (const c of pendingCarts) {
    try {
      const items = JSON.parse(c.itemsJson) as {
        name: string;
        quantity: number;
        priceCents: number;
      }[];
      await sendEmail(
        abandonedCartEmail({
          to: c.email,
          items,
          locale: c.locale,
          cartUrl: `${SITE_URL}/${c.locale}/cart`,
          unsubscribeUrl: `${SITE_URL}/api/cart-reminder/unsubscribe?token=${c.token}`,
        }),
      );
      await db
        .update(abandonedCarts)
        .set({ reminderSentAt: new Date() })
        .where(eq(abandonedCarts.id, c.id));
      cartRemindersSent++;
    } catch {
      // échec d'envoi : reminderSentAt non posé → réessayé au prochain passage
    }
  }

  // 4) Purge des paniers abandonnés de plus de 30 jours (minimisation nLPD)
  const cartPurgeCutoff = new Date(now - ABANDONED_PURGE_MS);
  const purgedCarts = await db
    .delete(abandonedCarts)
    .where(lt(abandonedCarts.createdAt, cartPurgeCutoff))
    .returning({ id: abandonedCarts.id });

  return {
    retentionFilesDeleted,
    quotesDeleted: rowsToDelete.length,
    orphansDeleted,
    cartRemindersSent,
    abandonedCartsPurged: purgedCarts.length,
  };
}

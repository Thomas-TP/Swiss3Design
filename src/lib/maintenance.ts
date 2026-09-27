import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  quoteRequests,
  quoteMessages,
  abandonedCarts,
  requestLimits,
  emailOutbox,
  agentRegistrations,
  oauthAccessToken,
  oauthClient,
  oauthClientAssertion,
  oauthRefreshToken,
} from "@/db/schema";
import { abandonedCartEmail } from "./email-templates";
import { drainEmailOutbox, queueEmail } from "./outbox";
import { reconcilePendingOrders } from "./checkout-session";
import { SITE_URL } from "./seo";
import {
  syncStripeCatalog,
  type CatalogSyncReport,
} from "./commerce/stripe-catalog";

// Rétention (politique de confidentialité) : fichiers/devis supprimés au plus
// tard 2 ans après la dernière activité des devis clos ou sans suite. Les fichiers
// nécessaires à une fabrication payée en cours restent disponibles.
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
// Délai de grâce avant de considérer un fichier comme orphelin (upload en cours)
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
// Statuts dont la ligne de devis peut être entièrement supprimée après 2 ans
const DELETABLE_STATUSES = [
  "received",
  "quoted",
  "rejected",
  "declined",
  "revision_requested",
];

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
  oauthClientsPurged: number;
  stripeCatalog: CatalogSyncReport;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Serveur OAuth des agents : enregistrements auth.md jamais revendiqués (fenêtre
// close depuis 1 jour) ou révoqués depuis 30 jours — la suppression de leur
// client OAuth emporte l'enregistrement (cascade) —, jetons expirés, et clients
// enregistrés dynamiquement (RFC 7591, ouvert) jamais autorisés en 90 jours.
async function purgeOAuth(
  db: Awaited<ReturnType<typeof getDb>>,
  now: number,
): Promise<number> {
  const stale = await db
    .select({ clientId: agentRegistrations.clientId })
    .from(agentRegistrations)
    .where(
      or(
        and(
          eq(agentRegistrations.status, "unclaimed"),
          lt(agentRegistrations.claimExpiresAt, new Date(now - DAY_MS)),
        ),
        and(
          eq(agentRegistrations.status, "revoked"),
          lt(agentRegistrations.updatedAt, new Date(now - 30 * DAY_MS)),
        ),
      ),
    )
    .limit(500);
  const agentClients = stale.length
    ? await db
        .delete(oauthClient)
        .where(
          inArray(
            oauthClient.clientId,
            stale.map((s) => s.clientId),
          ),
        )
        .returning({ id: oauthClient.id })
    : [];
  await db
    .delete(oauthAccessToken)
    .where(lt(oauthAccessToken.expiresAt, new Date(now - DAY_MS)));
  await db
    .delete(oauthRefreshToken)
    .where(lt(oauthRefreshToken.expiresAt, new Date(now - DAY_MS)));
  await db
    .delete(oauthClientAssertion)
    .where(lt(oauthClientAssertion.expiresAt, new Date(now)));
  const unusedClients = await db
    .delete(oauthClient)
    .where(
      and(
        lt(oauthClient.createdAt, new Date(now - 90 * DAY_MS)),
        isNull(oauthClient.userId),
        sql`NOT EXISTS (SELECT 1 FROM oauth_consent c WHERE c.client_id = ${oauthClient.clientId})`,
        sql`NOT EXISTS (SELECT 1 FROM oauth_refresh_token t WHERE t.client_id = ${oauthClient.clientId})`,
        sql`NOT EXISTS (SELECT 1 FROM agent_registrations r WHERE r.client_id = ${oauthClient.clientId})`,
      ),
    )
    .returning({ id: oauthClient.id });
  return agentClients.length + unusedClients.length;
}

export async function runMaintenance(): Promise<MaintenanceReport> {
  const { env } = await getCloudflareContext({ async: true });
  const db = await getDb();
  const now = Date.now();
  await db.delete(requestLimits).where(lt(requestLimits.expiresAt, new Date()));
  await db
    .delete(emailOutbox)
    .where(lt(emailOutbox.sentAt, new Date(now - 30 * 86400000)));
  await reconcilePendingOrders(db);
  await drainEmailOutbox(db, 20);

  // 1) Rétention : devis de plus de 2 ans
  const cutoff = new Date(now - TWO_YEARS_MS);
  const oldQuotes = await db
    .select({
      id: quoteRequests.id,
      fileUrl: quoteRequests.fileUrl,
      status: quoteRequests.status,
    })
    .from(quoteRequests)
    .where(
      and(
        lt(quoteRequests.updatedAt, cutoff),
        inArray(quoteRequests.status, [
          "received",
          "quoted",
          "rejected",
          "declined",
          "revision_requested",
          "done",
        ]),
      ),
    )
    .limit(100);

  let retentionFilesDeleted = 0;
  const rowsToDelete: string[] = [];
  for (const q of oldQuotes) {
    const attachments = await db
      .select({ id: quoteMessages.id, fileUrl: quoteMessages.fileUrl })
      .from(quoteMessages)
      .where(eq(quoteMessages.quoteId, q.id));
    for (const attachment of attachments) {
      if (!attachment.fileUrl) continue;
      await env.R2.delete(attachment.fileUrl);
      await db
        .update(quoteMessages)
        .set({ fileUrl: null, fileName: null })
        .where(eq(quoteMessages.id, attachment.id));
      retentionFilesDeleted++;
    }
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

  const messageFiles = await db
    .select({ fileUrl: quoteMessages.fileUrl })
    .from(quoteMessages)
    .where(isNotNull(quoteMessages.fileUrl));
  for (const row of messageFiles) if (row.fileUrl) referenced.add(row.fileUrl);

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
      await queueEmail(
        db,
        "cart-reminder:" + c.id,
        abandonedCartEmail({
          to: c.email,
          items,
          locale: c.locale,
          cartUrl: `${SITE_URL}/${c.locale}/cart#restore=${c.token}`,
          unsubscribeUrl: `${SITE_URL}/api/cart-reminder/unsubscribe?token=${c.token}`,
        }),
      );
    } catch {
      // échec d'envoi : reminderSentAt non posé → réessayé au prochain passage
    }
  }

  await drainEmailOutbox(db, 20);
  if (pendingCarts.length) {
    const delivered = await db
      .select({ id: abandonedCarts.id })
      .from(abandonedCarts)
      .where(
        and(
          inArray(
            abandonedCarts.id,
            pendingCarts.map((c) => c.id),
          ),
          isNotNull(abandonedCarts.reminderSentAt),
        ),
      );
    cartRemindersSent = delivered.length;
  }

  // 4) Purge des paniers abandonnés de plus de 30 jours (minimisation nLPD)
  const cartPurgeCutoff = new Date(now - ABANDONED_PURGE_MS);
  const purgedCarts = await db
    .delete(abandonedCarts)
    .where(lt(abandonedCarts.createdAt, cartPurgeCutoff))
    .returning({ id: abandonedCarts.id });

  // 5) Agents et applications OAuth (voir purgeOAuth)
  const oauthClientsPurged = await purgeOAuth(db, now);

  // 6) Catalogue Stripe des agents IA : stock et prix à chaque passage, flux
  //    complet une fois par jour (n'échoue jamais : erreur rapportée).
  const stripeCatalog = await syncStripeCatalog(db);

  return {
    retentionFilesDeleted,
    quotesDeleted: rowsToDelete.length,
    orphansDeleted,
    cartRemindersSent,
    abandonedCartsPurged: purgedCarts.length,
    oauthClientsPurged,
    stripeCatalog,
  };
}

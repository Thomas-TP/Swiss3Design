"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { newsletterSends, products, productTranslations, productImages } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { sendBulkEmail } from "@/lib/email";
import { newsletterAnnouncementEmail } from "@/lib/email-templates";
import {
  getRecipients,
  createUnsubscribeToken,
  type NewsletterAudience,
} from "@/lib/newsletter";

const AUDIENCES: NewsletterAudience[] = ["newsletter", "product_news", "both"];

interface ComposeInput {
  subject: string;
  bodyText: string;
  audience: NewsletterAudience;
  productId: string;
}

function parseInput(formData: FormData): ComposeInput | { error: string } {
  const subject = String(formData.get("subject") || "").trim();
  const bodyText = String(formData.get("bodyText") || "").trim();
  const audienceRaw = String(formData.get("audience") || "");
  const productId = String(formData.get("productId") || "").trim();

  if (subject.length < 3) return { error: "Objet trop court." };
  if (bodyText.length < 10) return { error: "Message trop court." };
  if (!AUDIENCES.includes(audienceRaw as NewsletterAudience)) {
    return { error: "Cible invalide." };
  }
  return { subject, bodyText, audience: audienceRaw as NewsletterAudience, productId };
}

async function loadProduct(productId: string) {
  if (!productId) return undefined;
  const db = await getDb();
  const [row] = await db
    .select({
      name: productTranslations.name,
      priceCents: products.priceCents,
      slug: products.slug,
    })
    .from(products)
    .innerJoin(
      productTranslations,
      eq(productTranslations.productId, products.id),
    )
    .where(eq(products.id, productId))
    .limit(1);
  if (!row) return undefined;

  const [image] = await db
    .select({ url: productImages.url })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(productImages.sortOrder)
    .limit(1);

  return {
    name: row.name,
    priceCents: row.priceCents,
    imageUrl: image?.url ?? null,
    url: `https://swiss3design.ch/fr/products/${row.slug}`,
  };
}

export async function previewAnnouncement(
  formData: FormData,
): Promise<{ subject: string; html: string; recipientCount: number } | { error: string }> {
  await requireAdmin();
  const input = parseInput(formData);
  if ("error" in input) return input;

  const [product, recipients] = await Promise.all([
    loadProduct(input.productId),
    getRecipients(input.audience),
  ]);

  const email = newsletterAnnouncementEmail({
    to: "apercu@swiss3design.ch",
    subject: input.subject,
    bodyText: input.bodyText,
    product,
    unsubscribeUrl: "https://swiss3design.ch/api/newsletter/unsubscribe?u=apercu&t=apercu",
  });

  return { subject: email.subject, html: email.html, recipientCount: recipients.length };
}

export async function sendAnnouncement(
  formData: FormData,
): Promise<{ success: true; count: number } | { error: string }> {
  const session = await requireAdmin();
  const input = parseInput(formData);
  if ("error" in input) return input;

  const { env } = await getCloudflareContext({ async: true });
  if (!env.BETTER_AUTH_SECRET) return { error: "Configuration serveur incomplète." };

  const [product, recipients] = await Promise.all([
    loadProduct(input.productId),
    getRecipients(input.audience),
  ]);
  if (recipients.length === 0) return { error: "Aucun destinataire pour cette cible." };

  const messages = await Promise.all(
    recipients.map(async (r) => {
      const token = await createUnsubscribeToken(r.id, env.BETTER_AUTH_SECRET!);
      const unsubscribeUrl = `https://swiss3design.ch/api/newsletter/unsubscribe?u=${r.id}&t=${token}`;
      return newsletterAnnouncementEmail({
        to: r.email,
        subject: input.subject,
        bodyText: input.bodyText,
        product,
        unsubscribeUrl,
      });
    }),
  );

  const sent = await sendBulkEmail(messages);

  const db = await getDb();
  await db.insert(newsletterSends).values({
    subject: input.subject,
    bodyHtml: messages[0]?.html ?? "",
    audience: input.audience,
    productId: input.productId || null,
    recipientCount: sent,
    sentBy: session.user.id,
  });

  revalidatePath("/admin/emails/announcements");
  return { success: true, count: sent };
}

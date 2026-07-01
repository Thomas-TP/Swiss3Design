"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { newsletterSends, products, productTranslations, productImages } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { sendBulkEmail, sendEmail } from "@/lib/email";
import { newsletterAnnouncementEmail } from "@/lib/email-templates";
import {
  getRecipients,
  createUnsubscribeToken,
  type NewsletterAudience,
} from "@/lib/newsletter";

const AUDIENCES: NewsletterAudience[] = ["newsletter", "product_news", "both"];
const MAX_PRODUCTS = 4;

interface ComposeInput {
  subject: string;
  bodyText: string;
  audience: NewsletterAudience;
  productIds: string[];
  bannerImageUrl: string | null;
  ctaLabel: string;
  ctaUrl: string;
}

function parseInput(formData: FormData): ComposeInput | { error: string } {
  const subject = String(formData.get("subject") || "").trim();
  const bodyText = String(formData.get("bodyText") || "").trim();
  const audienceRaw = String(formData.get("audience") || "");
  const productIds = formData
    .getAll("productIds")
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, MAX_PRODUCTS);
  const bannerImageUrl = String(formData.get("bannerImageUrl") || "").trim() || null;
  const ctaLabel = String(formData.get("ctaLabel") || "").trim();
  const ctaUrl = String(formData.get("ctaUrl") || "").trim();

  if (subject.length < 3) return { error: "Objet trop court." };
  if (bodyText.length < 10) return { error: "Message trop court." };
  if (!AUDIENCES.includes(audienceRaw as NewsletterAudience)) {
    return { error: "Cible invalide." };
  }
  if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrl)) {
    return { error: "Le bouton personnalisé nécessite un libellé ET un lien." };
  }
  if (ctaUrl && !/^https?:\/\//.test(ctaUrl)) {
    return { error: "Le lien du bouton doit commencer par http(s)://." };
  }
  if (bannerImageUrl && !/^https?:\/\//.test(bannerImageUrl)) {
    return { error: "Image de bannière invalide." };
  }
  return {
    subject,
    bodyText,
    audience: audienceRaw as NewsletterAudience,
    productIds,
    bannerImageUrl,
    ctaLabel,
    ctaUrl,
  };
}

async function loadProducts(productIds: string[]) {
  if (productIds.length === 0) return [];
  const db = await getDb();
  const rows = await db
    .select({
      id: products.id,
      name: productTranslations.name,
      priceCents: products.priceCents,
      slug: products.slug,
    })
    .from(products)
    .innerJoin(
      productTranslations,
      eq(productTranslations.productId, products.id),
    )
    .where(inArray(products.id, productIds));

  const images = rows.length
    ? await db
        .select({ productId: productImages.productId, url: productImages.url })
        .from(productImages)
        .where(inArray(productImages.productId, rows.map((r) => r.id)))
        .orderBy(productImages.sortOrder)
    : [];
  const firstImage = new Map<string, string>();
  for (const img of images) {
    if (!firstImage.has(img.productId)) firstImage.set(img.productId, img.url);
  }

  // Conserve l'ordre choisi par l'admin, pas l'ordre de retour SQL.
  const byId = new Map(rows.map((r) => [r.id, r]));
  return productIds
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({
      name: r.name,
      priceCents: r.priceCents,
      imageUrl: firstImage.get(r.id) ?? null,
      url: `https://swiss3design.ch/fr/products/${r.slug}`,
    }));
}

function buildCta(input: ComposeInput) {
  return input.ctaLabel && input.ctaUrl
    ? { label: input.ctaLabel, url: input.ctaUrl }
    : null;
}

export async function previewAnnouncement(
  formData: FormData,
): Promise<{ subject: string; html: string; recipientCount: number } | { error: string }> {
  await requireAdmin();
  const input = parseInput(formData);
  if ("error" in input) return input;

  const [selectedProducts, recipients] = await Promise.all([
    loadProducts(input.productIds),
    getRecipients(input.audience),
  ]);

  const email = newsletterAnnouncementEmail({
    to: "apercu@swiss3design.ch",
    subject: input.subject,
    bodyText: input.bodyText,
    bannerImageUrl: input.bannerImageUrl,
    products: selectedProducts,
    cta: buildCta(input),
    unsubscribeUrl: "https://swiss3design.ch/api/newsletter/unsubscribe?u=apercu&t=apercu",
  });

  return { subject: email.subject, html: email.html, recipientCount: recipients.length };
}

// Envoi d'un exemplaire à l'admin connecté, pour relire avant diffusion —
// n'écrit rien dans le journal, ne compte pas comme un envoi réel.
export async function sendTestEmail(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const session = await requireAdmin();
  const input = parseInput(formData);
  if ("error" in input) return input;

  const selectedProducts = await loadProducts(input.productIds);
  const email = newsletterAnnouncementEmail({
    to: session.user.email,
    subject: `[Test] ${input.subject}`,
    bodyText: input.bodyText,
    bannerImageUrl: input.bannerImageUrl,
    products: selectedProducts,
    cta: buildCta(input),
    unsubscribeUrl: "https://swiss3design.ch/api/newsletter/unsubscribe?u=apercu&t=apercu",
  });

  const ok = await sendEmail(email);
  return ok ? { success: true } : { error: "Envoi impossible (RESEND_API_KEY absente ?)." };
}

export async function sendAnnouncement(
  formData: FormData,
): Promise<{ success: true; count: number } | { error: string }> {
  const session = await requireAdmin();
  const input = parseInput(formData);
  if ("error" in input) return input;

  const { env } = await getCloudflareContext({ async: true });
  if (!env.BETTER_AUTH_SECRET) return { error: "Configuration serveur incomplète." };

  const [selectedProducts, recipients] = await Promise.all([
    loadProducts(input.productIds),
    getRecipients(input.audience),
  ]);
  if (recipients.length === 0) return { error: "Aucun destinataire pour cette cible." };

  const cta = buildCta(input);
  const messages = await Promise.all(
    recipients.map(async (r) => {
      const token = await createUnsubscribeToken(r.id, env.BETTER_AUTH_SECRET!);
      const unsubscribeUrl = `https://swiss3design.ch/api/newsletter/unsubscribe?u=${r.id}&t=${token}`;
      return newsletterAnnouncementEmail({
        to: r.email,
        subject: input.subject,
        bodyText: input.bodyText,
        bannerImageUrl: input.bannerImageUrl,
        products: selectedProducts,
        cta,
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
    productIds: input.productIds.length ? JSON.stringify(input.productIds) : null,
    bannerImageUrl: input.bannerImageUrl,
    ctaLabel: input.ctaLabel || null,
    ctaUrl: input.ctaUrl || null,
    recipientCount: sent,
    sentBy: session.user.id,
  });

  revalidatePath("/admin/emails/announcements");
  return { success: true, count: sent };
}

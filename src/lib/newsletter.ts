// Destinataires + jeton de désabonnement pour les annonces newsletter
// (source de vérité : notification_preferences, jamais synchronisée vers un
// service tiers). Jeton HMAC-SHA256 autoporté (même schéma que
// email-proof.ts) : pas d'expiration — un lien de désabonnement doit rester
// valable même des mois après l'envoi.

import { eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  notificationPreferences,
  user,
  products,
  productTranslations,
  productImages,
} from "@/db/schema";

export type NewsletterAudience = "newsletter" | "product_news" | "both";

export interface NewsletterRecipient {
  id: string;
  email: string;
  name: string;
}

export async function getRecipients(
  audience: NewsletterAudience,
): Promise<NewsletterRecipient[]> {
  const db = await getDb();
  const condition =
    audience === "newsletter"
      ? eq(notificationPreferences.newsletter, true)
      : audience === "product_news"
        ? eq(notificationPreferences.productNews, true)
        : or(
            eq(notificationPreferences.newsletter, true),
            eq(notificationPreferences.productNews, true),
          );

  return db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(notificationPreferences)
    .innerJoin(user, eq(user.id, notificationPreferences.userId))
    .where(condition);
}

export interface AnnouncementProduct {
  name: string;
  priceCents: number;
  imageUrl?: string | null;
  url: string;
}

// Charge les produits choisis pour une annonce, dans l'ordre où l'admin les a
// sélectionnés (pas l'ordre de retour SQL). Partagé entre l'ancien panel
// Next.js (src/app/[locale]/admin/emails/announcements/actions.ts) et le
// nouveau point d'entrée interne appelé par Medusa
// (src/app/api/internal/newsletter/route.ts) — une seule implémentation.
export async function loadAnnouncementProducts(
  productIds: string[],
): Promise<AnnouncementProduct[]> {
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
        .where(
          inArray(
            productImages.productId,
            rows.map((r) => r.id),
          ),
        )
        .orderBy(productImages.sortOrder)
    : [];
  const firstImage = new Map<string, string>();
  for (const img of images) {
    if (!firstImage.has(img.productId)) firstImage.set(img.productId, img.url);
  }

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

const encoder = new TextEncoder();

async function hmacKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

function payload(userId: string) {
  return encoder.encode(`newsletter-unsub:${userId}`);
}

export async function createUnsubscribeToken(
  userId: string,
  secret: string,
): Promise<string> {
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, "sign"),
    payload(userId),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyUnsubscribeToken(
  userId: string,
  token: string,
  secret: string,
): Promise<boolean> {
  if (!token || token.length !== 64 || /[^0-9a-f]/.test(token)) return false;
  const sig = new Uint8Array(token.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  return crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, "verify"),
    sig,
    payload(userId),
  );
}

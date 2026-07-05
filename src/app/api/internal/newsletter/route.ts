import { getCloudflareContext } from "@opennextjs/cloudflare";
import { newsletterAnnouncementEmail } from "@/lib/email-templates";
import { sendBulkEmail, sendEmail } from "@/lib/email";
import {
  getRecipients,
  createUnsubscribeToken,
  loadAnnouncementProducts,
  type NewsletterAudience,
} from "@/lib/newsletter";

// Point d'entrée interne appelé par Medusa (migration en cours, voir
// apps/medusa/apps/backend/src/api/admin/newsletters) : l'admin compose et
// déclenche l'envoi depuis le panel Medusa, mais les destinataires
// (notification_preferences, D1) et l'envoi réel (Resend) restent ici — même
// logique déjà en prod que l'ancien panel Next.js
// (src/app/[locale]/admin/emails/announcements/actions.ts), pas de
// duplication. Protégé par secret partagé, jamais par une session admin :
// seul Medusa (déjà authentifié côté admin) appelle cette route.
const AUDIENCES: NewsletterAudience[] = ["newsletter", "product_news", "both"];
const MAX_PRODUCTS = 4;

interface RequestBody {
  mode: "preview" | "test" | "send";
  subject?: string;
  bodyText?: string;
  audience?: string;
  productIds?: string[];
  bannerImageUrl?: string | null;
  ctaLabel?: string;
  ctaUrl?: string;
  testEmail?: string;
}

function validate(body: RequestBody) {
  const subject = (body.subject ?? "").trim();
  const bodyText = (body.bodyText ?? "").trim();
  const audience = body.audience;
  const productIds = (body.productIds ?? []).slice(0, MAX_PRODUCTS);
  const bannerImageUrl = (body.bannerImageUrl ?? "").trim() || null;
  const ctaLabel = (body.ctaLabel ?? "").trim();
  const ctaUrl = (body.ctaUrl ?? "").trim();

  if (subject.length < 3) return { error: "Objet trop court." } as const;
  if (bodyText.length < 10) return { error: "Message trop court." } as const;
  if (!audience || !AUDIENCES.includes(audience as NewsletterAudience)) {
    return { error: "Cible invalide." } as const;
  }
  if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrl)) {
    return { error: "Le bouton personnalisé nécessite un libellé ET un lien." } as const;
  }
  if (ctaUrl && !/^https?:\/\//.test(ctaUrl)) {
    return { error: "Le lien du bouton doit commencer par http(s)://." } as const;
  }
  if (bannerImageUrl && !/^https?:\/\//.test(bannerImageUrl)) {
    return { error: "Image de bannière invalide." } as const;
  }
  return {
    subject,
    bodyText,
    audience: audience as NewsletterAudience,
    productIds,
    bannerImageUrl,
    ctaLabel,
    ctaUrl,
  } as const;
}

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = request.headers.get("authorization") ?? "";
  if (!env.MEDUSA_INTERNAL_SECRET || auth !== `Bearer ${env.MEDUSA_INTERNAL_SECRET}`) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = (await request.json()) as RequestBody;
  const input = validate(body);
  if ("error" in input) {
    return Response.json({ error: input.error }, { status: 400 });
  }

  const cta =
    input.ctaLabel && input.ctaUrl ? { label: input.ctaLabel, url: input.ctaUrl } : null;

  if (body.mode === "preview") {
    const [selectedProducts, recipients] = await Promise.all([
      loadAnnouncementProducts(input.productIds),
      getRecipients(input.audience),
    ]);
    const email = newsletterAnnouncementEmail({
      to: "apercu@swiss3design.ch",
      subject: input.subject,
      bodyText: input.bodyText,
      bannerImageUrl: input.bannerImageUrl,
      products: selectedProducts,
      cta,
      unsubscribeUrl: "https://swiss3design.ch/api/newsletter/unsubscribe?u=apercu&t=apercu",
    });
    return Response.json({
      subject: email.subject,
      html: email.html,
      recipientCount: recipients.length,
    });
  }

  if (body.mode === "test") {
    const testEmail = (body.testEmail ?? "").trim();
    if (!testEmail) {
      return Response.json({ error: "testEmail requis pour le mode test." }, { status: 400 });
    }
    const selectedProducts = await loadAnnouncementProducts(input.productIds);
    const email = newsletterAnnouncementEmail({
      to: testEmail,
      subject: `[Test] ${input.subject}`,
      bodyText: input.bodyText,
      bannerImageUrl: input.bannerImageUrl,
      products: selectedProducts,
      cta,
      unsubscribeUrl: "https://swiss3design.ch/api/newsletter/unsubscribe?u=apercu&t=apercu",
    });
    const ok = await sendEmail(email);
    return ok
      ? Response.json({ success: true })
      : Response.json({ error: "Envoi impossible (RESEND_API_KEY absente ?)." }, { status: 500 });
  }

  // mode "send"
  if (!env.BETTER_AUTH_SECRET) {
    return Response.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }
  const [selectedProducts, recipients] = await Promise.all([
    loadAnnouncementProducts(input.productIds),
    getRecipients(input.audience),
  ]);
  if (recipients.length === 0) {
    return Response.json({ error: "Aucun destinataire pour cette cible." }, { status: 400 });
  }

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
  return Response.json({ success: true, count: sent });
}

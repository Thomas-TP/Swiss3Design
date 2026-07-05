// Appelle le point d'entrée interne de l'app Next.js (destinataires
// notification_preferences + envoi Resend, voir
// src/app/api/internal/newsletter/route.ts côté racine) — protégé par un
// secret partagé, jamais par une session : seul Medusa (déjà authentifié
// côté admin) appelle cette route.
export interface NewsletterComposeInput {
  subject: string
  bodyText: string
  audience: "newsletter" | "product_news" | "both"
  productIds: string[]
  bannerImageUrl: string | null
  ctaLabel: string
  ctaUrl: string
}

async function callNewsletterBridge(
  body: Record<string, unknown>,
): Promise<{ data?: Record<string, unknown>; error?: string; status: number }> {
  const appUrl = process.env.SWISS3DESIGN_APP_URL
  const secret = process.env.MEDUSA_INTERNAL_SECRET
  if (!appUrl || !secret) {
    return { error: "SWISS3DESIGN_APP_URL/MEDUSA_INTERNAL_SECRET non configurés.", status: 500 }
  }

  const res = await fetch(`${appUrl}/api/internal/newsletter`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    return { error: (json.error as string) ?? `Erreur ${res.status}`, status: res.status }
  }
  return { data: json, status: res.status }
}

export async function previewAnnouncement(input: NewsletterComposeInput) {
  return callNewsletterBridge({ mode: "preview", ...input })
}

export async function sendTestAnnouncement(input: NewsletterComposeInput, testEmail: string) {
  return callNewsletterBridge({ mode: "test", ...input, testEmail })
}

export async function sendAnnouncement(input: NewsletterComposeInput) {
  return callNewsletterBridge({ mode: "send", ...input })
}

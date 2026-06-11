import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  // Expéditeur spécifique (sinon EMAIL_FROM) : commandes@ pour les ventes,
  // contact@ pour les e-mails de compte et les devis.
  from?: string;
}

// Envoi via l'API REST Resend. Sans RESEND_API_KEY, l'envoi est ignoré
// silencieusement (loggé) — le site reste fonctionnel sans e-mails.
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.RESEND_API_KEY) {
    console.log(`[email ignoré — pas de RESEND_API_KEY] ${message.subject} → ${message.to}`);
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: message.from || env.EMAIL_FROM || "Swiss3Design <onboarding@resend.dev>",
      to: message.to,
      subject: message.subject,
      html: message.html,
    }),
  });

  if (!res.ok) {
    console.error(`[email] échec ${res.status}: ${await res.text()}`);
    return false;
  }
  return true;
}

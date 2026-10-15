import { getCloudflareContext } from "@opennextjs/cloudflare";
import { allowedRecipients } from "./preview-email";

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  // Expéditeur spécifique (sinon EMAIL_FROM) : commandes@ pour les ventes,
  // contact@ pour les e-mails de compte et les devis.
  from?: string;
  // Adresse de réponse — utilisé pour les notifications admin afin que
  // « Répondre » écrive directement au client.
  replyTo?: string;
}

// Envoi via l'API REST Resend. Sans RESEND_API_KEY, l'envoi est ignoré
// silencieusement (loggé) — le site reste fonctionnel sans e-mails.
export async function sendEmail(
  message: EmailMessage,
  idempotencyKey?: string,
): Promise<boolean> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.RESEND_API_KEY) {
    console.log(
      `[email ignoré — pas de RESEND_API_KEY] ${message.subject} → ${message.to}`,
    );
    return false;
  }
  // Preview : seules les adresses autorisées reçoivent (src/lib/preview-email.ts).
  // Un message sans destinataire autorisé est écarté volontairement : `true`, pour
  // que la file d'envoi (outbox) ne le retente pas.
  const to = allowedRecipients(env, message.to);
  if (to.length === 0) {
    console.log(`[email écarté — preview] ${message.subject}`);
    return true;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from:
        message.from ||
        env.EMAIL_FROM ||
        "Swiss3Design <onboarding@resend.dev>",
      to,
      subject: message.subject,
      html: message.html,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    console.error(`[email] échec ${res.status}: ${await res.text()}`);
    return false;
  }
  return true;
}

// Envoi en masse via l'API batch Resend (jusqu'à 100 messages indépendants
// par requête — chaque message garde son propre destinataire et son propre
// contenu, donc pas de fuite d'adresses entre destinataires comme le
// donnerait un simple tableau `to`). Utilisé pour les annonces newsletter.
// Retourne le nombre de messages effectivement envoyés.
const RESEND_BATCH_SIZE = 100;

export async function sendBulkEmail(all: EmailMessage[]): Promise<number> {
  if (all.length === 0) return 0;
  const { env } = await getCloudflareContext({ async: true });
  if (!env.RESEND_API_KEY) {
    console.log(
      `[email en masse ignoré — pas de RESEND_API_KEY] ${all.length} destinataires`,
    );
    return 0;
  }
  // Preview : seuls les destinataires autorisés (src/lib/preview-email.ts).
  const messages = all.flatMap((m) => {
    const to = allowedRecipients(env, m.to);
    return to.length > 0 ? [{ ...m, to }] : [];
  });

  let sent = 0;
  for (let i = 0; i < messages.length; i += RESEND_BATCH_SIZE) {
    const chunk = messages.slice(i, i + RESEND_BATCH_SIZE);
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        chunk.map((m) => ({
          from:
            m.from || env.EMAIL_FROM || "Swiss3Design <onboarding@resend.dev>",
          to: m.to,
          subject: m.subject,
          html: m.html,
          ...(m.replyTo ? { reply_to: m.replyTo } : {}),
        })),
      ),
    });
    if (!res.ok) {
      console.error(
        `[email en masse] échec ${res.status}: ${await res.text()}`,
      );
      continue;
    }
    sent += chunk.length;
  }
  return sent;
}

// Destinataires des notifications boutique (ADMIN_EMAILS, séparés par virgule)
export async function getAdminEmails(): Promise<string[]> {
  const { env } = await getCloudflareContext({ async: true });
  return (env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

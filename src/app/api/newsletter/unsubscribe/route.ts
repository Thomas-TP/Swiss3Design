import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { verifyUnsubscribeToken } from "@/lib/newsletter";

// Désabonnement en un clic depuis un e-mail d'annonce, sans connexion requise
// (jeton HMAC signé — voir src/lib/newsletter.ts). Coupe newsletter ET
// nouveautés produits (désabonnement complet, l'interprétation la moins
// surprenante d'un lien « se désabonner »). Composé en français uniquement,
// comme les annonces elles-mêmes.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";

  let ok = false;
  if (userId && token) {
    const { env } = await getCloudflareContext({ async: true });
    if (
      env.BETTER_AUTH_SECRET &&
      (await verifyUnsubscribeToken(userId, token, env.BETTER_AUTH_SECRET))
    ) {
      const db = await getDb();
      await db
        .insert(notificationPreferences)
        .values({ userId, newsletter: false, productNews: false })
        .onConflictDoUpdate({
          target: notificationPreferences.userId,
          set: { newsletter: false, productNews: false, updatedAt: new Date() },
        });
      ok = true;
    }
  }

  const title = ok ? "Désabonnement confirmé" : "Lien invalide";
  const body = ok
    ? "Vous ne recevrez plus la newsletter ni les annonces de nouveaux produits. Vous pouvez modifier vos préférences à tout moment depuis votre compte."
    : "Ce lien de désabonnement n'est plus valable. Vous pouvez gérer vos préférences depuis votre compte.";

  const html = `<!doctype html><html lang="fr"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#fafaf9;color:#1c1917;">
  <div style="max-width:480px;margin:0 auto;padding:64px 20px;text-align:center;">
    <h1 style="font-size:22px;letter-spacing:-0.3px;">${title}</h1>
    <p style="color:#57534e;line-height:1.6;">${body}</p>
    <p style="margin-top:28px;"><a href="/fr/account/notifications" style="display:inline-block;background:#e5231c;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 26px;border-radius:999px;">Gérer mes préférences</a></p>
  </div>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

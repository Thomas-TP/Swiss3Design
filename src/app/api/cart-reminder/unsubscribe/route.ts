import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { abandonedCarts } from "@/db/schema";

const MSG: Record<string, { title: string; body: string; home: string }> = {
  fr: {
    title: "Désinscription confirmée",
    body: "Vous ne recevrez plus de rappel de panier. Vos données de relance ont été supprimées.",
    home: "Retour à la boutique",
  },
  de: {
    title: "Abmeldung bestätigt",
    body: "Sie erhalten keine Warenkorb-Erinnerungen mehr. Ihre Erinnerungsdaten wurden gelöscht.",
    home: "Zurück zum Shop",
  },
  it: {
    title: "Disiscrizione confermata",
    body: "Non riceverai più promemoria del carrello. I tuoi dati di promemoria sono stati eliminati.",
    home: "Torna al negozio",
  },
  en: {
    title: "Unsubscribed",
    body: "You won't receive cart reminders anymore. Your reminder data has been deleted.",
    home: "Back to the shop",
  },
};

// Retrait du consentement (nLPD) : supprime TOUTES les relances de l'e-mail lié
// au token. Page de confirmation autonome (hors layout i18n) dans la langue du
// panier d'origine.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  let locale = "fr";

  if (token) {
    const db = await getDb();
    const [row] = await db
      .select({ email: abandonedCarts.email, locale: abandonedCarts.locale })
      .from(abandonedCarts)
      .where(eq(abandonedCarts.token, token))
      .limit(1);
    if (row) {
      locale = row.locale;
      await db.delete(abandonedCarts).where(eq(abandonedCarts.email, row.email));
    }
  }

  const m = MSG[locale] ?? MSG.fr;
  const html = `<!doctype html><html lang="${locale}"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${m.title}</title></head>
<body style="margin:0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#fafaf9;color:#1c1917;">
  <div style="max-width:480px;margin:0 auto;padding:64px 20px;text-align:center;">
    <h1 style="font-size:22px;letter-spacing:-0.3px;">${m.title}</h1>
    <p style="color:#57534e;line-height:1.6;">${m.body}</p>
    <p style="margin-top:28px;"><a href="/${locale}" style="display:inline-block;background:#e5231c;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 26px;border-radius:999px;">${m.home}</a></p>
  </div>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

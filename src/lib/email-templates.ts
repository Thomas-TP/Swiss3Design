// Templates d'e-mails transactionnels — HTML inline, sobres, aux couleurs du site.
// Chaque template existe en FR/DE/IT/EN et suit la locale du client.

import type { EmailMessage } from "./email";

type Locale = "fr" | "de" | "it" | "en";

function chf(cents: number): string {
  return (cents / 100).toFixed(2) + " CHF";
}

function layout(title: string, body: string, footer: string): string {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
      <span style="display:inline-block;width:28px;height:28px;border-radius:6px;background:#da291c;color:#ffffff;font-weight:900;font-size:15px;line-height:28px;text-align:center;">3</span>
      <span style="font-weight:600;font-size:17px;letter-spacing:-0.2px;">&nbsp;Swiss3Design</span>
    </div>
    <div style="background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 12px;font-size:21px;letter-spacing:-0.3px;">${title}</h1>
      ${body}
    </div>
    <p style="color:#78716c;font-size:12px;line-height:1.6;margin:20px 4px 0;">
      ${footer}<br/>Swiss3Design — Gland, Suisse
    </p>
  </div>
</body>
</html>`;
}

const FOOTER: Record<Locale, string> = {
  fr: "Des questions ? Répondez simplement à cet e-mail.",
  de: "Fragen? Antworten Sie einfach auf diese E-Mail.",
  it: "Domande? Rispondete semplicemente a questa e-mail.",
  en: "Questions? Just reply to this email.",
};

// ── Confirmation de commande ─────────────────────────────────────────────────

interface OrderForEmail {
  orderNumber: string;
  email: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  shippingAddress: string;
  locale: string;
}

interface ItemForEmail {
  nameSnapshot: string;
  priceCentsSnapshot: number;
  quantity: number;
}

const ORDER_TEXTS: Record<
  Locale,
  { subject: string; title: string; intro: string; shipping: string; free: string; total: string; address: string }
> = {
  fr: {
    subject: "Commande {n} confirmée — Swiss3Design",
    title: "Merci pour votre commande ! 🎉",
    intro: "Nous avons bien reçu votre paiement. Votre commande <strong>{n}</strong> part en préparation dans notre atelier de Gland.",
    shipping: "Livraison",
    free: "Offerte",
    total: "Total",
    address: "Adresse de livraison",
  },
  de: {
    subject: "Bestellung {n} bestätigt — Swiss3Design",
    title: "Vielen Dank für Ihre Bestellung! 🎉",
    intro: "Wir haben Ihre Zahlung erhalten. Ihre Bestellung <strong>{n}</strong> wird in unserem Atelier in Gland vorbereitet.",
    shipping: "Versand",
    free: "Gratis",
    total: "Total",
    address: "Lieferadresse",
  },
  it: {
    subject: "Ordine {n} confermato — Swiss3Design",
    title: "Grazie per il vostro ordine! 🎉",
    intro: "Abbiamo ricevuto il pagamento. Il vostro ordine <strong>{n}</strong> è in preparazione nel nostro atelier di Gland.",
    shipping: "Spedizione",
    free: "Gratuita",
    total: "Totale",
    address: "Indirizzo di consegna",
  },
  en: {
    subject: "Order {n} confirmed — Swiss3Design",
    title: "Thank you for your order! 🎉",
    intro: "We've received your payment. Your order <strong>{n}</strong> is now being prepared in our Gland workshop.",
    shipping: "Shipping",
    free: "Free",
    total: "Total",
    address: "Shipping address",
  },
};

export function orderConfirmationEmail(
  order: OrderForEmail,
  items: ItemForEmail[],
): EmailMessage {
  const locale = (["fr", "de", "it", "en"].includes(order.locale)
    ? order.locale
    : "fr") as Locale;
  const t = ORDER_TEXTS[locale];

  let address = { name: "", street: "", npa: "", city: "" };
  try {
    address = { ...address, ...JSON.parse(order.shippingAddress) };
  } catch {
    // adresse illisible — section omise
  }

  const rows = items
    .map(
      (it) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">${it.quantity} × ${it.nameSnapshot}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;text-align:right;white-space:nowrap;">${chf(it.priceCentsSnapshot * it.quantity)}</td>
      </tr>`,
    )
    .join("");

  const body = `
    <p style="margin:0 0 18px;color:#44403c;line-height:1.6;">${t.intro.replace("{n}", order.orderNumber)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows}
      <tr>
        <td style="padding:8px 0;color:#78716c;">${t.shipping}</td>
        <td style="padding:8px 0;text-align:right;color:${order.shippingCents === 0 ? "#059669" : "#1c1917"};">
          ${order.shippingCents === 0 ? t.free : chf(order.shippingCents)}
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;font-weight:700;border-top:2px solid #1c1917;">${t.total}</td>
        <td style="padding:10px 0;text-align:right;font-weight:700;border-top:2px solid #1c1917;">${chf(order.totalCents)}</td>
      </tr>
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#78716c;">
      <strong style="color:#1c1917;">${t.address}</strong><br/>
      ${address.name}<br/>${address.street}<br/>${address.npa} ${address.city}, CH
    </p>`;

  return {
    to: order.email,
    subject: t.subject.replace("{n}", order.orderNumber),
    html: layout(t.title, body, FOOTER[locale]),
  };
}

// ── Commande expédiée ────────────────────────────────────────────────────────

const SHIPPED_TEXTS: Record<
  Locale,
  { subject: string; title: string; body: string }
> = {
  fr: {
    subject: "Votre commande {n} est en route 📦",
    title: "C'est parti !",
    body: "Votre commande <strong>{n}</strong> a été remise à la Poste suisse. Elle arrive chez vous d'ici 1 à 3 jours ouvrés.",
  },
  de: {
    subject: "Ihre Bestellung {n} ist unterwegs 📦",
    title: "Es geht los!",
    body: "Ihre Bestellung <strong>{n}</strong> wurde der Schweizer Post übergeben. Sie erreicht Sie in 1–3 Werktagen.",
  },
  it: {
    subject: "Il vostro ordine {n} è in viaggio 📦",
    title: "Si parte!",
    body: "Il vostro ordine <strong>{n}</strong> è stato consegnato alla Posta svizzera. Arriverà entro 1–3 giorni lavorativi.",
  },
  en: {
    subject: "Your order {n} is on its way 📦",
    title: "It's on the move!",
    body: "Your order <strong>{n}</strong> has been handed to Swiss Post. It will reach you within 1–3 business days.",
  },
};

export function orderShippedEmail(order: OrderForEmail): EmailMessage {
  const locale = (["fr", "de", "it", "en"].includes(order.locale)
    ? order.locale
    : "fr") as Locale;
  const t = SHIPPED_TEXTS[locale];
  const body = `<p style="margin:0;color:#44403c;line-height:1.6;">${t.body.replace("{n}", order.orderNumber)}</p>`;
  return {
    to: order.email,
    subject: t.subject.replace("{n}", order.orderNumber),
    html: layout(t.title, body, FOOTER[locale]),
  };
}

// ── Réponse à une demande de devis ───────────────────────────────────────────

const QUOTE_TEXTS: Record<
  Locale,
  { subject: string; title: string; intro: string; price: string; note: string; cta: string }
> = {
  fr: {
    subject: "Votre devis Swiss3Design est prêt",
    title: "Votre devis est prêt ✨",
    intro: "Nous avons étudié votre projet d'impression sur mesure. Voici notre proposition :",
    price: "Prix proposé",
    note: "Notre message",
    cta: "Pour accepter ce devis ou poser une question, répondez simplement à cet e-mail. Vous retrouvez aussi ce devis dans votre espace client.",
  },
  de: {
    subject: "Ihre Swiss3Design-Offerte ist bereit",
    title: "Ihre Offerte ist bereit ✨",
    intro: "Wir haben Ihr Projekt geprüft. Hier unser Vorschlag:",
    price: "Angebotener Preis",
    note: "Unsere Nachricht",
    cta: "Um die Offerte anzunehmen oder Fragen zu stellen, antworten Sie einfach auf diese E-Mail. Sie finden die Offerte auch in Ihrem Kundenkonto.",
  },
  it: {
    subject: "Il vostro preventivo Swiss3Design è pronto",
    title: "Il vostro preventivo è pronto ✨",
    intro: "Abbiamo esaminato il vostro progetto. Ecco la nostra proposta:",
    price: "Prezzo proposto",
    note: "Il nostro messaggio",
    cta: "Per accettare il preventivo o fare domande, rispondete a questa e-mail. Lo trovate anche nel vostro account cliente.",
  },
  en: {
    subject: "Your Swiss3Design quote is ready",
    title: "Your quote is ready ✨",
    intro: "We've reviewed your custom printing project. Here is our proposal:",
    price: "Quoted price",
    note: "Our message",
    cta: "To accept this quote or ask a question, simply reply to this email. You can also find it in your customer account.",
  },
};

export function quoteReplyEmail(quote: {
  email: string;
  locale: string;
  quotedPriceCents: number | null;
  adminMessage: string | null;
}): EmailMessage {
  const locale = (["fr", "de", "it", "en"].includes(quote.locale)
    ? quote.locale
    : "fr") as Locale;
  const t = QUOTE_TEXTS[locale];
  const body = `
    <p style="margin:0 0 16px;color:#44403c;line-height:1.6;">${t.intro}</p>
    ${
      quote.quotedPriceCents != null
        ? `<p style="margin:0 0 16px;font-size:15px;">${t.price} :
            <strong style="font-size:19px;">${chf(quote.quotedPriceCents)}</strong></p>`
        : ""
    }
    ${
      quote.adminMessage
        ? `<p style="margin:0 0 16px;padding:12px 16px;background:#fafaf9;border-radius:10px;color:#44403c;line-height:1.6;">
            <strong style="color:#1c1917;">${t.note} :</strong><br/>${quote.adminMessage}</p>`
        : ""
    }
    <p style="margin:0;font-size:13px;color:#78716c;line-height:1.6;">${t.cta}</p>`;
  return {
    to: quote.email,
    subject: t.subject,
    html: layout(t.title, body, FOOTER[locale]),
  };
}

// ── Réinitialisation du mot de passe (FR + EN, locale inconnue) ──────────────

export function resetPasswordEmail(to: string, url: string): EmailMessage {
  const body = `
    <p style="margin:0 0 18px;color:#44403c;line-height:1.6;">
      Vous avez demandé à réinitialiser votre mot de passe Swiss3Design.
      Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
      Ce lien expire dans une heure.
    </p>
    <p style="margin:0 0 18px;text-align:center;">
      <a href="${url}" style="display:inline-block;background:#da291c;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 28px;border-radius:999px;">
        Réinitialiser mon mot de passe
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#78716c;line-height:1.6;">
      You requested a password reset — click the button above (link expires in 1 hour).<br/>
      Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail :
      votre mot de passe reste inchangé.
    </p>`;
  return {
    to,
    subject: "Réinitialisation de votre mot de passe — Swiss3Design",
    html: layout("Nouveau mot de passe", body, FOOTER.fr),
  };
}

// ── Vérification d'adresse e-mail (FR + EN, locale inconnue à l'inscription) ─

export function verificationEmail(to: string, url: string): EmailMessage {
  const body = `
    <p style="margin:0 0 18px;color:#44403c;line-height:1.6;">
      Bienvenue chez Swiss3Design ! Cliquez sur le bouton ci-dessous pour confirmer
      votre adresse e-mail et activer votre compte.
    </p>
    <p style="margin:0 0 18px;text-align:center;">
      <a href="${url}" style="display:inline-block;background:#da291c;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 28px;border-radius:999px;">
        Confirmer mon e-mail
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#78716c;line-height:1.6;">
      Welcome to Swiss3Design! Click the button above to confirm your email address.<br/>
      Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.
    </p>`;
  return {
    to,
    subject: "Confirmez votre e-mail — Swiss3Design",
    html: layout("Confirmez votre adresse", body, FOOTER.fr),
  };
}

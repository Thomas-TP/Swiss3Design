// Templates d'e-mails transactionnels — HTML inline, sobres, aux couleurs du site.
// Chaque template existe en FR/DE/IT/EN et suit la locale du client.

import type { EmailMessage } from "./email";

type Locale = "fr" | "de" | "it" | "en";

// Expéditeurs : commandes@ pour tout ce qui touche aux ventes,
// contact@ pour le compte client et les devis.
const FROM_ORDERS = "Swiss3Design <commandes@swiss3design.ch>";
const FROM_CONTACT = "Swiss3Design <contact@swiss3design.ch>";
const SITE_URL = "https://swiss3design.ch";

// Suivi Poste suisse
function trackingUrl(trackingNumber: string): string {
  return `https://service.post.ch/ekp-web/ui/entry/search/${encodeURIComponent(trackingNumber)}`;
}

function button(href: string, label: string): string {
  return `<p style="margin:0 0 18px;text-align:center;">
      <a href="${href}" style="display:inline-block;background:#da291c;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 28px;border-radius:999px;">${label}</a>
    </p>`;
}

function chf(cents: number): string {
  return (cents / 100).toFixed(2) + " CHF";
}

// Échappe le contenu saisi par le client avant injection dans le HTML
function esc(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    from: FROM_ORDERS,
    subject: t.subject.replace("{n}", order.orderNumber),
    html: layout(t.title, body, FOOTER[locale]),
  };
}

// ── Commande expédiée ────────────────────────────────────────────────────────

const SHIPPED_TEXTS: Record<
  Locale,
  { subject: string; title: string; body: string; tracking: string; track: string }
> = {
  fr: {
    subject: "Votre commande {n} est en route 📦",
    title: "C'est parti !",
    body: "Votre commande <strong>{n}</strong> a été remise à la Poste suisse. Elle arrive chez vous d'ici 1 à 3 jours ouvrés.",
    tracking: "Numéro de suivi",
    track: "Suivre mon colis",
  },
  de: {
    subject: "Ihre Bestellung {n} ist unterwegs 📦",
    title: "Es geht los!",
    body: "Ihre Bestellung <strong>{n}</strong> wurde der Schweizer Post übergeben. Sie erreicht Sie in 1–3 Werktagen.",
    tracking: "Sendungsnummer",
    track: "Paket verfolgen",
  },
  it: {
    subject: "Il vostro ordine {n} è in viaggio 📦",
    title: "Si parte!",
    body: "Il vostro ordine <strong>{n}</strong> è stato consegnato alla Posta svizzera. Arriverà entro 1–3 giorni lavorativi.",
    tracking: "Numero di tracciamento",
    track: "Seguire il pacco",
  },
  en: {
    subject: "Your order {n} is on its way 📦",
    title: "It's on the move!",
    body: "Your order <strong>{n}</strong> has been handed to Swiss Post. It will reach you within 1–3 business days.",
    tracking: "Tracking number",
    track: "Track my parcel",
  },
};

export function orderShippedEmail(
  order: OrderForEmail,
  trackingNumber?: string | null,
): EmailMessage {
  const locale = (["fr", "de", "it", "en"].includes(order.locale)
    ? order.locale
    : "fr") as Locale;
  const t = SHIPPED_TEXTS[locale];
  const tracking = trackingNumber
    ? `<p style="margin:18px 0 6px;text-align:center;font-size:13px;color:#78716c;">${t.tracking}</p>
      <p style="margin:0 0 16px;text-align:center;">
        <span style="display:inline-block;background:#fafaf9;border:1px solid #e7e5e4;border-radius:10px;padding:10px 20px;font-size:16px;font-weight:700;letter-spacing:1px;">${trackingNumber}</span>
      </p>
      ${button(trackingUrl(trackingNumber), t.track)}`
    : "";
  const body = `<p style="margin:0;color:#44403c;line-height:1.6;">${t.body.replace("{n}", order.orderNumber)}</p>${tracking}`;
  return {
    to: order.email,
    from: FROM_ORDERS,
    subject: t.subject.replace("{n}", order.orderNumber),
    html: layout(t.title, body, FOOTER[locale]),
  };
}

// ── Commande livrée ──────────────────────────────────────────────────────────

const DELIVERED_TEXTS: Record<
  Locale,
  { subject: string; title: string; body: string; feedback: string }
> = {
  fr: {
    subject: "Votre commande {n} a été livrée ✅",
    title: "Bien arrivée !",
    body: "Votre commande <strong>{n}</strong> a été livrée. Nous espérons que vos impressions vous plaisent !",
    feedback: "Un souci avec un article ? Une remarque ? Répondez simplement à cet e-mail, nous trouvons toujours une solution.",
  },
  de: {
    subject: "Ihre Bestellung {n} wurde zugestellt ✅",
    title: "Gut angekommen!",
    body: "Ihre Bestellung <strong>{n}</strong> wurde zugestellt. Wir hoffen, Ihre Drucke gefallen Ihnen!",
    feedback: "Ein Problem mit einem Artikel? Eine Anmerkung? Antworten Sie einfach auf diese E-Mail — wir finden immer eine Lösung.",
  },
  it: {
    subject: "Il vostro ordine {n} è stato consegnato ✅",
    title: "Arrivato a destinazione!",
    body: "Il vostro ordine <strong>{n}</strong> è stato consegnato. Speriamo che le vostre stampe vi piacciano!",
    feedback: "Un problema con un articolo? Un'osservazione? Rispondete a questa e-mail — troviamo sempre una soluzione.",
  },
  en: {
    subject: "Your order {n} has been delivered ✅",
    title: "Safely delivered!",
    body: "Your order <strong>{n}</strong> has been delivered. We hope you love your prints!",
    feedback: "An issue with an item? Any feedback? Just reply to this email — we always find a solution.",
  },
};

export function orderDeliveredEmail(order: OrderForEmail): EmailMessage {
  const locale = (["fr", "de", "it", "en"].includes(order.locale)
    ? order.locale
    : "fr") as Locale;
  const t = DELIVERED_TEXTS[locale];
  const body = `
    <p style="margin:0 0 16px;color:#44403c;line-height:1.6;">${t.body.replace("{n}", order.orderNumber)}</p>
    <p style="margin:0;font-size:13px;color:#78716c;line-height:1.6;">${t.feedback}</p>`;
  return {
    to: order.email,
    from: FROM_ORDERS,
    subject: t.subject.replace("{n}", order.orderNumber),
    html: layout(t.title, body, FOOTER[locale]),
  };
}

// ── Commande annulée / remboursée ────────────────────────────────────────────

const CANCELLED_TEXTS: Record<
  Locale,
  { subject: string; title: string; body: string; refund: string }
> = {
  fr: {
    subject: "Votre commande {n} a été annulée",
    title: "Commande annulée",
    body: "Votre commande <strong>{n}</strong> a été annulée.",
    refund: "Si vous aviez déjà payé, le montant est remboursé sur votre moyen de paiement d'origine — il apparaît généralement sous 5 à 10 jours ouvrés.",
  },
  de: {
    subject: "Ihre Bestellung {n} wurde storniert",
    title: "Bestellung storniert",
    body: "Ihre Bestellung <strong>{n}</strong> wurde storniert.",
    refund: "Falls Sie bereits bezahlt haben, wird der Betrag auf Ihr ursprüngliches Zahlungsmittel zurückerstattet — in der Regel innerhalb von 5–10 Werktagen sichtbar.",
  },
  it: {
    subject: "Il vostro ordine {n} è stato annullato",
    title: "Ordine annullato",
    body: "Il vostro ordine <strong>{n}</strong> è stato annullato.",
    refund: "Se avevate già pagato, l'importo viene rimborsato sul vostro metodo di pagamento originale — di solito appare entro 5–10 giorni lavorativi.",
  },
  en: {
    subject: "Your order {n} has been cancelled",
    title: "Order cancelled",
    body: "Your order <strong>{n}</strong> has been cancelled.",
    refund: "If you had already paid, the amount is refunded to your original payment method — it usually shows up within 5–10 business days.",
  },
};

export function orderCancelledEmail(order: OrderForEmail): EmailMessage {
  const locale = (["fr", "de", "it", "en"].includes(order.locale)
    ? order.locale
    : "fr") as Locale;
  const t = CANCELLED_TEXTS[locale];
  const body = `
    <p style="margin:0 0 16px;color:#44403c;line-height:1.6;">${t.body.replace("{n}", order.orderNumber)}</p>
    <p style="margin:0;font-size:13px;color:#78716c;line-height:1.6;">${t.refund}</p>`;
  return {
    to: order.email,
    from: FROM_ORDERS,
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
    from: FROM_CONTACT,
    subject: t.subject,
    html: layout(t.title, body, FOOTER[locale]),
  };
}

// ── Devis refusé ─────────────────────────────────────────────────────────────

const QUOTE_REJECTED_TEXTS: Record<
  Locale,
  { subject: string; title: string; intro: string; reason: string; outro: string }
> = {
  fr: {
    subject: "Votre demande de devis — Swiss3Design",
    title: "Concernant votre demande de devis",
    intro: "Merci pour l'intérêt que vous portez à Swiss3Design. Après étude attentive de votre projet, nous ne sommes malheureusement pas en mesure d'y donner suite.",
    reason: "Notre message",
    outro: "Cela ne remet pas en cause vos futurs projets : n'hésitez pas à nous soumettre une nouvelle demande, nous l'étudierons avec plaisir. Pour toute question, répondez simplement à cet e-mail.",
  },
  de: {
    subject: "Ihre Offerten-Anfrage — Swiss3Design",
    title: "Zu Ihrer Offerten-Anfrage",
    intro: "Vielen Dank für Ihr Interesse an Swiss3Design. Nach sorgfältiger Prüfung Ihres Projekts können wir Ihre Anfrage leider nicht umsetzen.",
    reason: "Unsere Nachricht",
    outro: "Das gilt nicht für künftige Projekte: Reichen Sie gerne eine neue Anfrage ein — wir prüfen sie mit Freude. Bei Fragen antworten Sie einfach auf diese E-Mail.",
  },
  it: {
    subject: "La vostra richiesta di preventivo — Swiss3Design",
    title: "Riguardo alla vostra richiesta",
    intro: "Grazie per l'interesse verso Swiss3Design. Dopo un attento esame del vostro progetto, purtroppo non siamo in grado di realizzarlo.",
    reason: "Il nostro messaggio",
    outro: "Questo non vale per i progetti futuri: non esitate a inviarci una nuova richiesta, la esamineremo con piacere. Per qualsiasi domanda, rispondete a questa e-mail.",
  },
  en: {
    subject: "Your quote request — Swiss3Design",
    title: "About your quote request",
    intro: "Thank you for your interest in Swiss3Design. After carefully reviewing your project, we are unfortunately unable to take it on.",
    reason: "Our message",
    outro: "This doesn't apply to future projects: feel free to submit a new request and we'll gladly review it. For any question, just reply to this email.",
  },
};

export function quoteRejectedEmail(quote: {
  email: string;
  locale: string;
  adminMessage: string | null;
}): EmailMessage {
  const locale = (["fr", "de", "it", "en"].includes(quote.locale)
    ? quote.locale
    : "fr") as Locale;
  const t = QUOTE_REJECTED_TEXTS[locale];
  const body = `
    <p style="margin:0 0 16px;color:#44403c;line-height:1.6;">${t.intro}</p>
    ${
      quote.adminMessage
        ? `<p style="margin:0 0 16px;padding:12px 16px;background:#fafaf9;border-radius:10px;color:#44403c;line-height:1.6;">
            <strong style="color:#1c1917;">${t.reason} :</strong><br/>${quote.adminMessage}</p>`
        : ""
    }
    <p style="margin:0;font-size:13px;color:#78716c;line-height:1.6;">${t.outro}</p>`;
  return {
    to: quote.email,
    from: FROM_CONTACT,
    subject: t.subject,
    html: layout(t.title, body, FOOTER[locale]),
  };
}

// ── Notifications admin (toujours en français) ───────────────────────────────

export function adminNewOrderEmail(
  order: OrderForEmail & { id: string },
  items: ItemForEmail[],
  adminEmails: string[],
  lowStock: { name: string; stock: number }[] = [],
): EmailMessage {
  let address = { name: "", street: "", npa: "", city: "" };
  try {
    address = { ...address, ...JSON.parse(order.shippingAddress) };
  } catch {
    // adresse illisible — section omise
  }

  const rows = items
    .map(
      (it) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">${it.quantity} × ${esc(it.nameSnapshot)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;text-align:right;white-space:nowrap;">${chf(it.priceCentsSnapshot * it.quantity)}</td>
      </tr>`,
    )
    .join("");

  const stockAlert =
    lowStock.length > 0
      ? `<p style="margin:18px 0 0;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#92400e;line-height:1.7;">
          <strong>⚠ Stock bas après cette commande :</strong><br/>
          ${lowStock.map((p) => `${p.name} — ${p.stock} restant(s)`).join("<br/>")}
        </p>`
      : "";

  const body = `
    <p style="margin:0 0 18px;color:#44403c;line-height:1.6;">
      Nouvelle commande payée de <strong>${esc(order.email)}</strong> (langue : ${order.locale.toUpperCase()}).
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows}
      <tr>
        <td style="padding:8px 0;color:#78716c;">Livraison</td>
        <td style="padding:8px 0;text-align:right;">${order.shippingCents === 0 ? "Offerte" : chf(order.shippingCents)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;font-weight:700;border-top:2px solid #1c1917;">Total</td>
        <td style="padding:10px 0;text-align:right;font-weight:700;border-top:2px solid #1c1917;">${chf(order.totalCents)}</td>
      </tr>
    </table>
    <p style="margin:20px 0 18px;font-size:13px;color:#78716c;">
      <strong style="color:#1c1917;">Livraison à</strong><br/>
      ${esc(address.name)}<br/>${esc(address.street)}<br/>${esc(address.npa)} ${esc(address.city)}, CH
    </p>
    ${button(`${SITE_URL}/fr/admin/orders/${order.id}`, "Voir la commande")}
    ${stockAlert}`;

  return {
    to: adminEmails,
    from: FROM_ORDERS,
    replyTo: order.email,
    subject: `🛒 Nouvelle commande ${order.orderNumber} — ${chf(order.totalCents)}`,
    html: layout(`Nouvelle commande ${order.orderNumber}`, body, "Notification interne Swiss3Design — répondre écrit directement au client."),
  };
}

export function adminNewQuoteEmail(
  quote: {
    id: string;
    email: string;
    description: string;
    material: string | null;
    colors: string | null;
    dimensions: string | null;
    fileName: string | null;
    locale: string;
  },
  adminEmails: string[],
): EmailMessage {
  const specs = [
    ["Matière", quote.material],
    ["Couleurs", quote.colors],
    ["Dimensions", quote.dimensions],
    ["Fichier 3D", quote.fileName],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const body = `
    <p style="margin:0 0 16px;color:#44403c;line-height:1.6;">
      Nouvelle demande de devis de <strong>${esc(quote.email)}</strong> (langue : ${quote.locale.toUpperCase()}).
    </p>
    <p style="margin:0 0 16px;padding:12px 16px;background:#fafaf9;border-radius:10px;color:#44403c;line-height:1.6;white-space:pre-wrap;">${esc(quote.description)}</p>
    ${
      specs.length > 0
        ? `<table style="border-collapse:collapse;font-size:13px;color:#44403c;margin:0 0 18px;">
            ${specs.map(([k, v]) => `<tr><td style="padding:3px 16px 3px 0;color:#78716c;">${k}</td><td style="padding:3px 0;">${esc(v)}</td></tr>`).join("")}
          </table>`
        : ""
    }
    ${button(`${SITE_URL}/fr/admin/quotes/${quote.id}`, "Chiffrer le devis")}`;

  return {
    to: adminEmails,
    from: FROM_CONTACT,
    replyTo: quote.email,
    subject: `📐 Nouvelle demande de devis — ${quote.email}`,
    html: layout("Nouvelle demande de devis", body, "Notification interne Swiss3Design — répondre écrit directement au client."),
  };
}

// ── Code de vérification d'e-mail au checkout (commande sans compte) ─────────

const CHECKOUT_CODE_TEXTS: Record<
  Locale,
  { subject: string; title: string; intro: string; expiry: string }
> = {
  fr: {
    subject: "{code} — votre code de vérification Swiss3Design",
    title: "Votre code de vérification",
    intro: "Saisissez ce code sur la page de commande pour confirmer votre adresse e-mail :",
    expiry: "Ce code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
  },
  de: {
    subject: "{code} — Ihr Swiss3Design-Bestätigungscode",
    title: "Ihr Bestätigungscode",
    intro: "Geben Sie diesen Code auf der Bestellseite ein, um Ihre E-Mail-Adresse zu bestätigen:",
    expiry: "Dieser Code läuft in 10 Minuten ab. Falls Sie das nicht angefordert haben, ignorieren Sie diese E-Mail.",
  },
  it: {
    subject: "{code} — il vostro codice di verifica Swiss3Design",
    title: "Il vostro codice di verifica",
    intro: "Inserite questo codice nella pagina dell'ordine per confermare il vostro indirizzo e-mail:",
    expiry: "Questo codice scade tra 10 minuti. Se non avete richiesto nulla, ignorate questa e-mail.",
  },
  en: {
    subject: "{code} — your Swiss3Design verification code",
    title: "Your verification code",
    intro: "Enter this code on the checkout page to confirm your email address:",
    expiry: "This code expires in 10 minutes. If you didn't request it, you can ignore this email.",
  },
};

export function checkoutCodeEmail(
  to: string,
  code: string,
  locale: string,
): EmailMessage {
  const l = (["fr", "de", "it", "en"].includes(locale) ? locale : "fr") as Locale;
  const t = CHECKOUT_CODE_TEXTS[l];
  const body = `
    <p style="margin:0 0 18px;color:#44403c;line-height:1.6;">${t.intro}</p>
    <p style="margin:0 0 18px;text-align:center;">
      <span style="display:inline-block;background:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;padding:14px 28px;font-size:30px;font-weight:700;letter-spacing:8px;font-variant-numeric:tabular-nums;">${code}</span>
    </p>
    <p style="margin:0;font-size:12px;color:#78716c;line-height:1.6;">${t.expiry}</p>`;
  return {
    to,
    from: FROM_ORDERS,
    subject: t.subject.replace("{code}", code),
    html: layout(t.title, body, FOOTER[l]),
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
    from: FROM_CONTACT,
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
    from: FROM_CONTACT,
    subject: "Confirmez votre e-mail — Swiss3Design",
    html: layout("Confirmez votre adresse", body, FOOTER.fr),
  };
}

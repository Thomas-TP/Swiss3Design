// Templates d'e-mails transactionnels — HTML inline, sobres, aux couleurs du site.
// Chaque template existe en FR/DE/IT/EN et suit la locale du client.

import { readStudioOrderLine } from "@/lib/studio/order-line";
import type { EmailMessage } from "./email";

type Locale = "fr" | "de" | "it" | "en";

// Expéditeurs (tableau d'adresses du 09.10.2026, domaine kreya.ch vérifié chez
// Resend) : chaque usage a son adresse, toutes reçues par le routage e-mail
// Cloudflare (catch-all *@kreya.ch) : une réponse du client arrive toujours.
const FROM_ORDERS = "Kreya <shop@kreya.ch>";
const FROM_ACCOUNT = "Kreya <account@kreya.ch>";
const FROM_STUDIO = "Kreya <studio@kreya.ch>";
const FROM_NEWS = "Kreya <news@kreya.ch>";
const FROM_CONTACT = "Kreya <contact@kreya.ch>";
const SITE_URL = "https://kreya.ch";

// Suivi Poste suisse
function trackingUrl(trackingNumber: string): string {
  return `https://service.post.ch/ekp-web/ui/entry/search/${encodeURIComponent(trackingNumber)}`;
}

// Liens vers le site dans les e-mails clients (relance panier, devis,
// newsletter) : marqués utm_* pour que la mesure d'audience classe ces
// retours dans le canal « Email », campagne par campagne, au lieu de
// « Direct ». Jamais sur les liens d'authentification (jetons) ni vers
// d'autres sites.
export function withUtm(url: string, campaign: string): string {
  if (!url.startsWith(`${SITE_URL}/`)) return url;
  const target = new URL(url);
  target.searchParams.set("utm_source", "kreya");
  target.searchParams.set("utm_medium", "email");
  target.searchParams.set("utm_campaign", campaign);
  return target.toString();
}

function button(href: string, label: string): string {
  return `<p style="margin:0 0 18px;text-align:center;">
      <a href="${href}" style="display:inline-block;background:#e5231c;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 28px;border-radius:999px;">${label}</a>
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
  // Mode sombre e-mail : on assombrit le chrome de la page et on garde la
  // carte blanche (toujours lisible quel que soit le client mail). Le logo
  // (rouge de marque, sans blanc/noir) reste identique dans les deux modes.
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<style>
  @media (prefers-color-scheme: dark) {
    .s3d-body { background:#0c0a09 !important; }
    .s3d-brand { color:#fafaf9 !important; }
    .s3d-footer { color:#a8a29e !important; }
  }
</style>
</head>
<body class="s3d-body" style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td style="padding-right:9px;line-height:0;vertical-align:middle;">
          <img src="${SITE_URL}/brand/png/icon-64.png" alt="" width="30" height="30" style="display:block;border:0;outline:none;width:30px;height:30px;object-fit:contain;" />
        </td>
        <td class="s3d-brand" style="vertical-align:middle;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;letter-spacing:-0.2px;color:#1c1917;">
          <span style="font-weight:800;letter-spacing:-0.4px;">Kreya</span>
        </td>
      </tr>
    </table>
    <div style="background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 12px;font-size:21px;letter-spacing:-0.3px;">${title}</h1>
      ${body}
    </div>
    <p class="s3d-footer" style="color:#78716c;font-size:12px;line-height:1.6;margin:20px 4px 0;">
      ${footer}<br/>Kreya — Gland, Suisse
    </p>
  </div>
</body>
</html>`;
}

const FOOTER: Record<Locale, string> = {
  fr: "Des questions ? Répondez simplement à cet e-mail.",
  de: "Fragen? Antworten Sie einfach auf diese E-Mail.",
  it: "Domande? Risponda semplicemente a questa e-mail.",
  en: "Questions? Just reply to this email.",
};

// ── Relance de panier abandonné (opt-in nLPD) ────────────────────────────────

interface CartReminderItem {
  name: string;
  quantity: number;
  priceCents: number;
}

const CART_REMINDER_TEXTS: Record<
  Locale,
  {
    subject: string;
    title: string;
    intro: string;
    cta: string;
    outro: string;
    unsubscribe: string;
    consentNote: string;
  }
> = {
  fr: {
    subject: "Votre panier vous attend",
    title: "Vous avez oublié quelque chose ?",
    intro:
      "Votre sélection est toujours là — reprenez votre commande quand vous voulez :",
    cta: "Reprendre mon panier",
    outro: "Les articles restent disponibles dans la limite des stocks.",
    unsubscribe: "Ne plus recevoir de rappel",
    consentNote:
      "Vous recevez cet e-mail car vous avez demandé un rappel de votre panier.",
  },
  de: {
    subject: "Ihr Warenkorb wartet auf Sie",
    title: "Haben Sie etwas vergessen?",
    intro:
      "Ihre Auswahl ist noch da — setzen Sie Ihre Bestellung fort, wann Sie möchten:",
    cta: "Zum Warenkorb",
    outro: "Die Artikel bleiben verfügbar, solange der Vorrat reicht.",
    unsubscribe: "Keine Erinnerungen mehr erhalten",
    consentNote:
      "Sie erhalten diese E-Mail, weil Sie eine Erinnerung an Ihren Warenkorb angefordert haben.",
  },
  it: {
    subject: "Il Suo carrello La aspetta",
    title: "Ha dimenticato qualcosa?",
    intro: "La Sua selezione è ancora qui — riprenda l'ordine quando vuole:",
    cta: "Riprendi il carrello",
    outro: "Gli articoli restano disponibili fino a esaurimento scorte.",
    unsubscribe: "Non ricevere più promemoria",
    consentNote:
      "Riceve questa e-mail perché ha richiesto un promemoria del carrello.",
  },
  en: {
    subject: "Your cart is waiting",
    title: "Did you forget something?",
    intro:
      "Your selection is still here — pick up where you left off whenever you like:",
    cta: "Back to my cart",
    outro: "Items remain available while stocks last.",
    unsubscribe: "Stop receiving reminders",
    consentNote: "You're receiving this because you asked for a cart reminder.",
  },
};

export function abandonedCartEmail(params: {
  to: string;
  items: CartReminderItem[];
  locale: string;
  cartUrl: string;
  unsubscribeUrl: string;
}): EmailMessage {
  const loc = (
    ["fr", "de", "it", "en"].includes(params.locale) ? params.locale : "fr"
  ) as Locale;
  const t = CART_REMINDER_TEXTS[loc];
  const rows = params.items
    .map(
      (it) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">${it.quantity} × ${esc(it.name)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;text-align:right;white-space:nowrap;">${chf(it.priceCents * it.quantity)}</td>
      </tr>`,
    )
    .join("");
  const body = `
    <p style="margin:0 0 18px;color:#44403c;line-height:1.6;">${t.intro}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;font-size:14px;color:#1c1917;">
      ${rows}
    </table>
    ${button(withUtm(params.cartUrl, "cart_reminder"), t.cta)}
    <p style="margin:0;font-size:13px;color:#78716c;line-height:1.6;">${t.outro}</p>`;
  const footer = `${t.consentNote}<br/><a href="${params.unsubscribeUrl}" style="color:#78716c;text-decoration:underline;">${t.unsubscribe}</a>`;
  return {
    to: params.to,
    from: FROM_ORDERS,
    subject: t.subject,
    html: layout(t.title, body, footer),
  };
}

// ── Objets du Studio dans les e-mails de commande ────────────────────────────
// Le libellé d'une ligne (nameSnapshot) n'a aucun texte saisi. Les textes à
// imprimer, eux, sont affichés au CLIENT dans sa confirmation (il repère une
// faute avant l'impression) et à l'ATELIER dans la notification : toujours
// échappés (`esc`), ce sont des chaînes saisies librement.
const STUDIO_FIELD_LABELS: Record<Locale, Record<string, string>> = {
  fr: {
    name: "Nom",
    role: "Fonction",
    line1: "Ligne 1",
    line2: "Ligne 2",
    peak: "Nom de la montagne",
    text: "Texte",
  },
  de: {
    name: "Name",
    role: "Funktion",
    line1: "Zeile 1",
    line2: "Zeile 2",
    peak: "Name des Bergs",
    text: "Text",
  },
  it: {
    name: "Nome",
    role: "Funzione",
    line1: "Riga 1",
    line2: "Riga 2",
    peak: "Nome della montagna",
    text: "Testo",
  },
  en: {
    name: "Name",
    role: "Role",
    line1: "Line 1",
    line2: "Line 2",
    peak: "Mountain name",
    text: "Text",
  },
};

const STUDIO_ORDER_NOTE: Record<Locale, string> = {
  fr: "Les objets du Studio sont fabriqués sur commande. Un humain de l'atelier relit chaque texte avant l'impression ; si un texte est refusé (marque de tiers, injure, contenu illicite), la commande est annulée et vous êtes remboursé intégralement.",
  de: "Studio-Objekte werden auf Bestellung gefertigt. Ein Mitarbeiter der Werkstatt liest jeden Text vor dem Druck gegen; wird ein Text abgelehnt (Fremdmarke, Beleidigung, rechtswidriger Inhalt), wird die Bestellung storniert und Ihnen der volle Betrag erstattet.",
  it: "Gli oggetti dello Studio sono realizzati su ordinazione. Una persona del laboratorio rilegge ogni testo prima della stampa; se un testo viene rifiutato (marchio di terzi, ingiuria, contenuto illecito), l'ordine è annullato e Lei è rimborsato integralmente.",
  en: "Studio objects are made to order. A person at the workshop reads every text before printing; if a text is refused (third-party brand, insult, unlawful content), the order is cancelled and you are refunded in full.",
};

/** Textes à imprimer d'une ligne du Studio (échappés), ou "" si la ligne n'en porte pas. */
function studioTextsHtml(item: ItemForEmail, locale: Locale): string {
  const studio = readStudioOrderLine(item.studio);
  if (!studio) return "";
  const labels = STUDIO_FIELD_LABELS[locale];
  const parts = Object.entries(studio.texts)
    .filter(([, value]) => typeof value === "string" && value)
    .map(
      ([field, value]) =>
        `${esc(labels[field] ?? field)} : « ${esc(String(value))} »`,
    );
  return parts.length
    ? `<br/><span style="font-size:12px;color:#78716c;">${parts.join(" · ")}</span>`
    : "";
}

const hasStudio = (items: ItemForEmail[]) =>
  items.some((item) => readStudioOrderLine(item.studio) !== null);

// ── Confirmation de commande ─────────────────────────────────────────────────

interface OrderForEmail {
  orderNumber: string;
  email: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents?: number;
  discountCode?: string | null;
  totalCents: number;
  shippingAddress: string;
  locale: string;
  channel?: string | null;
  agentName?: string | null;
  adminNote?: string | null;
}

// Canal de vente, pour l'admin (toujours en français).
const CHANNEL_LABELS: Record<string, string> = {
  stripe_acs: "Agent IA via Stripe (Agentic Commerce Suite)",
  mpp: "Agent IA — paiement machine (MPP)",
  acp: "Agent IA — protocole ACP",
  ucp: "Agent IA — protocole UCP",
  x402: "Agent IA — x402 (stablecoin)",
};

interface ItemForEmail {
  /** `order_items.studio` (jsonb) : l'objet du Studio acheté, ou null. */
  studio?: unknown;
  nameSnapshot: string;
  colorName?: string | null;
  colorHex?: string | null;
  priceCentsSnapshot: number;
  quantity: number;
}

const ORDER_TEXTS: Record<
  Locale,
  {
    subject: string;
    title: string;
    intro: string;
    shipping: string;
    free: string;
    discount: string;
    total: string;
    address: string;
    viaAgent: string;
  }
> = {
  fr: {
    subject: "Commande {n} confirmée — Kreya",
    title: "Merci pour votre commande ! 🎉",
    intro:
      "Nous avons bien reçu votre paiement. Votre commande <strong>{n}</strong> part en préparation dans notre atelier de Gland.",
    shipping: "Livraison",
    free: "Offerte",
    total: "Total",
    discount: "Remise",
    address: "Adresse de livraison",
    viaAgent:
      "Commande passée par l'intermédiaire de votre agent IA. Pour toute question, répondez simplement à cet e-mail.",
  },
  de: {
    subject: "Bestellung {n} bestätigt — Kreya",
    title: "Vielen Dank für Ihre Bestellung! 🎉",
    intro:
      "Wir haben Ihre Zahlung erhalten. Ihre Bestellung <strong>{n}</strong> wird in unserem Atelier in Gland vorbereitet.",
    shipping: "Versand",
    free: "Gratis",
    total: "Total",
    discount: "Rabatt",
    address: "Lieferadresse",
    viaAgent:
      "Diese Bestellung wurde über Ihren KI-Agenten aufgegeben. Bei Fragen antworten Sie einfach auf diese E-Mail.",
  },
  it: {
    subject: "Ordine {n} confermato — Kreya",
    title: "Grazie per il Suo ordine! 🎉",
    intro:
      "Abbiamo ricevuto il pagamento. Il Suo ordine <strong>{n}</strong> è in preparazione nel nostro atelier di Gland.",
    shipping: "Spedizione",
    free: "Gratuita",
    total: "Totale",
    discount: "Sconto",
    address: "Indirizzo di consegna",
    viaAgent:
      "Ordine effettuato tramite il Suo agente IA. Per qualsiasi domanda, risponda semplicemente a questa e-mail.",
  },
  en: {
    subject: "Order {n} confirmed — Kreya",
    title: "Thank you for your order! 🎉",
    intro:
      "We've received your payment. Your order <strong>{n}</strong> is now being prepared in our Gland workshop.",
    shipping: "Shipping",
    free: "Free",
    total: "Total",
    discount: "Discount",
    address: "Shipping address",
    viaAgent:
      "This order was placed through your AI agent. If you have any questions, simply reply to this email.",
  },
};

export function orderConfirmationEmail(
  order: OrderForEmail,
  items: ItemForEmail[],
): EmailMessage {
  const locale = (
    ["fr", "de", "it", "en"].includes(order.locale) ? order.locale : "fr"
  ) as Locale;
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
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">${it.quantity} × ${esc(it.nameSnapshot)}${studioTextsHtml(it, locale)}${it.colorName ? ` — <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${esc(it.colorHex ?? "#cccccc")};vertical-align:middle;margin:0 3px 1px 0;"></span>${esc(it.colorName)}` : ""}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;text-align:right;white-space:nowrap;">${chf(it.priceCentsSnapshot * it.quantity)}</td>
      </tr>`,
    )
    .join("");

  // Achat délégué à un agent IA : l'acheteur doit savoir d'où vient la
  // commande et comment joindre la boutique.
  const viaAgent =
    order.channel && order.channel !== "web"
      ? `<p style="margin:0 0 18px;padding:10px 14px;background:#f5f5f4;border-radius:10px;font-size:13px;color:#57534e;line-height:1.6;">${t.viaAgent}</p>`
      : "";

  const body = `
    <p style="margin:0 0 18px;color:#44403c;line-height:1.6;">${t.intro.replace("{n}", order.orderNumber)}</p>
    ${viaAgent}
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows}
      ${
        order.discountCents && order.discountCents > 0
          ? `<tr>
        <td style="padding:8px 0;color:#059669;">${t.discount}${order.discountCode ? ` (${esc(order.discountCode)})` : ""}</td>
        <td style="padding:8px 0;text-align:right;color:#059669;">−${chf(order.discountCents)}</td>
      </tr>`
          : ""
      }
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
      ${esc(address.name)}<br/>${esc(address.street)}<br/>${esc(address.npa)} ${esc(address.city)}, CH
    </p>
    ${
      hasStudio(items)
        ? `<p style="margin:18px 0 0;padding:12px 16px;background:#f5f5f4;border-radius:10px;font-size:13px;color:#57534e;line-height:1.6;">${STUDIO_ORDER_NOTE[locale]}</p>`
        : ""
    }`;

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
  {
    subject: string;
    title: string;
    body: string;
    tracking: string;
    track: string;
  }
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
    subject: "Il Suo ordine {n} è in viaggio 📦",
    title: "Si parte!",
    body: "Il Suo ordine <strong>{n}</strong> è stato consegnato alla Posta svizzera. Arriverà entro 1–3 giorni lavorativi.",
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
  const locale = (
    ["fr", "de", "it", "en"].includes(order.locale) ? order.locale : "fr"
  ) as Locale;
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
    feedback:
      "Un souci avec un article ? Une remarque ? Répondez simplement à cet e-mail, nous trouvons toujours une solution.",
  },
  de: {
    subject: "Ihre Bestellung {n} wurde zugestellt ✅",
    title: "Gut angekommen!",
    body: "Ihre Bestellung <strong>{n}</strong> wurde zugestellt. Wir hoffen, Ihre Drucke gefallen Ihnen!",
    feedback:
      "Ein Problem mit einem Artikel? Eine Anmerkung? Antworten Sie einfach auf diese E-Mail — wir finden immer eine Lösung.",
  },
  it: {
    subject: "Il Suo ordine {n} è stato consegnato ✅",
    title: "Arrivato a destinazione!",
    body: "Il Suo ordine <strong>{n}</strong> è stato consegnato. Speriamo che le Sue stampe Le piacciano!",
    feedback:
      "Un problema con un articolo? Un'osservazione? Risponda a questa e-mail — troviamo sempre una soluzione.",
  },
  en: {
    subject: "Your order {n} has been delivered ✅",
    title: "Safely delivered!",
    body: "Your order <strong>{n}</strong> has been delivered. We hope you love your prints!",
    feedback:
      "An issue with an item? Any feedback? Just reply to this email — we always find a solution.",
  },
};

export function orderDeliveredEmail(order: OrderForEmail): EmailMessage {
  const locale = (
    ["fr", "de", "it", "en"].includes(order.locale) ? order.locale : "fr"
  ) as Locale;
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
    refund:
      "Si vous avez déjà payé, nous vous confirmerons séparément le remboursement après son traitement. Contactez-nous pour toute question.",
  },
  de: {
    subject: "Ihre Bestellung {n} wurde storniert",
    title: "Bestellung storniert",
    body: "Ihre Bestellung <strong>{n}</strong> wurde storniert.",
    refund:
      "Falls Sie bereits bezahlt haben, bestätigen wir die Erstattung separat nach der Bearbeitung. Bei Fragen kontaktieren Sie uns.",
  },
  it: {
    subject: "Il Suo ordine {n} è stato annullato",
    title: "Ordine annullato",
    body: "Il Suo ordine <strong>{n}</strong> è stato annullato.",
    refund:
      "Se ha già pagato, confermeremo separatamente il rimborso dopo l’elaborazione. Ci contatti per qualsiasi domanda.",
  },
  en: {
    subject: "Your order {n} has been cancelled",
    title: "Order cancelled",
    body: "Your order <strong>{n}</strong> has been cancelled.",
    refund:
      "If you have already paid, we will confirm your refund separately once it has been processed. Please contact us with any questions.",
  },
};

// Motif d'annulation propre aux objets du Studio : un texte refusé à la relecture.
const STUDIO_REFUSED: Record<Locale, string> = {
  fr: "Un texte de votre objet du Studio n'a pas pu être imprimé après relecture (marque de tiers, injure ou contenu illicite). La commande est annulée et vous êtes remboursé intégralement ; le remboursement vous est confirmé séparément. Vous pouvez recommencer dans le Studio avec un autre texte.",
  de: "Ein Text Ihres Studio-Objekts konnte nach der Durchsicht nicht gedruckt werden (Fremdmarke, Beleidigung oder rechtswidriger Inhalt). Die Bestellung wurde storniert und Ihnen wird der volle Betrag erstattet; die Rückerstattung bestätigen wir Ihnen separat. Sie können im Studio mit einem anderen Text neu beginnen.",
  it: "Un testo del Suo oggetto dello Studio non ha potuto essere stampato dopo la rilettura (marchio di terzi, ingiuria o contenuto illecito). L'ordine è annullato e Lei viene rimborsato integralmente; il rimborso Le sarà confermato separatamente. Può ricominciare nello Studio con un altro testo.",
  en: "A text on your Studio object could not be printed after review (third-party brand, insult or unlawful content). The order has been cancelled and you are refunded in full; we will confirm the refund separately. You can start again in the Studio with another text.",
};

export function orderCancelledEmail(
  order: OrderForEmail,
  reason?: "studio-text",
): EmailMessage {
  const locale = (
    ["fr", "de", "it", "en"].includes(order.locale) ? order.locale : "fr"
  ) as Locale;
  const t = CANCELLED_TEXTS[locale];
  const body = `
    <p style="margin:0 0 16px;color:#44403c;line-height:1.6;">${t.body.replace("{n}", order.orderNumber)}</p>
    ${
      reason === "studio-text"
        ? `<p style="margin:0 0 16px;color:#44403c;line-height:1.6;">${STUDIO_REFUSED[locale]}</p>`
        : `<p style="margin:0;font-size:13px;color:#78716c;line-height:1.6;">${t.refund}</p>`
    }`;
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
  {
    subject: string;
    title: string;
    intro: string;
    price: string;
    note: string;
    valid: string;
    cta: string;
    review: string;
  }
> = {
  fr: {
    subject: "Votre devis Kreya est prêt",
    title: "Votre devis est prêt ✨",
    intro:
      "Nous avons étudié votre projet d'impression sur mesure. Voici notre proposition :",
    price: "Prix proposé",
    note: "Notre message",
    valid: "Valable jusqu'au {date}",
    cta: "Depuis votre espace client, vous pouvez accepter et payer ce devis, demander une modification ou le refuser — en un clic.",
    review: "Voir mon devis",
  },
  de: {
    subject: "Ihre Kreya-Offerte ist bereit",
    title: "Ihre Offerte ist bereit ✨",
    intro: "Wir haben Ihr Projekt geprüft. Hier unser Vorschlag:",
    price: "Angebotener Preis",
    note: "Unsere Nachricht",
    valid: "Gültig bis {date}",
    cta: "In Ihrem Kundenkonto können Sie diese Offerte mit einem Klick annehmen und bezahlen, eine Anpassung anfragen oder ablehnen.",
    review: "Meine Offerte ansehen",
  },
  it: {
    subject: "Il Suo preventivo Kreya è pronto",
    title: "Il Suo preventivo è pronto ✨",
    intro: "Abbiamo esaminato il Suo progetto. Ecco la nostra proposta:",
    price: "Prezzo proposto",
    note: "Il nostro messaggio",
    valid: "Valido fino al {date}",
    cta: "Dal Suo account cliente può accettare e pagare questo preventivo, chiedere una modifica o rifiutarlo — con un clic.",
    review: "Vedi il mio preventivo",
  },
  en: {
    subject: "Your Kreya quote is ready",
    title: "Your quote is ready ✨",
    intro: "We've reviewed your custom printing project. Here is our proposal:",
    price: "Quoted price",
    note: "Our message",
    valid: "Valid until {date}",
    cta: "From your customer account you can accept and pay this quote, request a change or decline it — in one click.",
    review: "View my quote",
  },
};

function formatDate(date: Date, locale: Locale): string {
  return date.toLocaleDateString(`${locale}-CH`, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function quoteReplyEmail(quote: {
  id: string;
  email: string;
  locale: string;
  quotedPriceCents: number | null;
  adminMessage: string | null;
  validUntil?: Date | null;
}): EmailMessage {
  const locale = (
    ["fr", "de", "it", "en"].includes(quote.locale) ? quote.locale : "fr"
  ) as Locale;
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
            <strong style="color:#1c1917;">${t.note} :</strong><br/>${esc(quote.adminMessage)}</p>`
        : ""
    }
    ${
      quote.validUntil
        ? `<p style="margin:0 0 18px;font-size:13px;color:#78716c;">${t.valid.replace("{date}", formatDate(quote.validUntil, locale))}</p>`
        : ""
    }
    ${button(withUtm(`${SITE_URL}/${locale}/account/quotes/${quote.id}`, "quote"), t.review)}
    <p style="margin:0;font-size:13px;color:#78716c;line-height:1.6;">${t.cta}</p>`;
  return {
    to: quote.email,
    from: FROM_STUDIO,
    subject: t.subject,
    html: layout(t.title, body, FOOTER[locale]),
  };
}

// ── Devis refusé ─────────────────────────────────────────────────────────────

const QUOTE_REJECTED_TEXTS: Record<
  Locale,
  {
    subject: string;
    title: string;
    intro: string;
    reason: string;
    outro: string;
  }
> = {
  fr: {
    subject: "Votre demande de devis — Kreya",
    title: "Concernant votre demande de devis",
    intro:
      "Merci pour l'intérêt que vous portez à Kreya. Après étude attentive de votre projet, nous ne sommes malheureusement pas en mesure d'y donner suite.",
    reason: "Notre message",
    outro:
      "Cela ne remet pas en cause vos futurs projets : n'hésitez pas à nous soumettre une nouvelle demande, nous l'étudierons avec plaisir. Pour toute question, répondez simplement à cet e-mail.",
  },
  de: {
    subject: "Ihre Offerten-Anfrage — Kreya",
    title: "Zu Ihrer Offerten-Anfrage",
    intro:
      "Vielen Dank für Ihr Interesse an Kreya. Nach sorgfältiger Prüfung Ihres Projekts können wir Ihre Anfrage leider nicht umsetzen.",
    reason: "Unsere Nachricht",
    outro:
      "Das gilt nicht für künftige Projekte: Reichen Sie gerne eine neue Anfrage ein — wir prüfen sie mit Freude. Bei Fragen antworten Sie einfach auf diese E-Mail.",
  },
  it: {
    subject: "La Sua richiesta di preventivo — Kreya",
    title: "Riguardo alla Sua richiesta",
    intro:
      "Grazie per l'interesse verso Kreya. Dopo un attento esame del Suo progetto, purtroppo non siamo in grado di realizzarlo.",
    reason: "Il nostro messaggio",
    outro:
      "Questo non vale per i progetti futuri: non esiti a inviarci una nuova richiesta, la esamineremo con piacere. Per qualsiasi domanda, risponda a questa e-mail.",
  },
  en: {
    subject: "Your quote request — Kreya",
    title: "About your quote request",
    intro:
      "Thank you for your interest in Kreya. After carefully reviewing your project, we are unfortunately unable to take it on.",
    reason: "Our message",
    outro:
      "This doesn't apply to future projects: feel free to submit a new request and we'll gladly review it. For any question, just reply to this email.",
  },
};

export function quoteRejectedEmail(quote: {
  email: string;
  locale: string;
  adminMessage: string | null;
}): EmailMessage {
  const locale = (
    ["fr", "de", "it", "en"].includes(quote.locale) ? quote.locale : "fr"
  ) as Locale;
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
    from: FROM_STUDIO,
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
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">${it.quantity} × ${esc(it.nameSnapshot)}${studioTextsHtml(it, "fr")}${it.colorName ? ` — <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${esc(it.colorHex ?? "#cccccc")};vertical-align:middle;margin:0 3px 1px 0;"></span>${esc(it.colorName)}` : ""}</td>
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

  const channel =
    order.channel && CHANNEL_LABELS[order.channel]
      ? `<p style="margin:0 0 18px;font-size:13px;color:#44403c;">
          <strong>Canal :</strong> ${CHANNEL_LABELS[order.channel]}${order.agentName ? ` — ${esc(order.agentName)}` : ""}
        </p>`
      : "";
  // Anomalies relevées à l'enregistrement (stock insuffisant après un achat
  // déjà payé, article retiré du catalogue…) : à traiter à la main.
  const notes = order.adminNote
    ? `<p style="margin:0 0 18px;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;font-size:13px;color:#991b1b;line-height:1.7;">
          <strong>⚠ À vérifier :</strong><br/>${esc(order.adminNote).replace(/\n/g, "<br/>")}
        </p>`
    : "";

  // Objets du Studio : les textes sont à relire AVANT l'impression (CGV : sous
  // 2 jours ouvrés). Sans relecture posée dans l'admin, la commande ne peut pas
  // passer en production.
  const studioReview = hasStudio(items)
    ? `<p style="margin:0 0 18px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#92400e;line-height:1.7;">
          <strong>⚠ Textes du Studio à relire avant l'impression</strong> (sous 2 jours ouvrés). Refus (marque de tiers, injure, contenu illicite) : annuler la commande et la rembourser intégralement dans Stripe.
        </p>`
    : "";

  const body = `
    <p style="margin:0 0 18px;color:#44403c;line-height:1.6;">
      Nouvelle commande payée de <strong>${esc(order.email)}</strong> (langue : ${order.locale.toUpperCase()}).
    </p>
    ${channel}
    ${notes}
    ${studioReview}
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
    html: layout(
      `Nouvelle commande ${order.orderNumber}`,
      body,
      "Notification interne Kreya — répondre écrit directement au client.",
    ),
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
    /** Formulaire de /custom : quantité et poids estimé d'UNE pièce (navigateur, indicatif). */
    quantity?: number | null;
    estGrams?: number | null;
    /** Atelier 3D : résumé du projet de couleurs joint (3MF peint), une ligne. */
    colorProject?: string | null;
  },
  adminEmails: string[],
): EmailMessage {
  const specs = [
    ["Matière", quote.material],
    ["Couleurs", quote.colors],
    ["Dimensions", quote.dimensions],
    ["Fichier 3D", quote.fileName],
    ["Projet couleurs", quote.colorProject ?? null],
    [
      "Quantité",
      quote.quantity && quote.quantity > 1 ? String(quote.quantity) : null,
    ],
    ["Poids estimé", quote.estGrams ? `≈ ${quote.estGrams} g par pièce` : null],
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
    from: FROM_STUDIO,
    replyTo: quote.email,
    subject: `📐 Nouvelle demande de devis — ${quote.email}`,
    html: layout(
      "Nouvelle demande de devis",
      body,
      "Notification interne Kreya — répondre écrit directement au client.",
    ),
  };
}

// ── Devis payé (notification interne) ────────────────────────────────────────

export function adminQuotePaidEmail(
  quote: {
    id: string;
    email: string;
    quotedPriceCents: number | null;
    locale: string;
  },
  adminEmails: string[],
): EmailMessage {
  const amount =
    quote.quotedPriceCents != null ? chf(quote.quotedPriceCents) : "—";
  const body = `
    <p style="margin:0 0 18px;color:#44403c;line-height:1.6;">
      Le devis de <strong>${esc(quote.email)}</strong> vient d'être
      <strong>payé</strong> (${amount}). À produire puis expédier.
    </p>
    ${button(`${SITE_URL}/fr/admin/quotes/${quote.id}`, "Voir le devis")}`;
  return {
    to: adminEmails,
    from: FROM_STUDIO,
    replyTo: quote.email,
    subject: `💳 Devis payé — ${quote.email} (${amount})`,
    html: layout(
      "Devis payé",
      body,
      "Notification interne Kreya — répondre écrit directement au client.",
    ),
  };
}

// ── Devis : le client demande une modification (notification interne) ────────

export function adminQuoteRevisionEmail(
  quote: { id: string; email: string; locale: string },
  message: string,
  fileName: string | null,
  adminEmails: string[],
): EmailMessage {
  const body = `
    <p style="margin:0 0 16px;color:#44403c;line-height:1.6;">
      <strong>${esc(quote.email)}</strong> (langue : ${quote.locale.toUpperCase()})
      demande une <strong>modification</strong> de son devis.
    </p>
    <p style="margin:0 0 16px;padding:12px 16px;background:#fafaf9;border-radius:10px;color:#44403c;line-height:1.6;white-space:pre-wrap;">${esc(message)}</p>
    ${
      fileName
        ? `<p style="margin:0 0 18px;font-size:13px;color:#78716c;">📎 Fichier joint : ${esc(fileName)} (à télécharger depuis la fiche)</p>`
        : ""
    }
    ${button(`${SITE_URL}/fr/admin/quotes/${quote.id}`, "Re-chiffrer le devis")}`;
  return {
    to: adminEmails,
    from: FROM_STUDIO,
    replyTo: quote.email,
    subject: `✏️ Modification demandée — ${quote.email}`,
    html: layout(
      "Demande de modification",
      body,
      "Notification interne Kreya — répondre écrit directement au client.",
    ),
  };
}

// ── Devis : le client refuse le devis (notification interne) ─────────────────

export function adminQuoteDeclinedEmail(
  quote: {
    id: string;
    email: string;
    locale: string;
    quotedPriceCents: number | null;
  },
  reason: string | null,
  adminEmails: string[],
): EmailMessage {
  const amount =
    quote.quotedPriceCents != null ? chf(quote.quotedPriceCents) : "—";
  const body = `
    <p style="margin:0 0 16px;color:#44403c;line-height:1.6;">
      <strong>${esc(quote.email)}</strong> (langue : ${quote.locale.toUpperCase()})
      a <strong>refusé</strong> le devis (${amount}).
    </p>
    ${
      reason
        ? `<p style="margin:0 0 18px;padding:12px 16px;background:#fafaf9;border-radius:10px;color:#44403c;line-height:1.6;white-space:pre-wrap;"><strong style="color:#1c1917;">Motif :</strong><br/>${esc(reason)}</p>`
        : ""
    }
    ${button(`${SITE_URL}/fr/admin/quotes/${quote.id}`, "Voir le devis")}`;
  return {
    to: adminEmails,
    from: FROM_STUDIO,
    replyTo: quote.email,
    subject: `🚫 Devis refusé — ${quote.email}`,
    html: layout(
      "Devis refusé par le client",
      body,
      "Notification interne Kreya — répondre écrit directement au client.",
    ),
  };
}

// ── Code de vérification d'e-mail au checkout (commande sans compte) ─────────

const CHECKOUT_CODE_TEXTS: Record<
  Locale,
  { subject: string; title: string; intro: string; expiry: string }
> = {
  fr: {
    subject: "{code} — votre code de vérification Kreya",
    title: "Votre code de vérification",
    intro:
      "Saisissez ce code sur la page de commande pour confirmer votre adresse e-mail :",
    expiry:
      "Ce code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
  },
  de: {
    subject: "{code} — Ihr Kreya-Bestätigungscode",
    title: "Ihr Bestätigungscode",
    intro:
      "Geben Sie diesen Code auf der Bestellseite ein, um Ihre E-Mail-Adresse zu bestätigen:",
    expiry:
      "Dieser Code läuft in 10 Minuten ab. Falls Sie das nicht angefordert haben, ignorieren Sie diese E-Mail.",
  },
  it: {
    subject: "{code} — il Suo codice di verifica Kreya",
    title: "Il Suo codice di verifica",
    intro:
      "Inserisca questo codice nella pagina dell'ordine per confermare il Suo indirizzo e-mail:",
    expiry:
      "Questo codice scade tra 10 minuti. Se non ha richiesto nulla, ignori questa e-mail.",
  },
  en: {
    subject: "{code} — your Kreya verification code",
    title: "Your verification code",
    intro:
      "Enter this code on the checkout page to confirm your email address:",
    expiry:
      "This code expires in 10 minutes. If you didn't request it, you can ignore this email.",
  },
};

export function checkoutCodeEmail(
  to: string,
  code: string,
  locale: string,
): EmailMessage {
  const l = (
    ["fr", "de", "it", "en"].includes(locale) ? locale : "fr"
  ) as Locale;
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
      Vous avez demandé à réinitialiser votre mot de passe Kreya.
      Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
      Ce lien expire dans une heure.
    </p>
    <p style="margin:0 0 18px;text-align:center;">
      <a href="${url}" style="display:inline-block;background:#e5231c;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 28px;border-radius:999px;">
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
    from: FROM_ACCOUNT,
    subject: "Réinitialisation de votre mot de passe — Kreya",
    html: layout("Nouveau mot de passe", body, FOOTER.fr),
  };
}

// ── Connexion sans mot de passe (FR + EN) ────────────────────────────────────

export function magicLinkEmail(to: string, url: string): EmailMessage {
  const body = `
    <p style="margin:0 0 18px;color:#44403c;line-height:1.6;">
      Cliquez sur le bouton ci-dessous pour vous connecter à votre compte
      Kreya. Ce lien expire dans 5 minutes et ne sert qu'une fois.
    </p>
    ${button(url, "Me connecter")}
    <p style="margin:0;font-size:12px;color:#78716c;line-height:1.6;">
      Click the button above to sign in to your Kreya account (link expires in 5 minutes).<br/>
      Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.
    </p>`;
  return {
    to,
    from: FROM_ACCOUNT,
    subject: "Votre lien de connexion — Kreya",
    html: layout("Connexion à Kreya", body, FOOTER.fr),
  };
}

export function otpEmail(
  to: string,
  code: string,
  type: "sign-in" | "email-verification" | "forget-password" | "change-email",
): EmailMessage {
  const intro =
    type === "sign-in"
      ? "Voici votre code de connexion Kreya :"
      : type === "forget-password"
        ? "Voici votre code pour réinitialiser votre mot de passe Kreya :"
        : type === "change-email"
          ? "Voici votre code pour confirmer votre nouvelle adresse e-mail :"
          : "Voici votre code de vérification Kreya :";
  const body = `
    <p style="margin:0 0 18px;color:#44403c;line-height:1.6;">${intro}</p>
    <p style="margin:0 0 18px;text-align:center;">
      <span style="display:inline-block;background:#f5f5f4;border-radius:12px;padding:14px 22px;font-size:28px;font-weight:700;letter-spacing:0.3em;color:#1c1917;">
        ${esc(code)}
      </span>
    </p>
    <p style="margin:0;font-size:12px;color:#78716c;line-height:1.6;">
      Here is your Kreya verification code (valid 5 minutes).<br/>
      Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.
    </p>`;
  return {
    to,
    from: FROM_ACCOUNT,
    subject: `${code} — votre code Kreya`,
    html: layout("Votre code de vérification", body, FOOTER.fr),
  };
}

// ── Vérification d'adresse e-mail (FR + EN, locale inconnue à l'inscription) ─

export function verificationEmail(to: string, url: string): EmailMessage {
  const body = `
    <p style="margin:0 0 18px;color:#44403c;line-height:1.6;">
      Bienvenue chez Kreya ! Cliquez sur le bouton ci-dessous pour confirmer
      votre adresse e-mail et activer votre compte.
    </p>
    <p style="margin:0 0 18px;text-align:center;">
      <a href="${url}" style="display:inline-block;background:#e5231c;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 28px;border-radius:999px;">
        Confirmer mon e-mail
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#78716c;line-height:1.6;">
      Welcome to Kreya! Click the button above to confirm your email address.<br/>
      Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.
    </p>`;
  return {
    to,
    from: FROM_ACCOUNT,
    subject: "Confirmez votre e-mail — Kreya",
    html: layout("Confirmez votre adresse", body, FOOTER.fr),
  };
}

// ── Confirmation de suppression de compte (FR + EN) ──────────────────────────

export function deleteAccountEmail(to: string, url: string): EmailMessage {
  const body = `
    <p style="margin:0 0 18px;color:#44403c;line-height:1.6;">
      Vous avez demandé la suppression de votre compte Kreya. Cliquez
      sur le bouton ci-dessous pour confirmer : votre compte et vos données
      personnelles seront effacés. Vos commandes restent conservées 10 ans
      pour des raisons comptables (art. 958f CO). Ce lien expire dans 1 heure.
    </p>
    ${button(url, "Supprimer définitivement mon compte")}
    <p style="margin:0;font-size:12px;color:#78716c;line-height:1.6;">
      You requested deletion of your Kreya account — click the button above to confirm (link expires in 1 hour).<br/>
      Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail :
      votre compte reste inchangé.
    </p>`;
  return {
    to,
    from: FROM_ACCOUNT,
    subject: "Confirmez la suppression de votre compte — Kreya",
    html: layout("Suppression de compte", body, FOOTER.fr),
  };
}

// ── Formulaire de contact : notification interne ─────────────────────────────

export function adminContactEmail(
  message: {
    name: string;
    email: string;
    subject: string | null;
    body: string;
    locale: string;
  },
  adminEmails: string[],
): EmailMessage {
  const rows = [
    ["Nom", message.name],
    ["E-mail", message.email],
    ["Sujet", message.subject],
    ["Langue", message.locale.toUpperCase()],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const body = `
    <p style="margin:0 0 16px;color:#44403c;line-height:1.6;">
      Nouveau message via le formulaire de contact.
    </p>
    <table style="border-collapse:collapse;font-size:13px;color:#44403c;margin:0 0 16px;">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:3px 16px 3px 0;color:#78716c;">${k}</td><td style="padding:3px 0;">${esc(v)}</td></tr>`,
        )
        .join("")}
    </table>
    <p style="margin:0;padding:12px 16px;background:#fafaf9;border-radius:10px;color:#44403c;line-height:1.6;white-space:pre-wrap;">${esc(message.body)}</p>`;

  return {
    to: adminEmails,
    from: FROM_CONTACT,
    replyTo: message.email,
    subject: `✉️ Nouveau message — ${message.name}`,
    html: layout(
      "Nouveau message de contact",
      body,
      "Notification interne Kreya — répondre écrit directement au client.",
    ),
  };
}

// ── Formulaire de contact : accusé de réception au client ────────────────────

const CONTACT_CONFIRM_TEXTS: Record<
  Locale,
  { subject: string; title: string; intro: string; yourMessage: string }
> = {
  fr: {
    subject: "Nous avons bien reçu votre message — Kreya",
    title: "Message bien reçu ✅",
    intro:
      "Merci de nous avoir écrit ! Nous avons bien reçu votre message et revenons vers vous au plus vite, généralement sous 24 à 48 h. Voici une copie de votre message :",
    yourMessage: "Votre message",
  },
  de: {
    subject: "Wir haben Ihre Nachricht erhalten — Kreya",
    title: "Nachricht erhalten ✅",
    intro:
      "Danke für Ihre Nachricht! Wir haben sie erhalten und melden uns so rasch wie möglich, in der Regel innert 24 bis 48 Std. Hier eine Kopie Ihrer Nachricht:",
    yourMessage: "Ihre Nachricht",
  },
  it: {
    subject: "Abbiamo ricevuto il Suo messaggio — Kreya",
    title: "Messaggio ricevuto ✅",
    intro:
      "Grazie per averci scritto! Abbiamo ricevuto il Suo messaggio e Le risponderemo al più presto, di solito entro 24–48 h. Ecco una copia del Suo messaggio:",
    yourMessage: "Il Suo messaggio",
  },
  en: {
    subject: "We’ve received your message — Kreya",
    title: "Message received ✅",
    intro:
      "Thanks for writing to us! We’ve received your message and will get back to you as soon as possible, usually within 24 to 48 hours. Here’s a copy of your message:",
    yourMessage: "Your message",
  },
};

export function contactConfirmationEmail(
  to: string,
  body: string,
  locale: string,
): EmailMessage {
  const l = (
    ["fr", "de", "it", "en"].includes(locale) ? locale : "fr"
  ) as Locale;
  const t = CONTACT_CONFIRM_TEXTS[l];
  const html = `
    <p style="margin:0 0 16px;color:#44403c;line-height:1.6;">${t.intro}</p>
    <p style="margin:0;padding:12px 16px;background:#fafaf9;border-radius:10px;color:#44403c;line-height:1.6;white-space:pre-wrap;"><strong style="color:#1c1917;">${t.yourMessage} :</strong><br/>${esc(body)}</p>`;
  return {
    to,
    from: FROM_CONTACT,
    subject: t.subject,
    html: layout(t.title, html, FOOTER[l]),
  };
}

// ── Annonce newsletter (admin) ───────────────────────────────────────────────
// Composée en français uniquement (back-office non traduit, comme le reste
// de l'admin) — envoyée telle quelle aux abonnés, quelle que soit leur
// langue de compte. Lien de désabonnement en un clic (jeton HMAC signé,
// voir src/lib/newsletter.ts), sans connexion requise.

interface AnnouncementProduct {
  name: string;
  priceCents: number;
  imageUrl?: string | null;
  url: string;
}

export function newsletterAnnouncementEmail(params: {
  to: string;
  subject: string;
  bodyText: string; // texte de l'admin, paragraphes séparés par des lignes vides
  bannerImageUrl?: string | null;
  products?: AnnouncementProduct[];
  cta?: { label: string; url: string } | null;
  unsubscribeUrl: string;
}): EmailMessage {
  const banner = params.bannerImageUrl
    ? `<img src="${params.bannerImageUrl}" alt="" width="504" style="display:block;width:100%;max-width:504px;height:auto;border-radius:10px;margin:0 0 18px;" />`
    : "";

  const paragraphs = params.bodyText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#44403c;line-height:1.6;">${esc(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");

  const productCards = (params.products ?? [])
    .map(
      (
        product,
      ) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 12px;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden;">
        <tr>
          ${
            product.imageUrl
              ? `<td style="width:88px;padding:0;"><img src="${product.imageUrl}" alt="" width="88" height="88" style="display:block;width:88px;height:88px;object-fit:cover;" /></td>`
              : ""
          }
          <td style="padding:14px 16px;vertical-align:middle;">
            <p style="margin:0 0 4px;font-weight:600;color:#1c1917;">${esc(product.name)}</p>
            <p style="margin:0 0 10px;color:#78716c;font-size:13px;">${chf(product.priceCents)}</p>
            <a href="${withUtm(product.url, "newsletter")}" style="color:#e5231c;font-weight:600;font-size:13px;text-decoration:none;">Découvrir →</a>
          </td>
        </tr>
      </table>`,
    )
    .join("");

  const cta = params.cta
    ? button(withUtm(params.cta.url, "newsletter"), params.cta.label)
    : "";

  const body = `${banner}${paragraphs}${productCards}${cta}`;
  const footer = `Vous recevez cet e-mail car vous êtes inscrit·e aux communications Kreya.<br/><a href="${params.unsubscribeUrl}" style="color:#78716c;text-decoration:underline;">Se désabonner en un clic</a>`;

  return {
    to: params.to,
    from: FROM_NEWS,
    subject: params.subject,
    html: layout(params.subject, body, footer),
  };
}

import { Link } from "@/i18n/navigation";
import {
  orderConfirmationEmail,
  orderShippedEmail,
  orderDeliveredEmail,
  orderCancelledEmail,
  quoteReplyEmail,
  quoteRejectedEmail,
  adminNewOrderEmail,
  adminNewQuoteEmail,
  adminQuoteRevisionEmail,
  adminQuoteDeclinedEmail,
  verificationEmail,
  resetPasswordEmail,
} from "@/lib/email-templates";
import { requireAdmin } from "@/lib/session";

const PREVIEW_LOCALES = ["fr", "de", "it", "en"] as const;

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ l?: string }>;
}) {
  await requireAdmin();
  const { l } = await searchParams;
  const previewLocale = (PREVIEW_LOCALES as readonly string[]).includes(l ?? "")
    ? (l as (typeof PREVIEW_LOCALES)[number])
    : "fr";

  const sampleOrder = {
    id: "demo",
    orderNumber: "S3D-DEMO42",
    email: "client@example.ch",
    subtotalCents: 4980,
    shippingCents: 890,
    totalCents: 5870,
    shippingAddress: JSON.stringify({
      name: "Jean Dupont",
      street: "Rue du Borgeaud 12",
      npa: "1196",
      city: "Gland",
    }),
    locale: previewLocale,
  };
  const sampleItems = [
    { nameSnapshot: "Vase Spirale", priceCentsSnapshot: 2990, quantity: 1 },
    { nameSnapshot: "Porte-clés relief", priceCentsSnapshot: 995, quantity: 2 },
  ];
  // Aperçu : validité fictive à +30 j (horloge stable sur la durée du rendu)
  // eslint-disable-next-line react-hooks/purity
  const validUntilPreview = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const customerPreviews = [
    {
      title: "Confirmation de commande",
      desc: "Envoyé automatiquement au client dès que son paiement est validé.",
      email: orderConfirmationEmail(sampleOrder, sampleItems),
      height: 640,
    },
    {
      title: "Commande expédiée",
      desc: "Envoyé quand vous passez une commande au statut « Expédiée » — avec le n° de suivi Poste s'il est renseigné.",
      email: orderShippedEmail(sampleOrder, "99.60.123456.78901234"),
      height: 560,
    },
    {
      title: "Commande livrée",
      desc: "Envoyé quand vous passez une commande au statut « Livrée ».",
      email: orderDeliveredEmail(sampleOrder),
      height: 380,
    },
    {
      title: "Commande annulée",
      desc: "Envoyé quand vous annulez une commande déjà payée (le remboursement se fait dans Stripe).",
      email: orderCancelledEmail(sampleOrder),
      height: 380,
    },
    {
      title: "Devis prêt",
      desc: "Envoyé quand vous chiffrez un devis (statut « Devis envoyé »).",
      email: quoteReplyEmail({
        id: "demo",
        email: "client@example.ch",
        locale: previewLocale,
        quotedPriceCents: 4900,
        adminMessage:
          "Impression en PETG noir et rouge, 2 exemplaires, prêts sous 5 jours ouvrés.",
        validUntil: validUntilPreview,
      }),
      height: 560,
    },
    {
      title: "Devis refusé",
      desc: "Envoyé quand vous passez un devis au statut « Refusée » — votre message au client sert de motif.",
      email: quoteRejectedEmail({
        email: "client@example.ch",
        locale: previewLocale,
        adminMessage:
          "La pièce dépasse le volume d'impression de nos machines (256 mm).",
      }),
      height: 480,
    },
    {
      title: "Vérification d'e-mail",
      desc: "Envoyé à l'inscription pour confirmer l'adresse (FR/EN, langue inconnue à ce stade).",
      email: verificationEmail("client@example.ch", "#"),
      height: 460,
    },
    {
      title: "Mot de passe oublié",
      desc: "Envoyé quand un client demande la réinitialisation de son mot de passe (lien valable 1 h).",
      email: resetPasswordEmail("client@example.ch", "#"),
      height: 480,
    },
  ];

  const adminPreviews = [
    {
      title: "Nouvelle commande (notification interne)",
      desc: "Envoyé à l'équipe (ADMIN_EMAILS) dès qu'une commande est payée — avec alerte stock bas le cas échéant. « Répondre » écrit directement au client.",
      email: adminNewOrderEmail(
        sampleOrder,
        sampleItems,
        ["vous@example.ch"],
        [{ name: "Vase Spirale", stock: 1 }],
      ),
      height: 760,
    },
    {
      title: "Nouvelle demande de devis (notification interne)",
      desc: "Envoyé à l'équipe dès qu'une demande de devis arrive, avec un lien direct pour la chiffrer.",
      email: adminNewQuoteEmail(
        {
          id: "demo",
          email: "client@example.ch",
          description:
            "Bonjour, j'aurais besoin d'un support de casque sur mesure, environ 25 cm de haut, si possible en deux couleurs.",
          material: "PETG",
          colors: "Noir + rouge",
          dimensions: "250 × 120 × 80 mm",
          fileName: "support-casque.stl",
          locale: previewLocale,
        },
        ["vous@example.ch"],
      ),
      height: 640,
    },
    {
      title: "Modification de devis demandée (notification interne)",
      desc: "Envoyé à l'équipe quand le client demande une modification depuis son espace — avec son message et le fichier joint éventuel.",
      email: adminQuoteRevisionEmail(
        { id: "demo", email: "client@example.ch", locale: previewLocale },
        "Serait-il possible de l'avoir en PETG noir plutôt qu'en PLA, et 2 cm plus haut ?",
        "support-casque-v2.stl",
        ["vous@example.ch"],
      ),
      height: 520,
    },
    {
      title: "Devis refusé par le client (notification interne)",
      desc: "Envoyé à l'équipe quand le client refuse un devis depuis son espace — avec le motif s'il en a indiqué un.",
      email: adminQuoteDeclinedEmail(
        {
          id: "demo",
          email: "client@example.ch",
          locale: previewLocale,
          quotedPriceCents: 4900,
        },
        "Budget dépassé pour ce trimestre, je reviendrai vers vous plus tard.",
        ["vous@example.ch"],
      ),
      height: 480,
    },
  ];

  const renderPreview = (p: {
    title: string;
    desc: string;
    email: { subject: string; html: string };
    height: number;
  }) => (
    <section key={p.title}>
      <h3 className="font-semibold">{p.title}</h3>
      <p className="text-xs text-soft">{p.desc}</p>
      <p className="mt-1.5 text-xs">
        <span className="rounded-md bg-line/60 px-2 py-1 font-medium">
          Objet : {p.email.subject}
        </span>
      </p>
      <iframe
        srcDoc={p.email.html}
        title={p.title}
        sandbox=""
        className="mt-3 w-full rounded-card border border-line bg-paper"
        style={{ height: p.height }}
      />
    </section>
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex gap-1.5 border-b border-line pb-3">
        <span className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-paper">
          Aperçu
        </span>
        <Link
          href="/admin/emails/announcements"
          className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-soft hover:text-ink"
        >
          Annonces
        </Link>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Aperçu des e-mails</h2>
          <p className="text-sm text-soft">
            Chaque e-mail client est envoyé dans la langue du client.
          </p>
        </div>
        <div className="flex gap-1.5">
          {PREVIEW_LOCALES.map((pl) => (
            <Link
              key={pl}
              href={{ pathname: "/admin/emails", query: { l: pl } }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                previewLocale === pl
                  ? "bg-ink text-paper"
                  : "border border-line bg-surface text-soft hover:text-ink"
              }`}
            >
              {pl}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {customerPreviews.map(renderPreview)}

        <div className="mt-10 border-t border-line pt-6">
          <h2 className="text-lg font-bold">Notifications internes</h2>
          <p className="text-sm text-soft">
            Envoyées à vous uniquement ({"ADMIN_EMAILS"}), toujours en français.
          </p>
        </div>
        {adminPreviews.map(renderPreview)}
      </div>
    </div>
  );
}

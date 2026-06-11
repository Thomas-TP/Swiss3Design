import { Link } from "@/i18n/navigation";
import {
  orderConfirmationEmail,
  orderShippedEmail,
  quoteReplyEmail,
  verificationEmail,
} from "@/lib/email-templates";

const PREVIEW_LOCALES = ["fr", "de", "it", "en"] as const;

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ l?: string }>;
}) {
  const { l } = await searchParams;
  const previewLocale = (PREVIEW_LOCALES as readonly string[]).includes(l ?? "")
    ? (l as (typeof PREVIEW_LOCALES)[number])
    : "fr";

  const sampleOrder = {
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

  const previews = [
    {
      title: "Confirmation de commande",
      desc: "Envoyé automatiquement au client dès que son paiement est validé.",
      email: orderConfirmationEmail(sampleOrder, sampleItems),
      height: 640,
    },
    {
      title: "Commande expédiée",
      desc: "Envoyé quand vous passez une commande au statut « Expédiée ».",
      email: orderShippedEmail(sampleOrder),
      height: 360,
    },
    {
      title: "Devis prêt",
      desc: "Envoyé quand vous chiffrez un devis (statut « Devis envoyé »).",
      email: quoteReplyEmail({
        email: "client@example.ch",
        locale: previewLocale,
        quotedPriceCents: 4900,
        adminMessage:
          "Impression en PETG noir et rouge, 2 exemplaires, prêts sous 5 jours ouvrés.",
      }),
      height: 520,
    },
    {
      title: "Vérification d'e-mail",
      desc: "Envoyé à l'inscription pour confirmer l'adresse (FR/EN, langue inconnue à ce stade).",
      email: verificationEmail("client@example.ch", "#"),
      height: 460,
    },
  ];

  return (
    <div className="max-w-2xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Aperçu des e-mails</h2>
          <p className="text-sm text-soft">
            Chaque e-mail est envoyé dans la langue du client.
          </p>
        </div>
        <div className="flex gap-1.5">
          {PREVIEW_LOCALES.map((pl) => (
            <Link
              key={pl}
              href={{ pathname: "/admin/emails", query: { l: pl } }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                previewLocale === pl
                  ? "bg-ink text-white"
                  : "border border-line bg-surface text-soft hover:text-ink"
              }`}
            >
              {pl}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {previews.map((p) => (
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
        ))}
      </div>
    </div>
  );
}

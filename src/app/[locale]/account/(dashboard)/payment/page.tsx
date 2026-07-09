import { CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getStripe } from "@/lib/stripe";
import { getServerSession } from "@/lib/session";
import { card } from "../_ui";

export const dynamic = "force-dynamic";

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
};

export default async function PaymentTab() {
  const t = await getTranslations("account");
  const session = await getServerSession();
  const { user } = session!;

  // Lecture seule : aucune gestion (ajout/suppression) de carte ici. Les
  // moyens de paiement sont gérés par le client lui-même via son compte
  // Stripe Link — Swiss3Design ne stocke jamais de numéro de carte (PCI =
  // Stripe). Voir la décision de scope dans le plan Phase 4.
  let cards: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  }[] = [];
  if (user.stripeCustomerId) {
    const { env } = await getCloudflareContext({ async: true });
    const stripe = getStripe(env.STRIPE_SECRET_KEY);
    const methods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });
    cards = methods.data
      .filter((m) => m.card)
      .map((m) => ({
        brand: m.card!.brand,
        last4: m.card!.last4,
        expMonth: m.card!.exp_month,
        expYear: m.card!.exp_year,
      }));
  }

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <CreditCard size={19} className="text-soft" />
        {t("payment.title")}
      </h1>
      <p className="mt-1 mb-6 text-sm text-soft">{t("payment.subtitle")}</p>

      <div className="space-y-4">
        <div className={card}>
          <div className="flex items-start gap-2.5">
            <ShieldCheck
              size={18}
              className="mt-0.5 shrink-0 text-emerald-600"
            />
            <div>
              <p className="text-sm font-semibold">{t("payment.linkTitle")}</p>
              <p className="mt-1 text-sm text-soft">{t("payment.linkDesc")}</p>
            </div>
          </div>
          <a
            href="https://link.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
          >
            {t("payment.manageOnLink")}
            <ExternalLink size={14} />
          </a>
        </div>

        {cards.length > 0 && (
          <div className={card}>
            <p className="text-sm font-semibold">{t("payment.cardsTitle")}</p>
            <ul className="mt-3 divide-y divide-line">
              {cards.map((c) => (
                <li
                  key={`${c.brand}-${c.last4}-${c.expMonth}-${c.expYear}`}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2.5">
                    <CreditCard size={15} className="text-soft" />
                    {BRAND_LABELS[c.brand] ?? c.brand} •••• {c.last4}
                  </span>
                  <span className="text-xs text-soft tabular-nums">
                    {String(c.expMonth).padStart(2, "0")}/{c.expYear}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

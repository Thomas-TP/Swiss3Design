import { getShippingSettings } from "@/lib/shipping-settings";
import { and, desc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { customerAddresses } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { ClientMessages } from "@/i18n/client-messages";
import { CheckoutFlow, type CheckoutAddress } from "./checkout-flow";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // Le titre du tunnel vient du namespace « system » (point final = point
  // rouge) ; `checkout.title` (sans point) reste celui de l'onglet.
  const t = await getTranslations("system.checkout");
  const { env } = await getCloudflareContext({ async: true });

  // Adresse par défaut du client connecté, proposée en préremplissage
  // (carnet d'adresses complet géré depuis /account/addresses).
  let initialAddress: CheckoutAddress | null = null;
  const session = await getServerSession();
  if (session) {
    const db = await getDb();
    const [saved] = await db
      .select()
      .from(customerAddresses)
      .where(
        and(
          eq(customerAddresses.userId, session.user.id),
          eq(customerAddresses.isDefault, true),
        ),
      )
      .orderBy(desc(customerAddresses.updatedAt))
      .limit(1);
    if (saved) {
      initialAddress = {
        name: saved.name,
        street: saved.street,
        npa: saved.npa,
        city: saved.city,
        canton: saved.canton,
      };
    }
  }

  return (
    <div className="s3d-page py-10 md:py-16">
      {/* Un seul h1. Colonne plus étroite que le panier : un formulaire se
          lit sur une mesure courte, pas sur 1440 px. Ni Lenis ni canvas ici
          (page hors du groupe (site)) : rien ne bouge autour des iframes
          Stripe. */}
      <div className="mx-auto max-w-5xl">
        <PageHeader title={t("title")} />
        <div className="mt-8">
          {/* Messages client du tunnel, déclarés ici et non dans le layout :
              la page de retour Stripe (checkout/success) est dessous et n'en
              a pas besoin. `footer` : les mentions sous le bouton de paiement. */}
          <ClientMessages
            namespaces={["checkout", "footer", "system.checkout"]}
          >
            <CheckoutFlow
              shippingSettings={await getShippingSettings()}
              initialAddress={initialAddress}
              sessionEmail={session?.user.email ?? null}
              stripePublishableKey={env.STRIPE_PUBLISHABLE_KEY ?? ""}
            />
          </ClientMessages>
        </div>
      </div>
    </div>
  );
}

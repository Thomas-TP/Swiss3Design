import { and, desc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { customerAddresses } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { CheckoutFlow, type CheckoutAddress } from "./checkout-flow";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const t = await getTranslations("checkout");

  // Interrupteur Samsung Pay côté serveur (wrangler.jsonc) : vide en prod
  // (service partenaire pas encore approuvé), STAGE sur le Worker preview —
  // le banc d'essai suit ainsi le workflow branche → preview sans toucher
  // au checkout LIVE.
  const { env } = await getCloudflareContext({ async: true });
  const samsungPay = {
    serviceId: env.SAMSUNG_PAY_SERVICE_ID ?? "",
    environment: env.SAMSUNG_PAY_ENV ?? "",
    // « Custom payment method » Stripe (cpmt_…) : tuile SAMSUNG Pay affichée
    // DANS le Payment Element. Vide → repli sur le bouton autonome.
    cpmtId: env.SAMSUNG_PAY_CPMT_ID ?? "",
  };

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
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-16">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
        {t("title")}
      </h1>
      <div className="mt-8">
        <CheckoutFlow
          initialAddress={initialAddress}
          sessionEmail={session?.user.email ?? null}
          samsungPay={samsungPay}
        />
      </div>
    </div>
  );
}

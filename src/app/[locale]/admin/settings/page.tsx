import { getSetting } from "@/db/queries";
import { requireAdmin } from "@/lib/session";
import { SHIPPING_CENTS, FREE_SHIPPING_OVER_CENTS } from "@/lib/shipping";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [shipping, freeOver] = await Promise.all([
    getSetting("shipping_cents"),
    getSetting("free_shipping_over_cents"),
  ]);

  return (
    <div className="max-w-lg">
      <h2 className="mb-1 text-xl font-bold">Réglages de la boutique</h2>
      <p className="mb-5 text-sm text-soft">
        Frais de port appliqués au panier (tarif unique pour toute la Suisse).
      </p>
      <SettingsForm
        shippingChf={(Number(shipping ?? SHIPPING_CENTS) / 100).toFixed(2)}
        freeOverChf={(
          Number(freeOver ?? FREE_SHIPPING_OVER_CENTS) / 100
        ).toFixed(2)}
      />
    </div>
  );
}

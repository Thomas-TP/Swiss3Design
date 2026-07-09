import { getSetting } from "@/db/queries";
import { requireAdmin } from "@/lib/session";
import { SHIPPING_CENTS, FREE_SHIPPING_OVER_CENTS } from "@/lib/shipping";
import { SettingsForm } from "./settings-form";
import { MaintenanceButton } from "./maintenance-button";

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

      <section className="mt-8 rounded-card border border-line bg-surface p-5 sm:p-6">
        <h3 className="font-semibold">Maintenance des données</h3>
        <p className="mb-4 mt-1 text-sm leading-relaxed text-soft">
          Supprime les fichiers 3D orphelins (uploads jamais transformés en
          demande) et applique la rétention : les fichiers et devis de plus de 2
          ans sont effacés (les devis payés sont conservés sans leur fichier).
          Peut aussi être planifié quotidiennement via un cron appelant{" "}
          <code className="rounded bg-paper px-1 py-0.5 text-xs">
            POST /api/cron/maintenance
          </code>{" "}
          avec l&apos;en-tête{" "}
          <code className="rounded bg-paper px-1 py-0.5 text-xs">
            Authorization: Bearer CRON_SECRET
          </code>
          .
        </p>
        <MaintenanceButton />
      </section>
    </div>
  );
}

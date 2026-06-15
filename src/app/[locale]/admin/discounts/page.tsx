import { desc } from "drizzle-orm";
import { Plus, Ticket } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/db";
import { discountCodes } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { formatChf } from "@/lib/format";
import { BTN_PRIMARY } from "../ui";

export default async function AdminDiscountsPage() {
  await requireAdmin();
  const db = await getDb();
  const rows = await db
    .select()
    .from(discountCodes)
    .orderBy(desc(discountCodes.createdAt));

  // Server component dynamique : l'horloge est stable sur la durée du rendu
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold tracking-tight">Codes promo</h2>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-soft">
          {rows.length} code{rows.length > 1 ? "s" : ""}
        </p>
        <Link href="/admin/discounts/new" className={BTN_PRIMARY}>
          <Plus size={16} />
          Nouveau code
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-10 text-center text-soft">
          <p className="font-medium">Aucun code promo.</p>
          <p className="mt-1 text-sm">
            Créez un code pour offrir une remise au panier.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface px-4">
          {rows.map((d) => {
            const expired = d.expiresAt != null && d.expiresAt.getTime() < now;
            const exhausted = d.maxUses != null && d.usedCount >= d.maxUses;
            const live = d.active && !expired && !exhausted;
            return (
              <li key={d.id} className="flex items-center gap-3 py-3.5">
                <Ticket size={16} className="shrink-0 text-soft" />
                <Link
                  href={`/admin/discounts/${d.id}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {d.code}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        live
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-line text-soft"
                      }`}
                    >
                      {live
                        ? "Actif"
                        : expired
                          ? "Expiré"
                          : exhausted
                            ? "Épuisé"
                            : "Inactif"}
                    </span>
                  </p>
                  <p className="text-xs text-soft">
                    {d.type === "percent"
                      ? `−${d.value}%`
                      : `−${formatChf(d.value, "fr")}`}
                    {d.minSubtotalCents != null &&
                      ` · min ${formatChf(d.minSubtotalCents, "fr")}`}
                    {` · ${d.usedCount}${d.maxUses != null ? `/${d.maxUses}` : ""} utilisé(s)`}
                    {d.expiresAt &&
                      ` · exp. ${d.expiresAt.toLocaleDateString("fr-CH")}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { getDb } from "@/db";
import { Link } from "@/i18n/navigation";
import {
  loadAdminStock,
  type AdminStock,
  loadConsumptions,
  loadMovements,
} from "@/lib/filament/admin-data";
import { SPOOL_LOCATION_FR, SPOOL_TYPE_FR } from "@/lib/filament/constants";
import { summarizeCosts } from "@/lib/filament/costs";
import { isMissingTable } from "@/lib/filament/stock-db";
import { requireAdmin } from "@/lib/session";
import { BuyTab } from "./buy-tab";
import { InventoryTab } from "./inventory-tab";
import { CostsTab, MovementsTab, PurchasesTab, RefsTab } from "./other-tabs";
import { QuickWeigh, type WeighRow } from "./quick-weigh";

export const dynamic = "force-dynamic";

const TABS = [
  ["inventaire", "Inventaire"],
  ["pesee", "Pesée rapide"],
  ["achats", "Achats"],
  ["acheter", "À acheter"],
  ["mouvements", "Mouvements"],
  ["couts", "Coûts"],
  ["references", "Références"],
] as const;

export default async function AdminFilamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; kind?: string }>;
}) {
  await requireAdmin();
  const { tab: rawTab, kind } = await searchParams;
  const tab = TABS.some(([key]) => key === rawTab) ? rawTab! : "inventaire";
  const db = await getDb();

  let stock: AdminStock | null = null;
  try {
    stock = await loadAdminStock(db);
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }

  let content;
  if (!stock) {
    content = (
      <p className="rounded-card border border-line bg-surface p-6 text-sm">
        Les tables du stock de filament n&apos;existent pas encore dans cette
        base : appliquez la migration
        <code className="mx-1">drizzle-pg/0010_filament_stock.sql</code> puis
        rechargez.
      </p>
    );
  } else if (tab === "inventaire") content = <InventoryTab stock={stock} />;
  else if (tab === "pesee") {
    const byId = new Map(stock.refs.map((r) => [r.id, r]));
    const rows: WeighRow[] = stock.spools
      .filter((s) => s.status === "in_stock")
      .sort(
        (a, b) =>
          (a.location ?? "z").localeCompare(b.location ?? "z") ||
          (a.slot ?? "").localeCompare(b.slot ?? ""),
      )
      .map((s) => {
        const ref = byId.get(s.refId)!;
        return {
          id: s.id,
          label: `${ref.officialName} · ${ref.brand} ${ref.rangeName}`,
          hexes: [ref.hex, ref.hex2, ref.hex3].filter((h): h is string =>
            Boolean(h),
          ),
          typeLabel: SPOOL_TYPE_FR[s.spoolType],
          location: s.location
            ? SPOOL_LOCATION_FR[s.location]
            : "emplacement ?",
          tare: s.tareGrams,
          remaining: s.remainingGrams,
          initial: s.initialGrams,
        };
      });
    content = <QuickWeigh rows={rows} />;
  } else if (tab === "achats") content = <PurchasesTab stock={stock} />;
  else if (tab === "acheter") content = <BuyTab stock={stock} />;
  else if (tab === "mouvements") {
    const movements = await loadMovements(db, { kind });
    content = <MovementsTab movements={movements} kind={kind} />;
  } else if (tab === "couts") {
    const consumptions = await loadConsumptions(db);
    content = (
      <CostsTab
        costs={summarizeCosts(
          stock.spools.map((s) => ({
            id: s.id,
            costCents: s.costCents,
            initialGrams: s.initialGrams,
            remainingGrams: s.remainingGrams,
            status: s.status,
          })),
          consumptions,
        )}
      />
    );
  } else content = <RefsTab stock={stock} />;

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold tracking-tight">
        Stock de filament
      </h2>
      <p className="mb-5 max-w-2xl text-sm text-soft">
        Les bobines de l&apos;atelier : grammes restants, réservés par les
        commandes du Studio, les articles imprimés à la demande de la boutique
        et les devis, à acheter. Les couleurs de la boutique sont les références
        « sur mesure » de l&apos;onglet Références (décochables article par
        article dans la fiche produit).
      </p>
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-line pb-3 text-sm">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/filaments?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 ${tab === key ? "border-ink bg-ink text-paper" : "border-line text-soft hover:border-ink hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {content}
    </div>
  );
}

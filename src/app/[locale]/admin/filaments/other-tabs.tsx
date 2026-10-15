import { FilamentChip } from "@/components/filament-chip";
import type { AdminStock, MovementRow } from "@/lib/filament/admin-data";
import {
  MOVEMENT_KIND_FR,
  SPOOL_TYPE_FR,
  SPOOL_TYPE_LIST,
} from "@/lib/filament/constants";
import type { CostSummary } from "@/lib/filament/costs";
import { FILAMENT_IDS } from "@/lib/studio/filaments";
import { Link } from "@/i18n/navigation";
import { FIELD } from "../ui";
import { ActionForm, SubmitButton } from "./action-form";
import {
  addHolder,
  cancelPurchase,
  receivePurchaseAction,
  retireHolder,
  saveRef,
  saveTarePresets,
} from "./actions";

const eur = (cents: number | null) =>
  cents === null ? "—" : `${(cents / 100).toFixed(2).replace(".", ",")} €`;
const chf = (cents: number | null) =>
  cents === null ? "—" : `CHF ${(cents / 100).toFixed(2)}`;
const dateFr = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("fr-CH") : "—";
const dateTimeFr = (d: Date) =>
  new Date(d).toLocaleString("fr-CH", {
    dateStyle: "short",
    timeStyle: "short",
  });

// ── Achats ───────────────────────────────────────────────────────────────────

export function PurchasesTab({ stock }: { stock: AdminStock }) {
  const refById = new Map(stock.refs.map((r) => [r.id, r]));
  return (
    <div className="space-y-4">
      {stock.purchases.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-5 text-sm">
          Aucun achat. Créez-en un depuis « À acheter » (panier Bambu).
        </p>
      ) : null}
      {stock.purchases.map((p) => {
        const lines = stock.spools.filter((s) => s.purchaseId === p.id);
        return (
          <section
            key={p.id}
            className="rounded-card border border-line bg-surface p-4"
          >
            <header className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <h3 className="text-sm font-semibold">
                {p.supplier}
                {p.reference ? ` · ${p.reference}` : ""}
              </h3>
              <span className="rounded-full bg-stone-500/15 px-2 py-0.5 text-[11px] font-medium">
                {p.status === "ordered"
                  ? "Commandé"
                  : p.status === "received"
                    ? "Reçu"
                    : "Annulé"}
              </span>
              <span className="text-xs text-soft">
                {dateFr(p.orderedAt)} · {p.spoolCount} unité(s) · EUR{" "}
                {eur(p.totalEurCents)} · payé {chf(p.totalCents)}
              </span>
            </header>
            {lines.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm">
                {Object.entries(
                  lines.reduce<Record<string, number>>((acc, s) => {
                    const key = `${s.refId}|${s.spoolType}`;
                    acc[key] = (acc[key] ?? 0) + 1;
                    return acc;
                  }, {}),
                ).map(([key, qty]) => {
                  const [refId, type] = key.split("|");
                  const ref = refById.get(refId);
                  return (
                    <li key={key} className="flex items-center gap-2">
                      <FilamentChip
                        hexes={
                          ref
                            ? [ref.hex, ref.hex2, ref.hex3].filter(
                                (h): h is string => Boolean(h),
                              )
                            : []
                        }
                        size={14}
                      />
                      {qty} × {ref?.officialName ?? "?"} ·{" "}
                      {SPOOL_TYPE_FR[type as keyof typeof SPOOL_TYPE_FR]}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {p.status === "ordered" ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <ActionForm
                  action={receivePurchaseAction}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="id" value={p.id} />
                  <input
                    name="totalChf"
                    inputMode="decimal"
                    placeholder="Total payé en CHF"
                    className={`${FIELD} max-w-44`}
                  />
                  <SubmitButton>Réceptionner</SubmitButton>
                </ActionForm>
                <ActionForm action={cancelPurchase}>
                  <input type="hidden" name="id" value={p.id} />
                  <SubmitButton ghost>Annuler l&apos;achat</SubmitButton>
                </ActionForm>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

// ── Mouvements ───────────────────────────────────────────────────────────────

export function MovementsTab({
  movements,
  kind,
}: {
  movements: MovementRow[];
  kind?: string;
}) {
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2 text-xs">
        <Link
          href="/admin/filaments?tab=mouvements"
          className={`rounded-full border px-3 py-1 ${!kind ? "border-ink" : "border-line"}`}
        >
          Tous
        </Link>
        {Object.entries(MOVEMENT_KIND_FR).map(([k, v]) => (
          <Link
            key={k}
            href={`/admin/filaments?tab=mouvements&kind=${k}`}
            className={`rounded-full border px-3 py-1 ${kind === k ? "border-ink" : "border-line"}`}
          >
            {v}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-soft">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Bobine</th>
              <th className="px-4 py-2">Mouvement</th>
              <th className="px-4 py-2 text-right">Δ</th>
              <th className="px-4 py-2 text-right">Après</th>
              <th className="px-4 py-2">Détail</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-t border-line align-top">
                <td className="px-4 py-2 whitespace-nowrap">
                  {dateTimeFr(m.createdAt)}
                </td>
                <td className="px-4 py-2">{m.refLabel}</td>
                <td className="px-4 py-2">
                  {MOVEMENT_KIND_FR[m.kind as keyof typeof MOVEMENT_KIND_FR] ??
                    m.kind}
                </td>
                <td
                  className={`px-4 py-2 text-right tabular-nums ${m.deltaGrams < 0 ? "text-accent-text" : ""}`}
                >
                  {m.deltaGrams > 0 ? "+" : ""}
                  {m.deltaGrams} g
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {m.gramsAfter} g
                </td>
                <td className="px-4 py-2 text-xs text-soft">
                  {m.grossGrams !== null
                    ? `brut ${m.grossGrams} g − tare ${m.tareGrams} g · `
                    : ""}
                  {m.orderId ? (
                    <Link
                      href={`/admin/orders/${m.orderId}`}
                      className="underline"
                    >
                      commande
                    </Link>
                  ) : null}
                  {m.quoteId ? (
                    <Link
                      href={`/admin/quotes/${m.quoteId}`}
                      className="underline"
                    >
                      devis
                    </Link>
                  ) : null}
                  {m.note ? ` ${m.note}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {movements.length === 0 ? (
          <p className="p-5 text-sm text-soft">Aucun mouvement.</p>
        ) : null}
      </div>
    </div>
  );
}

// ── Coûts ────────────────────────────────────────────────────────────────────

export function CostsTab({ costs }: { costs: CostSummary }) {
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-surface p-4">
          <dt className="text-xs text-soft">
            Coût moyen au kilo (achats réels)
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {costs.avgCentsPerKg === null ? "—" : chf(costs.avgCentsPerKg)}
          </dd>
        </div>
        <div className="rounded-card border border-line bg-surface p-4">
          <dt className="text-xs text-soft">Valeur du stock</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {chf(costs.stockValueCents)}
          </dd>
          {costs.stockWithoutCost > 0 ? (
            <p className="mt-1 text-xs text-soft">
              {costs.stockWithoutCost} bobine(s) sans prix : non comptées.
            </p>
          ) : null}
        </div>
        <div className="rounded-card border border-line bg-surface p-4">
          <dt className="text-xs text-soft">Consommation du dernier mois</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {costs.monthly[0] ? `${costs.monthly[0].grams} g` : "—"}
          </dd>
        </div>
      </dl>
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-soft">
            <tr>
              <th className="px-4 py-2">Mois</th>
              <th className="px-4 py-2 text-right">Consommé</th>
              <th className="px-4 py-2 text-right">Valeur</th>
            </tr>
          </thead>
          <tbody>
            {costs.monthly.map((m) => (
              <tr key={m.month} className="border-t border-line">
                <td className="px-4 py-2">{m.month}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {m.grams} g
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {chf(m.costCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {costs.monthly.length === 0 ? (
          <p className="p-5 text-sm text-soft">
            Aucune consommation décomptée.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── Références et réglages ───────────────────────────────────────────────────

function RefForm({ ref_ }: { ref_?: AdminStock["refs"][number] }) {
  const f = (name: string) =>
    ref_
      ? String((ref_ as unknown as Record<string, unknown>)[name] ?? "")
      : "";
  const cents = (v: number | null | undefined) =>
    v === null || v === undefined ? "" : (v / 100).toFixed(2);
  return (
    <ActionForm
      action={saveRef}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {ref_ ? <input type="hidden" name="id" value={ref_.id} /> : null}
      <label className="text-xs text-soft">
        Marque
        <input
          name="brand"
          required
          defaultValue={f("brand")}
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className="text-xs text-soft">
        Gamme
        <input
          name="rangeName"
          required
          defaultValue={f("rangeName")}
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className="text-xs text-soft">
        Nom officiel
        <input
          name="officialName"
          required
          defaultValue={f("officialName")}
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className="text-xs text-soft">
        Code produit
        <input
          name="productCode"
          defaultValue={f("productCode")}
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className="text-xs text-soft">
        Hex officiel
        <input
          name="hex"
          required
          defaultValue={f("hex") || "#"}
          pattern="#[0-9A-Fa-f]{6}"
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className="text-xs text-soft">
        2e teinte (tricolore)
        <input
          name="hex2"
          defaultValue={f("hex2")}
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className="text-xs text-soft">
        3e teinte
        <input
          name="hex3"
          defaultValue={f("hex3")}
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className="text-xs text-soft">
        Id de la palette du Studio
        <select
          name="studioId"
          defaultValue={f("studioId")}
          className={`${FIELD} mt-1`}
        >
          <option value="">(hors Studio)</option>
          {FILAMENT_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-soft">
        Net d&apos;une bobine (g)
        <input
          name="spoolNetGrams"
          defaultValue={ref_ ? f("spoolNetGrams") : "1000"}
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className="text-xs text-soft">
        Seuil de réassort (g dispo)
        <input
          name="reorderBelowGrams"
          defaultValue={ref_ ? f("reorderBelowGrams") : "300"}
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className="text-xs text-soft">
        Bobines neuves de réserve
        <input
          name="minSpareSpools"
          defaultValue={ref_ ? f("minSpareSpools") : "0"}
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className="text-xs text-soft">
        Prix avec bobine (€)
        <input
          name="priceSpoolEur"
          defaultValue={cents(ref_?.priceSpoolEurCents)}
          inputMode="decimal"
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className="text-xs text-soft">
        Prix recharge (€)
        <input
          name="priceRefillEur"
          defaultValue={cents(ref_?.priceRefillEurCents)}
          inputMode="decimal"
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className="text-xs text-soft">
        Lien avec bobine
        <input
          name="urlSpool"
          defaultValue={f("urlSpool")}
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className="text-xs text-soft">
        Lien recharge
        <input
          name="urlRefill"
          defaultValue={f("urlRefill")}
          className={`${FIELD} mt-1`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-4 text-xs sm:col-span-2 lg:col-span-4">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="customOk"
            defaultChecked={ref_?.customOk ?? false}
          />{" "}
          Proposée en sur mesure et en boutique
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="hexConfirmed"
            defaultChecked={ref_?.hexConfirmed ?? true}
          />{" "}
          Teinte confirmée
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="active"
            defaultChecked={ref_?.active ?? true}
          />{" "}
          Active
        </label>
        <input
          name="note"
          defaultValue={f("note")}
          placeholder="Note"
          className={`${FIELD} max-w-xs`}
        />
        <SubmitButton>
          {ref_ ? "Enregistrer" : "Ajouter la référence"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function RefsTab({ stock }: { stock: AdminStock }) {
  return (
    <div className="space-y-6">
      <section className="rounded-card border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold">
          Tare par défaut selon le type de bobine
        </h3>
        <p className="mt-1 text-xs text-soft">
          La pesée rapide propose la tare du type. Une recharge montée = support
          + mandrin en carton (à vérifier en pesant un mandrin vide). Les
          bobines existantes gardent leur propre tare.
        </p>
        <ActionForm
          action={saveTarePresets}
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          {SPOOL_TYPE_LIST.map((t) => (
            <label key={t} className="text-xs text-soft">
              {SPOOL_TYPE_FR[t]}
              <input
                name={`tare:${t}`}
                defaultValue={stock.tarePresets[t]}
                inputMode="numeric"
                className={`${FIELD} mt-1 w-28`}
              />
            </label>
          ))}
          <SubmitButton ghost>Enregistrer</SubmitButton>
        </ActionForm>
      </section>

      <section className="rounded-card border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold">
          Supports plastique Bambu vides ({stock.freeHolders} libre(s))
        </h3>
        <ul className="mt-3 space-y-1 text-sm">
          {stock.holders
            .filter((h) => !h.retiredAt)
            .map((h) => (
              <li key={h.id} className="flex items-center gap-3">
                <span>
                  Support {h.tareGrams} g{h.note ? ` · ${h.note}` : ""}
                </span>
                <span className="text-xs text-soft">
                  {h.inUse ? "sous une bobine" : "libre"}
                </span>
                {!h.inUse ? (
                  <ActionForm action={retireHolder}>
                    <input type="hidden" name="id" value={h.id} />
                    <SubmitButton ghost>Retirer</SubmitButton>
                  </ActionForm>
                ) : null}
              </li>
            ))}
        </ul>
        <ActionForm
          action={addHolder}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <input
            name="tareGrams"
            defaultValue={stock.tarePresets.bambu_reusable}
            inputMode="numeric"
            className={`${FIELD} w-24`}
            aria-label="Tare du support (g)"
          />
          <input
            name="note"
            placeholder="Note"
            className={`${FIELD} max-w-xs`}
          />
          <SubmitButton ghost>Ajouter un support vide</SubmitButton>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">
          Références ({stock.refs.length})
        </h3>
        {stock.refs.map((r) => (
          <details
            key={r.id}
            className="rounded-card border border-line bg-surface p-4"
          >
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
              <FilamentChip
                hexes={[r.hex, r.hex2, r.hex3].filter((h): h is string =>
                  Boolean(h),
                )}
                size={18}
              />
              <span className="font-medium">{r.officialName}</span>
              <span className="text-soft">
                {r.brand} · {r.rangeName}
                {r.studioId ? ` · Studio (${r.studioId})` : ""}
              </span>
            </summary>
            <div className="mt-4">
              <RefForm ref_={r} />
            </div>
          </details>
        ))}
        <details className="rounded-card border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Ajouter une référence
          </summary>
          <div className="mt-4">
            <RefForm />
          </div>
        </details>
      </section>
    </div>
  );
}

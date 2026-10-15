import { FilamentChip } from "@/components/filament-chip";
import type { AdminStock } from "@/lib/filament/admin-data";
import {
  planBasket,
  suggestPurchases,
  type BasketOption,
  type BuyRefInput,
} from "@/lib/filament/shopping";
import { FIELD } from "../ui";
import { ActionForm, SubmitButton } from "./action-form";
import { createPurchase } from "./actions";

const eur = (cents: number) =>
  `${(cents / 100).toFixed(2).replace(".", ",")} €`;

function toInputs(stock: AdminStock): BuyRefInput[] {
  return stock.refs
    .filter(
      (r) => r.active && (r.studioId || r.minSpareSpools > 0 || r.customOk),
    )
    .map((r) => {
      const a = stock.availability.get(r.id);
      return {
        refId: r.id,
        label: `${r.brand} ${r.rangeName} · ${r.officialName}`,
        studio: Boolean(r.studioId),
        customOk: r.customOk,
        available: a?.available ?? 0,
        orderedGrams: a?.orderedGrams ?? 0,
        sealed: a?.sealedCount ?? 0,
        ordered: a?.orderedCount ?? 0,
        reorderBelowGrams: r.reorderBelowGrams,
        minSpareSpools: r.minSpareSpools,
        priceSpoolEurCents: r.priceSpoolEurCents,
        priceRefillEurCents: r.priceRefillEurCents,
        urlSpool: r.urlSpool,
        urlRefill: r.urlRefill,
        gramsPerDay: stock.gramsPerDay[r.id],
      };
    });
}

function BasketCard({
  title,
  option,
  labels,
  hexes,
  highlight,
}: {
  title: string;
  option: BasketOption;
  labels: Map<string, string>;
  hexes: Map<string, string[]>;
  highlight?: boolean;
}) {
  const t = option.totals;
  const payload = JSON.stringify(
    option.lines.map((l) => ({ refId: l.refId, format: l.format, qty: l.qty })),
  );
  return (
    <section
      className={`rounded-card border bg-surface p-4 ${highlight ? "border-ink" : "border-line"}`}
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-1.5 text-sm">
        {option.lines.map((l) => (
          <li
            key={`${l.refId}-${l.format}-${l.extra}`}
            className="flex flex-wrap items-center gap-2"
          >
            <FilamentChip hexes={hexes.get(l.refId) ?? []} size={16} />
            <span className="tabular-nums">{l.qty} ×</span>
            <span className="min-w-0 flex-1">
              {labels.get(l.refId)} ·{" "}
              {l.format === "refill" ? "recharge" : "avec bobine"}
              {l.extra ? " (pour le palier)" : ""}
              {l.needsHolder ? " · support à prévoir" : ""}
            </span>
            {l.url ? (
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline"
              >
                Fiche
              </a>
            ) : null}
            <span className="tabular-nums text-soft">
              {eur(l.unitEurCents)}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:max-w-sm">
        <dt className="text-soft">{t.units} unités, prix catalogue</dt>
        <dd className="text-right tabular-nums">{eur(t.listEurCents)}</dd>
        <dt className="text-soft">Remise −{t.tierPercent} %</dt>
        <dd className="text-right tabular-nums">− {eur(t.discountEurCents)}</dd>
        <dt className="text-soft">Port (Suisse)</dt>
        <dd className="text-right tabular-nums">
          {t.shippingEurCents === 0 ? "offert" : eur(t.shippingEurCents)}
        </dd>
        <dt className="font-semibold">Total</dt>
        <dd className="text-right font-semibold tabular-nums">
          {eur(t.totalEurCents)}
        </dd>
      </dl>
      {t.freeShippingGapEurCents > 0 ? (
        <p className="mt-2 text-xs text-soft">
          Encore {eur(t.freeShippingGapEurCents)} pour le port offert (dès 119
          €, après remise).
        </p>
      ) : null}
      {option.extras > 0 ? (
        <p className="mt-2 text-xs text-soft">
          {option.extras} unité(s) de plus que le besoin : surcoût de{" "}
          {eur(option.marginalEurCents)} au total (
          {eur(option.marginalPerExtraEurCents ?? 0)} l&apos;unité, port
          compris).
        </p>
      ) : null}
      <ActionForm
        action={createPurchase}
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="lines" value={payload} />
        <input
          type="hidden"
          name="totalEur"
          value={(t.totalEurCents / 100).toFixed(2)}
        />
        <input
          name="reference"
          placeholder="N° de commande Bambu (facultatif)"
          className={`${FIELD} max-w-xs`}
        />
        <SubmitButton ghost>Enregistrer comme commandé</SubmitButton>
      </ActionForm>
    </section>
  );
}

export function BuyTab({ stock }: { stock: AdminStock }) {
  const inputs = toInputs(stock);
  const labels = new Map(inputs.map((i) => [i.refId, i.label]));
  const hexes = new Map(
    stock.refs.map((r) => [
      r.id,
      [r.hex, r.hex2, r.hex3].filter((h): h is string => Boolean(h)),
    ]),
  );
  // Seules les couleurs suivies pour le réassort (Studio ou réserve voulue) déclenchent un achat.
  const tracked = inputs.filter((i) => i.studio || i.minSpareSpools > 0);
  const suggestions = suggestPurchases(tracked);
  const needIds = new Set(suggestions.map((s) => s.refId));
  const extras = tracked
    .filter((i) => !needIds.has(i.refId))
    .concat(
      inputs.filter((i) => !i.studio && i.minSpareSpools === 0 && i.customOk),
    )
    .filter(
      (i) => i.priceRefillEurCents !== null || i.priceSpoolEurCents !== null,
    )
    .sort(
      (a, b) => a.available + a.orderedGrams - (b.available + b.orderedGrams),
    )
    .map((i) => ({
      refId: i.refId,
      qty: 1,
      reason: "spare" as const,
      coverDays: null,
    }));
  const plan = planBasket(inputs, suggestions, extras, stock.freeHolders);
  const base = plan.options[0];
  const recommended = plan.recommended;
  const byRef = new Map(inputs.map((i) => [i.refId, i]));

  return (
    <div className="space-y-6">
      <p className="text-sm text-soft">
        Une couleur est à acheter si ce qu&apos;il y aura (disponible +
        commandé) passe sous son seuil (300 g par défaut), ou si elle n&apos;a
        plus de bobine neuve de réserve. {stock.freeHolders} support(s) vide(s)
        libre(s) : une recharge n&apos;est proposée que s&apos;il en reste un,
        sinon une bobine avec support.
      </p>

      {suggestions.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-5 text-sm">
          Rien à acheter pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-soft">
              <tr>
                <th className="px-4 py-2">Couleur</th>
                <th className="px-4 py-2">Pourquoi</th>
                <th className="px-4 py-2 text-right">Disponible</th>
                <th className="px-4 py-2 text-right">Commandé</th>
                <th className="px-4 py-2 text-right">Couverture</th>
                <th className="px-4 py-2 text-right">Qté conseillée</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => {
                const i = byRef.get(s.refId)!;
                return (
                  <tr key={s.refId} className="border-t border-line">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <FilamentChip
                          hexes={hexes.get(s.refId) ?? []}
                          size={16}
                        />
                        {i.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-soft">
                      {s.reason === "below"
                        ? "Sous le seuil"
                        : s.reason === "spare"
                          ? "Pas de réserve neuve"
                          : "Sous le seuil et sans réserve"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {i.available} g
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {i.ordered} bobine(s)
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {s.coverDays === null ? "—" : `${s.coverDays} j`}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {s.qty}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {base.totals.units > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Panier Bambu Lab Europe</h2>
          <p className="text-xs text-soft">
            Les remises comptent bobines et recharges ensemble (−10 % à 2, −20 %
            à 4, −30 % à 6, −40 % à 10 unités). Les extras sont les couleurs les
            moins fournies, ajoutées seulement si chaque unité ajoutée coûte
            moins de la moitié de son prix catalogue.
          </p>
          {recommended && recommended.extras > 0 ? (
            <BasketCard
              title="Recommandé : regrouper pour le palier"
              option={recommended}
              labels={labels}
              hexes={hexes}
              highlight
            />
          ) : null}
          <BasketCard
            title={
              recommended && recommended.extras > 0
                ? "Besoin réel seulement"
                : "Besoin réel"
            }
            option={base}
            labels={labels}
            hexes={hexes}
            highlight={!recommended || recommended.extras === 0}
          />
          {plan.options
            .filter((o) => o.extras > 0 && o !== recommended)
            .map((o) => (
              <BasketCard
                key={o.extras}
                title={`Autre option : +${o.extras} pour le palier −${o.totals.tierPercent} %`}
                option={o}
                labels={labels}
                hexes={hexes}
              />
            ))}
        </div>
      ) : null}
    </div>
  );
}

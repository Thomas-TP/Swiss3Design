import { FilamentChip } from "@/components/filament-chip";
import type {
  FilamentPanel,
  PanelSpool,
  QuotePanel,
} from "@/lib/filament/panel-data";
import { FIELD } from "../ui";
import { ActionForm, SubmitButton } from "./action-form";
import {
  consumeOrderFilament,
  consumeQuoteFilament,
  saveQuotePlan,
  undoOrderFilament,
  undoQuoteFilament,
} from "./consume-actions";

// Panneau « Filament » d'une commande (objets du Studio) ou d'un devis : ce que la
// pièce consomme par couleur, la bobine à débiter et les grammes RÉELS du slicer
// (le calcul du site n'est qu'une proposition, modifiable). Tant que le décompte
// n'est pas fait, ces grammes sont RÉSERVÉS : ils ne comptent plus comme disponibles.

/** La bobine la plus juste : la plus petite qui suffit, sinon la plus pleine. */
function bestSpool(spools: PanelSpool[], grams: number): string {
  const enough = spools
    .filter((s) => s.remainingGrams >= grams)
    .sort((a, b) => a.remainingGrams - b.remainingGrams);
  return (
    enough[0]?.id ??
    [...spools].sort((a, b) => b.remainingGrams - a.remainingGrams)[0]?.id ??
    ""
  );
}

function Rows({ panel }: { panel: FilamentPanel }) {
  return (
    <ul className="space-y-3">
      {panel.needs.map((need) => {
        const spools = panel.spools.filter((s) => s.refId === need.refId);
        return (
          <li
            key={need.refId ?? need.label}
            className="rounded-xl border border-line p-3 text-sm"
          >
            <p className="flex items-center gap-2 font-medium">
              <FilamentChip hexes={need.hexes} size={16} />
              {need.label}
              <span className="font-normal text-soft">· ≈ {need.grams} g</span>
            </p>
            {!need.refId || spools.length === 0 ? (
              <p className="mt-1 text-xs text-soft">
                {need.refId
                  ? "Aucune bobine en stock pour cette couleur."
                  : "Couleur non suivie : rien à décompter."}
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {[0, 1].map((row) => (
                  <div key={row} className="flex flex-wrap items-center gap-2">
                    <select
                      name="spool"
                      defaultValue={
                        row === 0 ? bestSpool(spools, need.grams) : ""
                      }
                      className={`${FIELD} max-w-56`}
                      aria-label={`Bobine ${row + 1} pour ${need.label}`}
                    >
                      {row === 1 ? (
                        <option value="">(2e bobine, si besoin)</option>
                      ) : null}
                      {spools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <input
                      name="grams"
                      inputMode="numeric"
                      defaultValue={row === 0 ? need.grams : ""}
                      placeholder="g"
                      className={`${FIELD} w-24`}
                      aria-label="Grammes réels"
                    />
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Done({ at, children }: { at: Date; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-emerald-700">
        Décompte fait le{" "}
        {new Date(at).toLocaleString("fr-CH", {
          dateStyle: "short",
          timeStyle: "short",
        })}
        .
      </span>
      {children}
    </div>
  );
}

export function OrderFilamentPanel({
  orderId,
  status,
  panel,
}: {
  orderId: string;
  status: string;
  panel: FilamentPanel;
}) {
  const open = ["paid", "in_production"].includes(status);
  return (
    <section className="mt-4 rounded-card border border-line bg-surface p-5">
      <h3 className="mb-1 font-semibold">Filament de la commande</h3>
      {panel.consumedAt ? (
        <Done at={panel.consumedAt}>
          <ActionForm action={undoOrderFilament}>
            <input type="hidden" name="orderId" value={orderId} />
            <SubmitButton ghost>Annuler le décompte</SubmitButton>
          </ActionForm>
        </Done>
      ) : (
        <>
          <p className="mb-3 text-xs text-soft">
            {open
              ? "À l'impression : confirmez les grammes réels du slicer et la bobine utilisée. Tant que ce n'est pas fait, ces grammes sont réservés."
              : status === "pending"
                ? "Commande en attente de paiement : ces grammes sont réservés jusqu'à l'expiration."
                : "Les grammes ne sont plus réservés (commande livrée, expédiée ou annulée). Décomptez-les si ce n'est pas fait."}
          </p>
          <ActionForm action={consumeOrderFilament} className="space-y-3">
            <input type="hidden" name="orderId" value={orderId} />
            <Rows panel={panel} />
            <SubmitButton>Décompter du stock</SubmitButton>
          </ActionForm>
        </>
      )}
    </section>
  );
}

export function QuoteFilamentPanel({
  quoteId,
  panel,
}: {
  quoteId: string;
  panel: QuotePanel;
}) {
  return (
    <section className="mt-4 rounded-card border border-line bg-surface p-5">
      <h3 className="mb-1 font-semibold">Filament du devis</h3>
      <p className="mb-3 text-xs text-soft">
        Quantité {panel.quantity}
        {panel.estGrams
          ? ` · estimation du client ≈ ${panel.estGrams} g par pièce (navigateur, indicative)`
          : ""}
        . Saisissez les grammes par couleur : ils réservent le stock dès que le
        devis est accepté.
      </p>
      {panel.chosen.length === 0 ? (
        <p className="text-sm text-soft">
          Le client n&apos;a choisi aucune couleur du stock.
        </p>
      ) : (
        <ActionForm
          action={saveQuotePlan}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="quoteId" value={quoteId} />
          {panel.chosen.map((c) => (
            <label key={c.refId} className="text-xs text-soft">
              <span className="flex items-center gap-1.5">
                <FilamentChip hexes={c.hexes} size={14} />
                {c.label}
              </span>
              <input
                name={`plan:${c.refId}`}
                inputMode="numeric"
                defaultValue={
                  c.planned ||
                  (panel.estGrams
                    ? Math.round(
                        (panel.estGrams * panel.quantity) / panel.chosen.length,
                      )
                    : "")
                }
                className={`${FIELD} mt-1 w-28`}
                aria-label={`Grammes pour ${c.label}`}
              />
            </label>
          ))}
          <SubmitButton ghost>Enregistrer les grammes</SubmitButton>
        </ActionForm>
      )}
      {panel.needs.length > 0 ? (
        <div className="mt-5 border-t border-line pt-4">
          {panel.consumedAt ? (
            <Done at={panel.consumedAt}>
              <ActionForm action={undoQuoteFilament}>
                <input type="hidden" name="quoteId" value={quoteId} />
                <SubmitButton ghost>Annuler le décompte</SubmitButton>
              </ActionForm>
            </Done>
          ) : (
            <ActionForm action={consumeQuoteFilament} className="space-y-3">
              <input type="hidden" name="quoteId" value={quoteId} />
              <Rows panel={panel} />
              <SubmitButton>Décompter du stock</SubmitButton>
            </ActionForm>
          )}
        </div>
      ) : null}
    </section>
  );
}

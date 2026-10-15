import { FilamentChip } from "@/components/filament-chip";
import type { AdminStock } from "@/lib/filament/admin-data";
import {
  SPOOL_LOCATION_FR,
  SPOOL_STATUS_FR,
  SPOOL_TYPE_FR,
  SPOOL_TYPE_LIST,
} from "@/lib/filament/constants";
import type { SpoolRow } from "@/lib/filament/stock-db";
import { FIELD } from "../ui";
import { ActionForm, SubmitButton } from "./action-form";
import {
  addSpool,
  adjustSpool,
  emptySpool,
  mountRefill,
  retireSpool,
  updateSpool,
  weighOne,
} from "./actions";

const SMALL = "rounded-lg border border-line bg-surface px-2 py-1 text-xs";

function RefTitle({ ref_ }: { ref_: AdminStock["refs"][number] }) {
  return (
    <>
      <span className="font-semibold text-ink">{ref_.officialName}</span>{" "}
      <span className="text-soft">
        {ref_.brand} · {ref_.rangeName}
        {ref_.productCode ? ` · ${ref_.productCode}` : ""}
      </span>
    </>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "neutral" | "warn" | "ok";
}) {
  const cls =
    tone === "warn"
      ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
      : tone === "ok"
        ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
        : "bg-stone-500/15 text-stone-700 dark:text-stone-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

function SpoolLine({ spool }: { spool: SpoolRow }) {
  const pct = Math.min(
    100,
    Math.round((spool.remainingGrams / spool.initialGrams) * 100),
  );
  const active = spool.status === "in_stock";
  return (
    <li className="border-t border-line px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span>{SPOOL_TYPE_FR[spool.spoolType]}</span>
            {spool.status !== "in_stock" ? (
              <Badge tone={spool.status === "ordered" ? "warn" : "neutral"}>
                {SPOOL_STATUS_FR[spool.status]}
              </Badge>
            ) : null}
            {spool.sealed && active ? <Badge tone="ok">Neuve</Badge> : null}
            {spool.toConfirm ? <Badge tone="warn">À confirmer</Badge> : null}
            {spool.spoolType === "bambu_refill" && !spool.holderId && active ? (
              <Badge tone="warn">À monter</Badge>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-soft">
            {spool.location
              ? SPOOL_LOCATION_FR[spool.location]
              : "Emplacement ?"}
            {spool.slot ? ` · ${spool.slot}` : ""} · tare {spool.tareGrams} g
            {!spool.tareConfirmed ? " (à vérifier)" : ""}
            {spool.note ? ` · ${spool.note}` : ""}
          </p>
        </div>
        <div className="w-40 shrink-0">
          <p className="text-right text-sm font-semibold tabular-nums">
            {spool.remainingGrams} g
            <span className="font-normal text-soft">
              {" "}
              / {spool.initialGrams}
            </span>
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {active ? (
          <ActionForm action={weighOne} className="flex items-center gap-1.5">
            <input type="hidden" name="id" value={spool.id} />
            <input
              name="gross"
              inputMode="numeric"
              placeholder="brut (g)"
              aria-label="Poids brut en grammes"
              className={`${SMALL} w-24`}
            />
            <SubmitButton ghost>Peser</SubmitButton>
          </ActionForm>
        ) : null}
      </div>
      {spool.status !== "retired" ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-soft">
            Modifier, ajuster, vider
          </summary>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <ActionForm
              action={updateSpool}
              className="space-y-2 rounded-xl border border-line p-3"
            >
              <input type="hidden" name="id" value={spool.id} />
              <div className="flex flex-wrap gap-2">
                <select
                  name="location"
                  defaultValue={spool.location ?? ""}
                  className={SMALL}
                >
                  <option value="">Emplacement ?</option>
                  {Object.entries(SPOOL_LOCATION_FR).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input
                  name="slot"
                  defaultValue={spool.slot ?? ""}
                  placeholder="Slot"
                  className={`${SMALL} w-20`}
                />
                <input
                  name="tareGrams"
                  defaultValue={spool.tareGrams}
                  inputMode="numeric"
                  className={`${SMALL} w-20`}
                  aria-label="Tare (g)"
                />
              </div>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name="tareConfirmed"
                  defaultChecked={spool.tareConfirmed}
                />{" "}
                Tare vérifiée
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name="toConfirm"
                  defaultChecked={spool.toConfirm}
                />{" "}
                Couleur à confirmer
              </label>
              <input
                name="note"
                defaultValue={spool.note ?? ""}
                placeholder="Note"
                className={`${SMALL} w-full`}
              />
              <SubmitButton ghost>Enregistrer</SubmitButton>
            </ActionForm>
            <div className="space-y-3">
              {active ? (
                <ActionForm
                  action={adjustSpool}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3"
                >
                  <input type="hidden" name="id" value={spool.id} />
                  <input
                    name="grams"
                    inputMode="numeric"
                    placeholder="± g"
                    className={`${SMALL} w-20`}
                    aria-label="Grammes à ajouter ou retirer"
                  />
                  <input
                    name="note"
                    placeholder="Motif"
                    className={`${SMALL} min-w-0 flex-1`}
                  />
                  <SubmitButton ghost>Ajuster</SubmitButton>
                </ActionForm>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {spool.spoolType === "bambu_refill" &&
                !spool.holderId &&
                active ? (
                  <ActionForm action={mountRefill}>
                    <input type="hidden" name="id" value={spool.id} />
                    <SubmitButton ghost>
                      Monter sur un support libre
                    </SubmitButton>
                  </ActionForm>
                ) : null}
                {active ? (
                  <ActionForm action={emptySpool}>
                    <input type="hidden" name="id" value={spool.id} />
                    <SubmitButton ghost>Bobine vide</SubmitButton>
                  </ActionForm>
                ) : null}
                <ActionForm action={retireSpool}>
                  <input type="hidden" name="id" value={spool.id} />
                  <SubmitButton ghost>Retirer</SubmitButton>
                </ActionForm>
              </div>
            </div>
          </div>
        </details>
      ) : null}
    </li>
  );
}

export function InventoryTab({ stock }: { stock: AdminStock }) {
  const { refs, spools, availability } = stock;
  const ordered = [...refs].sort(
    (a, b) =>
      Number(Boolean(b.studioId)) - Number(Boolean(a.studioId)) ||
      a.brand.localeCompare(b.brand) ||
      a.officialName.localeCompare(b.officialName),
  );
  const inStock = spools.filter((s) => s.status === "in_stock");
  const totalGrams = inStock.reduce((s, x) => s + x.remainingGrams, 0);
  return (
    <div className="space-y-6">
      <p className="text-sm text-soft">
        {inStock.length} bobine(s) en stock,{" "}
        {(totalGrams / 1000).toFixed(2).replace(".", ",")} kg au total ·{" "}
        {stock.freeHolders} support(s) plastique vide(s) libre(s) pour des
        recharges.
      </p>

      <div className="space-y-4">
        {ordered.map((ref) => {
          const a = availability.get(ref.id);
          const mine = spools.filter((s) => s.refId === ref.id);
          if (mine.length === 0 && !ref.studioId) return null;
          return (
            <section
              key={ref.id}
              className="overflow-hidden rounded-card border border-line bg-surface"
            >
              <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <FilamentChip
                  hexes={[ref.hex, ref.hex2, ref.hex3].filter(
                    (h): h is string => Boolean(h),
                  )}
                  size={28}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <RefTitle ref_={ref} />
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {ref.studioId ? <Badge tone="ok">Studio</Badge> : null}
                    {ref.shopColorId ? <Badge>Boutique</Badge> : null}
                    {ref.customOk ? <Badge>Sur mesure</Badge> : null}
                    {!ref.hexConfirmed ? (
                      <Badge tone="warn">Teinte à confirmer</Badge>
                    ) : null}
                    {!ref.active ? <Badge tone="warn">Inactive</Badge> : null}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-x-5 text-right text-xs text-soft">
                  <div>
                    <dt>Restant</dt>
                    <dd className="text-sm font-semibold text-ink tabular-nums">
                      {a?.remaining ?? 0} g
                    </dd>
                  </div>
                  <div>
                    <dt>Réservé</dt>
                    <dd className="text-sm font-semibold text-ink tabular-nums">
                      {a?.reserved ?? 0} g
                    </dd>
                  </div>
                  <div>
                    <dt>Disponible</dt>
                    <dd
                      className={`text-sm font-semibold tabular-nums ${(a?.available ?? 0) < ref.reorderBelowGrams ? "text-accent-text" : "text-ink"}`}
                    >
                      {a?.available ?? 0} g
                    </dd>
                  </div>
                </dl>
              </header>
              {mine.length === 0 ? (
                <p className="border-t border-line px-4 py-3 text-sm text-soft">
                  Aucune bobine : couleur épuisée au Studio.
                </p>
              ) : (
                <ul>
                  {mine
                    .sort(
                      (x, y) =>
                        x.status.localeCompare(y.status) ||
                        y.remainingGrams - x.remainingGrams,
                    )
                    .map((s) => (
                      <SpoolLine key={s.id} spool={s} />
                    ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <details className="rounded-card border border-line bg-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Ajouter une bobine
        </summary>
        <ActionForm
          action={addSpool}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="text-xs text-soft">
            Couleur
            <select name="refId" required className={`${FIELD} mt-1`}>
              {refs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.brand} {r.rangeName} · {r.officialName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-soft">
            Type de bobine
            <select
              name="spoolType"
              className={`${FIELD} mt-1`}
              defaultValue="bambu_reusable"
            >
              {SPOOL_TYPE_LIST.map((t) => (
                <option key={t} value={t}>
                  {SPOOL_TYPE_FR[t]} (tare {stock.tarePresets[t]} g)
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-soft">
            Tare (g), vide = celle du type
            <input
              name="tareGrams"
              inputMode="numeric"
              className={`${FIELD} mt-1`}
            />
          </label>
          <label className="text-xs text-soft">
            Poids brut (g) lu sur la balance
            <input
              name="gross"
              inputMode="numeric"
              className={`${FIELD} mt-1`}
            />
          </label>
          <label className="text-xs text-soft">
            ou restant (g)
            <input
              name="remaining"
              inputMode="numeric"
              className={`${FIELD} mt-1`}
            />
          </label>
          <label className="text-xs text-soft">
            Emplacement
            <select name="location" className={`${FIELD} mt-1`}>
              <option value="">?</option>
              {Object.entries(SPOOL_LOCATION_FR).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-soft">
            Slot
            <input name="slot" className={`${FIELD} mt-1`} />
          </label>
          <label className="text-xs text-soft">
            Prix payé (CHF)
            <input
              name="costChf"
              inputMode="decimal"
              className={`${FIELD} mt-1`}
            />
          </label>
          <label className="text-xs text-soft">
            Date d&apos;achat
            <input name="purchasedAt" type="date" className={`${FIELD} mt-1`} />
          </label>
          <div className="flex flex-wrap items-center gap-4 text-xs sm:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="sealed" /> Neuve, non ouverte
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="toConfirm" /> Couleur à confirmer
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="tareConfirmed" /> Tare vérifiée
            </label>
            <input
              name="note"
              placeholder="Note"
              className={`${FIELD} max-w-xs`}
            />
            <SubmitButton>Ajouter</SubmitButton>
          </div>
        </ActionForm>
      </details>
      <p className="text-xs text-soft">
        Les types et leurs tares par défaut se règlent dans l&apos;onglet «
        Références ».{" "}
      </p>
    </div>
  );
}

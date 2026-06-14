"use client";

import { useActionState, useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  saveDiscount,
  deleteDiscount,
  type DiscountFormState,
} from "./actions";
import { FIELD, BTN_PRIMARY, BTN_GHOST } from "../ui";

export interface DiscountFormInitial {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number; // percent, ou centimes si fixed
  minSubtotalCents: number | null;
  maxUses: number | null;
  expiresAt: string | null; // YYYY-MM-DD
  active: boolean;
}

export function DiscountForm({ initial }: { initial?: DiscountFormInitial }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    DiscountFormState,
    FormData
  >(saveDiscount, {});
  const [type, setType] = useState<"percent" | "fixed">(
    initial?.type ?? "percent",
  );

  useEffect(() => {
    if (state.success) {
      router.push("/admin/discounts");
      router.refresh();
    }
  }, [state.success, router]);

  const initialValue =
    initial == null
      ? ""
      : initial.type === "fixed"
        ? (initial.value / 100).toFixed(2)
        : String(initial.value);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <section className="space-y-4 rounded-card border border-line bg-surface p-5 sm:p-6">
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">Code *</span>
          <input
            name="code"
            required
            defaultValue={initial?.code ?? ""}
            placeholder="BIENVENUE10"
            className={`${FIELD} uppercase`}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Type</span>
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as "percent" | "fixed")}
              className={FIELD}
            >
              <option value="percent">Pourcentage (%)</option>
              <option value="fixed">Montant fixe (CHF)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">
              {type === "percent" ? "Pourcentage (1–100)" : "Montant (CHF)"} *
            </span>
            <input
              name="value"
              required
              inputMode="decimal"
              defaultValue={initialValue}
              placeholder={type === "percent" ? "10" : "5.00"}
              className={FIELD}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">
              Min. d&apos;achat (CHF)
            </span>
            <input
              name="minSubtotal"
              inputMode="decimal"
              defaultValue={
                initial?.minSubtotalCents != null
                  ? (initial.minSubtotalCents / 100).toFixed(2)
                  : ""
              }
              placeholder="—"
              className={FIELD}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Usages max</span>
            <input
              name="maxUses"
              type="number"
              min={1}
              defaultValue={initial?.maxUses ?? ""}
              placeholder="∞"
              className={FIELD}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Expire le</span>
            <input
              name="expiresAt"
              type="date"
              defaultValue={initial?.expiresAt ?? ""}
              className={FIELD}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial?.active ?? true}
            className="h-4 w-4 accent-accent"
          />
          Actif
        </label>
      </section>

      {state.error && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={BTN_PRIMARY}>
          <Save size={16} />
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <Link href="/admin/discounts" className={BTN_GHOST}>
          Annuler
        </Link>
        {initial && <DeleteButton id={initial.id} />}
      </div>
    </form>
  );
}

function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  return (
    <button
      type="button"
      disabled={deleting}
      onClick={async () => {
        if (!confirm("Supprimer ce code promo ?")) return;
        setDeleting(true);
        try {
          await deleteDiscount(id);
          router.push("/admin/discounts");
          router.refresh();
        } catch {
          setDeleting(false);
          alert("Échec de la suppression, réessayez.");
        }
      }}
      className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-accent transition-colors hover:bg-red-500/20"
    >
      <Trash2 size={14} />
      Supprimer
    </button>
  );
}

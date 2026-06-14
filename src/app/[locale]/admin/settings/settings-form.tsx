"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { saveSettings, type SettingsState } from "./actions";
import { FIELD, BTN_PRIMARY } from "../ui";

export function SettingsForm({
  shippingChf,
  freeOverChf,
}: {
  shippingChf: string;
  freeOverChf: string;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    saveSettings,
    {},
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-card border border-line bg-surface p-5 sm:p-6"
    >
      <label className="block text-sm">
        <span className="mb-1.5 block font-semibold">
          Frais de livraison (CHF)
        </span>
        <input
          name="shipping"
          required
          inputMode="decimal"
          defaultValue={shippingChf}
          className={FIELD}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block font-semibold">
          Livraison offerte dès (CHF)
        </span>
        <input
          name="freeOver"
          required
          inputMode="decimal"
          defaultValue={freeOverChf}
          className={FIELD}
        />
      </label>
      {state.error && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p className="rounded-xl bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          Réglages enregistrés ✓
        </p>
      )}
      <button disabled={pending} className={BTN_PRIMARY}>
        <Save size={16} />
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

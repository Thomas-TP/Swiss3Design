"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { CANTONS } from "@/lib/cantons";
import { medusa } from "@/lib/medusa";
import { card, field, btnPrimary, btnGhost } from "../_ui";

export interface Address {
  id: string;
  address_name: string | null;
  is_default_shipping: boolean;
  first_name: string | null;
  last_name: string | null;
  address_1: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
}

interface AddressInput {
  label: string;
  name: string;
  street: string;
  npa: string;
  city: string;
  canton: string;
}

const EMPTY: AddressInput = { label: "", name: "", street: "", npa: "", city: "", canton: "" };

function toInput(a: Address): AddressInput {
  return {
    label: a.address_name ?? "",
    name: [a.first_name, a.last_name].filter(Boolean).join(" "),
    street: a.address_1 ?? "",
    npa: a.postal_code ?? "",
    city: a.city ?? "",
    canton: a.province ?? "",
  };
}

// Adresses portées sur l'API native Medusa (store.customer.*Address) plutôt
// que sur une table D1 custom : Medusa gère nativement un carnet d'adresses
// par client, pas besoin de réinventer côté storefront-next.
function toMedusaBody(input: AddressInput) {
  const [firstName, ...rest] = input.name.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName;
  return {
    address_name: input.label.trim() || undefined,
    first_name: firstName,
    last_name: lastName,
    address_1: input.street,
    postal_code: input.npa,
    city: input.city,
    province: input.canton,
    country_code: "ch",
  };
}

function AddressForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: AddressInput;
  onCancel: () => void;
  onSaved: (input: AddressInput) => Promise<{ error?: string } | { success: true }>;
}) {
  const t = useTranslations("account");
  const tCheckout = useTranslations("checkout");
  const [value, setValue] = useState<AddressInput>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await onSaved(value);
    setPending(false);
    if ("error" in res) {
      setError(t("addresses.error"));
      return;
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        value={value.label ?? ""}
        onChange={(e) => setValue({ ...value, label: e.target.value })}
        placeholder={t("addresses.labelPlaceholder")}
        maxLength={40}
        className={field}
      />
      <input
        value={value.name}
        onChange={(e) => setValue({ ...value, name: e.target.value })}
        placeholder={tCheckout("name")}
        required
        minLength={2}
        className={field}
      />
      <input
        value={value.street}
        onChange={(e) => setValue({ ...value, street: e.target.value })}
        placeholder={tCheckout("street")}
        required
        minLength={3}
        className={field}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <input
          value={value.npa}
          onChange={(e) => setValue({ ...value, npa: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          placeholder={tCheckout("npa")}
          inputMode="numeric"
          required
          className={field}
        />
        <input
          value={value.city}
          onChange={(e) => setValue({ ...value, city: e.target.value })}
          placeholder={tCheckout("city")}
          required
          minLength={2}
          className={field}
        />
      </div>
      <select value={value.canton} onChange={(e) => setValue({ ...value, canton: e.target.value })} required className={field}>
        <option value="">{tCheckout("canton")}</option>
        {CANTONS.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      {error && <p className="text-sm font-medium text-accent">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? t("security.processing") : t("addresses.save")}
        </button>
        <button type="button" onClick={onCancel} className={btnGhost}>
          {t("quoteActions.cancel")}
        </button>
      </div>
    </form>
  );
}

export function AddressBook({ addresses, onReload }: { addresses: Address[]; onReload: () => Promise<void> }) {
  const t = useTranslations("account");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function onDelete(id: string) {
    if (!confirm(t("addresses.deleteConfirm"))) return;
    setPending(id);
    await medusa.store.customer.deleteAddress(id);
    setPending(null);
    await onReload();
  }

  async function onSetDefault(id: string) {
    setPending(id);
    await medusa.store.customer.updateAddress(id, { is_default_shipping: true });
    setPending(null);
    await onReload();
  }

  return (
    <div className="space-y-4">
      {addresses.length === 0 && !adding && <p className={`${card} text-sm text-soft`}>{t("addresses.empty")}</p>}

      {addresses.map((a) =>
        editingId === a.id ? (
          <div key={a.id} className={card}>
            <AddressForm
              initial={toInput(a)}
              onCancel={() => setEditingId(null)}
              onSaved={async (input) => {
                try {
                  await medusa.store.customer.updateAddress(a.id, toMedusaBody(input));
                } catch {
                  return { error: "failed" };
                }
                setEditingId(null);
                await onReload();
                return { success: true };
              }}
            />
          </div>
        ) : (
          <div key={a.id} className={`${card} flex items-start justify-between gap-3`}>
            <div className="flex items-start gap-2.5">
              <MapPin size={17} className="mt-0.5 shrink-0 text-soft" />
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {a.address_name || t("addresses.unnamed")}
                  {a.is_default_shipping && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <Star size={11} />
                      {t("addresses.default")}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-soft">
                  {a.first_name} {a.last_name}
                </p>
                <p className="text-xs text-soft">
                  {a.address_1}, {a.postal_code} {a.city} ({a.province})
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {!a.is_default_shipping && (
                <button
                  type="button"
                  onClick={() => onSetDefault(a.id)}
                  disabled={pending !== null}
                  className="text-xs font-semibold text-soft transition-colors hover:text-ink disabled:opacity-40"
                >
                  {t("addresses.makeDefault")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingId(a.id)}
                className="text-soft transition-colors hover:text-ink"
                aria-label={t("addresses.edit")}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(a.id)}
                disabled={pending !== null}
                className="text-soft transition-colors hover:text-accent disabled:opacity-40"
                aria-label={t("addresses.delete")}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ),
      )}

      {adding ? (
        <div className={card}>
          <AddressForm
            initial={EMPTY}
            onCancel={() => setAdding(false)}
            onSaved={async (input) => {
              try {
                await medusa.store.customer.createAddress(toMedusaBody(input));
              } catch {
                return { error: "failed" };
              }
              setAdding(false);
              await onReload();
              return { success: true };
            }}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={btnPrimary}>
          <Plus size={15} />
          {t("addresses.add")}
        </button>
      )}
    </div>
  );
}

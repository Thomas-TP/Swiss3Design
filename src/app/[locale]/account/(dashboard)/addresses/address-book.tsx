"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CANTONS } from "@/lib/cantons";
import { card, field, btnPrimary, btnGhost } from "../_ui";
import {
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  type AddressInput,
} from "./actions";

interface Address extends Omit<AddressInput, "label"> {
  id: string;
  isDefault: boolean;
  label: string | null;
}

const EMPTY: AddressInput = {
  label: "",
  name: "",
  street: "",
  npa: "",
  city: "",
  canton: "",
};

function AddressForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: AddressInput;
  onCancel: () => void;
  onSaved: (
    input: AddressInput,
  ) => Promise<{ error?: string } | { success: true }>;
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
          onChange={(e) =>
            setValue({
              ...value,
              npa: e.target.value.replace(/\D/g, "").slice(0, 4),
            })
          }
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
      <select
        value={value.canton}
        onChange={(e) => setValue({ ...value, canton: e.target.value })}
        required
        className={field}
      >
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

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function onDelete(id: string) {
    if (!confirm(t("addresses.deleteConfirm"))) return;
    setPending(id);
    await deleteAddress(id);
    setPending(null);
    router.refresh();
  }

  async function onSetDefault(id: string) {
    setPending(id);
    await setDefaultAddress(id);
    setPending(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {addresses.length === 0 && !adding && (
        <p className={`${card} text-sm text-soft`}>{t("addresses.empty")}</p>
      )}

      {addresses.map((a) =>
        editingId === a.id ? (
          <div key={a.id} className={card}>
            <AddressForm
              initial={{ ...a, label: a.label ?? "" }}
              onCancel={() => setEditingId(null)}
              onSaved={async (input) => {
                const res = await updateAddress(a.id, input);
                if ("success" in res) {
                  setEditingId(null);
                  router.refresh();
                }
                return res;
              }}
            />
          </div>
        ) : (
          <div
            key={a.id}
            className={`${card} flex items-start justify-between gap-3`}
          >
            <div className="flex items-start gap-2.5">
              <MapPin size={17} className="mt-0.5 shrink-0 text-soft" />
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {a.label || t("addresses.unnamed")}
                  {a.isDefault && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <Star size={11} />
                      {t("addresses.default")}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-soft">{a.name}</p>
                <p className="text-xs text-soft">
                  {a.street}, {a.npa} {a.city} ({a.canton})
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {!a.isDefault && (
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
              const res = await addAddress(input);
              if ("success" in res) {
                setAdding(false);
                router.refresh();
              }
              return res;
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={btnPrimary}
        >
          <Plus size={15} />
          {t("addresses.add")}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { updatePreferences } from "./actions";

function Toggle({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-soft">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-line"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export function PrefsForm({
  initial,
}: {
  initial: { newsletter: boolean; productNews: boolean };
}) {
  const t = useTranslations("account");
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(next: typeof value) {
    setValue(next);
    setPending(true);
    setSaved(false);
    const res = await updatePreferences(next);
    setPending(false);
    if ("success" in res) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div>
      <div className="divide-y divide-line">
        <Toggle
          checked={value.newsletter}
          onChange={(v) => save({ ...value, newsletter: v })}
          label={t("notifications.newsletter")}
          desc={t("notifications.newsletterDesc")}
        />
        <Toggle
          checked={value.productNews}
          onChange={(v) => save({ ...value, productNews: v })}
          label={t("notifications.productNews")}
          desc={t("notifications.productNewsDesc")}
        />
      </div>
      {(pending || saved) && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-soft">
          {saved && <Check size={13} className="text-emerald-600" />}
          {pending ? t("security.processing") : t("profile.saved")}
        </p>
      )}
    </div>
  );
}

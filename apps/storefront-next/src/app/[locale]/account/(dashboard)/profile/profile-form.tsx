"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateUser } from "@/lib/auth-client";
import { field, btnPrimary } from "../_ui";

export function ProfileForm({ name }: { name: string }) {
  const t = useTranslations("account");
  const [value, setValue] = useState(name);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) return;
    setPending(true);
    setSaved(false);
    await updateUser({ name: trimmed });
    setPending(false);
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2.5 sm:flex-row">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        maxLength={120}
        required
        className={`${field} sm:flex-1`}
      />
      <button type="submit" disabled={pending || !value.trim() || value.trim() === name} className={btnPrimary}>
        {saved ? <Check size={15} /> : null}
        {pending ? t("security.processing") : saved ? t("profile.saved") : t("profile.save")}
      </button>
    </form>
  );
}

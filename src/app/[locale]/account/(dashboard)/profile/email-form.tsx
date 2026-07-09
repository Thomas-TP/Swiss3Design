"use client";

import { useState } from "react";
import { BadgeCheck, MailCheck, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { changeEmail, sendVerificationEmail } from "@/lib/auth-client";
import { field, btnPrimary, btnGhost } from "../_ui";

export function EmailForm({
  email,
  verified,
}: {
  email: string;
  verified: boolean;
}) {
  const t = useTranslations("account");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await changeEmail({
      newEmail: value.trim().toLowerCase(),
    });
    setPending(false);
    if (err) {
      setError(t("profile.emailError"));
      return;
    }
    setSent(true);
    setEditing(false);
  }

  async function resendVerification() {
    setPending(true);
    await sendVerificationEmail({ email });
    setPending(false);
    setResendSent(true);
  }

  if (sent) {
    return (
      <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        <MailCheck size={16} className="shrink-0" />
        {t("profile.emailChangeSent")}
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm">
          {email}
          {verified ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <BadgeCheck size={14} />
              {t("profile.emailVerified")}
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              {t("profile.emailUnverified")}
            </span>
          )}
        </span>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setValue("");
              setError(null);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-soft transition-colors hover:text-ink"
          >
            <Pencil size={13} />
            {t("profile.emailChange")}
          </button>
        )}
      </div>

      {!verified && !editing && (
        <button
          type="button"
          onClick={resendVerification}
          disabled={pending || resendSent}
          className={`${btnGhost} mt-3`}
        >
          {resendSent ? t("profile.emailResendSent") : t("profile.emailResend")}
        </button>
      )}

      {editing && (
        <form
          onSubmit={onSubmit}
          className="mt-3 flex flex-col gap-2.5 sm:flex-row"
        >
          <input
            type="email"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("profile.emailNewPlaceholder")}
            required
            autoComplete="email"
            className={`${field} sm:flex-1`}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || !value.trim()}
              className={btnPrimary}
            >
              {pending ? t("security.processing") : t("profile.emailSend")}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={btnGhost}
            >
              {t("quoteActions.cancel")}
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-sm font-medium text-accent">{error}</p>}
    </div>
  );
}

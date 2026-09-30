"use client";

import { useState } from "react";
import { BadgeCheck, MailCheck, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { changeEmail, sendVerificationEmail } from "@/lib/auth-client";
import {
  badge,
  badgeWarn,
  btnGhost,
  btnPrimary,
  field,
  textAction,
  textSuccess,
} from "../_ui";

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
      <output className="mt-3 flex items-center gap-2 rounded-field bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">
        <MailCheck size={16} strokeWidth={1.5} className="shrink-0" />
        {t("profile.emailChangeSent")}
      </output>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <span className="break-all">{email}</span>
          {verified ? (
            <span
              className={`flex items-center gap-1 text-xs font-semibold ${textSuccess}`}
            >
              <BadgeCheck size={14} strokeWidth={1.5} />
              {t("profile.emailVerified")}
            </span>
          ) : (
            <span className={`${badge} ${badgeWarn}`}>
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
            className={`${textAction} flex shrink-0 items-center gap-1.5`}
          >
            <Pencil size={13} strokeWidth={1.5} />
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
            aria-label={t("profile.emailNewPlaceholder")}
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
      {error && (
        <p className="mt-2 text-sm font-medium text-accent-text">{error}</p>
      )}
    </div>
  );
}

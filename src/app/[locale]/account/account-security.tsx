"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Trash2,
  MailCheck,
  Copy,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSession, twoFactor, deleteUser } from "@/lib/auth-client";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60";
const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-60";

function TwoFactor() {
  const t = useTranslations("account");
  const router = useRouter();
  const { data } = useSession();
  const enabled = Boolean(
    (data?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled,
  );

  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{ uri: string; codes: string[] } | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onEnable() {
    setPending(true);
    setError(null);
    const { data: res, error: err } = await twoFactor.enable({ password });
    setPending(false);
    if (err || !res) {
      setError(t("security.errorPassword"));
      return;
    }
    setSetup({ uri: res.totpURI, codes: res.backupCodes });
  }

  async function onConfirm() {
    setPending(true);
    setError(null);
    const { error: err } = await twoFactor.verifyTotp({ code });
    setPending(false);
    if (err) {
      setError(t("security.errorCode"));
      return;
    }
    setSetup(null);
    setCode("");
    setPassword("");
    router.refresh();
  }

  async function onDisable() {
    setPending(true);
    setError(null);
    const { error: err } = await twoFactor.disable({ password });
    setPending(false);
    if (err) {
      setError(t("security.errorPassword"));
      return;
    }
    setPassword("");
    router.refresh();
  }

  return (
    <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {enabled ? (
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          ) : (
            <ShieldOff size={18} className="mt-0.5 shrink-0 text-soft" />
          )}
          <div>
            <p className="text-sm font-semibold">{t("security.twoFactorTitle")}</p>
            <p className="mt-0.5 text-xs text-soft">{t("security.twoFactorDesc")}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            enabled
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-line text-soft"
          }`}
        >
          {enabled ? t("security.twoFactorActive") : t("security.twoFactorInactive")}
        </span>
      </div>

      {/* Étape de configuration : QR + codes de récupération + vérification */}
      {setup ? (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-soft">{t("security.scanQr")}</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <span className="inline-block rounded-xl bg-white p-3 ring-1 ring-line">
              <QRCodeSVG value={setup.uri} size={148} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-soft">
                {t("security.backupTitle")}
              </p>
              <p className="mt-1 text-xs text-soft">{t("security.backupHint")}</p>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
                {setup.codes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(setup.codes.join("\n"))}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-soft hover:text-ink"
              >
                <Copy size={13} />
                {t("security.copyCodes")}
              </button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-soft">{t("security.enterCode")}</p>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("security.codePlaceholder")}
                className={`${field} tracking-[0.3em]`}
              />
              <button
                type="button"
                onClick={onConfirm}
                disabled={code.length !== 6 || pending}
                className={btnPrimary}
              >
                {pending ? t("security.processing") : t("security.verify")}
              </button>
            </div>
          </div>
          {error && <p className="text-sm font-medium text-accent">{error}</p>}
        </div>
      ) : enabled ? (
        <div className="mt-4 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder={t("security.password")}
            className={field}
          />
          {error && <p className="text-sm font-medium text-accent">{error}</p>}
          <button
            type="button"
            onClick={onDisable}
            disabled={pending}
            className={btnGhost}
          >
            <ShieldOff size={15} />
            {pending ? t("security.processing") : t("security.disable")}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder={t("security.password")}
            className={field}
          />
          <p className="text-xs text-soft">{t("security.passwordHint")}</p>
          {error && <p className="text-sm font-medium text-accent">{error}</p>}
          <button
            type="button"
            onClick={onEnable}
            disabled={pending}
            className={btnPrimary}
          >
            <KeyRound size={15} />
            {pending ? t("security.processing") : t("security.enable")}
          </button>
        </div>
      )}
    </div>
  );
}

function DeleteAccount() {
  const t = useTranslations("account");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onDelete() {
    if (!confirm(t("security.deleteConfirm"))) return;
    setPending(true);
    const { error } = await deleteUser({ callbackURL: "/" });
    setPending(false);
    if (!error) setSent(true);
  }

  return (
    <div className="rounded-card border border-red-500/30 bg-red-500/5 p-5 sm:p-6">
      <p className="flex items-center gap-2 text-sm font-semibold text-accent">
        <Trash2 size={16} />
        {t("security.dangerTitle")}
      </p>
      <p className="mt-1 text-xs text-soft">{t("security.dangerDesc")}</p>
      {sent ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <MailCheck size={16} className="shrink-0" />
          {t("security.deleteEmailSent")}
        </p>
      ) : (
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-red-500/20 disabled:opacity-60"
        >
          <Trash2 size={15} />
          {pending ? t("security.processing") : t("security.deleteButton")}
        </button>
      )}
    </div>
  );
}

export function AccountSecurity() {
  const t = useTranslations("account");
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-semibold">{t("security.title")}</h2>
      <div className="space-y-4">
        <TwoFactor />
        <DeleteAccount />
      </div>
    </section>
  );
}

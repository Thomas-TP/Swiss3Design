"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, MailCheck, Pencil } from "lucide-react";
import { Link } from "@/i18n/navigation";
const field =
  "min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm placeholder:text-soft/60 focus:border-ink focus:outline-none";
export type EmailProof = { email: string; token: string };

export function GuestEmailVerification({
  proof,
  onProof,
  notice,
  next = "/checkout",
}: {
  notice?: string;
  next?: string;
  proof: EmailProof | null;
  onProof: (p: EmailProof | null) => void;
}) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  async function sendCode() {
    if (!emailValid || pending) return;
    setPending("send");
    setError(null);
    try {
      const res = await fetch("/api/checkout/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          email: email.trim().toLowerCase(),
          locale,
        }),
      });
      // 429 = un code vient déjà d'être envoyé à cette adresse
      if (!res.ok && res.status !== 429) throw new Error("send_failed");
      setCodeSent(true);
      setCooldown(30);
      setCode("");
    } catch {
      setError(t("errorSendCode"));
    } finally {
      setPending(null);
    }
  }

  async function verifyCode() {
    if (code.length !== 6 || pending) return;
    setPending("verify");
    setError(null);
    try {
      const target = email.trim().toLowerCase();
      const res = await fetch("/api/checkout/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email: target, code }),
      });
      if (!res.ok) {
        setError(t("errorCodeInvalid"));
        return;
      }
      const data = (await res.json()) as { proof: string };
      onProof({ email: target, token: data.proof });
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(null);
    }
  }

  if (proof) {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />
          <span className="truncate">{proof.email}</span>
          <span className="hidden shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 sm:inline">
            {t("emailVerified")}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            onProof(null);
            setCodeSent(false);
            setCode("");
          }}
          aria-label={t("email")}
          className="shrink-0 rounded-full p-1.5 text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          <Pencil size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs leading-relaxed text-soft">
        {notice ?? t("guestNotice")}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setCodeSent(false);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendCode();
            }
          }}
          type="email"
          autoComplete="email"
          placeholder={t("email")}
          className={field}
        />
        <button
          type="button"
          onClick={sendCode}
          disabled={!emailValid || pending !== null || cooldown > 0}
          className="shrink-0 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-paper transition-all hover:bg-ink/85 active:scale-[0.98] disabled:opacity-50"
        >
          {pending === "send"
            ? t("processing")
            : cooldown > 0
              ? t("resendIn", { s: cooldown })
              : codeSent
                ? t("resendCode")
                : t("sendCode")}
        </button>
      </div>
      {codeSent && (
        <div className="rounded-xl bg-paper p-3.5 ring-1 ring-line">
          <p className="flex items-center gap-2 text-xs font-medium text-soft">
            <MailCheck size={14} className="shrink-0 text-emerald-600" />
            {t("codeSentTo", { email: email.trim().toLowerCase() })}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <input
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  verifyCode();
                }
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t("codePlaceholder")}
              className={`${field} tracking-[0.3em]`}
            />
            <button
              type="button"
              onClick={verifyCode}
              disabled={code.length !== 6 || pending !== null}
              className="shrink-0 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-50"
            >
              {pending === "verify" ? t("processing") : t("verifyCode")}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent"
        >
          {error}
        </p>
      )}
      <p className="text-xs text-soft">
        {t("haveAccount")}{" "}
        <Link
          href={{ pathname: "/account/login", query: { next } }}
          className="font-semibold text-accent hover:underline"
        >
          {t("loginCta")}
        </Link>
      </p>
    </div>
  );
}

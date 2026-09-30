"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, MailCheck, Pencil } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { fieldSkin } from "@/components/ui/field";

// Vérification de l'e-mail d'un invité (code à 6 chiffres). Habillage
// « Strates » : champs `fieldSkin`, boutons d'encre (le bouton rouge de
// l'écran reste celui du tunnel ou du panier), confirmation en vert de statut.
// Logique inchangée : envoi et contrôle du code par /api/checkout/verify-email.
const field = `min-w-0 flex-1 ${fieldSkin}`;
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
      <div className="mt-3 flex items-center justify-between gap-3 rounded-field border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-emerald-800 dark:text-emerald-200">
          <CheckCircle2
            size={17}
            strokeWidth={1.5}
            className="shrink-0 text-emerald-600"
          />
          {/* ph-mask : adresse masquée dans les enregistrements de visite. */}
          <span className="ph-mask truncate">{proof.email}</span>
          <span className="hidden shrink-0 rounded-hair bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold sm:inline">
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
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-field text-emerald-700 transition-colors hover:bg-emerald-500/15 dark:text-emerald-200"
        >
          <Pencil size={15} strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm leading-relaxed text-soft">
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
          aria-label={t("email")}
          placeholder={t("email")}
          className={field}
        />
        <Button
          variant="ink"
          onClick={sendCode}
          disabled={!emailValid || pending !== null || cooldown > 0}
          className="shrink-0"
        >
          {pending === "send"
            ? t("processing")
            : cooldown > 0
              ? t("resendIn", { s: cooldown })
              : codeSent
                ? t("resendCode")
                : t("sendCode")}
        </Button>
      </div>
      {codeSent && (
        <div className="rounded-field border border-line bg-surface p-3.5">
          <p className="flex items-center gap-2 text-sm font-medium text-soft">
            <MailCheck
              size={15}
              strokeWidth={1.5}
              className="shrink-0 text-emerald-600"
            />
            <span className="ph-mask">
              {t("codeSentTo", { email: email.trim().toLowerCase() })}
            </span>
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
              aria-label={t("codePlaceholder")}
              placeholder={t("codePlaceholder")}
              className={`${field} s3d-num tracking-[0.3em]`}
            />
            <Button
              variant="ink"
              onClick={verifyCode}
              disabled={code.length !== 6 || pending !== null}
              className="shrink-0"
            >
              {pending === "verify" ? t("processing") : t("verifyCode")}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-field border border-accent-text/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent-text"
        >
          {error}
        </p>
      )}
      <p className="text-sm text-soft">
        {t("haveAccount")}{" "}
        <Link
          href={{ pathname: "/account/login", query: { next } }}
          className="font-semibold text-accent-text underline-offset-4 hover:underline"
        >
          {t("loginCta")}
        </Link>
      </p>
    </div>
  );
}

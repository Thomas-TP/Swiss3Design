"use client";

import { useState } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { signIn, twoFactor } from "@/lib/auth-client";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

export function LoginForm({ next = "/account" }: { next?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Étape de vérification 2FA après un mot de passe correct sur un compte protégé
  const [stage, setStage] = useState<"login" | "totp" | "backup">("login");
  const [code, setCode] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    const { data: res, error: err } = await signIn.email({
      email: String(data.get("email")),
      password: String(data.get("password")),
    });
    if (err) {
      setError(
        err.status === 403
          ? t("errorUnverified")
          : err.status === 401
            ? t("errorInvalid")
            : t("errorGeneric"),
      );
      setPending(false);
      return;
    }
    // Compte avec 2FA : signIn ne crée pas encore de session, il faut le code
    if ((res as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      setStage("totp");
      setPending(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function verify() {
    setPending(true);
    setError(null);
    const { error: err } =
      stage === "backup"
        ? await twoFactor.verifyBackupCode({ code })
        : await twoFactor.verifyTotp({ code });
    setPending(false);
    if (err) {
      setError(t("twoFactor.error"));
      return;
    }
    router.push(next);
    router.refresh();
  }

  if (stage !== "login") {
    const isBackup = stage === "backup";
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={18} className="text-emerald-600" />
          {t("twoFactor.title")}
        </p>
        <p className="text-sm text-soft">
          {isBackup ? t("twoFactor.backupPrompt") : t("twoFactor.prompt")}
        </p>
        <input
          value={code}
          onChange={(e) =>
            setCode(
              isBackup
                ? e.target.value.trim()
                : e.target.value.replace(/\D/g, "").slice(0, 6),
            )
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              verify();
            }
          }}
          inputMode={isBackup ? "text" : "numeric"}
          autoComplete="one-time-code"
          placeholder={isBackup ? t("twoFactor.backupCode") : t("twoFactor.code")}
          className={`${field} ${isBackup ? "" : "tracking-[0.3em]"}`}
        />
        {error && (
          <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={verify}
          disabled={pending || code.length < 6}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
        >
          <ShieldCheck size={16} />
          {pending ? t("processing") : t("twoFactor.verify")}
        </button>
        <button
          type="button"
          onClick={() => {
            setStage(isBackup ? "totp" : "backup");
            setCode("");
            setError(null);
          }}
          className="block w-full text-center text-xs font-medium text-soft transition-colors hover:text-ink"
        >
          {isBackup ? t("twoFactor.useTotp") : t("twoFactor.useBackup")}
        </button>
      </div>
    );
  }

  return (
    // method="post" : si JS est indisponible, le repli natif n'envoie jamais le
    // mot de passe dans l'URL (sinon GET par défaut → fuite via Referer/logs).
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={field}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={field}
        />
        <p className="mt-1.5 text-right">
          <Link
            href="/account/forgot-password"
            className="text-xs font-medium text-soft transition-colors hover:text-accent"
          >
            {t("forgotLink")}
          </Link>
        </p>
      </div>
      {error && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        <LogIn size={16} />
        {t("signInCta")}
      </button>
    </form>
  );
}

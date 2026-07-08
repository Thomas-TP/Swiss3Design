"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LogIn, ShieldCheck, Mail, Fingerprint } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { BrandMark } from "@/components/brand-mark";
import { GoogleButton } from "@/components/google-button";
import { signIn, twoFactor, emailOtp, captureToken } from "@/lib/auth-client";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";
const btnGhost =
  "flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink disabled:opacity-60";

// Miroir de login-form.tsx côté app Next.js racine, adapté à l'architecture
// bearer cross-origine (chaque appel qui peut terminer une connexion passe
// par `captureToken`). **Lien magique volontairement absent** : redirige via
// une navigation GET classique sur le serveur d'auth (localhost:3000), qui
// pose un cookie SUR CETTE origine avant de rediriger - ce storefront (autre
// origine) n'a alors aucun jeton porteur à récupérer. **Connexion Google en
// popup** (`GoogleButton`/`signInWithGooglePopup`) : contourne ce problème en
// gardant tout le dialogue OAuth sur l'origine du serveur d'auth (le popup y
// navigue en premier niveau, cookies OK) et en récupérant le jeton via
// postMessage plutôt que par redirection — voir auth-client.ts. Mot de
// passe, 2FA, clé d'accès et code par e-mail restent de simples appels API
// directs, donc pleinement compatibles nativement.
function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"login" | "totp" | "backup" | "passwordless" | "otpVerify">("login");
  const [code, setCode] = useState("");
  const [plEmail, setPlEmail] = useState("");

  const passkeySupported = useSyncExternalStore(
    () => () => {},
    () => typeof window !== "undefined" && !!window.PublicKeyCredential,
    () => false,
  );

  useEffect(() => {
    if (!passkeySupported) return;
    let cancelled = false;
    window.PublicKeyCredential.isConditionalMediationAvailable?.().then((available) => {
      if (!available || cancelled) return;
      signIn.passkey({ autoFill: true }, { onSuccess: captureToken }).then((res) => {
        if (!cancelled && res && !res.error) router.push(next);
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passkeySupported]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    const { data: res, error: err } = await signIn.email(
      { email: String(data.get("email")), password: String(data.get("password")) },
      { onSuccess: captureToken },
    );
    if (err) {
      setError(err.status === 403 ? t("errorUnverified") : err.status === 401 ? t("errorInvalid") : t("errorGeneric"));
      setPending(false);
      return;
    }
    if ((res as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      setStage("totp");
      setPending(false);
      return;
    }
    router.push(next);
  }

  async function verify() {
    setPending(true);
    setError(null);
    const { error: err } =
      stage === "backup"
        ? await twoFactor.verifyBackupCode({ code }, { onSuccess: captureToken })
        : await twoFactor.verifyTotp({ code }, { onSuccess: captureToken });
    setPending(false);
    if (err) {
      setError(t("twoFactor.error"));
      return;
    }
    router.push(next);
  }

  async function onPasskeySignIn() {
    setPending(true);
    setError(null);
    const { error: err } = await signIn.passkey({}, { onSuccess: captureToken });
    setPending(false);
    if (err) {
      if (("code" in err ? err.code : null) !== "AUTH_CANCELLED") setError(t("errorGeneric"));
      return;
    }
    router.push(next);
  }

  async function sendOtp() {
    setPending(true);
    setError(null);
    const { error: err } = await emailOtp.sendVerificationOtp({ email: plEmail, type: "sign-in" });
    setPending(false);
    if (err) {
      setError(t("passwordless.error"));
      return;
    }
    setStage("otpVerify");
  }

  async function verifyOtp() {
    setPending(true);
    setError(null);
    const { data: res, error: err } = await signIn.emailOtp({ email: plEmail, otp: code }, { onSuccess: captureToken });
    setPending(false);
    if (err) {
      setError(t("twoFactor.error"));
      return;
    }
    if ((res as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      setStage("totp");
      return;
    }
    router.push(next);
  }

  if (stage === "totp" || stage === "backup") {
    const isBackup = stage === "backup";
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={18} className="text-emerald-600" />
          {t("twoFactor.title")}
        </p>
        <p className="text-sm text-soft">{isBackup ? t("twoFactor.backupPrompt") : t("twoFactor.prompt")}</p>
        <input
          value={code}
          onChange={(e) => setCode(isBackup ? e.target.value.trim() : e.target.value.replace(/\D/g, "").slice(0, 6))}
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
        {error && <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error}</p>}
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

  if (stage === "otpVerify") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-soft">{t("passwordless.otpSentTo", { email: plEmail })}</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              verifyOtp();
            }
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={t("twoFactor.code")}
          className={`${field} tracking-[0.3em]`}
        />
        {error && <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error}</p>}
        <button
          type="button"
          onClick={verifyOtp}
          disabled={pending || code.length < 6}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? t("processing") : t("twoFactor.verify")}
        </button>
        <button
          type="button"
          onClick={() => {
            setStage("passwordless");
            setCode("");
            setError(null);
          }}
          className="block w-full text-center text-xs font-medium text-soft transition-colors hover:text-ink"
        >
          {t("passwordless.back")}
        </button>
      </div>
    );
  }

  if (stage === "passwordless") {
    return (
      <div className="space-y-4">
        {passkeySupported && (
          <>
            <button type="button" onClick={onPasskeySignIn} disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60">
              <Fingerprint size={16} />
              {t("passwordless.usePasskey")}
            </button>
            <div className="flex items-center gap-3 text-xs text-soft">
              <span className="h-px flex-1 bg-line" />
              {t("passwordless.orEmail")}
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}
        <input type="email" value={plEmail} onChange={(e) => setPlEmail(e.target.value)} placeholder={t("email")} autoComplete="email" required className={field} />
        {error && <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error}</p>}
        <button
          type="button"
          onClick={sendOtp}
          disabled={pending || !plEmail.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
        >
          <Mail size={16} />
          {pending ? t("processing") : t("passwordless.sendCode")}
        </button>
        <button
          type="button"
          onClick={() => {
            setStage("login");
            setError(null);
          }}
          className="block w-full text-center text-xs font-medium text-soft transition-colors hover:text-ink"
        >
          {t("passwordless.back")}
        </button>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
          {t("email")}
        </label>
        <input id="email" name="email" type="email" required autoComplete="email webauthn" className={field} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
          {t("password")}
        </label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className={field} />
        <p className="mt-1.5 text-right">
          <Link href="/account/forgot-password" className="text-xs font-medium text-soft transition-colors hover:text-accent">
            {t("forgotLink")}
          </Link>
        </p>
      </div>
      {error && <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        <LogIn size={16} />
        {t("signInCta")}
      </button>
      {passkeySupported && (
        <button type="button" onClick={onPasskeySignIn} disabled={pending} className={btnGhost}>
          <Fingerprint size={16} />
          {t("passwordless.usePasskey")}
        </button>
      )}
      <div className="flex items-center gap-3 text-xs text-soft">
        <span className="h-px flex-1 bg-line" />
        {t("orContinueWith")}
        <span className="h-px flex-1 bg-line" />
      </div>
      <GoogleButton onSuccess={() => router.push(next)} />
      <button
        type="button"
        onClick={() => {
          setStage("passwordless");
          setError(null);
        }}
        className="block w-full text-center text-xs font-medium text-soft transition-colors hover:text-ink"
      >
        {t("passwordless.toggle")}
      </button>
    </form>
  );
}

export default function LoginPage() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  // Chemin non préfixé par la locale : `useRouter()` de "@/i18n/navigation"
  // ajoute lui-même le préfixe de locale au push (comme add-to-cart.tsx).
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/account";

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6 md:py-20">
      <BrandMark className="mx-auto h-10 w-10 text-ink" />
      <h1 className="mt-5 text-center text-3xl font-bold tracking-tight">{t("signInTitle")}</h1>
      <div className="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
        <LoginForm next={next} />
      </div>
      <p className="mt-5 text-center text-sm text-soft">
        {t("noAccount")}{" "}
        <Link href="/account/register" className="font-semibold text-accent hover:underline">
          {t("signUpTitle")}
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-soft">
        <Link href="/track" className="font-medium hover:text-ink hover:underline">
          {t("trackOrderLink")}
        </Link>
      </p>
    </div>
  );
}

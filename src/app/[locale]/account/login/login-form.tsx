"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LogIn, ShieldCheck, Mail, MailCheck, Fingerprint } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { signIn, twoFactor, emailOtp } from "@/lib/auth-client";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";
const btnGhost =
  "flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink disabled:opacity-60";

export function LoginForm({ next = "/account" }: { next?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // login : mot de passe · totp/backup : code 2FA · passwordless : choix
  // lien/code · magicSent : lien envoyé · otpVerify : saisie du code reçu
  const [stage, setStage] = useState<
    "login" | "totp" | "backup" | "passwordless" | "magicSent" | "otpVerify"
  >("login");
  const [code, setCode] = useState("");
  const [plEmail, setPlEmail] = useState("");
  // Clé d'accès proposée seulement si le navigateur sait s'en servir —
  // évite un bouton mort sur les navigateurs/OS sans WebAuthn. Rendu côté
  // serveur : false (pas de window) ; useSyncExternalStore fait la mise à
  // jour post-hydratation sans avertissement d'incohérence SSR/client.
  const passkeySupported = useSyncExternalStore(
    () => () => {},
    () => typeof window !== "undefined" && !!window.PublicKeyCredential,
    () => false,
  );

  // WebAuthn « conditional UI » : arme une demande de clé d'accès silencieuse
  // dès l'arrivée sur le formulaire. Le navigateur propose alors la clé
  // enregistrée directement dans la liste d'autocomplétion du champ e-mail
  // (autoComplete="username webauthn") — sans ça, une clé créée dans le compte
  // n'est jamais proposée et reste lettre morte.
  // router/next stables sur la durée de vie du formulaire
  // biome-ignore lint/correctness/useExhaustiveDependencies: router/next stables sur la durée de vie du formulaire
  useEffect(() => {
    if (!passkeySupported) return;
    let cancelled = false;
    window.PublicKeyCredential.isConditionalMediationAvailable?.().then(
      (available) => {
        if (!available || cancelled) return;
        signIn.passkey({ autoFill: true }).then((res) => {
          if (!cancelled && res && !res.error) {
            router.push(next);
            router.refresh();
          }
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [passkeySupported]);

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

  async function sendMagicLink() {
    setPending(true);
    setError(null);
    const { error: err } = await signIn.magicLink({
      email: plEmail,
      callbackURL: `/${locale}${next}`,
    });
    setPending(false);
    if (err) {
      setError(t("passwordless.error"));
      return;
    }
    setStage("magicSent");
  }

  async function onPasskeySignIn() {
    setPending(true);
    setError(null);
    const { error: err } = await signIn.passkey();
    setPending(false);
    if (err) {
      // Annulation par l'utilisateur (boîte de dialogue système) : silencieux
      if (("code" in err ? err.code : null) !== "AUTH_CANCELLED") {
        setError(t("errorGeneric"));
      }
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function sendOtp() {
    setPending(true);
    setError(null);
    const { error: err } = await emailOtp.sendVerificationOtp({
      email: plEmail,
      type: "sign-in",
    });
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
    const { data: res, error: err } = await signIn.emailOtp({
      email: plEmail,
      otp: code,
    });
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
    router.refresh();
  }

  if (stage === "totp" || stage === "backup") {
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
          placeholder={
            isBackup ? t("twoFactor.backupCode") : t("twoFactor.code")
          }
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

  if (stage === "magicSent") {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        <MailCheck size={16} className="shrink-0" />
        {t("passwordless.magicSent")}
      </p>
    );
  }

  if (stage === "otpVerify") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-soft">
          {t("passwordless.otpSentTo", { email: plEmail })}
        </p>
        <input
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
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
        {error && (
          <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
            {error}
          </p>
        )}
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
            <button
              type="button"
              onClick={onPasskeySignIn}
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
            >
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
        <input
          type="email"
          value={plEmail}
          onChange={(e) => setPlEmail(e.target.value)}
          placeholder={t("email")}
          autoComplete="email"
          required
          className={field}
        />
        {error && (
          <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={sendMagicLink}
          disabled={pending || !plEmail.trim()}
          className={
            passkeySupported
              ? btnGhost
              : "flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
          }
        >
          <Mail size={16} />
          {pending ? t("processing") : t("passwordless.sendLink")}
        </button>
        <button
          type="button"
          onClick={sendOtp}
          disabled={pending || !plEmail.trim()}
          className="block w-full text-center text-xs font-medium text-soft transition-colors hover:text-ink disabled:opacity-60"
        >
          {t("passwordless.sendCode")}
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
          autoComplete="email webauthn"
          className={field}
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-sm font-semibold"
        >
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
      {/* Clé d'accès visible dès le premier écran : la cacher derrière
          « sans mot de passe » la rendait introuvable en pratique. */}
      {passkeySupported && (
        <button
          type="button"
          onClick={onPasskeySignIn}
          disabled={pending}
          className={btnGhost}
        >
          <Fingerprint size={16} />
          {t("passwordless.usePasskey")}
        </button>
      )}
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

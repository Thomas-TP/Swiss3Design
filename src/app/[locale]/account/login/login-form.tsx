"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LogIn, ShieldCheck, Mail, MailCheck, Fingerprint } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { signIn, twoFactor, emailOtp } from "@/lib/auth-client";
import { Field, fieldClass } from "@/components/ui/field";
import {
  alertError,
  alertSuccess,
  btnAccentLg,
  btnGhost,
  linkSoft,
} from "../(dashboard)/_ui";

// Champ de code (TOTP, code de secours, code reçu par e-mail) : chiffres à
// chasse fixe, interlettrage large pour lire les six chiffres d'un coup d'œil.
const codeField = `${fieldClass} tracking-[0.3em]`;
const btnGhostFull = `${btnGhost} w-full`;
const linkBack = `${linkSoft} block w-full text-center`;

// Connexion demandée par le serveur OAuth (un agent ou une application veut
// accéder au compte) : l'URL porte la requête d'autorisation signée (?sig=…).
// Les POST de connexion la transmettent (plugin client oauth-provider) et
// better-auth répond { redirect, url } vers le consentement, que son client
// suit lui-même — il ne faut alors surtout pas naviguer vers `next`.
function isOAuthRedirect(data: unknown): boolean {
  return Boolean((data as { redirect?: boolean } | null)?.redirect);
}

// Lien magique : la vérification a lieu dans un autre onglet, sans la requête
// signée. On y renvoie donc vers /oauth2/authorize (paramètres d'origine,
// signature retirée), qui reprend l'autorisation une fois connecté.
function oauthResumeUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("sig")) return null;
  for (const key of ["sig", "exp", "ba_iat", "ba_param", "ba_pl"])
    params.delete(key);
  return `/api/auth/oauth2/authorize?${params.toString()}`;
}

export function LoginForm({
  next = "/account",
  strongReauthentication = false,
}: {
  next?: string;
  strongReauthentication?: boolean;
}) {
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

  function signedIn(data: unknown) {
    if (isOAuthRedirect(data)) return;
    router.push(next);
    router.refresh();
  }

  // WebAuthn « conditional UI » : arme une demande de clé d'accès silencieuse
  // dès l'arrivée sur le formulaire. Le navigateur propose alors la clé
  // enregistrée directement dans la liste d'autocomplétion du champ e-mail
  // (autoComplete="username webauthn") — sans ça, une clé créée dans le compte
  // n'est jamais proposée et reste lettre morte.
  // oxlint-disable exhaustive-deps -- router/next stables sur la duree de vie du formulaire
  useEffect(() => {
    if (!passkeySupported) return;
    let cancelled = false;
    window.PublicKeyCredential.isConditionalMediationAvailable?.().then(
      (available) => {
        if (!available || cancelled) return;
        signIn.passkey({ autoFill: true }).then((res) => {
          if (!cancelled && res && !res.error) signedIn(res.data);
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [passkeySupported]);
  // oxlint-enable exhaustive-deps

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
    signedIn(res);
  }

  async function verify() {
    setPending(true);
    setError(null);
    const { data: res, error: err } =
      stage === "backup"
        ? await twoFactor.verifyBackupCode({ code })
        : await twoFactor.verifyTotp({ code });
    setPending(false);
    if (err) {
      setError(t("twoFactor.error"));
      return;
    }
    signedIn(res);
  }

  async function sendMagicLink() {
    setPending(true);
    setError(null);
    const { error: err } = await signIn.magicLink({
      email: plEmail,
      callbackURL: oauthResumeUrl() ?? `/${locale}${next}`,
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
    const { data: res, error: err } = await signIn.passkey();
    setPending(false);
    if (err) {
      // Annulation par l'utilisateur (boîte de dialogue système) : silencieux
      if (("code" in err ? err.code : null) !== "AUTH_CANCELLED") {
        setError(t("errorGeneric"));
      }
      return;
    }
    signedIn(res);
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
    signedIn(res);
  }

  if (stage === "totp" || stage === "backup") {
    const isBackup = stage === "backup";
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck
            size={18}
            strokeWidth={1.5}
            className="text-emerald-600"
          />
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
          aria-label={
            isBackup ? t("twoFactor.backupCode") : t("twoFactor.code")
          }
          placeholder={
            isBackup ? t("twoFactor.backupCode") : t("twoFactor.code")
          }
          className={isBackup ? fieldClass : codeField}
        />
        {error && <p className={alertError}>{error}</p>}
        <button
          type="button"
          onClick={verify}
          disabled={pending || code.length < 6}
          className={btnAccentLg}
        >
          <ShieldCheck size={16} strokeWidth={1.5} />
          {pending ? t("processing") : t("twoFactor.verify")}
        </button>
        <button
          type="button"
          onClick={() => {
            setStage(isBackup ? "totp" : "backup");
            setCode("");
            setError(null);
          }}
          className={linkBack}
        >
          {isBackup ? t("twoFactor.useTotp") : t("twoFactor.useBackup")}
        </button>
      </div>
    );
  }

  if (stage === "magicSent") {
    return (
      <p className={`${alertSuccess} flex items-center gap-2`}>
        <MailCheck size={16} strokeWidth={1.5} className="shrink-0" />
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
          aria-label={t("twoFactor.code")}
          placeholder={t("twoFactor.code")}
          className={codeField}
        />
        {error && <p className={alertError}>{error}</p>}
        <button
          type="button"
          onClick={verifyOtp}
          disabled={pending || code.length < 6}
          className={btnAccentLg}
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
          className={linkBack}
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
              className={btnAccentLg}
            >
              <Fingerprint size={16} strokeWidth={1.5} />
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
          aria-label={t("email")}
          placeholder={t("email")}
          autoComplete="email"
          required
          className={fieldClass}
        />
        {error && <p className={alertError}>{error}</p>}
        <button
          type="button"
          onClick={sendMagicLink}
          disabled={pending || !plEmail.trim()}
          // Un seul bouton rouge par écran : la clé d'accès le prend quand
          // elle est proposée, sinon l'envoi du lien.
          className={passkeySupported ? btnGhostFull : btnAccentLg}
        >
          <Mail size={16} strokeWidth={1.5} />
          {pending ? t("processing") : t("passwordless.sendLink")}
        </button>
        <button
          type="button"
          onClick={sendOtp}
          disabled={pending || !plEmail.trim()}
          className={`${linkBack} disabled:opacity-60`}
        >
          {t("passwordless.sendCode")}
        </button>
        <button
          type="button"
          onClick={() => {
            setStage("login");
            setError(null);
          }}
          className={linkBack}
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
      <Field label={t("email")} htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          required
          // oxlint-disable-next-line autocomplete-valid -- "username webauthn" est la valeur standard pour l'autofill de cle d'acces (conditional UI WebAuthn) ; faux positif connu de la regle, portee de eslint-plugin-jsx-a11y (cf. sveltejs/svelte#8568), qui ne reconnait pas le token "webauthn" du spec
          autoComplete="username webauthn"
          className={fieldClass}
        />
      </Field>
      <Field label={t("password")} htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={fieldClass}
        />
        <p className="text-right">
          <Link href="/account/forgot-password" className={linkSoft}>
            {t("forgotLink")}
          </Link>
        </p>
      </Field>
      {error && <p className={alertError}>{error}</p>}
      <button type="submit" disabled={pending} className={btnAccentLg}>
        <LogIn size={16} strokeWidth={1.5} />
        {t("signInCta")}
      </button>
      {/* Clé d'accès visible dès le premier écran : la cacher derrière
          « sans mot de passe » la rendait introuvable en pratique. */}
      {passkeySupported && (
        <button
          type="button"
          onClick={onPasskeySignIn}
          disabled={pending}
          className={btnGhostFull}
        >
          <Fingerprint size={16} strokeWidth={1.5} />
          {t("passwordless.usePasskey")}
        </button>
      )}
      {!strongReauthentication && (
        <button
          type="button"
          onClick={() => {
            setStage("passwordless");
            setError(null);
          }}
          className={linkBack}
        >
          {t("passwordless.toggle")}
        </button>
      )}
    </form>
  );
}

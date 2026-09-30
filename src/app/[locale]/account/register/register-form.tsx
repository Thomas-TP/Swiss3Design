"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus, MailCheck, LoaderCircle } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { signUp, signIn } from "@/lib/auth-client";
import { track } from "@/lib/analytics";
import { Field, fieldClass } from "@/components/ui/field";
import { alertError, btnAccentLg } from "../(dashboard)/_ui";

export function RegisterForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Identifiants conservés en mémoire le temps de la vérification : dès que
  // l'e-mail est confirmé (même depuis un autre appareil), cet appareil se
  // connecte tout seul.
  const [waiting, setWaiting] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const signedIn = useRef(false);
  useEffect(() => {
    if (!waiting) return;
    // Auto-connexion dès que l'e-mail est confirmé : on retente simplement
    // signIn (qui échoue tant que l'e-mail n'est pas vérifié). Aucun endpoint
    // d'énumération, et on espace les tentatives pour rester sous la limite
    // anti-abus de l'authentification (~1 essai / 55 s).
    let lastAttempt = 0;
    const attempt = async () => {
      if (signedIn.current || Date.now() - lastAttempt < 55_000) return;
      lastAttempt = Date.now();
      const { data, error: err } = await signIn.email({
        email: waiting.email,
        password: waiting.password,
      });
      // err 403 = e-mail pas encore confirmé ; 429 = limite atteinte → on réessaie plus tard
      if (err || !data) return;
      if ((data as { twoFactorRedirect?: boolean }).twoFactorRedirect) {
        router.push("/account/login");
        return;
      }
      signedIn.current = true;
      setSigningIn(true);
      router.push("/account");
      router.refresh();
    };
    attempt();
    const id = setInterval(attempt, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") attempt();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [waiting, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const { data: result, error: err } = await signUp.email({
      name: String(data.get("name")),
      email,
      password,
      callbackURL: `/${locale}/account`,
    });
    if (err) {
      setError(
        err.status === 422
          ? t("errorExists")
          : err.status === 400
            ? t("errorWeakPassword")
            : t("errorGeneric"),
      );
      setPending(false);
      return;
    }
    // Aucune donnée du compte : seulement le fait qu'il a été créé.
    track("Signed Up", {
      method: "email",
      needs_verification: !result?.token,
    });
    // Sans token = vérification d'e-mail requise avant connexion
    if (!result?.token) {
      setWaiting({ email, password });
      setPending(false);
      return;
    }
    router.push("/account");
    router.refresh();
  }

  if (waiting) {
    return (
      <div className="rounded-field border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <MailCheck
          size={28}
          strokeWidth={1.5}
          className="mx-auto text-emerald-600"
        />
        <p className="mt-3 text-sm font-medium leading-relaxed text-emerald-800 dark:text-emerald-200">
          {t("verifyNotice")}
        </p>
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
          <LoaderCircle size={14} strokeWidth={1.5} className="animate-spin" />
          {signingIn ? t("verifySigningIn") : t("verifyWaiting")}
        </p>
      </div>
    );
  }

  return (
    // method="post" : repli natif sans JS qui n'expose pas le mot de passe en URL
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <Field label={t("name")} htmlFor="name">
        <input
          id="name"
          name="name"
          required
          minLength={2}
          autoComplete="name"
          className={fieldClass}
        />
      </Field>
      <Field label={t("email")} htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={defaultEmail}
          className={fieldClass}
        />
      </Field>
      <Field label={t("password")} htmlFor="password" hint={t("passwordHint")}>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-describedby="password-hint"
          className={fieldClass}
        />
      </Field>
      {error && <p className={alertError}>{error}</p>}
      <button type="submit" disabled={pending} className={btnAccentLg}>
        <UserPlus size={16} strokeWidth={1.5} />
        {t("signUpCta")}
      </button>
    </form>
  );
}

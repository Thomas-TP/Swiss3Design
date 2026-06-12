"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus, MailCheck, LoaderCircle } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { signUp, signIn } from "@/lib/auth-client";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

export function RegisterForm() {
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
    const check = async () => {
      try {
        const res = await fetch("/api/verification-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: waiting.email }),
        });
        const data = (await res.json()) as { verified?: boolean };
        if (!data.verified || signedIn.current) return;
        signedIn.current = true;
        setSigningIn(true);
        const { error: err } = await signIn.email({
          email: waiting.email,
          password: waiting.password,
        });
        if (err) {
          // Cas limite (ex. mot de passe changé entre-temps) : direction la connexion
          router.push("/account/login");
          return;
        }
        router.push("/account");
        router.refresh();
      } catch {
        // réseau indisponible — on réessaiera au prochain tick
      }
    };
    const id = setInterval(check, 3000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
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
      setError(err.status === 422 ? t("errorExists") : t("errorGeneric"));
      setPending(false);
      return;
    }
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
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <MailCheck size={28} className="mx-auto text-emerald-600" />
        <p className="mt-3 text-sm font-medium leading-relaxed text-emerald-800">
          {t("verifyNotice")}
        </p>
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-emerald-700">
          <LoaderCircle size={14} className="animate-spin" />
          {signingIn ? t("verifySigningIn") : t("verifyWaiting")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-semibold">
          {t("name")}
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          autoComplete="name"
          className={field}
        />
      </div>
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
          minLength={8}
          autoComplete="new-password"
          className={field}
        />
        <p className="mt-1 text-xs text-soft">{t("passwordHint")}</p>
      </div>
      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        <UserPlus size={16} />
        {t("signUpCta")}
      </button>
    </form>
  );
}

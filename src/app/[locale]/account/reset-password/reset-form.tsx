"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Field, fieldClass } from "@/components/ui/field";
import { alertError, btnAccent, btnAccentLg } from "../(dashboard)/_ui";

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    const { error: err } = await authClient.resetPassword({
      newPassword: String(data.get("password")),
      token,
    });
    if (err) {
      setError(t("resetInvalid"));
      setPending(false);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center">
        <CheckCircle2
          size={28}
          strokeWidth={1.5}
          className="mx-auto text-emerald-600"
        />
        <p className="mt-3 text-sm font-medium leading-relaxed text-soft">
          {t("resetSuccess")}
        </p>
        <Link href="/account/login" className={`${btnAccent} mt-5`}>
          {t("signInCta")}
        </Link>
      </div>
    );
  }

  return (
    // method="post" : repli natif sans JS qui n'expose pas le mot de passe en URL
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <Field
        label={t("resetTitle")}
        htmlFor="password"
        hint={t("passwordHint")}
      >
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
        <KeyRound size={16} strokeWidth={1.5} />
        {pending ? t("processing") : t("resetCta")}
      </button>
    </form>
  );
}

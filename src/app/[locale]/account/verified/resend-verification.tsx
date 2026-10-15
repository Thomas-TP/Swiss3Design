"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { sendVerificationEmail } from "@/lib/auth-client";
import { Field, fieldClass } from "@/components/ui/field";
import { alertSuccess, btnAccentLg } from "../(dashboard)/_ui";

// Lien de confirmation expiré ou déjà utilisé : un nouveau lien, vers la même
// page de confirmation. Même message que l'adresse ait un compte ou non (pas
// d'énumération des comptes).
export function ResendVerification() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const email = String(new FormData(e.currentTarget).get("email"));
    await sendVerificationEmail({
      email,
      callbackURL: `/${locale}/account/verified`,
    }).catch(() => null);
    setSent(true);
    setPending(false);
  }

  if (sent) return <p className={alertSuccess}>{t("verifyResent")}</p>;

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <Field label={t("email")} htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={fieldClass}
        />
      </Field>
      <button type="submit" disabled={pending} className={btnAccentLg}>
        <Send size={16} strokeWidth={1.5} aria-hidden="true" />
        {t("verifyResendCta")}
      </button>
    </form>
  );
}

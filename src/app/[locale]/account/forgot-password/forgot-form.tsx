"use client";

import { useState } from "react";
import { MailCheck, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { Field, fieldClass } from "@/components/ui/field";
import { btnAccentLg } from "../(dashboard)/_ui";

export function ForgotForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const data = new FormData(e.currentTarget);
    await authClient.requestPasswordReset({
      email: String(data.get("email")),
      redirectTo: `/${locale}/account/reset-password`,
    });
    // Toujours afficher le succès : ne révèle pas si l'e-mail existe
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <MailCheck
          size={28}
          strokeWidth={1.5}
          className="mx-auto text-emerald-600"
        />
        <p className="mt-3 text-sm font-medium leading-relaxed text-soft">
          {t("resetSent")}
        </p>
      </div>
    );
  }

  return (
    // method="post" : repli natif sans JS (cohérence avec les autres formulaires)
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
        <Send size={16} strokeWidth={1.5} />
        {pending ? t("processing") : t("sendReset")}
      </button>
    </form>
  );
}

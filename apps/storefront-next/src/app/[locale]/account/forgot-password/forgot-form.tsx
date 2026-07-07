"use client";

import { useState } from "react";
import { MailCheck, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

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
      redirectTo: `${window.location.origin}/${locale}/account/reset-password`,
    });
    // Toujours afficher le succès : ne révèle pas si l'e-mail existe
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <MailCheck size={28} className="mx-auto text-emerald-600" />
        <p className="mt-3 text-sm font-medium leading-relaxed text-soft">{t("resetSent")}</p>
      </div>
    );
  }

  return (
    // method="post" : repli natif sans JS (cohérence avec les autres formulaires)
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
          {t("email")}
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={field} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        <Send size={16} />
        {pending ? t("processing") : t("sendReset")}
      </button>
    </form>
  );
}

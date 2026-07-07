"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors placeholder:text-soft/60 focus:border-ink focus:outline-none";

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
        <CheckCircle2 size={28} className="mx-auto text-emerald-600" />
        <p className="mt-3 text-sm font-medium leading-relaxed text-soft">{t("resetSuccess")}</p>
        <Link
          href="/account/login"
          className="mt-4 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
        >
          {t("signInCta")}
        </Link>
      </div>
    );
  }

  return (
    // method="post" : repli natif sans JS qui n'expose pas le mot de passe en URL
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
          {t("resetTitle")}
        </label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />
        <p className="mt-1 text-xs text-soft">{t("passwordHint")}</p>
      </div>
      {error && <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-[0.98] disabled:opacity-60"
      >
        <KeyRound size={16} />
        {pending ? t("processing") : t("resetCta")}
      </button>
    </form>
  );
}

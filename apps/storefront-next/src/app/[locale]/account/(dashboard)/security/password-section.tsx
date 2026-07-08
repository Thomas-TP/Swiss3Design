"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { changePassword, listAccounts } from "@/lib/auth-client";
import { card, field, btnPrimary } from "../_ui";

export function PasswordSection() {
  const t = useTranslations("account");
  // null = chargement, true = a déjà un mot de passe (provider "credential"),
  // false = compte lié uniquement via Google sur l'app racine (aucune
  // connexion sociale n'est proposée ici) → définir un mot de passe depuis
  // zéro nécessite une action serveur same-origine, pas encore disponible
  // cross-origine ; on affiche un message plutôt qu'un formulaire cassé.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAccounts().then(({ data }) => {
      if (cancelled) return;
      setHasPassword((data ?? []).some((a) => a.providerId === "credential"));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setDone(false);
    const { error: err } = await changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (err) {
      setError(t("security.passwordSection.errorChange"));
      return;
    }
    setCurrent("");
    setNext("");
    setDone(true);
  }

  if (hasPassword === null) return null;

  if (!hasPassword) {
    return (
      <div className={card}>
        <div className="flex items-center gap-2.5">
          <KeyRound size={18} className="shrink-0 text-soft" />
          <div>
            <p className="text-sm font-semibold">{t("security.passwordSection.title")}</p>
            <p className="mt-0.5 text-xs text-soft">{t("security.passwordSection.descSet")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={card}>
      <div className="flex items-center gap-2.5">
        <KeyRound size={18} className="shrink-0 text-soft" />
        <div>
          <p className="text-sm font-semibold">{t("security.passwordSection.title")}</p>
          <p className="mt-0.5 text-xs text-soft">{t("security.passwordSection.descChange")}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          placeholder={t("security.passwordSection.current")}
          required
          className={field}
        />
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          placeholder={t("security.passwordSection.new")}
          minLength={8}
          required
          className={field}
        />
        {error && <p className="text-sm font-medium text-accent">{error}</p>}
        {done && <p className="text-sm font-medium text-emerald-600">{t("security.passwordSection.saved")}</p>}
        <button type="submit" disabled={pending || next.length < 8 || !current} className={btnPrimary}>
          {pending ? t("security.processing") : t("security.passwordSection.submit")}
        </button>
      </form>
    </div>
  );
}

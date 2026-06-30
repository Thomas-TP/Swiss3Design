"use client";

import { useState } from "react";
import { Trash2, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteUser } from "@/lib/auth-client";

// Déplacé depuis l'onglet Sécurité vers Confidentialité (Phase 5) : la
// suppression de compte relève du droit à l'effacement (nLPD), à sa place
// naturelle aux côtés de l'export de données.
export function DeleteAccount() {
  const t = useTranslations("account");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onDelete() {
    if (!confirm(t("security.deleteConfirm"))) return;
    setPending(true);
    const { error } = await deleteUser({ callbackURL: "/" });
    setPending(false);
    if (!error) setSent(true);
  }

  return (
    <div className="rounded-card border border-red-500/30 bg-red-500/5 p-5 sm:p-6">
      <p className="flex items-center gap-2 text-sm font-semibold text-accent">
        <Trash2 size={16} />
        {t("security.dangerTitle")}
      </p>
      <p className="mt-1 text-xs text-soft">{t("security.dangerDesc")}</p>
      {sent ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <MailCheck size={16} className="shrink-0" />
          {t("security.deleteEmailSent")}
        </p>
      ) : (
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-red-500/20 disabled:opacity-60"
        >
          <Trash2 size={15} />
          {pending ? t("security.processing") : t("security.deleteButton")}
        </button>
      )}
    </div>
  );
}

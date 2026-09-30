"use client";

import { useState } from "react";
import { Trash2, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteUser } from "@/lib/auth-client";
import { alertSuccess, btnDanger } from "../_ui";

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
    <div className="rounded-card border border-accent-text/40 bg-accent/5 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-accent-text">
        <Trash2 size={16} strokeWidth={1.5} />
        {t("security.dangerTitle")}
      </h2>
      <p className="mt-1 text-xs text-soft">{t("security.dangerDesc")}</p>
      {sent ? (
        <output className={`${alertSuccess} mt-4 flex items-center gap-2`}>
          <MailCheck size={16} strokeWidth={1.5} className="shrink-0" />
          {t("security.deleteEmailSent")}
        </output>
      ) : (
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className={`${btnDanger} mt-4`}
        >
          <Trash2 size={15} strokeWidth={1.5} />
          {pending ? t("security.processing") : t("security.deleteButton")}
        </button>
      )}
    </div>
  );
}

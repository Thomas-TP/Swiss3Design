"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { card } from "../_ui";
import { ExportButton } from "./export-button";
import { DeleteAccount } from "./delete-account";

export default function PrivacyTab() {
  const t = useTranslations("account");

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Lock size={19} className="text-soft" />
        {t("privacy.title")}
      </h1>
      <p className="mt-1 mb-6 text-sm text-soft">{t("privacy.subtitle")}</p>

      <div className="space-y-4">
        <div className={card}>
          <p className="text-sm font-semibold">{t("privacy.exportTitle")}</p>
          <p className="mt-1 text-sm text-soft">{t("privacy.exportDesc")}</p>
          <div className="mt-4">
            <ExportButton />
          </div>
        </div>

        <DeleteAccount />
      </div>
    </div>
  );
}

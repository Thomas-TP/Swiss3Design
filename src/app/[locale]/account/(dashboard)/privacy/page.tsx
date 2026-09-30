import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AccountTitle } from "../account-title";
import { card } from "../_ui";
import { ExportButton } from "./export-button";
import { DeleteAccount } from "./delete-account";

export const dynamic = "force-dynamic";

export default async function PrivacyTab() {
  const t = await getTranslations("account");

  return (
    <div>
      <AccountTitle
        title={t("privacy.title")}
        subtitle={t("privacy.subtitle")}
        icon={Lock}
      />

      <div className="space-y-4">
        <div className={card}>
          <h2 className="text-sm font-semibold">{t("privacy.exportTitle")}</h2>
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

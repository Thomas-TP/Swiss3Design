import { getTranslations } from "next-intl/server";
import { AccountSecurity } from "../account-security";

export const dynamic = "force-dynamic";

export default async function SecurityTab() {
  const t = await getTranslations("account");
  return (
    <div>
      <h1 className="text-xl font-bold">{t("security.title")}</h1>
      <p className="mt-1 mb-6 text-sm text-soft">{t("security.subtitle")}</p>
      <AccountSecurity />
    </div>
  );
}

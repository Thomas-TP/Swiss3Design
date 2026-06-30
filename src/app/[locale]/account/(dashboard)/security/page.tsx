import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { enabledSocialProviders } from "@/lib/auth";
import { AccountSecurity } from "../account-security";
import { PasswordSection } from "./password-section";
import { SessionsSection } from "./sessions-section";
import { ConnectedAccountsSection } from "./connected-accounts-section";

export const dynamic = "force-dynamic";

export default async function SecurityTab() {
  const t = await getTranslations("account");
  const { env } = await getCloudflareContext({ async: true });
  const providers = enabledSocialProviders(env);

  return (
    <div>
      <h1 className="text-xl font-bold">{t("security.title")}</h1>
      <p className="mt-1 mb-6 text-sm text-soft">{t("security.subtitle")}</p>
      <div className="space-y-4">
        <PasswordSection />
        <SessionsSection />
        <ConnectedAccountsSection providers={providers} />
        <AccountSecurity />
      </div>
    </div>
  );
}

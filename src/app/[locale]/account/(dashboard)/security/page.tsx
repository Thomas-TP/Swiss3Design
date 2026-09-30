import { headers } from "next/headers";
import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAuthenticatorName } from "@better-auth/passkey";
import { getAuth, enabledSocialProviders } from "@/lib/auth";
import { AccountSecurity } from "../account-security";
import { AccountTitle } from "../account-title";
import { PasswordSection } from "./password-section";
import { SessionsSection } from "./sessions-section";
import { ConnectedAccountsSection } from "./connected-accounts-section";
import { PasskeysSection } from "./passkeys-section";

export const dynamic = "force-dynamic";

export default async function SecurityTab() {
  const t = await getTranslations("account");
  const { env } = await getCloudflareContext({ async: true });
  const providers = enabledSocialProviders(env);

  const auth = await getAuth();
  const reqHeaders = await headers();
  const passkeys = (await auth.api.listPasskeys({ headers: reqHeaders })).map(
    (p) => ({
      id: p.id,
      name: p.name ?? null,
      deviceType: p.deviceType,
      createdAt: p.createdAt ? p.createdAt.toISOString() : null,
      providerLabel: getAuthenticatorName(p.aaguid ?? undefined) ?? null,
    }),
  );

  return (
    <div>
      <AccountTitle
        title={t("security.title")}
        subtitle={t("security.subtitle")}
        icon={ShieldCheck}
      />
      <div className="space-y-4">
        <PasswordSection />
        <PasskeysSection initialPasskeys={passkeys} />
        <SessionsSection />
        <ConnectedAccountsSection providers={providers} />
        <AccountSecurity />
      </div>
    </div>
  );
}

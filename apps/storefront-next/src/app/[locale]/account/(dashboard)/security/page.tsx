"use client";

import { useTranslations } from "next-intl";
import { AccountSecurity } from "../account-security";
import { PasswordSection } from "./password-section";
import { PasskeysSection } from "./passkeys-section";
import { SessionsSection } from "./sessions-section";

// ConnectedAccountsSection (OAuth) est absent : storefront-next n'offre pas
// la connexion sociale (cf. auth-client.ts) — rien à lier/délier ici.
export default function SecurityTab() {
  const t = useTranslations("account");

  return (
    <div>
      <h1 className="text-xl font-bold">{t("security.title")}</h1>
      <p className="mt-1 mb-6 text-sm text-soft">{t("security.subtitle")}</p>
      <div className="space-y-4">
        <PasswordSection />
        <PasskeysSection />
        <SessionsSection />
        <AccountSecurity />
      </div>
    </div>
  );
}

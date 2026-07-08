"use client";

import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useAccountUser } from "../account-context";
import { card } from "../_ui";
import { ProfileForm } from "./profile-form";
import { EmailForm } from "./email-form";

export default function ProfileTab() {
  const t = useTranslations("account");
  const user = useAccountUser();

  return (
    <div>
      <h1 className="text-xl font-bold">{t("profile.title")}</h1>
      <p className="mt-1 mb-6 text-sm text-soft">{t("profile.subtitle")}</p>

      <div className="space-y-4">
        <div className={card}>
          <p className="text-sm font-semibold">{t("profile.nameTitle")}</p>
          <ProfileForm name={user.name} />
        </div>

        <div className={card}>
          <p className="text-sm font-semibold">{t("profile.emailTitle")}</p>
          <EmailForm email={user.email} verified={user.emailVerified} />
        </div>

        <div className={card}>
          <p className="text-sm font-semibold">{t("profile.languageTitle")}</p>
          <p className="mt-0.5 text-xs text-soft">{t("profile.languageDesc")}</p>
          <div className="mt-3">
            <LocaleSwitcher />
          </div>
        </div>
      </div>
    </div>
  );
}

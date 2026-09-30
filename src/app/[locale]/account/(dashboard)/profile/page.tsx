import { User } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getServerSession } from "@/lib/session";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AccountTitle } from "../account-title";
import { card } from "../_ui";
import { ProfileForm } from "./profile-form";
import { EmailForm } from "./email-form";

export const dynamic = "force-dynamic";

export default async function ProfileTab() {
  const t = await getTranslations("account");
  const session = await getServerSession();
  const { user } = session!;

  return (
    <div>
      <AccountTitle
        title={t("profile.title")}
        subtitle={t("profile.subtitle")}
        icon={User}
      />

      <div className="space-y-4">
        <div className={card}>
          <h2 className="text-sm font-semibold">{t("profile.nameTitle")}</h2>
          <ProfileForm name={user.name} />
        </div>

        <div className={card}>
          <h2 className="text-sm font-semibold">{t("profile.emailTitle")}</h2>
          <EmailForm email={user.email} verified={user.emailVerified} />
        </div>

        <div className={card}>
          <h2 className="text-sm font-semibold">
            {t("profile.languageTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-soft">
            {t("profile.languageDesc")}
          </p>
          <div className="mt-3">
            <LocaleSwitcher />
          </div>
        </div>
      </div>
    </div>
  );
}

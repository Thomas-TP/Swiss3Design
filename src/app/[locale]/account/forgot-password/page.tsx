import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "../auth-shell";
import { linkAccent } from "../(dashboard)/_ui";
import { ForgotForm } from "./forgot-form";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");

  return (
    <AuthShell
      title={t("forgotTitle")}
      intro={t("forgotIntro")}
      below={
        <p className="mt-5 text-center text-sm">
          <Link href="/account/login" className={linkAccent}>
            {t("signInTitle")}
          </Link>
        </p>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "../auth-shell";
import { alertError, linkAccent } from "../(dashboard)/_ui";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <AuthShell title={t("resetTitle")}>
      {!token || error ? (
        <div className="space-y-4 text-center">
          <p className={alertError}>{t("resetInvalid")}</p>
          <Link
            href="/account/forgot-password"
            className={`${linkAccent} inline-block text-sm`}
          >
            {t("forgotTitle")}
          </Link>
        </div>
      ) : (
        <ResetForm token={token} />
      )}
    </AuthShell>
  );
}

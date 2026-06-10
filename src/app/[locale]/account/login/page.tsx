import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6 md:py-20">
      <h1 className="text-center text-3xl font-bold tracking-tight">
        {t("signInTitle")}
      </h1>
      <div className="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
        <LoginForm />
      </div>
      <p className="mt-5 text-center text-sm text-soft">
        {t("noAccount")}{" "}
        <Link
          href="/account/register"
          className="font-semibold text-accent hover:underline"
        >
          {t("signUpTitle")}
        </Link>
      </p>
    </div>
  );
}

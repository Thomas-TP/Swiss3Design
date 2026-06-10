import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6 md:py-20">
      <h1 className="text-center text-3xl font-bold tracking-tight">
        {t("signUpTitle")}
      </h1>
      <div className="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
        <RegisterForm />
      </div>
      <p className="mt-5 text-center text-sm text-soft">
        {t("haveAccount")}{" "}
        <Link
          href="/account/login"
          className="font-semibold text-accent hover:underline"
        >
          {t("signInTitle")}
        </Link>
      </p>
    </div>
  );
}

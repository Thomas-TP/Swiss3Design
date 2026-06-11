import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Link } from "@/i18n/navigation";
import { enabledSocialProviders } from "@/lib/auth";
import { SocialButtons } from "../social-buttons";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const t = await getTranslations("auth");
  const { env } = await getCloudflareContext({ async: true });
  const providers = enabledSocialProviders(env);

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6 md:py-20">
      <h1 className="text-center text-3xl font-bold tracking-tight">
        {t("signUpTitle")}
      </h1>
      <div className="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
        <RegisterForm />
        <SocialButtons providers={providers} />
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

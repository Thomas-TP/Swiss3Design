import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Link } from "@/i18n/navigation";
import { enabledSocialProviders } from "@/lib/auth";
import { SocialButtons } from "../social-buttons";
import { RegisterForm } from "./register-form";
import { BrandMark } from "@/components/brand-mark";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const t = await getTranslations("auth");
  const { env } = await getCloudflareContext({ async: true });
  const providers = enabledSocialProviders(env);

  // Pré-remplissage de l'e-mail depuis la conversion invité → compte
  const { email } = await searchParams;
  const defaultEmail =
    email && /^\S+@\S+\.\S+$/.test(email) ? email.toLowerCase() : "";

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6 md:py-20">
      <BrandMark className="mx-auto h-10 w-10 text-ink" />
      <h1 className="mt-5 text-center text-3xl font-bold tracking-tight">
        {t("signUpTitle")}
      </h1>
      <div className="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
        <RegisterForm defaultEmail={defaultEmail} />
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
      <p className="mt-3 text-center text-sm text-soft">
        <Link
          href="/track"
          className="font-medium hover:text-ink hover:underline"
        >
          {t("trackOrderLink")}
        </Link>
      </p>
    </div>
  );
}

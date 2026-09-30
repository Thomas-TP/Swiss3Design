import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { enabledSocialProviders } from "@/lib/auth";
import { SocialButtons } from "../social-buttons";
import { AuthShell } from "../auth-shell";
import { linkAccent, linkSoft } from "../(dashboard)/_ui";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

// Titre d'onglet uniquement : l'espace compte est en noindex (account/layout).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("signUpTitle") };
}

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
    <AuthShell
      title={t("signUpTitle")}
      below={
        <>
          <p className="mt-5 text-center text-sm text-soft">
            {t("haveAccount")}{" "}
            <Link href="/account/login" className={linkAccent}>
              {t("signInTitle")}
            </Link>
          </p>
          <p className="mt-3 text-center">
            <Link href="/track" className={linkSoft}>
              {t("trackOrderLink")}
            </Link>
          </p>
        </>
      }
    >
      <RegisterForm defaultEmail={defaultEmail} />
      <SocialButtons providers={providers} />
    </AuthShell>
  );
}

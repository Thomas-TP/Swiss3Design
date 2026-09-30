import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { enabledSocialProviders } from "@/lib/auth";
import { SocialButtons } from "../social-buttons";
import { AuthShell } from "../auth-shell";
import { linkAccent, linkSoft } from "../(dashboard)/_ui";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

// Titre d'onglet uniquement : l'espace compte est en noindex (account/layout).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("signInTitle") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reauth?: string }>;
}) {
  const t = await getTranslations("auth");
  const { env } = await getCloudflareContext({ async: true });
  const providers = enabledSocialProviders(env);

  // Destination après connexion (ex. retour au checkout) — chemins internes uniquement
  const { next, reauth } = await searchParams;
  const nextPath =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  const isAdminReauthentication = reauth === "admin";

  return (
    <AuthShell
      title={t("signInTitle")}
      intro={
        reauth
          ? t(isAdminReauthentication ? "adminReauthNotice" : "reauthNotice")
          : undefined
      }
      below={
        <>
          <p className="mt-5 text-center text-sm text-soft">
            {t("noAccount")}{" "}
            <Link href="/account/register" className={linkAccent}>
              {t("signUpTitle")}
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
      <LoginForm
        next={nextPath}
        strongReauthentication={isAdminReauthentication}
      />
      {!isAdminReauthentication && (
        <SocialButtons providers={providers} next={nextPath} />
      )}
    </AuthShell>
  );
}

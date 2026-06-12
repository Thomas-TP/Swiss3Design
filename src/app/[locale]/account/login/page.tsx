import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Link } from "@/i18n/navigation";
import { enabledSocialProviders } from "@/lib/auth";
import { SocialButtons } from "../social-buttons";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations("auth");
  const { env } = await getCloudflareContext({ async: true });
  const providers = enabledSocialProviders(env);

  // Destination après connexion (ex. retour au checkout) — chemins internes uniquement
  const { next } = await searchParams;
  const nextPath =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6 md:py-20">
      <h1 className="text-center text-3xl font-bold tracking-tight">
        {t("signInTitle")}
      </h1>
      <div className="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
        <LoginForm next={nextPath} />
        <SocialButtons providers={providers} next={nextPath} />
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

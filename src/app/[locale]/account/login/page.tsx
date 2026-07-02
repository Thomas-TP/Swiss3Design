import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Link } from "@/i18n/navigation";
import { enabledSocialProviders } from "@/lib/auth";
import { SocialButtons } from "../social-buttons";
import { LoginForm } from "./login-form";
import { BrandMark } from "@/components/brand-mark";

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
      <BrandMark className="mx-auto h-10 w-10 text-ink" />
      <h1 className="mt-5 text-center text-3xl font-bold tracking-tight">
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
      <p className="mt-3 text-center text-sm text-soft">
        <Link href="/track" className="font-medium hover:text-ink hover:underline">
          {t("trackOrderLink")}
        </Link>
      </p>
    </div>
  );
}

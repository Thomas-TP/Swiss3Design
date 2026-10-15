import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getServerSession } from "@/lib/session";
import { AuthShell } from "../auth-shell";
import { linkAccent } from "../(dashboard)/_ui";
import { ResendVerification } from "./resend-verification";
import { VerifiedStatus } from "./verified-status";

export const dynamic = "force-dynamic";

// Arrivée du lien de confirmation d'e-mail (callbackURL de l'inscription) :
// Better Auth a vérifié le jeton, confirmé l'adresse et ouvert la session avant
// de rediriger ici. Erreur (`?error=TOKEN_EXPIRED`, `INVALID_TOKEN`,
// `USER_NOT_FOUND`…) ou aucune session confirmée : un nouveau lien. Sinon : la
// confirmation, puis retour à l'onglet de l'inscription ou au compte
// (verified-status.tsx).

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ error?: string }>;
}): Promise<Metadata> {
  const [{ locale }, { error }] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t(error ? "verifyFailedTitle" : "verifiedTitle") };
}

export default async function VerifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations("auth");
  const { error } = await searchParams;
  const session = error ? null : await getServerSession();

  if (!session?.user.emailVerified) {
    return (
      <AuthShell
        title={t("verifyFailedTitle")}
        intro={
          error === "TOKEN_EXPIRED"
            ? t("verifyFailedExpired")
            : t("verifyFailedInvalid")
        }
        below={
          <p className="mt-5 text-center text-sm text-soft">
            <Link href="/account/login" className={linkAccent}>
              {t("signInTitle")}
            </Link>
          </p>
        }
      >
        <ResendVerification />
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("verifiedTitle")} intro={t("verifiedText")}>
      <VerifiedStatus />
    </AuthShell>
  );
}

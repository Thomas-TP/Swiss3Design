import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ResetForm } from "./reset-form";
import { BrandMark } from "@/components/brand-mark";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6 md:py-20">
      <BrandMark className="mx-auto h-10 w-10 text-ink" />
      <h1 className="mt-5 text-center text-3xl font-bold tracking-tight">
        {t("resetTitle")}
      </h1>
      <div className="mt-8 rounded-card border border-line bg-surface p-6 sm:p-8">
        {!token || error ? (
          <div className="text-center">
            <p className="text-sm font-medium leading-relaxed text-accent">
              {t("resetInvalid")}
            </p>
            <Link
              href="/account/forgot-password"
              className="mt-4 inline-block text-sm font-semibold text-accent hover:underline"
            >
              {t("forgotTitle")}
            </Link>
          </div>
        ) : (
          <ResetForm token={token} />
        )}
      </div>
    </div>
  );
}

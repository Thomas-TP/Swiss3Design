import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { NOINDEX } from "@/lib/seo";
import { TrackFlow } from "./track-flow";

export const dynamic = "force-dynamic";

// Outil de suivi (formulaire n° de commande + e-mail) : sans contenu propre
// pour les moteurs, et ?order= ne doit jamais se retrouver indexé.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "track" });
  return { title: t("title"), robots: NOINDEX };
}

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const t = await getTranslations("track");
  const { order } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 md:py-20">
      <span className="mx-auto flex h-1 w-10 rounded-full bg-accent" />
      <h1 className="mt-3 text-center text-3xl font-bold tracking-tight md:text-4xl">
        {t("title")}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-soft">
        {t("subtitle")}
      </p>
      <TrackFlow initialOrderNumber={order ?? ""} />
    </div>
  );
}

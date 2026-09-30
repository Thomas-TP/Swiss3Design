import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { NOINDEX } from "@/lib/seo";
import { PageHeader } from "@/components/page-header";
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
  const [t, ts] = await Promise.all([
    getTranslations("track"),
    getTranslations("system.track"),
  ]);
  const { order } = await searchParams;

  return (
    <div className="s3d-page py-14 md:py-20">
      {/* Hors groupe (site) : ni Lenis ni canvas. Un seul h1 (point rouge). */}
      <div className="mx-auto max-w-2xl">
        <PageHeader title={ts("title")} intro={t("subtitle")} />
        <TrackFlow initialOrderNumber={order ?? ""} />
      </div>
    </div>
  );
}

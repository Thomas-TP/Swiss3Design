import { getTranslations } from "next-intl/server";
import { TrackFlow } from "./track-flow";

export const dynamic = "force-dynamic";

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const t = await getTranslations("track");
  const { order } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 md:py-20">
      <h1 className="text-center text-3xl font-bold tracking-tight">
        {t("title")}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-soft">
        {t("subtitle")}
      </p>
      <TrackFlow initialOrderNumber={order ?? ""} />
    </div>
  );
}

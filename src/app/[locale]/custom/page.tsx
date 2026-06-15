import { getTranslations } from "next-intl/server";
import { getMaterials } from "@/db/queries";
import { QuoteForm } from "./quote-form";

export const dynamic = "force-dynamic";

export default async function CustomPage() {
  const [t, materials] = await Promise.all([
    getTranslations("custom"),
    getMaterials(),
  ]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 md:py-16">
      <span className="flex h-1 w-10 rounded-full bg-accent" />
      <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-3 leading-relaxed text-soft">{t("intro")}</p>

      <div className="mt-8">
        <QuoteForm materials={materials} />
      </div>
    </div>
  );
}

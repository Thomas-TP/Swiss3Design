import { getTranslations } from "next-intl/server";
import { QuoteForm } from "./quote-form";

export default async function CustomPage() {
  const t = await getTranslations("custom");

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 md:py-16">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-3 leading-relaxed text-soft">{t("intro")}</p>

      <div className="mt-8">
        <QuoteForm />
      </div>
    </div>
  );
}

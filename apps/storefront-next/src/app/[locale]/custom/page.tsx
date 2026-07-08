import { getTranslations } from "next-intl/server";
import { QuoteForm } from "./quote-form";
import { PageHeader } from "@/components/page-header";

export default async function CustomPage() {
  const t = await getTranslations("custom");

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 md:py-16">
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="mt-8">
        <QuoteForm />
      </div>
    </div>
  );
}

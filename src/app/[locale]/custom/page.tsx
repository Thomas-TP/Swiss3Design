import { getTranslations } from "next-intl/server";
import { getMaterials } from "@/db/queries";
import { QuoteForm } from "./quote-form";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function CustomPage() {
  const [t, materials] = await Promise.all([
    getTranslations("custom"),
    getMaterials(),
  ]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 md:py-16">
      <PageHeader title={t("title")} intro={t("intro")} />

      <div className="mt-8">
        <QuoteForm materials={materials} />
      </div>
    </div>
  );
}

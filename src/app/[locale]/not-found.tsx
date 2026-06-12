import { SearchX, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Rendu pour tout notFound() dans l'arbre [locale] (ex. produit supprimé)
export default async function NotFoundPage() {
  const t = await getTranslations("errors");

  return (
    <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-surface ring-1 ring-line">
        <SearchX size={26} strokeWidth={1.6} className="text-soft" />
      </span>
      <h1 className="mt-6 text-2xl font-bold">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-soft">{t("notFoundText")}</p>
      <Link
        href="/"
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
      >
        {t("notFoundCta")}
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}

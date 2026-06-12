import { getTranslations } from "next-intl/server";
import { FavoritesList } from "./favorites-list";

export default async function FavoritesPage() {
  const t = await getTranslations("favorites");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
        {t("title")}
      </h1>
      <FavoritesList />
    </div>
  );
}

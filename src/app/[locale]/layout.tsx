import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { LocaleShell } from "@/components/locale-shell";

// Layout du segment de langue : l'habillage des pages (LocaleShell). Le
// document <html>/<body>, le thème, les données structurées du site et les
// métadonnées par défaut sont dans le layout racine (src/app/layout.tsx), pour
// que la 404 d'une URL inconnue, rendue hors de ce segment, les partage.
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return <LocaleShell locale={locale}>{children}</LocaleShell>;
}

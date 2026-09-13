"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
const NAMES: Record<Locale, string> = {
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  en: "English",
};
export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select
      aria-label={t("language")}
      value={locale}
      onChange={(e) =>
        router.replace(
          pathname + window.location.search + window.location.hash,
          { locale: e.target.value as Locale },
        )
      }
      className="max-w-24 cursor-pointer rounded-full border border-line bg-surface px-2 py-2 text-xs font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {routing.locales.map((l) => (
        <option key={l} value={l} lang={l}>
          {NAMES[l]}
        </option>
      ))}
    </select>
  );
}

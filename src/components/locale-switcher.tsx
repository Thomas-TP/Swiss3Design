"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      aria-label="Language"
      value={locale}
      onChange={(e) =>
        router.replace(pathname, { locale: e.target.value as Locale })
      }
      className="cursor-pointer appearance-none rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-soft transition-colors hover:text-ink focus:outline-none"
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>
          {l.toUpperCase()}
        </option>
      ))}
    </select>
  );
}

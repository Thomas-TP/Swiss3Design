"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useIsDark, toggleTheme } from "@/lib/theme";

// Bascule clair/sombre : agit sur la classe .dark de <html> et persiste le
// choix. L'icône reflète l'état réel via useIsDark (sans flash d'hydratation).
export function ThemeToggle() {
  const t = useTranslations("nav");
  const dark = useIsDark();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t("theme")}
      className="rounded-full p-2 text-soft transition-colors hover:bg-line/60 hover:text-ink"
    >
      {dark ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}
    </button>
  );
}

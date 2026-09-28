"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useIsDark, toggleTheme } from "@/lib/theme";

// Bascule clair/sombre : agit sur la classe .dark de <html> et persiste le
// choix. L'icône reflète l'état réel via useIsDark (sans flash d'hydratation).
// Habillage « Strates » : bouton carré de 40 px à rayon `field`, trait 1,5,
// sans pastille de couleur ; le focus est l'anneau encre global.
export function ThemeToggle() {
  const t = useTranslations("nav");
  const dark = useIsDark();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t("theme")}
      className="inline-flex h-10 w-10 items-center justify-center rounded-field text-soft transition-colors duration-150 hover:bg-line/60 hover:text-ink"
    >
      {dark ? (
        <Sun size={19} strokeWidth={1.5} />
      ) : (
        <Moon size={19} strokeWidth={1.5} />
      )}
    </button>
  );
}

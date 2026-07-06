import { Moon, Sun } from "lucide-solid";
import { useIsDark, toggleTheme } from "../lib/theme";
import { useI18n } from "../i18n/context";

export function ThemeToggle() {
  const { t } = useI18n();
  const dark = useIsDark();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t("nav.theme")}
      class="rounded-full p-2 text-soft transition-colors hover:bg-line/60 hover:text-ink"
    >
      {dark() ? <Sun size={20} stroke-width={1.8} /> : <Moon size={20} stroke-width={1.8} />}
    </button>
  );
}

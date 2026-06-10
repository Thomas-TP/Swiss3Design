import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="mt-20 border-t border-line bg-surface pb-24 md:pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-xs font-black text-white">
                3
              </span>
              Swiss3Design
            </p>
            <p className="mt-1 text-sm text-soft">{t("tagline")}</p>
          </div>
          <a
            href="mailto:contact@swiss3design.ch"
            className="text-sm font-medium text-soft transition-colors hover:text-ink"
          >
            contact@swiss3design.ch
          </a>
        </div>
        <p className="mt-8 text-xs text-soft">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}

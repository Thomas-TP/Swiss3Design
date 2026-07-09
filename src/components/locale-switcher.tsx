"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

// Noms natifs : chaque langue s'affiche dans sa propre langue
const NAMES: Record<Locale, string> = {
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  en: "English",
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-label="Language"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-soft transition-colors hover:text-ink focus:outline-none"
      >
        {locale}
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1.5 shadow-lg shadow-ink/5"
        >
          {routing.locales.map((l) => (
            <button
              key={l}
              type="button"
              role="option"
              aria-selected={l === locale}
              onClick={() => {
                setOpen(false);
                router.replace(pathname, { locale: l });
              }}
              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-paper ${
                l === locale ? "font-semibold" : ""
              }`}
            >
              {NAMES[l]}
              {l === locale && (
                <Check size={15} className="shrink-0 text-accent" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

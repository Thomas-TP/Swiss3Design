"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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
  const locale = useLocale() as Locale;
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(
    Math.max(0, routing.locales.indexOf(locale)),
  );
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [activeIndex, open]);

  function openAt(index: number) {
    setActiveIndex(index);
    setOpen(true);
  }

  function close(focusTrigger = false) {
    setOpen(false);
    if (focusTrigger) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function choose(nextLocale: Locale) {
    close(true);
    router.replace(pathname + window.location.search + window.location.hash, {
      locale: nextLocale,
    });
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${t("language")} : ${NAMES[locale]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() =>
          open ? close() : openAt(Math.max(0, routing.locales.indexOf(locale)))
        }
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openAt(Math.max(0, routing.locales.indexOf(locale)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openAt(routing.locales.length - 1);
          }
        }}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-soft transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {locale}
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {/* oxlint-disable prefer-tag-over-role -- liste deroulante maison necessaire au style de marque */}
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={t("language")}
          className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1.5 shadow-lg shadow-ink/5"
        >
          {routing.locales.map((nextLocale, index) => (
            <button
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              key={nextLocale}
              type="button"
              role="option"
              aria-label={NAMES[nextLocale]}
              aria-selected={nextLocale === locale}
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => choose(nextLocale)}
              onMouseEnter={() => setActiveIndex(index)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((index + 1) % routing.locales.length);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex(
                    (index - 1 + routing.locales.length) %
                      routing.locales.length,
                  );
                } else if (event.key === "Home") {
                  event.preventDefault();
                  setActiveIndex(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  setActiveIndex(routing.locales.length - 1);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  close(true);
                } else if (event.key === "Tab") {
                  close();
                }
              }}
              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-paper focus:bg-paper focus:outline-none ${
                nextLocale === locale ? "font-semibold" : ""
              }`}
            >
              {NAMES[nextLocale]}
              {nextLocale === locale && (
                <Check size={15} className="shrink-0 text-accent" />
              )}
            </button>
          ))}
        </div>
      )}
      {/* oxlint-enable prefer-tag-over-role */}
    </div>
  );
}

import { createSignal, onCleanup, onMount, For } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { Check, ChevronDown } from "lucide-solid";
import { LOCALES, type Locale } from "../i18n/messages";
import { useI18n } from "../i18n/context";

const NAMES: Record<Locale, string> = {
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  en: "English",
};

export function LocaleSwitcher() {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = createSignal(false);
  let ref: HTMLDivElement | undefined;

  onMount(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref && !ref.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    });
  });

  function switchTo(next: Locale) {
    setOpen(false);
    const rest = location.pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
    navigate(`/${next}${rest === "/" ? "" : rest}${location.search}`);
  }

  return (
    <div ref={ref} class="relative inline-block">
      <button
        type="button"
        aria-label="Language"
        aria-haspopup="listbox"
        aria-expanded={open()}
        onClick={() => setOpen((o) => !o)}
        class="flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-soft transition-colors hover:text-ink focus:outline-none"
      >
        {locale()}
        <ChevronDown size={13} class={`transition-transform duration-200 ${open() ? "rotate-180" : ""}`} />
      </button>
      {open() && (
        <ul
          role="listbox"
          class="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1.5 shadow-lg shadow-ink/5"
        >
          <For each={LOCALES}>
            {(l) => (
              <li role="option" aria-selected={l === locale()}>
                <button
                  type="button"
                  onClick={() => switchTo(l)}
                  class={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-paper ${
                    l === locale() ? "font-semibold" : ""
                  }`}
                >
                  {NAMES[l]}
                  {l === locale() && <Check size={15} class="shrink-0 text-accent" />}
                </button>
              </li>
            )}
          </For>
        </ul>
      )}
    </div>
  );
}

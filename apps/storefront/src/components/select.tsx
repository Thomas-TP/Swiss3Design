import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { Check, ChevronDown } from "lucide-solid";

export interface SelectOption {
  value: string;
  label: string;
}

// Liste déroulante maison - miroir de src/components/select.tsx côté app
// Next.js (les <select> natifs ne se stylent pas).
export function Select(props: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  name?: string;
  ariaLabel?: string;
}) {
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

  const selected = () => props.options.find((o) => o.value === props.value);

  return (
    <div ref={ref} class="relative">
      <Show when={props.name}>
        <input type="hidden" name={props.name} value={props.value} />
      </Show>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-label={props.ariaLabel}
        onClick={() => setOpen((o) => !o)}
        class="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm transition-colors focus:border-ink focus:outline-none"
      >
        <span class={`truncate ${selected() ? "" : "text-soft/60"}`}>
          {selected()?.label ?? props.placeholder}
        </span>
        <ChevronDown size={16} class={`shrink-0 text-soft transition-transform duration-200 ${open() ? "rotate-180" : ""}`} />
      </button>
      <Show when={open()}>
        <ul
          role="listbox"
          class="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface py-1.5 shadow-lg shadow-ink/5"
        >
          <For each={props.options}>
            {(o) => (
              <li role="option" aria-selected={o.value === props.value}>
                <button
                  type="button"
                  onClick={() => {
                    props.onChange(o.value);
                    setOpen(false);
                  }}
                  class={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-paper ${
                    o.value === props.value ? "font-semibold" : ""
                  }`}
                >
                  <span class="truncate">{o.label}</span>
                  <Show when={o.value === props.value}>
                    <Check size={15} class="shrink-0 text-accent" />
                  </Show>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

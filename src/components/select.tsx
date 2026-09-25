"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

// Liste déroulante visuellement identique à la version de production, avec
// déplacement du focus et commandes clavier explicites.
export function Select({
  value,
  onChange,
  options,
  placeholder,
  name,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  name?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];

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
    if (options.length === 0) return;
    setActiveIndex(Math.max(0, Math.min(index, options.length - 1)));
    setOpen(true);
  }

  function close(focusTrigger = false) {
    setOpen(false);
    if (focusTrigger) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function choose(option: SelectOption) {
    onChange(option.value);
    close(true);
  }

  return (
    <div ref={ref} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() =>
          open ? close() : openAt(selectedIndex >= 0 ? selectedIndex : 0)
        }
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openAt(selectedIndex >= 0 ? selectedIndex : 0);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openAt(selectedIndex >= 0 ? selectedIndex : options.length - 1);
          }
        }}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm transition-colors focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span className={`truncate ${selected ? "" : "text-soft/60"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-soft transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {/* oxlint-disable prefer-tag-over-role -- liste deroulante maison necessaire au style de marque */}
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel ?? placeholder}
          className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface py-1.5 shadow-lg shadow-ink/5"
        >
          {options.map((option, index) => (
            <button
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => choose(option)}
              onMouseEnter={() => setActiveIndex(index)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((index + 1) % options.length);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((index - 1 + options.length) % options.length);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  setActiveIndex(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  setActiveIndex(options.length - 1);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  close(true);
                } else if (event.key === "Tab") {
                  close();
                }
              }}
              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-paper focus:bg-paper focus:outline-none ${
                option.value === value ? "font-semibold" : ""
              }`}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && (
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

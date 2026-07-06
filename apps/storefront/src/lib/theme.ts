import { createSignal, onCleanup, onMount } from "solid-js";

// Source de vérité du thème : la classe .dark sur <html> (posée par le script
// anti-FOUC dans entry-server.tsx, basculée par le toggle). Miroir de
// src/lib/theme.ts côté app Next.js (adapté : Solid n'a pas
// useSyncExternalStore, un signal + MutationObserver suffit).

export type Theme = "light" | "dark";

export function resolveTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // stockage indisponible — on retombe sur la préférence système
  }
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function useIsDark() {
  const [isDark, setIsDark] = createSignal(false);

  onMount(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark")),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    onCleanup(() => observer.disconnect());
  });

  return isDark;
}

export function toggleTheme() {
  const next: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem("theme", next);
  } catch {
    // stockage indisponible — le choix ne sera pas mémorisé, sans gravité
  }
}

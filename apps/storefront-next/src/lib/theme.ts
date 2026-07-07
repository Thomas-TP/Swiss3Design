import { useSyncExternalStore } from "react";

// Source de vérité du thème : la classe .dark sur <html> (posée par le script
// anti-FOUC du layout, ré-appliquée à chaque navigation par <ThemeManager>,
// basculée par le toggle). On s'y abonne via useSyncExternalStore — pas de
// setState dans un effet, pas de décalage SSR. Miroir exact de
// src/lib/theme.ts côté app Next.js racine.

export type Theme = "light" | "dark";

export function resolveTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // stockage indisponible — on retombe sur la préférence système
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function subscribe(callback: () => void) {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
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

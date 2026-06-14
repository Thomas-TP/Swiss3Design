import { useSyncExternalStore } from "react";

// Source de vérité du thème : la classe .dark sur <html> (posée par le script
// anti-FOUC du layout, basculée par le toggle). On s'y abonne via
// useSyncExternalStore — pas de setState dans un effet, pas de décalage SSR.

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
  const next = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem("theme", next ? "dark" : "light");
  } catch {
    // stockage indisponible — le choix ne sera pas mémorisé, sans gravité
  }
}

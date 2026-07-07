"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { applyTheme, resolveTheme } from "@/lib/theme";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Filet de sécurité du thème (cf. src/components/theme-manager.tsx côté app
// Next.js racine — miroir exact).
export function ThemeManager() {
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    applyTheme(resolveTheme());
  }, [pathname]);

  useEffect(() => {
    const reapply = () => applyTheme(resolveTheme());
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) reapply();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme") reapply();
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}

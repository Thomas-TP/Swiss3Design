"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { applyTheme, resolveTheme } from "@/lib/theme";

// useLayoutEffect côté client (ré-applique AVANT peinture → aucun flash),
// useEffect côté serveur (évite l'avertissement SSR de React).
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Filet de sécurité du thème. Le script anti-FOUC du layout ne pose la classe
// .dark qu'au chargement initial du document. Or certaines navigations ne
// rechargent pas le document : changement de langue (router.replace re-rend
// tout le layout [locale]), retour arrière, restauration bfcache… La classe
// peut alors être perdue et l'UI « sauter » en clair. On la ré-applique donc à
// chaque navigation et à chaque restauration, depuis le choix mémorisé.
//
// On lit le pathname via next/navigation (et non @/i18n/navigation) car il
// inclut le préfixe de langue : il change donc aussi au changement de langue.
export function ThemeManager() {
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    applyTheme(resolveTheme());
  }, [pathname]);

  useEffect(() => {
    const reapply = () => applyTheme(resolveTheme());
    // pageshow.persisted = page restaurée depuis le bfcache (retour arrière).
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) reapply();
    };
    // Synchro entre onglets : un changement de thème ailleurs s'applique ici.
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

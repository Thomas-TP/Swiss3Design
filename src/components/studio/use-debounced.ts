"use client";

import { useEffect, useState } from "react";

/**
 * Valeur retardée : suit `value` une fois qu'elle n'a plus changé pendant
 * `delayMs`. Sert au résumé vivant des lecteurs d'écran (1 s, brief « Strates »,
 * §6.10) : un glissé ne doit pas les faire parler à chaque pixel. La première
 * valeur est celle du premier rendu (rien à annoncer au chargement).
 */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

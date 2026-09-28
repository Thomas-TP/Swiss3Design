// Thème du Stage (brief « Strates », §4.4) : couleurs lues dans les jetons CSS
// (une seule source de vérité, globals.css) et suivi de la classe .dark de
// <html>, le même signal que useIsDark (src/lib/theme.ts). Les valeurs de
// repli sont celles du §2.1, au cas où un jeton manquerait.
import type { StageTheme } from "./types";

const FALLBACK = {
  light: {
    paper: "#f4f0e8",
    ink: "#1a1614",
    iso: "#c9c1b2",
    isoIndex: "#9c7650",
  },
  dark: {
    paper: "#0e0d0b",
    ink: "#f2ede4",
    iso: "#3a352f",
    isoIndex: "#8a6c4e",
  },
} as const;

function token(style: CSSStyleDeclaration, name: string): string {
  return style.getPropertyValue(name).trim();
}

export function readStageTheme(): StageTheme {
  const root = document.documentElement;
  const dark = root.classList.contains("dark");
  const style = getComputedStyle(root);
  const fallback = dark ? FALLBACK.dark : FALLBACK.light;
  return {
    dark,
    paper: token(style, "--paper") || fallback.paper,
    ink: token(style, "--ink") || fallback.ink,
    iso: token(style, "--iso") || fallback.iso,
    isoIndex: token(style, "--iso-index") || fallback.isoIndex,
  };
}

/**
 * Fond d'une vue `clear: "tone"` : --paper calculé sur la section (un
 * chapitre [data-tone="ink"] le redéfinit localement).
 */
export function readToneColor(element: Element, theme: StageTheme): string {
  return token(getComputedStyle(element), "--paper") || theme.paper;
}

export function onThemeChange(cb: () => void): () => void {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

export function sameTheme(a: StageTheme, b: StageTheme): boolean {
  return (
    a.dark === b.dark &&
    a.paper === b.paper &&
    a.ink === b.ink &&
    a.iso === b.iso &&
    a.isoIndex === b.isoIndex
  );
}

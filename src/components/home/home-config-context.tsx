"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { track } from "@/lib/analytics";
import type { LavauxConfig } from "@/lib/studio/types";
import {
  DEFAULT_PALETTE,
  DEFAULT_PATTERN,
  variantConfig,
  variantKey,
  type HeroData,
  type HeroPaletteKey,
  type HeroPatternKey,
  type VariantFigures,
} from "./hero-data";

// `HomeConfig` (brief « Strates », §7.5 chapitre 01) : la palette et le motif
// que le visiteur règle dans le héros, partagés avec le chapitre 01 (l'éclaté
// suit le même vase). Un contexte client, rien d'autre : les chiffres des douze
// variantes arrivent du serveur en props (hero-data-build.ts), le client n'en
// calcule aucun et n'importe aucune bibliothèque du Studio.

interface HomeConfigValue {
  data: HeroData;
  palette: HeroPaletteKey;
  pattern: HeroPatternKey;
  setPalette(palette: HeroPaletteKey): void;
  setPattern(pattern: HeroPatternKey): void;
  /** Configuration complète de la variante choisie. */
  config: LavauxConfig;
  figures: VariantFigures;
  /** Vrai dès le premier geste : le poster n'est plus celui du serveur. */
  customized: boolean;
}

const HomeConfigContext = createContext<HomeConfigValue | null>(null);

// « Une fois par session » (§4.10) : un drapeau de module, donc par session
// JavaScript (les navigations entre pages vitrine la gardent). Aucun stockage
// de plus : la liste des clés du §4.10 est fermée.
let customizedReported = false;

export function HomeConfigProvider({
  data,
  children,
}: {
  data: HeroData;
  children: ReactNode;
}) {
  const [palette, setPaletteState] = useState<HeroPaletteKey>(DEFAULT_PALETTE);
  const [pattern, setPatternState] = useState<HeroPatternKey>(DEFAULT_PATTERN);

  const report = useCallback(
    (nextPalette: HeroPaletteKey, nextPattern: HeroPatternKey) => {
      if (customizedReported) return;
      customizedReported = true;
      // Jamais de texte saisi : deux identifiants de la liste fermée.
      track("Hero Customized", { palette: nextPalette, pattern: nextPattern });
    },
    [],
  );

  const setPalette = useCallback(
    (next: HeroPaletteKey) => {
      setPaletteState(next);
      report(next, pattern);
    },
    [pattern, report],
  );
  const setPattern = useCallback(
    (next: HeroPatternKey) => {
      setPatternState(next);
      report(palette, next);
    },
    [palette, report],
  );

  const value = useMemo<HomeConfigValue>(
    () => ({
      data,
      palette,
      pattern,
      setPalette,
      setPattern,
      config: variantConfig(data, palette, pattern),
      figures: data.figures[variantKey(palette, pattern)],
      customized: palette !== DEFAULT_PALETTE || pattern !== DEFAULT_PATTERN,
    }),
    [data, palette, pattern, setPalette, setPattern],
  );

  return (
    <HomeConfigContext.Provider value={value}>
      {children}
    </HomeConfigContext.Provider>
  );
}

export function useHomeConfig(): HomeConfigValue {
  const value = useContext(HomeConfigContext);
  if (!value)
    throw new Error("useHomeConfig : hors de <HomeConfigProvider> (accueil).");
  return value;
}

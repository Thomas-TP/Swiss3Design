import { useEffect, useState, type ReactNode } from "react";
import type { HeroPoster } from "@/lib/studio/poster";
import { useHomeConfig } from "./home-config-context";
import { PosterSvg } from "./poster-svg";
import styles from "./home.module.css";

// Posters recalculés côté client quand il n'y a pas de 3D (mouvement réduit,
// appareil sans WebGL) : les contrôles du héros recolorent le dessin, tout de
// suite. Le calcul vit dans src/lib/studio/poster.ts, qui tire les générateurs
// du Studio : on ne l'importe que de façon asynchrone, pour ceux qui en ont
// besoin (jamais dans le JavaScript initial), et on le réchauffe dès que la
// page sait qu'elle est en 2D, si bien que le premier geste est instantané.

type PosterModule = typeof import("@/lib/studio/poster");

let loaded: Promise<PosterModule> | null = null;
function loadPosters(): Promise<PosterModule> {
  loaded ??= import("@/lib/studio/poster");
  return loaded;
}

/**
 * Poster de la variante courante, calculé côté client, ou `null` : tant que
 * rien n'est réglé, le poster du serveur (celui de la configuration d'exemple)
 * est le bon. `active` : la page est en 2D.
 */
export function useStaticPoster(
  variant: HeroPoster["variant"],
  active: boolean,
): ReactNode | null {
  const { config, customized } = useHomeConfig();
  const [poster, setPoster] = useState<HeroPoster | null>(null);

  useEffect(() => {
    if (active) void loadPosters();
  }, [active]);

  useEffect(() => {
    if (!active || !customized) return;
    let cancelled = false;
    void loadPosters().then(({ heroPoster }) => {
      if (!cancelled) setPoster(heroPoster(config, variant));
    });
    return () => {
      cancelled = true;
    };
  }, [active, customized, config, variant]);

  if (!active || !customized || !poster) return null;
  return <PosterSvg poster={poster} className={styles.poster} />;
}

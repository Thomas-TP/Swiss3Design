import { useState, type ReactNode } from "react";
import { PosterEngine } from "@/gates/home";
import type { HeroPoster } from "@/lib/studio/poster";
import { useHomeConfig } from "./home-config-context";
import { PosterSvg } from "./poster-svg";
import styles from "./home.module.css";

// Posters recalculés côté client quand il n'y a pas de 3D (mouvement réduit,
// appareil sans WebGL) : les contrôles du héros recolorent le dessin, tout de
// suite. Le calcul vit dans src/lib/studio/poster.ts, qui tire les générateurs
// du Studio : il n'est atteint que par le gate de l'accueil (PosterEngine,
// next/dynamic sans SSR), si bien que ni le Worker ni le JavaScript initial ne
// le portent. Le moteur est monté dès que la page sait qu'elle est en 2D : son
// chunk arrive avant le premier geste, qui est alors instantané.

/**
 * `poster` : le poster de la variante courante, calculé côté client, ou `null`
 * (tant que rien n'est réglé, le poster du serveur, celui de la configuration
 * d'exemple, est le bon). `engine` : l'élément à rendre pour que le calcul ait
 * lieu (rien en 3D). `active` : la page est en 2D.
 */
export function useStaticPoster(
  variant: HeroPoster["variant"],
  active: boolean,
): { poster: ReactNode | null; engine: ReactNode } {
  const { config, customized } = useHomeConfig();
  const [computed, setComputed] = useState<HeroPoster | null>(null);

  const engine = active ? (
    <PosterEngine config={config} variant={variant} onPoster={setComputed} />
  ) : null;
  const poster =
    active && customized && computed ? (
      <PosterSvg poster={computed} className={styles.poster} />
    ) : null;
  return { poster, engine };
}

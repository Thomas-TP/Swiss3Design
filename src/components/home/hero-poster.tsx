import type { HeroPoster } from "@/lib/studio/poster";
import { HOME_DATA } from "./home-data.generated";
import { PosterSvg } from "./poster-svg";
import styles from "./home.module.css";

// Posters SSR du héros et de l'éclaté (brief « Strates », §5.7) : des SVG
// inline calculés par src/lib/studio/poster.ts avec la caméra du Stage
// (`heroCamera()`), donc la première frame WebGL se superpose au poster (écart
// mesuré de 0,2 px, print-hero.test.ts le garde). Les données sont figées dans
// home-data.generated.ts : la page n'embarque pas les générateurs du Studio.
// Décoratifs (aria-hidden) et non candidats au LCP (SVG inline : le h1 est
// l'élément LCP).

/** Données d'un poster de la configuration d'exemple (aussi lues par le chapitre 03). */
export function getHeroPoster(variant: HeroPoster["variant"]): HeroPoster {
  return HOME_DATA.posters[variant];
}

/** Le plateau vide, avant la première couche (la première frame du Stage est identique). */
export function HeroPlatePoster() {
  return (
    <PosterSvg poster={getHeroPoster("plate")} className={styles.poster} />
  );
}

/** La matière : strates colorées, état final de l'impression. */
export function HeroFinalPoster() {
  return (
    <PosterSvg poster={getHeroPoster("final")} className={styles.poster} />
  );
}

/** Le même vase éclaté (chapitre 01). */
export function HeroExplodedPoster() {
  return (
    <PosterSvg poster={getHeroPoster("exploded")} className={styles.poster} />
  );
}

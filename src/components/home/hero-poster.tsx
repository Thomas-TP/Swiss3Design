import { HERO_CONFIG } from "@/lib/studio/presets";
import { heroPoster, type HeroPoster } from "@/lib/studio/poster";
import { PosterSvg } from "./poster-svg";
import styles from "./home.module.css";

// Posters SSR du héros et de l'éclaté (brief « Strates », §5.7) : des SVG
// inline calculés par src/lib/studio/poster.ts avec la caméra du Stage
// (`heroCamera()`), donc la première frame WebGL se superpose au poster. Le
// calcul ne dépend ni de la langue ni de la requête : une fois par instance du
// Worker. Décoratifs (aria-hidden) et non candidats au LCP (SVG inline : le h1
// est l'élément LCP).

const cache = new Map<HeroPoster["variant"], HeroPoster>();

/** Données d'un poster de la configuration d'exemple (aussi lues par le chapitre 03). */
export function getHeroPoster(variant: HeroPoster["variant"]): HeroPoster {
  let value = cache.get(variant);
  if (!value) {
    value = heroPoster(HERO_CONFIG, variant);
    cache.set(variant, value);
  }
  return value;
}

const poster = getHeroPoster;

/** Le dessin (anneaux fantômes tous les 2 mm), avant que le visiteur ne joue. */
export function HeroGhostPoster() {
  return <PosterSvg poster={poster("ghost")} className={styles.poster} />;
}

/** La matière : strates colorées, état final de l'impression. */
export function HeroFinalPoster() {
  return <PosterSvg poster={poster("final")} className={styles.poster} />;
}

/** Le même vase éclaté (chapitre 01). */
export function HeroExplodedPoster() {
  return <PosterSvg poster={poster("exploded")} className={styles.poster} />;
}

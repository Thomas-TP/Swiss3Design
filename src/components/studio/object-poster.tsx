import { getHeroPoster } from "@/components/home/hero-poster";
import { PosterSvg } from "@/components/home/poster-svg";
import { cx } from "@/components/ui/cx";
import {
  borneTopView,
  cartoucheTopView,
  topViewToSvg,
} from "@/lib/studio/poster-flat";
import { BORNE_DEFAULT, CARTOUCHE_DEFAULT } from "@/lib/studio/presets";
import type { StudioObjectId, StudioTexts } from "@/lib/studio/types";

// Aperçu d'un objet du Studio dans ses couleurs (cartes de la boutique et de
// l'index du Studio) : le dessin que le code calcule, rendu par le serveur sans
// composant client ni JavaScript. Le vase est le poster 3/4 du héros (les
// strates aux teintes des bandes, déjà figé pour l'accueil), le sous-verre
// l'affiche statique de `public/posters` (hors du Worker), la carte et le
// porte-nom leur vue de dessus (une variante par thème, l'une des deux est
// masquée par la classe `.dark` de <html>).
//
// Le SVG est fabriqué par notre code à partir de la configuration par défaut
// (nombres, couleurs de filament) ; aucun texte du visiteur n'y entre (les
// lignes de texte sont des barres de la taille exacte du texte d'exemple).

type Theme = "light" | "dark";

// Un aperçu ne dépend que de l'objet, du thème et des textes d'exemple de la
// langue : calculé une fois par instance du Worker, puis relu.
const cache = new Map<string, string>();

function flatSvg(
  object: "cartouche" | "borne",
  texts: StudioTexts,
  theme: Theme,
  locale: string,
): string {
  const key = `${object}|${theme}|${locale}`;
  let svg = cache.get(key);
  if (svg === undefined) {
    const view =
      object === "cartouche"
        ? cartoucheTopView(CARTOUCHE_DEFAULT, texts, { theme })
        : borneTopView(BORNE_DEFAULT, texts, { theme });
    svg = topViewToSvg(view, { className: "block h-full w-full" });
    cache.set(key, svg);
  }
  return svg;
}

export function ObjectPreview({
  object,
  texts,
  locale,
  className,
}: {
  object: StudioObjectId;
  /** Textes d'exemple de la langue (studioCore.examples.*) : la taille des lignes de texte. */
  texts: StudioTexts;
  locale: string;
  className?: string;
}) {
  const frame = cx("grid place-items-center", className);

  if (object === "lavaux") {
    return (
      <div aria-hidden="true" className={frame}>
        <PosterSvg
          poster={getHeroPoster("final")}
          className="block h-full w-full"
        />
      </div>
    );
  }

  if (object === "relief") {
    return (
      <div aria-hidden="true" className={frame}>
        <img
          src="/posters/relief-default-light.svg"
          alt=""
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-contain dark:hidden"
        />
        <img
          src="/posters/relief-default-dark.svg"
          alt=""
          loading="lazy"
          decoding="async"
          className="hidden h-full w-full object-contain dark:block"
        />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className={frame}>
      <div
        className="h-full w-full dark:hidden"
        dangerouslySetInnerHTML={{
          __html: flatSvg(object, texts, "light", locale),
        }}
      />
      <div
        className="hidden h-full w-full dark:block"
        dangerouslySetInnerHTML={{
          __html: flatSvg(object, texts, "dark", locale),
        }}
      />
    </div>
  );
}

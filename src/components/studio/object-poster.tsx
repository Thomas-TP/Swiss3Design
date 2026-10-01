import { elevationToSvg, lavauxElevation } from "@/lib/studio/poster";
import {
  borneTopView,
  cartoucheTopView,
  reliefTopView,
  topViewToSvg,
} from "@/lib/studio/poster-flat";
import type { StudioConfig, StudioTexts } from "@/lib/studio/types";
import type { StudioLocale } from "./scene-props";
import { cx } from "@/components/ui/cx";

// Poster SSR d'un objet du Studio (index, cartes) : le dessin 2D exact, calculé
// par le code (poster.ts, poster-flat.ts) et rendu par le serveur en SVG,
// sans composant client ni JavaScript. Le dessin du vase hérite de la couleur
// du texte (traits) ; ceux des objets plats ont une variante par thème,
// l'une des deux est masquée par la classe `.dark` de <html>.
//
// Le SVG est fabriqué par notre code à partir de la configuration (nombres,
// couleurs de filament) ; aucun texte du visiteur n'y entre (les lignes de
// texte sont des barres de la taille exacte du texte).

export function ObjectPoster({
  config,
  texts,
  locale,
  className,
}: {
  config: StudioConfig;
  texts: StudioTexts;
  locale: StudioLocale;
  className?: string;
}) {
  if (config.object === "lavaux") {
    return (
      <div
        aria-hidden="true"
        className={cx("text-ink", className)}
        dangerouslySetInnerHTML={{
          __html: elevationToSvg(lavauxElevation(config), {
            className: "block h-full w-full",
            idPrefix: "poster",
          }),
        }}
      />
    );
  }
  const view = (theme: "light" | "dark") =>
    topViewToSvg(
      config.object === "cartouche"
        ? cartoucheTopView(config, texts, { theme })
        : config.object === "borne"
          ? borneTopView(config, texts, { theme })
          : reliefTopView(config, texts, { theme, locale }),
      { className: "block h-full w-full" },
    );
  return (
    <div aria-hidden="true" className={className}>
      <div
        className="h-full w-full dark:hidden"
        dangerouslySetInnerHTML={{ __html: view("light") }}
      />
      <div
        className="hidden h-full w-full dark:block"
        dangerouslySetInnerHTML={{ __html: view("dark") }}
      />
    </div>
  );
}

import type { ReactNode } from "react";
import { getHeroPoster } from "@/components/home/hero-poster";
import { PosterSvg } from "@/components/home/poster-svg";
import { cx } from "@/components/ui/cx";
import type { HeroPoster, PosterEllipse } from "@/lib/studio/poster";
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

let vase: HeroPoster | null = null;

/**
 * Le poster 3/4 du héros recadré sur le vase : le poster de l'accueil laisse
 * autour de lui la marge d'une scène entière, une carte veut l'objet en grand.
 */
function vasePoster(): HeroPoster {
  if (vase) return vase;
  const poster = getHeroPoster("final");
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const grow = (e: PosterEllipse) => {
    x0 = Math.min(x0, e.cx - e.rx);
    x1 = Math.max(x1, e.cx + e.rx);
    y0 = Math.min(y0, e.cy - e.ry);
    y1 = Math.max(y1, e.cy + e.ry);
  };
  for (const layer of poster.layers ?? []) layer.ellipses.forEach(grow);
  if (poster.mouth) grow(poster.mouth.ellipse);
  const pad = 3;
  vase = Number.isFinite(x0)
    ? {
        ...poster,
        viewBox: `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`,
      }
    : poster;
  return vase;
}

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
  // Le dessin est posé en absolu dans un cadre à proportion fixe : son
  // dimensionnement intrinsèque (un SVG sans taille) ne peut pas étirer le cadre.
  const frame = (children: ReactNode) => (
    <div aria-hidden="true" className={cx("relative", className)}>
      <div className="absolute inset-4 sm:inset-5">{children}</div>
    </div>
  );

  if (object === "lavaux")
    return frame(
      <PosterSvg poster={vasePoster()} className="block h-full w-full" />,
    );

  if (object === "relief")
    return frame(
      <>
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
      </>,
    );

  return frame(
    <>
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
    </>,
  );
}

import { motionBridge } from "@/lib/motion-bridge/store";
import { elevationToSvg } from "@/lib/studio/poster";
import { topViewToSvg } from "@/lib/studio/poster-flat";
import type { StudioConfig, StudioTexts } from "@/lib/studio/types";
import { flatViewData } from "./elevation-view";
import type { StudioLocale, StudioSceneProps } from "./scene-props";

// Vignettes du Studio (brief « Strates », §4.4 `bake`, §6.9 point 1, §6.7
// « Garder ») : une image de l'objet pour le tiroir d'envoi, la carte « Mes
// créations » et la pièce jointe du devis.
//  - avec WebGL : le service `bake` du Stage (rendu hors écran de la scène
//    `studio-object`, WebP) ;
//  - sans WebGL, ou si le rendu échoue : le dessin 2D exact en SVG (data: URL).
// Les textes ne sont jamais écrits dans le SVG (les lignes sont des barres de
// la taille du texte, voir elevation-view.tsx).

export type ThumbnailSize = 256 | 512;

/** Lecture d'un Blob en data: URL. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("lecture du blob"));
    reader.readAsDataURL(blob);
  });
}

/** SVG en data: URL : `img-src data:` l'autorise ; l'encodage évite tout caractère réservé. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Dessin 2D exact de la configuration, en data: URL (repli sans WebGL). */
export function flatThumbnail(
  config: StudioConfig,
  texts: StudioTexts,
  locale: StudioLocale,
  theme: "light" | "dark" = "light",
): string {
  const view = flatViewData(config, texts, locale, theme);
  return svgDataUrl(
    view.kind === "elevation"
      ? elevationToSvg(view.data)
      : topViewToSvg(view.data),
  );
}

export async function makeThumbnail({
  config,
  texts,
  locale,
  size,
  theme,
}: {
  config: StudioConfig;
  /** Textes AFFICHÉS (vignette de l'écran, pas un envoi). */
  texts: StudioTexts;
  locale: StudioLocale;
  size: ThumbnailSize;
  theme?: "light" | "dark";
}): Promise<string> {
  const stage = motionBridge.get().stage;
  if (stage) {
    const props: StudioSceneProps = {
      config,
      texts,
      locale,
      view: "orbit",
      cutZ: null,
      exploded: false,
    };
    try {
      const blob = await stage.bake("studio-object", props, {
        width: size,
        height: size,
      });
      return await blobToDataUrl(blob);
    } catch (error) {
      console.warn("[studio] vignette 3D impossible, dessin 2D", error);
    }
  }
  return flatThumbnail(config, texts, locale, theme);
}

// STL d'une ligne de commande du Studio, regénéré à partir de la configuration
// GARDÉE dans la commande (`order_items.studio`) : rien de lourd dans le Worker.
// Le navigateur de l'admin charge la police de glyphes, appelle ceci, et
// télécharge le fichier ; c'est exactement le chemin de l'export du Studio
// (`runExport` de motion/studio/geometry-core.ts : `sanitizeTexts` puis
// `exportStl(config, texts, { locale })`), donc les mêmes octets et le même hash
// pour une configuration donnée (order-stl.test.ts le vérifie).
import { exportStl, type ExportedStl } from "./build";
import type { StudioOrderLine } from "./order-line";
import { sanitizeTexts } from "./text/fields";

/** La police de glyphes est nécessaire dès qu'un texte s'imprime (hors vase). */
export function orderNeedsGlyphs(line: StudioOrderLine): boolean {
  return (
    line.object !== "lavaux" &&
    Object.keys(sanitizeTexts(line.object, line.texts)).length > 0
  );
}

export function exportOrderStl(line: StudioOrderLine): ExportedStl {
  return exportStl(line.config, sanitizeTexts(line.object, line.texts), {
    locale: line.locale,
  });
}

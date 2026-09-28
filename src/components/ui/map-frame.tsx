import type { CSSProperties } from "react";
import { cx } from "./cx";

// Cadre de carte (brief « Strates », §2.3) : graduations fines en marge,
// repère tous les 8 px, repère majeur tous les 64 px (sépia `iso-index`),
// coordonnées mono dans un coin. Desktop seulement (≥ lg), sur le héros de
// l'accueil et le footer : sur mobile il mangerait la marge. Calque décoratif
// posé dans une section positionnée (`relative`) : aria-hidden, sans pointeur,
// dessiné en dégradés CSS répétés (zéro SVG, zéro requête, se redimensionne
// seul). Les coordonnées affichées ici sont un décor : le texte qui compte
// (adresse, lieux) est ailleurs dans la page.

type Side = "top" | "right" | "bottom" | "left";

const INK = "var(--color-iso-index)";

function edge(side: Side): CSSProperties {
  const vertical = side === "left" || side === "right";
  const direction = vertical ? "to bottom" : "to right";
  // Deux couches : repères mineurs courts (4 px) et majeurs longs (10 px).
  const minor = `repeating-linear-gradient(${direction}, ${INK} 0 1px, transparent 1px 8px)`;
  const major = `repeating-linear-gradient(${direction}, ${INK} 0 1px, transparent 1px 64px)`;
  const anchor =
    side === "left"
      ? "left top"
      : side === "right"
        ? "right top"
        : side === "top"
          ? "left top"
          : "left bottom";
  return {
    backgroundImage: `${minor}, ${major}`,
    backgroundSize: vertical ? "4px 100%, 10px 100%" : "100% 4px, 100% 10px",
    backgroundPosition: `${anchor}, ${anchor}`,
    backgroundRepeat: "no-repeat",
    opacity: 0.7,
  };
}

const EDGE_CLASS: Record<Side, string> = {
  top: "inset-x-0 top-0 h-2.5",
  right: "inset-y-0 right-0 w-2.5",
  bottom: "inset-x-0 bottom-0 h-2.5",
  left: "inset-y-0 left-0 w-2.5",
};

const CORNER_CLASS = {
  "top-left": "left-5 top-4",
  "top-right": "right-5 top-4",
  "bottom-left": "bottom-4 left-5",
  "bottom-right": "bottom-4 right-5",
} as const;

export function MapFrame({
  sides = ["left", "bottom"],
  coordinates,
  corner = "top-right",
  className,
}: {
  sides?: Side[];
  /** Ex. « 46°25′N 6°16′E · Gland — 46°31′N 6°40′E · Pully ». */
  coordinates?: string;
  corner?: keyof typeof CORNER_CLASS;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "pointer-events-none absolute inset-0 hidden lg:block",
        className,
      )}
    >
      {sides.map((side) => (
        <span
          key={side}
          className={cx("absolute", EDGE_CLASS[side])}
          style={edge(side)}
        />
      ))}
      {coordinates && (
        <span
          className={cx(
            "s3d-label absolute whitespace-nowrap text-soft",
            CORNER_CLASS[corner],
          )}
        >
          {coordinates}
        </span>
      )}
    </div>
  );
}

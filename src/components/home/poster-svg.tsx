import type { HeroPoster } from "@/lib/studio/poster";
import styles from "./home.module.css";

// Rend en JSX les données d'un poster du héros (brief « Strates », §5.7) :
// `plate` (le plateau d'impression vide, avant la première couche), `final` (les
// strates colorées) ou `exploded` (les bandes écartées du chapitre 01).
// Composant pur, sans hook, sans import de bibliothèque : le serveur l'utilise
// pour le premier paint, le client pour recalculer le poster d'une variante
// (mouvement réduit, C0). Décoratif : `aria-hidden`, le texte qui compte est
// ailleurs. Les teintes suivent les jetons (`--color-paper`, `--color-iso`) :
// correctes dans les deux thèmes.

export function PosterSvg({
  poster,
  className,
}: {
  poster: HeroPoster;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox={poster.viewBox}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {poster.plate && (
        // Le plateau vide : épaisseur, dessus, puis quadrillage d'un pixel à
        // toute échelle (vector-effect). Les teintes viennent des jetons du
        // thème (home.module.css), comme la première frame du Stage.
        <>
          <path className={styles.plateBase} d={poster.plate.base} />
          <path className={styles.plateTop} d={poster.plate.top} />
          <path
            className={styles.plateGrid}
            d={poster.plate.grid}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
      {poster.layers?.map((layer) => (
        <g key={layer.band}>
          <g fill={layer.fill} stroke={layer.stroke} strokeWidth={0.6}>
            {layer.ellipses.map((e, i) => (
              <ellipse key={i} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} />
            ))}
          </g>
          {layer.cap && (
            <>
              <g fill={layer.cap.topFill}>
                <ellipse
                  cx={layer.cap.top.cx}
                  cy={layer.cap.top.cy}
                  rx={layer.cap.top.rx}
                  ry={layer.cap.top.ry}
                />
              </g>
              <g fill={layer.cap.mouthFill}>
                <ellipse
                  cx={layer.cap.mouth.cx}
                  cy={layer.cap.mouth.cy}
                  rx={layer.cap.mouth.rx}
                  ry={layer.cap.mouth.ry}
                />
              </g>
            </>
          )}
        </g>
      ))}
      {poster.mouth && (
        <g fill={poster.mouth.fill}>
          <ellipse
            cx={poster.mouth.ellipse.cx}
            cy={poster.mouth.ellipse.cy}
            rx={poster.mouth.ellipse.rx}
            ry={poster.mouth.ellipse.ry}
          />
        </g>
      )}
    </svg>
  );
}

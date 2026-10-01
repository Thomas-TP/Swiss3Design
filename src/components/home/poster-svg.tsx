import type { HeroPoster } from "@/lib/studio/poster";

// Rend en JSX les données d'un poster du héros (brief « Strates », §5.7) :
// `ghost` (les anneaux fantômes du vase, tous les 2 mm), `final` (les strates
// colorées) ou `exploded` (les bandes écartées du chapitre 01). Composant pur,
// sans hook, sans import de bibliothèque : le serveur l'utilise pour le premier
// paint, le client pour recalculer le poster d'une variante (mouvement réduit,
// C0). Décoratif : `aria-hidden`, le texte qui compte est ailleurs. Les
// contours suivent les jetons (`--color-iso`) : corrects dans les deux thèmes.

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
      {poster.ghost && (
        // Un trait d'un pixel à toute échelle (vector-effect) : le poster est
        // un dessin au trait, comme le cadre de la carte.
        <g fill="none" stroke="var(--color-iso)" strokeWidth={1}>
          {poster.ghost.map((e, i) => (
            <ellipse
              key={i}
              cx={e.cx}
              cy={e.cy}
              rx={e.rx}
              ry={e.ry}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
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

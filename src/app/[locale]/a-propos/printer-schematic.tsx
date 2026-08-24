// Schémas techniques des deux imprimantes du parc, dessinés à la main en SVG.
//
// Pourquoi un dessin et pas une photo : les rendus produits de Bambu Lab et de
// Creality sont sous leur copyright, et aucune photo de ces deux modèles
// n'existe sous licence libre (vérifié sur Wikimedia Commons : zéro résultat).
// Un schéma original lève la question des droits, et surtout il permet de
// placer les annotations **au pixel** sur chaque organe — sur une photo, on
// pointe à l'œil.
//
// Précision : chaque machine est dessinée dans son propre système de
// coordonnées en **millimètres réels** (encombrements officiels), puis
// positionnée dans un cadre plus large qui laisse la place aux annotations.
// D'où les silhouettes justes et nettement différentes :
//   • P1S — 389 × 458 mm : large et trapue, capot AMS bombé, petit écran mono
//     + molette sur le dessus.
//   • K2  — 404 × 545 mm : haute et étroite, CFS anguleux à couvercle plat
//     avec afficheur en façade, grand écran tactile en face avant.
//
// Thème : tous les traits sont en `currentColor` et les remplissages en
// `currentColor` à faible opacité, donc le schéma passe du noir sur clair au
// blanc sur sombre sans une seule media query. Seules les bobines gardent une
// couleur fixe — c'est la signature « multicolore » du site
// (voir `multicolor-dots.tsx`), sauf la 4e qui utilise le token `ink` pour
// rester visible dans les deux thèmes.

const SPOOLS = ["#e5231c", "#1d4ed8", "#f59e0b"] as const;

export type PrinterVariant = "p1s" | "k2";

export interface SchematicCallout {
  /** Libellé court affiché au bout du trait de rappel. */
  label: string;
}

/** Géométrie d'un renvoi : point visé sur la machine + sortie du trait. */
interface Anchor {
  /** Point visé, dans les coordonnées mm de la machine. */
  x: number;
  y: number;
  /** Côté vers lequel part le trait. */
  side: "left" | "right";
  /** Hauteur de l'étiquette, dans les coordonnées du cadre. */
  labelY: number;
  /**
   * Cadre de surbrillance dessiné autour de l'organe quand le renvoi est
   * actif, en coordonnées mm de la machine. C'est lui qui rend le survol
   * lisible : on voit *quelle pièce* on désigne, pas seulement un point.
   */
  hi: { x: number; y: number; w: number; h: number; rx: number };
}

interface Geometry {
  /** Encombrement dessiné de l'ensemble (machine + module multicolore), en mm. */
  machineW: number;
  machineH: number;
  /** Cadre complet, annotations comprises. */
  frameW: number;
  frameH: number;
  /** Décalage de la machine dans le cadre. */
  offsetX: number;
  offsetY: number;
  anchors: Anchor[];
}

const GEOMETRY: Record<PrinterVariant, Geometry> = {
  // AMS 2 Pro (211) + P1S (458) = 669 mm de haut, 389 de large.
  p1s: {
    machineW: 389,
    machineH: 669,
    frameW: 1000,
    frameH: 720,
    offsetX: 305,
    offsetY: 22,
    anchors: [
      // Bobines : on vise la tranche de la 1re bobine, pas le centre du bloc,
      // pour que le trait ne traverse pas les quatre couleurs.
      {
        x: 62,
        y: 66,
        side: "left",
        labelY: 70,
        hi: { x: 34, y: 32, w: 320, h: 70, rx: 12 },
      },
      {
        x: 57,
        y: 230,
        side: "left",
        labelY: 226,
        hi: { x: 12, y: 214, w: 121, h: 32, rx: 7 },
      },
      {
        x: 162,
        y: 372,
        side: "right",
        labelY: 300,
        hi: { x: 116, y: 328, w: 64, h: 82, rx: 9 },
      },
      // Enceinte : la coque extérieure, pas la grille d'aération.
      {
        x: 387,
        y: 430,
        side: "right",
        labelY: 452,
        hi: { x: -5, y: 206, w: 399, h: 468, rx: 12 },
      },
      {
        x: 157,
        y: 597,
        side: "left",
        labelY: 604,
        hi: { x: 30, y: 585, w: 240, h: 38, rx: 6 },
      },
    ],
  },
  // CFS (230) + K2 (545) = 775 mm de haut, 404 de large.
  k2: {
    machineW: 404,
    machineH: 775,
    frameW: 1000,
    frameH: 826,
    offsetX: 298,
    offsetY: 22,
    anchors: [
      {
        x: 83,
        y: 110,
        side: "left",
        labelY: 104,
        hi: { x: 40, y: 50, w: 332, h: 120, rx: 10 },
      },
      {
        x: 353,
        y: 336,
        side: "right",
        labelY: 306,
        hi: { x: 310, y: 294, w: 86, h: 84, rx: 9 },
      },
      {
        x: 166,
        y: 410,
        side: "left",
        labelY: 400,
        hi: { x: 118, y: 362, w: 68, h: 88, rx: 9 },
      },
      // Enceinte : la coque extérieure, pas la grille d'aération.
      {
        x: 402,
        y: 520,
        side: "right",
        labelY: 546,
        hi: { x: -5, y: 225, w: 414, h: 555, rx: 12 },
      },
      {
        x: 160,
        y: 681,
        side: "left",
        labelY: 690,
        hi: { x: 32, y: 668, w: 244, h: 38, rx: 6 },
      },
    ],
  },
};

/** Capot AMS 2 Pro : bombé, translucide, 4 bobines visibles au travers. */
function AmsUnit() {
  return (
    <g>
      {/* Capot bombé translucide */}
      <path
        d="M10 96 L10 62 A 184.5 56 0 0 1 379 62 L379 96 Z"
        fill="currentColor"
        fillOpacity="0.05"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="2.5"
      />
      {/* Bobines vues de face : 4 tranches de filament côte à côte */}
      {[40, 118, 196, 274].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={38}
          width={74}
          height={58}
          rx={9}
          fill={i === 3 ? "var(--color-ink)" : SPOOLS[i]}
          fillOpacity={i === 3 ? 0.82 : 0.9}
        />
      ))}
      {/* Corps opaque du module */}
      <rect
        x={10}
        y={96}
        width={369}
        height={115}
        rx={7}
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="2.5"
      />
      {/* Les 4 entraîneurs de filament */}
      {[40, 118, 196, 274].map((x) => (
        <g key={x}>
          <rect
            x={x}
            y={110}
            width={74}
            height={44}
            rx={6}
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
          <circle
            cx={x + 37}
            cy={132}
            r={11}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeWidth="2"
          />
        </g>
      ))}
      {/* Plaque de séchage / ventilation en façade */}
      <g stroke="currentColor" strokeOpacity="0.3" strokeWidth="2">
        {[172, 182, 192].map((y) => (
          <line key={y} x1={250} y1={y} x2={366} y2={y} />
        ))}
      </g>
    </g>
  );
}

/** CFS Creality : couvercle plat charnière, afficheur température/humidité. */
function CfsUnit() {
  return (
    <g>
      {/* Couvercle plat */}
      <rect
        x={12}
        y={0}
        width={380}
        height={34}
        rx={6}
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="2.5"
      />
      {/* Corps */}
      <rect
        x={12}
        y={34}
        width={380}
        height={196}
        rx={7}
        fill="currentColor"
        fillOpacity="0.06"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="2.5"
      />
      {/* Fenêtre teintée : stockage étanche */}
      <rect
        x={34}
        y={48}
        width={336}
        height={124}
        rx={5}
        fill="currentColor"
        fillOpacity="0.05"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      {/* 4 bobines */}
      {[46, 128, 210, 292].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={56}
          width={74}
          height={108}
          rx={7}
          fill={i === 3 ? "var(--color-ink)" : SPOOLS[i]}
          fillOpacity={i === 3 ? 0.82 : 0.9}
        />
      ))}
      {/* Afficheur température / humidité */}
      <rect
        x={46}
        y={186}
        width={78}
        height={30}
        rx={4}
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      <g stroke="currentColor" strokeOpacity="0.45" strokeWidth="2.5">
        <line x1={54} y1={196} x2={80} y2={196} />
        <line x1={54} y1={206} x2={72} y2={206} />
      </g>
      {/* 4 sorties de filament */}
      {[184, 236, 288, 340].map((cx) => (
        <circle
          key={cx}
          cx={cx}
          cy={201}
          r={12}
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="1.8"
        />
      ))}
    </g>
  );
}

/** Corps de la Bambu Lab P1S : 389 × 458 mm, posé sous l'AMS. */
function P1sBody() {
  return (
    <g transform="translate(0 211)">
      <rect
        x={0}
        y={0}
        width={389}
        height={458}
        rx={9}
        fill="currentColor"
        fillOpacity="0.07"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="3"
      />
      {/* Dessus : petit écran monochrome + molette (signature P1S) */}
      <line
        x1={0}
        y1={37}
        x2={389}
        y2={37}
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <rect
        x={18}
        y={8}
        width={78}
        height={22}
        rx={3}
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <circle
        cx={116}
        cy={19}
        r={11}
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.8"
      />
      {/* Panneau latéral droit + grille d'aération */}
      <line
        x1={296}
        y1={37}
        x2={296}
        y2={458}
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <g stroke="currentColor" strokeOpacity="0.28" strokeWidth="2.5">
        {[290, 302, 314, 326, 338].map((y) => (
          <line key={y} x1={318} y1={y} x2={370} y2={y} />
        ))}
      </g>
      {/* Porte vitrée */}
      <rect
        x={18}
        y={51}
        width={260}
        height={390}
        rx={5}
        fill="currentColor"
        fillOpacity="0.03"
        stroke="currentColor"
        strokeOpacity="0.32"
        strokeWidth="2"
      />
      <rect
        x={264}
        y={209}
        width={9}
        height={52}
        rx={4}
        fill="currentColor"
        fillOpacity="0.25"
      />
      {/* Intérieur : portique CoreXY, tête, colonnes Z, plateau */}
      <g opacity="0.75">
        <rect
          x={26}
          y={109}
          width={244}
          height={12}
          rx={3}
          fill="currentColor"
          fillOpacity="0.16"
        />
        <g stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5">
          <line x1={32} y1={129} x2={32} y2={402} />
          <line x1={264} y1={129} x2={264} y2={402} />
        </g>
        <rect
          x={124}
          y={125}
          width={48}
          height={54}
          rx={6}
          fill="currentColor"
          fillOpacity="0.22"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="1.8"
        />
        {/* Buse */}
        <path
          d="M140 179 L156 179 L150 193 L146 193 Z"
          fill="var(--color-accent)"
        />
        {/* Plateau chauffant + support */}
        <rect
          x={38}
          y={381}
          width={224}
          height={11}
          rx={2}
          fill="currentColor"
          fillOpacity="0.22"
        />
        <rect
          x={62}
          y={392}
          width={176}
          height={13}
          rx={2}
          fill="currentColor"
          fillOpacity="0.12"
        />
      </g>
      {/* Pieds */}
      <g fill="currentColor" fillOpacity="0.2">
        <rect x={22} y={458} width={42} height={10} rx={3} />
        <rect x={324} y={458} width={42} height={10} rx={3} />
      </g>
    </g>
  );
}

/** Corps de la Creality K2 : 404 × 545 mm, grand écran tactile en façade. */
function K2Body() {
  return (
    <g transform="translate(0 230)">
      <rect
        x={0}
        y={0}
        width={404}
        height={545}
        rx={9}
        fill="currentColor"
        fillOpacity="0.07"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="3"
      />
      <line
        x1={0}
        y1={38}
        x2={404}
        y2={38}
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      {/* Colonne droite : grand écran tactile couleur (signature K2) */}
      <line
        x1={300}
        y1={38}
        x2={300}
        y2={545}
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <rect
        x={316}
        y={70}
        width={74}
        height={72}
        rx={6}
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="2"
      />
      <g stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5">
        {[86, 96, 106].map((y) => (
          <line key={y} x1={330} y1={y} x2={376} y2={y} />
        ))}
      </g>
      <g stroke="currentColor" strokeOpacity="0.28" strokeWidth="2.5">
        {[372, 384, 396, 408].map((y) => (
          <line key={y} x1={322} y1={y} x2={384} y2={y} />
        ))}
      </g>
      {/* Porte vitrée */}
      <rect
        x={20}
        y={54}
        width={262}
        height={468}
        rx={5}
        fill="currentColor"
        fillOpacity="0.03"
        stroke="currentColor"
        strokeOpacity="0.32"
        strokeWidth="2"
      />
      <rect
        x={268}
        y={252}
        width={9}
        height={58}
        rx={4}
        fill="currentColor"
        fillOpacity="0.25"
      />
      {/* Intérieur */}
      <g opacity="0.75">
        <rect
          x={28}
          y={124}
          width={246}
          height={12}
          rx={3}
          fill="currentColor"
          fillOpacity="0.16"
        />
        <g stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5">
          <line x1={34} y1={144} x2={34} y2={476} />
          <line x1={268} y1={144} x2={268} y2={476} />
        </g>
        <rect
          x={126}
          y={140}
          width={52}
          height={58}
          rx={6}
          fill="currentColor"
          fillOpacity="0.22"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="1.8"
        />
        <path
          d="M143 198 L161 198 L154 213 L150 213 Z"
          fill="var(--color-accent)"
        />
        {/* Caméra de chambre */}
        <circle
          cx={252}
          cy={160}
          r={9}
          fill="currentColor"
          fillOpacity="0.2"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="1.8"
        />
        {/* Plateau chauffant + support */}
        <rect
          x={40}
          y={446}
          width={228}
          height={11}
          rx={2}
          fill="currentColor"
          fillOpacity="0.22"
        />
        <rect
          x={64}
          y={457}
          width={180}
          height={13}
          rx={2}
          fill="currentColor"
          fillOpacity="0.12"
        />
      </g>
      <g fill="currentColor" fillOpacity="0.2">
        <rect x={22} y={545} width={44} height={10} rx={3} />
        <rect x={336} y={545} width={44} height={10} rx={3} />
      </g>
    </g>
  );
}

/**
 * Position des points d'ancrage, en pourcentage du cadre — de quoi superposer
 * de vrais `<button>` HTML exactement dessus (voir `printer-showcase.tsx`).
 * Le SVG reste ainsi purement graphique, et l'interaction reste accessible.
 */
export function getHotspots(
  variant: PrinterVariant,
): { left: number; top: number }[] {
  const g = GEOMETRY[variant];
  return g.anchors.map((a) => ({
    left: ((g.offsetX + a.x) / g.frameW) * 100,
    top: ((g.offsetY + a.y) / g.frameH) * 100,
  }));
}

/**
 * Schéma annoté d'une imprimante. Les `callouts` sont fournis dans l'ordre des
 * ancrages définis dans `GEOMETRY` (voir `about-content.tsx`), ce qui permet de
 * traduire les libellés sans toucher à la géométrie.
 *
 * Les traits de rappel et leurs étiquettes ne sont dessinés qu'à partir de
 * `md` : en dessous, la largeur ne suffit pas et la légende numérotée affichée
 * par la page prend le relais (les pastilles chiffrées restent sur la machine
 * dans les deux cas, donc la correspondance ne se perd jamais).
 */
export function PrinterSchematic({
  variant,
  callouts,
  title,
  active = null,
}: {
  variant: PrinterVariant;
  callouts: SchematicCallout[];
  title: string;
  /** Index du renvoi mis en avant, ou `null`. Piloté par la vitrine. */
  active?: number | null;
}) {
  const g = GEOMETRY[variant];
  const gutter = 26;
  const dimmed = active !== null;

  return (
    <svg
      viewBox={`0 0 ${g.frameW} ${g.frameH}`}
      className="block h-auto w-full text-ink"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>

      {/* La machine d'abord : les annotations se posent par-dessus. */}
      <g transform={`translate(${g.offsetX} ${g.offsetY})`}>
        {variant === "p1s" ? (
          <>
            <AmsUnit />
            <P1sBody />
          </>
        ) : (
          <>
            <CfsUnit />
            <K2Body />
          </>
        )}
      </g>

      {/* Surbrillance de l'organe désigné : c'est elle qui rend le survol
          lisible — on voit la pièce entière, pas juste un point. */}
      {active !== null && g.anchors[active] ? (
        <rect
          x={g.offsetX + g.anchors[active].hi.x}
          y={g.offsetY + g.anchors[active].hi.y}
          width={g.anchors[active].hi.w}
          height={g.anchors[active].hi.h}
          rx={g.anchors[active].hi.rx}
          fill="var(--color-accent)"
          fillOpacity="0.1"
          stroke="var(--color-accent)"
          strokeWidth="3"
          className="schematic-hi"
        />
      ) : null}

      {/* Traits de rappel — masqués sous md (voir globals.css) */}
      <g className="schematic-leaders">
        {callouts.map((c, i) => {
          const a = g.anchors[i];
          if (!a) return null;
          const ax = g.offsetX + a.x;
          const ay = g.offsetY + a.y;
          const right = a.side === "right";
          const elbowX = right ? g.frameW - 210 : 210;
          const endX = right ? g.frameW - gutter - 176 : gutter + 176;
          const badgeX = right ? endX + 12 : endX - 12;
          const on = active === i;

          return (
            // Le SVG est purement graphique : aucun gestionnaire ici. Les
            // zones cliquables sont de vrais <button> HTML superposés par
            // `printer-showcase.tsx` (voir `getHotspots`), seuls capables
            // d'être focalisés au clavier et annoncés par un lecteur d'écran.
            <g
              key={c.label}
              className="schematic-callout"
              opacity={dimmed && !on ? 0.3 : 1}
            >
              <polyline
                points={`${ax},${ay} ${elbowX},${a.labelY} ${endX},${a.labelY}`}
                fill="none"
                stroke={on ? "var(--color-accent)" : "currentColor"}
                strokeOpacity={on ? 1 : 0.4}
                strokeWidth={on ? 2.5 : 2}
                strokeLinejoin="round"
              />
              {/* Point de visée discret : il désigne l'organe sans le masquer. */}
              <circle
                cx={ax}
                cy={ay}
                r={on ? 9 : 6}
                fill="var(--color-accent)"
                stroke="var(--color-paper)"
                strokeWidth="2"
              />
              <circle
                cx={badgeX}
                cy={a.labelY}
                r={on ? 14 : 12}
                fill="var(--color-accent)"
              />
              <text
                x={badgeX}
                y={a.labelY + 5}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="15"
                fontWeight="700"
              >
                {i + 1}
              </text>
              <text
                x={right ? badgeX + 22 : badgeX - 22}
                y={a.labelY + 6}
                textAnchor={right ? "start" : "end"}
                fill="currentColor"
                fontSize="19"
                fontWeight={on ? "700" : "600"}
              >
                {c.label}
              </text>
            </g>
          );
        })}
      </g>

      {/* Pastilles numérotées posées sur la machine : elles ne servent que
          lorsque les traits de rappel sont masqués (écrans étroits), où la
          légende numérotée sous le schéma porte les libellés. Sur grand écran
          elles sont masquées, sinon elles recouvriraient l'organe visé. */}
      <g className="schematic-dots">
        {callouts.map((c, i) => {
          const a = g.anchors[i];
          if (!a) return null;
          return (
            <g key={c.label}>
              <circle
                cx={g.offsetX + a.x}
                cy={g.offsetY + a.y}
                r={15}
                fill="var(--color-accent)"
              />
              <text
                x={g.offsetX + a.x}
                y={g.offsetY + a.y + 6}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="18"
                fontWeight="700"
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

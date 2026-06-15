// Illustration héro adaptative : le vase et le sol sont peints en currentColor
// (donc thémables via text-ink), tandis que les bandes reprennent la signature
// 4 couleurs AMS. Remplace l'ancien hero.svg dont le fond clair figé créait un
// pavé éblouissant en mode sombre.

const VASE =
  "M-120,-220 C-160,-120 -60,-40 -95,80 C-110,150 -130,200 -120,235 " +
  "L120,235 C130,200 110,150 95,80 C60,-40 160,-120 120,-220 Z";

// Bandes empilées : couches couleur en haut, corps neutre qui s'estompe vers
// la base. Le neutre suit le thème (currentColor) et reste donc lisible.
const BANDS: { y: number; fill: string; opacity?: number }[] = [
  { y: -208, fill: "#e5231c" },
  { y: -166, fill: "#e5231c", opacity: 0.7 },
  { y: -124, fill: "#1d4ed8" },
  { y: -82, fill: "#1d4ed8", opacity: 0.7 },
  { y: -40, fill: "#f59e0b" },
  { y: 2, fill: "#f59e0b", opacity: 0.7 },
  { y: 44, fill: "currentColor", opacity: 0.92 },
  { y: 86, fill: "currentColor", opacity: 0.6 },
  { y: 128, fill: "currentColor", opacity: 0.38 },
  { y: 170, fill: "currentColor", opacity: 0.22 },
];

export function HeroPrint({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 760 600"
      role="img"
      aria-hidden
      className={className}
      fill="none"
    >
      <g transform="translate(380,300)">
        {/* Ombre portée douce */}
        <ellipse cx="0" cy="252" rx="170" ry="22" fill="currentColor" opacity="0.07" />

        <clipPath id="hero-vase">
          <path d={VASE} />
        </clipPath>

        {/* Corps : teinte très légère pour suggérer le volume */}
        <path d={VASE} fill="currentColor" opacity="0.04" />

        {/* Bandes d'impression, découpées à la silhouette du vase */}
        <g clipPath="url(#hero-vase)">
          {BANDS.map((b) => (
            <rect
              key={b.y}
              x="-190"
              y={b.y}
              width="380"
              height="30"
              rx="3"
              fill={b.fill}
              opacity={b.opacity ?? 1}
            />
          ))}
        </g>

        {/* Contour fin */}
        <path
          d={VASE}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeWidth="2"
        />
      </g>

      {/* Pastilles 4 couleurs, coin supérieur gauche */}
      <g>
        {["#e5231c", "#1d4ed8", "#f59e0b", "currentColor"].map((c, i) => (
          <circle key={i} cx={56 + i * 26} cy="56" r="7" fill={c} opacity={c === "currentColor" ? 0.85 : 1} />
        ))}
      </g>
    </svg>
  );
}

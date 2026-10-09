import type { SVGProps } from "react";

// Picto maison (brief « Strates », §2.4) : grille 24, trait 1,5, extrémités
// carrées, couleur héritée (currentColor). lucide-react couvre le reste ; celui-ci
// n'existe nulle part ailleurs parce qu'il dit le métier : une pièce qui
// s'empile. Les trois autres du brief (buse, couche, point coté) n'ont jamais
// eu d'emploi et ont été retirés par WP-99 (le triangle des cartes a été
// abandonné au retour R09) ; un nouveau picto se redessine sur la même grille.
// Décoratif par défaut (aria-hidden) : le libellé vit à côté, jamais dans
// l'icône seule. Aucune croix, jamais (loi sur la protection des armoiries).

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Trois strates en sommet : le mark réduit à son geste (disque Studio). */
export function StrataIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 19.5h17l-2.2-3.8H5.7z" />
      <path d="M6.9 13.6h10.2l-2.2-3.8H9.1z" />
      <path d="M10.3 7.7h3.4L12 4.8z" />
    </Svg>
  );
}

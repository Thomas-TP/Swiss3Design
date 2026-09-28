import type { SVGProps } from "react";

// Pictos maison (brief « Strates », §2.4) : grille 24, trait 1,5, extrémités
// carrées, couleur héritée (currentColor). lucide-react couvre le reste ; ces
// quatre-là n'existent nulle part ailleurs parce qu'ils disent le métier :
// une pièce qui s'empile, la buse, la couche, le point coté. Décoratifs par
// défaut (aria-hidden) : le libellé vit à côté, jamais dans l'icône seule.
// Aucune croix, jamais (loi sur la protection des armoiries).

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

/** Buse : bloc de chauffe, cône, cordon déposé sur le plateau. */
export function NozzleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2.5v2" />
      <path d="M7.5 4.5h9v5h-9z" />
      <path d="M9.5 9.5 12 14l2.5-4.5" />
      <path d="M4 19.5h16" />
      <path d="M9 17h6" />
    </Svg>
  );
}

/** Couches : trois tranches de 0,2 mm vues de face. */
export function LayerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5.5h16V9H4z" />
      <path d="M4 10.25h16v3.5H4z" />
      <path d="M4 15h16v3.5H4z" />
    </Svg>
  );
}

/** Point coté : le triangle de nivellement des cartes nationales. */
export function SummitIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4.5 20.5 19h-17z" />
      <circle cx="12" cy="14" r="1.25" fill="currentColor" stroke="none" />
    </Svg>
  );
}

import type { ReactNode } from "react";
import { withDot } from "./ui/dot-title";

/*
 * En-tête de page unifié : surtitre optionnel (eyebrow), titre, intro et zone
 * d'actions. Toutes les pages l'utilisent pour garantir le même rythme
 * vertical et la même hiérarchie — c'est LE point de cohérence du site.
 *
 * Habillage « Strates » (brief §2.2) : surtitre en étiquette mono, h1 en
 * Archivo SemiExpanded (`text-display`, réduit en allemand par globals.css),
 * point final d'un titre texte rendu en point rouge (le « . » reste dans le
 * texte), chapeau en `text-lead`. Plus de trait rouge décoratif au-dessus du
 * titre : le rouge n'est pas un décor. Un seul h1 par page : c'est celui-ci.
 * Props inchangées (panier, favoris, boutique, sur mesure).
 */
export function PageHeader({
  eyebrow,
  title,
  intro,
  actions,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && <p className="s3d-label text-soft">{eyebrow}</p>}
        <h1
          className={`font-display text-display break-words text-ink ${eyebrow ? "mt-3" : ""}`}
        >
          {typeof title === "string" ? withDot(title) : title}
        </h1>
        {intro && <p className="mt-4 max-w-2xl text-lead text-soft">{intro}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-3">{actions}</div>
      )}
    </div>
  );
}

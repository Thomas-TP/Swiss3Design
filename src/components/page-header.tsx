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
  reserveEyebrow = false,
  title,
  intro,
  actions,
  className = "",
}: {
  eyebrow?: string;
  /**
   * Garde la place du surtitre quand il n'est pas encore connu (un compte lu
   * dans le navigateur, par exemple) : sans elle, son arrivée poussait le
   * titre de 28 px, donc toute la page (décalage de mise en page).
   */
  reserveEyebrow?: boolean;
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const hasEyebrowSlot = Boolean(eyebrow) || reserveEyebrow;
  return (
    <div
      className={`flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="s3d-label text-soft">{eyebrow}</p>
        ) : reserveEyebrow ? (
          // Même ligne que le surtitre, invisible et muette pour les lecteurs
          // d'écran : espace insécable pour que la boîte garde sa hauteur.
          <p aria-hidden="true" className="s3d-label select-none text-soft">
            {" "}
          </p>
        ) : null}
        <h1
          className={`font-display text-display break-words text-ink ${hasEyebrowSlot ? "mt-3" : ""}`}
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

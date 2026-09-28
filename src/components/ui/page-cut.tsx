import { ViewTransition, type ReactNode } from "react";

// Transition de page « Coupe » (brief « Strates », §3.4, motif M1) : chaque
// page du groupe (site) enveloppe son contenu dans <PageCut>, au niveau de la
// page et non du layout (un layout persiste d'une navigation à l'autre : ni
// enter ni exit n'y partiraient jamais). Seul le type "s3d-coupe", posé par
// SiteLink entre deux pages vitrine, anime : la nouvelle page s'imprime de bas
// en haut en 8 paliers de clip-path (480 ms) par-dessus l'ancienne, qui ne
// bouge pas ; le header reste ancré (site-header). Sans type (bouton retour,
// router.refresh(), Suspense, Firefox qui ignore les types) : rien. En
// mouvement réduit : SiteLink ne pose pas de type, et le CSS ramène de toute
// façon les durées à 0. CSS : globals.css (§2.5) et ./page-cut.css.
//
// Composant serveur (aucun état) : une page RSC l'utilise telle quelle. Le
// <div> donne à React UN nœud à nommer : avec plusieurs racines, chacune
// deviendrait un groupe qui s'imprimerait séparément. Il ne porte aucun style
// (bloc ordinaire dans <main>) : la mise en page de la page ne change pas. Le
// canvas du Stage n'a pas de nom : il reste dans les instantanés de la racine.
const ENTER = { "s3d-coupe": "s3d-coupe", default: "none" };
const EXIT = { "s3d-coupe": "s3d-coupe-out", default: "none" };

export function PageCut({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={ENTER} exit={EXIT} default="none">
      <div data-page-cut="">{children}</div>
    </ViewTransition>
  );
}

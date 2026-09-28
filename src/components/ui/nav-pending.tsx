"use client";

import { useTranslations } from "next-intl";
import { useMotionBridge } from "@/lib/motion-bridge/store";

// Buse d'attente du header (brief « Strates », §3.4, motif M2) : pendant
// qu'un SiteLink attend le serveur (prefetch coupé, pages dynamiques), un
// trait rouge de 24 px parcourt le bord inférieur du header jusqu'au commit.
// Pas de loading.tsx : il casserait les paires de View Transitions.
//
// À poser dans un élément positionné (le header). Le conteneur apparaît
// après 150 ms (transition d'opacité retardée depuis @starting-style) : une
// navigation rapide ne fait rien clignoter, sans minuterie JS. Il ne coupe
// qu'à l'horizontale (overflow-x: clip) : la buse part jusqu'à 100vw et
// créerait sinon un défilement horizontal. En mouvement réduit, la buse ne
// court pas (sa règle .s3d-pending, hors @layer, ne se surcharge pas par un
// utilitaire) : un filet fixe sur toute la largeur dit la même chose.
export function NavPending() {
  const pending = useMotionBridge((s) => s.navPending);
  const reduced = useMotionBridge((s) => s.reduced);
  const t = useTranslations("shell");

  return (
    <>
      {pending && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0 overflow-x-clip transition-opacity delay-150 duration-100 starting:opacity-0"
        >
          {reduced ? (
            <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />
          ) : (
            <span className="s3d-pending" />
          )}
        </span>
      )}
      {/* <output> porte le rôle status (annonce polie) sans attribut ARIA. */}
      <output className="sr-only">{pending ? t("pending") : ""}</output>
    </>
  );
}

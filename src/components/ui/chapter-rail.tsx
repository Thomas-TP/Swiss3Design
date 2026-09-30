"use client";

import { useEffect, useState } from "react";
import { motionBridge } from "@/lib/motion-bridge/store";
import { cx } from "./cx";

// Rail des chapitres (brief « Strates », §3.3) : grand écran seulement
// (≥ 96 rem, soit 1536 px), numéros mono à droite de l'écran, point rouge sur le
// chapitre courant. Le seuil n'est pas 1280 px comme le brief le prévoyait :
// le rail (24 px du bord + 52 px de large) est posé dans la marge droite de la
// page, et celle-ci (`--spacing-margin`, plus le surplus au-delà des 90 rem de
// `.s3d-page`) ne dépasse 84 px, rail et 8 px de respiration compris, qu'à
// partir de 1536 px, scrollbar de 17 px comprise. En dessous, il recouvrait
// le cœur « Ajouter aux favoris » de la colonne d'achat (32 px à 1440, 52 px à
// 1280). Pas de marge réservée sur les sections : elle couperait les bandes
// pleine largeur des chapitres « encre » sur leur côté droit.
// IntersectionObserver, pas de GSAP : le chapitre courant est celui qui
// traverse la bande centrale de l'écran. Un lien reste un vrai lien d'ancre
// (#id, utilisable sans JS et au clavier) ; quand Lenis tourne, le défilement
// passe par le pont (bridge.scroll.to) pour rester doux et décalé du header,
// sinon le navigateur saute à l'ancre (instantané, scroll-mt du chapitre).
// Calque 30 (sous le header, au-dessus du contenu), sur un fond papier voilé :
// le rail survole aussi les chapitres « encre », où le texte `soft` du thème
// de la page tomberait sous 4,5:1.

export interface RailChapter {
  id: string;
  number: string;
  label: string;
}

export function ChapterRail({
  chapters,
  label,
}: {
  chapters: RailChapter[];
  /** Nom accessible de la navigation (« Chapitres »). */
  label: string;
}) {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const sections = chapters
      .map((chapter) => document.getElementById(chapter.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0 || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setCurrent(entry.target.id);
      },
      // Bande de 10 % au milieu de l'écran : un seul chapitre à la fois.
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [chapters]);

  return (
    <nav
      aria-label={label}
      className="fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 rounded-card bg-paper/80 px-2.5 py-2 backdrop-blur min-[96rem]:block"
    >
      <ol className="flex flex-col gap-3">
        {chapters.map((chapter) => {
          const active = chapter.id === current;
          return (
            <li key={chapter.id}>
              <a
                href={`#${chapter.id}`}
                aria-current={active ? "location" : undefined}
                onClick={(event) => {
                  const scroll = motionBridge.get().scroll;
                  const target = document.getElementById(chapter.id);
                  if (!scroll || !target) return;
                  event.preventDefault();
                  scroll.to(target);
                  history.replaceState(null, "", `#${chapter.id}`);
                }}
                className={cx(
                  "group relative flex items-center justify-end gap-2.5 py-0.5 transition-colors duration-150",
                  active ? "text-ink" : "text-soft hover:text-ink",
                )}
              >
                <span className="s3d-label pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-hair bg-paper/90 px-1.5 py-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                  {chapter.label}
                </span>
                <span className="s3d-label">{chapter.number}</span>
                <span
                  aria-hidden="true"
                  className={cx(
                    "h-1.5 w-1.5 rounded-full transition-colors duration-150",
                    active ? "bg-accent" : "bg-line",
                  )}
                />
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

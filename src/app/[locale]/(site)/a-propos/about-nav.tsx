"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/cx";
import { readReducedMotion } from "@/lib/motion-bridge/motion-pref";
import { motionBridge } from "@/lib/motion-bridge/store";
import styles from "./about-nav.module.css";

interface AboutNavItem {
  id: string;
  label: string;
  /** « 01 », « 02 »… : le numéro du chapitre, en mono devant le libellé. */
  number?: string;
}

// Géométrie verticale, en px. Header = 64 (h-16), cette barre = 48 (h-12) : les
// chapitres portent `scroll-mt-32` (128 = 64 + 48 + 16 d'air), c'est là que
// leur haut se pose après un clic ou un saut d'ancre. La ligne de détection est
// un peu plus bas (22 px), pour que la section qu'on vient de viser soit bien
// celle qui s'allume, malgré l'arrondi et l'inertie de Lenis.
const SCROLL_OFFSET = 128;
const DETECTION_LINE = SCROLL_OFFSET + 22;

// Barre de navigation rapide en « rail kilométrique », collée sous le header :
// suit le défilement et met en avant la section actuellement lue, pour
// retrouver une info sans tout relire sur une page volontairement longue et
// complète.
//
// Écoute `scroll` (sans throttle) plutôt qu'un IntersectionObserver : son
// callback ne reçoit que les entrées dont l'état vient de CHANGER, pas un
// instantané de toutes les sections observées — sur une page à sections
// hautes, beaucoup de mouvements de défilement ne produisent aucune entrée
// "actuellement visible" dans le batch reçu, et le repère actif reste bloqué
// sur la première section (constaté en usage réel). L'algorithme ici est
// déterministe : à chaque scroll, on prend la dernière section (dans l'ordre du
// document) dont le haut a déjà franchi la ligne de détection. Vérifier
// quelques éléments par événement est de toute façon négligeable.
export function AboutNav({
  items,
  label,
}: {
  items: AboutNavItem[];
  /** Nom accessible de la navigation (« Sur cette page »). */
  label: string;
}) {
  const [activeId, setActiveId] = useState(items[0]?.id);
  const listRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  // Synchronisé par un effet plutôt que dans le corps du composant : on n'écrit
  // pas dans un ref pendant le rendu.
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    function computeActive() {
      let current = itemsRef.current[0]?.id;
      for (const item of itemsRef.current) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= DETECTION_LINE) {
          current = item.id;
        }
      }
      setActiveId((prev) => (prev === current ? prev : current));
    }

    computeActive();
    window.addEventListener("scroll", computeActive, { passive: true });
    window.addEventListener("resize", computeActive);
    return () => {
      window.removeEventListener("scroll", computeActive);
      window.removeEventListener("resize", computeActive);
    };
  }, []);

  // Garde le lien actif visible dans la barre horizontale scrollable (mobile).
  // Ajuste `scrollLeft` du conteneur directement plutôt que
  // `Element.scrollIntoView()` : sur un élément sticky, scrollIntoView
  // considère aussi le défilement vertical de la page (pour re-rendre le
  // conteneur visible) et annule le saut vers la section qui vient de se
  // produire — bug constaté en conditions réelles, pas juste théorique.
  useEffect(() => {
    const container = listRef.current;
    const activeEl = container?.querySelector<HTMLElement>(
      `[data-id="${activeId}"]`,
    );
    if (!container || !activeEl) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    if (
      elRect.left < containerRect.left ||
      elRect.right > containerRect.right
    ) {
      const delta =
        elRect.left -
        containerRect.left -
        (containerRect.width - elRect.width) / 2;
      container.scrollBy({
        left: delta,
        behavior: readReducedMotion() ? "auto" : "smooth",
      });
    }
  }, [activeId]);

  // Défilement explicite au clic plutôt que la navigation native par ancre :
  // la position visée est calculée ici (haut de section − SCROLL_OFFSET), donc
  // identique avec Lenis (bridge.scroll.to), sans Lenis (mouvement réduit,
  // capacité C0) et quelle que soit la façon dont Lenis lit `scroll-margin`.
  // `stopPropagation` : Lenis écoute aussi tous les clics sur une ancre #…
  // (option `anchors`, décalage de −80 px) et rejouerait son propre saut par
  // dessus le nôtre. Le href reste un vrai lien d'ancre, pour le clic droit et
  // l'absence de JS.
  function handleClick(id: string) {
    return (e: React.MouseEvent<HTMLAnchorElement>) => {
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      const top = Math.max(
        0,
        Math.round(
          target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET,
        ),
      );
      const scroll = motionBridge.get().scroll;
      if (scroll) scroll.to(top);
      else
        window.scrollTo({
          top,
          behavior: readReducedMotion() ? "auto" : "smooth",
        });
      // Comme une ancre native : le prochain Tab part de la section visée et
      // un lecteur d'écran commence à son titre.
      if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
      target.focus({ preventScroll: true });
      history.replaceState(null, "", `#${id}`);
    };
  }

  return (
    <nav
      aria-label={label}
      className={cx(
        styles.rail,
        "sticky top-16 z-30 border-b border-line bg-paper/90 backdrop-blur-lg",
      )}
    >
      <div
        ref={listRef}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ol className="s3d-page flex w-max min-w-full gap-x-7">
          {items.map((item) => {
            const active = activeId === item.id;
            return (
              <li key={item.id} className="shrink-0">
                <a
                  href={`#${item.id}`}
                  onClick={handleClick(item.id)}
                  data-id={item.id}
                  aria-current={active ? "location" : undefined}
                  className={cx(
                    "s3d-label relative flex h-12 items-center gap-2 transition-colors duration-150 ease-strate",
                    active ? "text-ink" : "text-soft hover:text-ink",
                  )}
                >
                  {item.number ? (
                    <span className={active ? "text-accent-text" : undefined}>
                      {item.number}
                    </span>
                  ) : null}
                  <span>{item.label}</span>
                  {/* Repère de la section lue : se trace de gauche à droite. */}
                  <span
                    aria-hidden="true"
                    className={cx(
                      "absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent transition-transform duration-280 ease-strate",
                      active ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

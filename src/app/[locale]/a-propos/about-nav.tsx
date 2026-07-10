"use client";

import { useEffect, useRef, useState } from "react";

interface AboutNavItem {
  id: string;
  label: string;
}

// Ligne de détection : juste sous le header (64px) + cette barre sticky.
const DETECTION_LINE = 150;

// Barre de navigation rapide, collée sous le header : suit le défilement et
// met en avant la section actuellement lue, pour retrouver une info sans
// tout relire sur une page volontairement longue et complète.
//
// Écoute `scroll` (throttlée par requestAnimationFrame) plutôt qu'un
// IntersectionObserver : son callback ne reçoit que les entrées dont l'état
// vient de CHANGER, pas un instantané de toutes les sections observées — sur
// une page à sections hautes, beaucoup de mouvements de défilement ne
// produisent aucune entrée "actuellement visible" dans le batch reçu, et la
// pastille active reste bloquée sur la première section. Constaté en usage
// réel, pas juste en théorie. L'algorithme ici est déterministe : à chaque
// scroll, on prend la dernière section (dans l'ordre du document) dont le
// haut a déjà franchi la ligne de détection.
export function AboutNav({ items }: { items: AboutNavItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id);
  const listRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

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

    // Pas de throttle requestAnimationFrame : ne pas dépendre d'un rAF qui
    // se déclenche de façon fiable (constaté peu fiable dans un contexte de
    // test automatisé/headless — même famille de souci que le défilement
    // fluide ou IntersectionObserver). Vérifier 6 éléments par événement
    // scroll est de toute façon négligeable en coût.
    computeActive();
    window.addEventListener("scroll", computeActive, { passive: true });
    return () => window.removeEventListener("scroll", computeActive);
  }, []);

  // Garde la pastille active visible dans la barre horizontale scrollable.
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
    if (elRect.left < containerRect.left || elRect.right > containerRect.right) {
      const delta =
        elRect.left -
        containerRect.left -
        (containerRect.width - elRect.width) / 2;
      container.scrollBy({ left: delta, behavior: "smooth" });
    }
  }, [activeId]);

  // Défilement explicite au clic plutôt que de compter sur la navigation
  // native par ancre (`<a href="#id">` + `scroll-behavior: smooth`) : plus
  // fiable pour respecter systématiquement le décalage `scroll-mt` sous le
  // header + cette barre sticky, sur tous les navigateurs.
  function handleClick(id: string) {
    return (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", `#${id}`);
    };
  }

  return (
    <div className="sticky top-16 z-30 -mx-4 border-b border-line bg-paper/90 backdrop-blur-lg sm:-mx-6">
      <div
        ref={listRef}
        className="flex gap-1.5 overflow-x-auto px-4 py-2.5 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={handleClick(item.id)}
            data-id={item.id}
            aria-current={activeId === item.id ? "true" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              activeId === item.id
                ? "bg-ink text-paper"
                : "text-soft hover:bg-line/60 hover:text-ink"
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}

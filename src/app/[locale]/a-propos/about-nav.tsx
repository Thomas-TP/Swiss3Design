"use client";

import { useEffect, useRef, useState } from "react";

interface AboutNavItem {
  id: string;
  label: string;
}

// Barre de navigation rapide, collée sous le header (top-16 = hauteur du
// header) : suit le défilement et met en avant la section actuellement
// visible (IntersectionObserver), pour retrouver une info sans tout relire
// sur une page volontairement longue et complète.
export function AboutNav({ items }: { items: AboutNavItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);

    // Fenêtre de détection : juste sous les barres sticky (header + cette
    // nav) jusqu'au tiers supérieur de l'écran — la section active est celle
    // dont le titre vient de passer sous cette ligne.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-150px 0px -70% 0px", threshold: 0 },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [items]);

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

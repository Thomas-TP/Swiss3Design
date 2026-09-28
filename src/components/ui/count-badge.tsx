"use client";

import { useEffect, useRef } from "react";
import { cx } from "./cx";

// Pastille de compteur du chrome (panier, favoris). Rouge = pastille, usage
// graphique permis du jeton accent ; blanc dessus 4,58:1. Masquée à zéro.
//
// Micro-interaction « s3d.purge » (brief §3.5) : quand le compte AUGMENTE,
// la pastille enfle puis retombe avec un léger dépassement (320 ms), comme la
// purge d'un changement de bobine. Web Animations API sur le nœud, sans état
// React ni keyframes globales. Jamais au chargement : le panier et les favoris
// se réhydratent depuis localStorage juste après le montage (0 → n), ce qui
// n'est pas un ajout ; la pastille ne s'arme qu'après ce délai. Rien en
// mouvement réduit (data-motion posé sur <html> avant le paint).
const ARM_AFTER_MS = 600;
const PURGE = "cubic-bezier(0.3, 1.35, 0.6, 1)";

export function CountBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(count);
  const armed = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      armed.current = true;
    }, ARM_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const grew = count > previous.current;
    previous.current = count;
    const node = ref.current;
    if (!grew || !armed.current || !node || !node.animate) return;
    if (document.documentElement.dataset.motion === "reduce") return;
    node.animate([{ transform: "scale(1.55)" }, { transform: "scale(1)" }], {
      duration: 320,
      easing: PURGE,
    });
  }, [count]);

  if (count <= 0) return null;
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cx(
        "s3d-num flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-bold leading-none text-on-accent",
        className,
      )}
    >
      {count}
    </span>
  );
}

"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useReducedMotionPreference } from "@/lib/motion-bridge/use-reduced-motion";

// Préférence du site (interrupteur du footer compris), et non celle du seul
// système. Le SSR rend l'état initial masqué ; en mouvement réduit, la
// variante motion-off (data-motion posé avant le paint) l'emporte sur les
// styles inline de Motion : le contenu est visible et immobile dès le
// premier paint, avant même l'hydratation. Remplacé par WP-99.
const REDUCED_FINAL = "motion-off:opacity-100! motion-off:transform-none!";

export function Reveal({
  children,
  delay = 0,
  className,
  inView = false,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  inView?: boolean;
}) {
  const reduced = useReducedMotionPreference();
  const animation = { opacity: 1, y: 0 };
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 18 }}
      {...(inView
        ? { whileInView: animation, viewport: { once: true, margin: "-60px" } }
        : { animate: animation })}
      transition={{
        duration: reduced ? 0 : 0.55,
        delay: reduced ? 0 : delay,
        ease: [0.21, 0.65, 0.36, 1],
      }}
      className={className ? `${REDUCED_FINAL} ${className}` : REDUCED_FINAL}
    >
      {children}
    </motion.div>
  );
}

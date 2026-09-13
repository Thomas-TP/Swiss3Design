"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

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
  const reduced = useReducedMotion();
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
      className={className}
    >
      {children}
    </motion.div>
  );
}

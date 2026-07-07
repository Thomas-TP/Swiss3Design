"use client";

import { motion } from "motion/react";
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
  const animation = { opacity: 1, y: 0 };
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      {...(inView
        ? { whileInView: animation, viewport: { once: true, margin: "-60px" } }
        : { animate: animation })}
      transition={{ duration: 0.55, delay, ease: [0.21, 0.65, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

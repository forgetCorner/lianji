"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export function KineticPageTransition({ pageKey, children, suspended = false }: { pageKey: string; children: React.ReactNode; suspended?: boolean }) {
  const reducedMotion = useReducedMotion();
  const staticTransition = Boolean(reducedMotion) || suspended;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        className="kinetic-page-stage"
        key={pageKey}
        initial={staticTransition ? { opacity: 1 } : { opacity: 0, x: 18, filter: "blur(6px)", clipPath: "inset(0 0 0 12%)" }}
        animate={{
          opacity: 1,
          x: 0,
          filter: "blur(0px)",
          clipPath: "inset(0 0 0 0%)",
          transitionEnd: { transform: "none", filter: "none", clipPath: "none" },
        }}
        exit={staticTransition ? { opacity: 1 } : { opacity: 0, x: -12, filter: "blur(3px)", clipPath: "inset(0 10% 0 0)" }}
        transition={{ duration: staticTransition ? 0 : 0.58, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

"use client";

import { AnimatePresence, motion, useMotionValue, usePresenceData, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { createPortal } from "react-dom";

type TransitionStageProps = {
  children: React.ReactNode;
  direction: 1 | -1;
  floatingAction?: React.ReactNode;
  floatingRoot?: HTMLElement | null;
  staticTransition: boolean;
};

function TransitionStage({ children, direction, floatingAction, floatingRoot, staticTransition }: TransitionStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const presenceDirection = usePresenceData() as 1 | -1 | undefined;
  const x = useMotionValue(staticTransition ? 0 : 18 * direction);
  const opacity = useMotionValue(staticTransition ? 1 : 0);
  const filter = useMotionValue(staticTransition ? "none" : "blur(6px)");
  const clipPath = useMotionValue(staticTransition ? "none" : "inset(0 0 0 12%)");

  const markTransition = (transitioning: boolean) => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.dataset.pageTransitioning = transitioning ? "true" : "false";
    if (!transitioning) stage.dispatchEvent(new Event("kinetic-page-transition-complete"));
  };

  const sharedMotionStyle = { x, opacity, filter, clipPath };

  return (
    <>
      <motion.div
        ref={stageRef}
        className="kinetic-page-stage"
        data-page-transitioning={staticTransition ? "false" : "true"}
        style={sharedMotionStyle}
        animate={{
          opacity: 1,
          x: 0,
          filter: "blur(0px)",
          clipPath: "inset(0 0 0 0%)",
          transitionEnd: { transform: "none", filter: "none", clipPath: "none" },
        }}
        exit={staticTransition ? { opacity: 1 } : { opacity: 0, x: -12 * (presenceDirection ?? direction), filter: "blur(3px)", clipPath: "inset(0 10% 0 0)" }}
        transition={{ duration: staticTransition ? 0 : 0.58, ease: [0.16, 1, 0.3, 1] }}
        onAnimationStart={() => markTransition(true)}
        onAnimationComplete={() => markTransition(false)}
      >
        {children}
      </motion.div>
      {floatingAction && floatingRoot && createPortal(
        <motion.div className="today-action-layer" style={sharedMotionStyle}>
          <div className="today-action-positioner">{floatingAction}</div>
        </motion.div>,
        floatingRoot,
      )}
    </>
  );
}

export function KineticPageTransition({ pageKey, children, direction = 1, suspended = false, floatingAction, floatingRoot }: { pageKey: string; children: React.ReactNode; direction?: 1 | -1; suspended?: boolean; floatingAction?: React.ReactNode; floatingRoot?: HTMLElement | null }) {
  const reducedMotion = useReducedMotion();
  const staticTransition = Boolean(reducedMotion) || suspended;

  return (
    <AnimatePresence custom={direction} mode="wait" initial={false}>
      <TransitionStage
        key={pageKey}
        direction={direction}
        staticTransition={staticTransition}
        floatingAction={floatingAction}
        floatingRoot={floatingRoot}
      >
        {children}
      </TransitionStage>
    </AnimatePresence>
  );
}

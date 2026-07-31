"use client";

import { AnimatePresence, motion, useMotionValue, usePresenceData, useReducedMotion } from "motion/react";
import { useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const MOBILE_TRANSITION_QUERY = "(max-width: 760px)";

function subscribeMobileTransition(callback: () => void) {
  const mediaQuery = window.matchMedia(MOBILE_TRANSITION_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getMobileTransitionSnapshot() {
  return window.matchMedia(MOBILE_TRANSITION_QUERY).matches;
}

type TransitionStageProps = {
  children: React.ReactNode;
  compactTransition: boolean;
  direction: 1 | -1;
  floatingAction?: React.ReactNode;
  floatingRoot?: HTMLElement | null;
  staticTransition: boolean;
};

function TransitionStage({ children, compactTransition, direction, floatingAction, floatingRoot, staticTransition }: TransitionStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const presenceDirection = usePresenceData() as 1 | -1 | undefined;
  const x = useMotionValue(staticTransition ? 0 : (compactTransition ? 10 : 18) * direction);
  const opacity = useMotionValue(staticTransition ? 1 : compactTransition ? 0.72 : 0);
  const filter = useMotionValue(staticTransition || compactTransition ? "none" : "blur(6px)");
  const clipPath = useMotionValue(staticTransition || compactTransition ? "none" : "inset(0 0 0 12%)");

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
        exit={staticTransition
          ? { opacity: 1 }
          : compactTransition
            ? { opacity: 0, x: -8 * (presenceDirection ?? direction) }
            : { opacity: 0, x: -12 * (presenceDirection ?? direction), filter: "blur(3px)", clipPath: "inset(0 10% 0 0)" }}
        transition={{ duration: staticTransition ? 0 : compactTransition ? 0.22 : 0.58, ease: [0.16, 1, 0.3, 1] }}
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
  const compactTransition = useSyncExternalStore(
    subscribeMobileTransition,
    getMobileTransitionSnapshot,
    () => false,
  );
  const staticTransition = Boolean(reducedMotion) || suspended;

  return (
    <AnimatePresence custom={direction} mode={compactTransition ? "sync" : "wait"} initial={false}>
      <TransitionStage
        key={pageKey}
        compactTransition={compactTransition}
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

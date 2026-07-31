"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { KineticIcon } from "@/components/kinetic-icons";
import {
  gestureIntent,
  magnetizedX,
  menuIndexWithHysteresis,
  nearestMenuIndex,
  type GestureIntent,
} from "@/lib/mobile-navigation-gesture";

export type MobileNavView = "today" | "plan" | "ranking" | "profile";

type MobileLiquidGlassNavProps = {
  view: MobileNavView;
  setView: (view: MobileNavView) => void;
};

type NavigationGeometry = {
  navLeft: number;
  centers: number[];
  selectionWidth: number;
};

type ActiveGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  intent: GestureIntent;
  previewIndex: number;
};

const mobileMenuItems: ReadonlyArray<{
  view: MobileNavView;
  label: string;
  icon: MobileNavView;
}> = [
  { view: "today", label: "今日", icon: "today" },
  { view: "plan", label: "计划", icon: "plan" },
  { view: "ranking", label: "排行", icon: "ranking" },
  { view: "profile", label: "我的", icon: "profile" },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function viewIndex(view: MobileNavView): number {
  return mobileMenuItems.findIndex((item) => item.view === view);
}

export function MobileLiquidGlassNav({
  view,
  setView,
}: MobileLiquidGlassNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const geometryRef = useRef<NavigationGeometry | null>(null);
  const gestureRef = useRef<ActiveGesture | null>(null);
  const readyRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [selectionWidth, setSelectionWidth] = useState(0);
  const prefersReducedMotion = Boolean(useReducedMotion());

  const rawX = useMotionValue(0);
  const rawScaleX = useMotionValue(1);
  const rawScaleY = useMotionValue(1);
  const rawSkewX = useMotionValue(0);
  const rawHighlightX = useMotionValue(0);
  const springX = useSpring(rawX, {
    stiffness: 680,
    damping: 46,
    mass: 0.42,
  });
  const springScaleX = useSpring(rawScaleX, {
    stiffness: 520,
    damping: 24,
    mass: 0.46,
  });
  const springScaleY = useSpring(rawScaleY, {
    stiffness: 520,
    damping: 24,
    mass: 0.46,
  });
  const springSkewX = useSpring(rawSkewX, {
    stiffness: 500,
    damping: 26,
    mass: 0.44,
  });
  const springHighlightX = useSpring(rawHighlightX, {
    stiffness: 440,
    damping: 28,
    mass: 0.4,
  });

  const positionForIndex = useCallback((index: number) => {
    const geometry = geometryRef.current;
    if (!geometry || geometry.centers[index] === undefined) return null;
    return geometry.centers[index] - geometry.selectionWidth / 2;
  }, []);

  const settleToIndex = useCallback((
    index: number,
    immediate = false,
    snapPosition = false,
  ) => {
    const position = positionForIndex(index);
    if (position === null) return;

    rawX.set(position);
    rawScaleX.set(1);
    rawScaleY.set(1);
    rawSkewX.set(0);
    rawHighlightX.set(0);

    if (snapPosition) {
      springX.jump(position);
    }

    if (immediate || prefersReducedMotion) {
      springX.jump(position);
      springScaleX.jump(1);
      springScaleY.jump(1);
      springSkewX.jump(0);
      springHighlightX.jump(0);
    }
  }, [
    positionForIndex,
    prefersReducedMotion,
    rawHighlightX,
    rawScaleX,
    rawScaleY,
    rawSkewX,
    rawX,
    springHighlightX,
    springScaleX,
    springScaleY,
    springSkewX,
    springX,
  ]);

  const measureNavigation = useCallback(() => {
    const nav = navRef.current;
    const buttons = buttonRefs.current;
    if (!nav || buttons.length !== mobileMenuItems.length || buttons.some((button) => !button)) {
      return null;
    }

    const navRect = nav.getBoundingClientRect();
    if (navRect.width <= 0) return null;

    const buttonRects = buttons.map((button) => button!.getBoundingClientRect());
    const centers = buttonRects.map((rect) => rect.left - navRect.left + rect.width / 2);
    const smallestButtonWidth = Math.min(...buttonRects.map((rect) => rect.width));
    const nextSelectionWidth = clamp(smallestButtonWidth, 68, 110);
    const geometry = {
      navLeft: navRect.left,
      centers,
      selectionWidth: nextSelectionWidth,
    };

    geometryRef.current = geometry;
    setSelectionWidth(nextSelectionWidth);

    if (!readyRef.current) {
      readyRef.current = true;
      setReady(true);
      settleToIndex(viewIndex(view), true);
    }

    return geometry;
  }, [settleToIndex, view]);

  const suppressNextClick = useCallback(() => {
    suppressClickRef.current = true;
    requestAnimationFrame(() => {
      suppressClickRef.current = false;
    });
  }, []);

  const releasePointerCapture = useCallback((pointerId: number) => {
    const nav = navRef.current;
    if (nav?.hasPointerCapture(pointerId)) {
      nav.releasePointerCapture(pointerId);
    }
  }, []);

  const cancelGesture = useCallback((suppressClick = true) => {
    const gesture = gestureRef.current;
    if (!gesture) return;

    gestureRef.current = null;
    setPreviewIndex(null);
    setInteracting(false);
    settleToIndex(viewIndex(view));
    if (suppressClick) suppressNextClick();
    releasePointerCapture(gesture.pointerId);
  }, [releasePointerCapture, settleToIndex, suppressNextClick, view]);

  useLayoutEffect(() => {
    measureNavigation();
    const nav = navRef.current;
    if (!nav) return;

    const resizeObserver = new ResizeObserver(() => {
      const geometry = measureNavigation();
      if (geometry && !gestureRef.current) {
        settleToIndex(viewIndex(view), true);
      }
    });
    resizeObserver.observe(nav);
    window.addEventListener("resize", measureNavigation);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureNavigation);
    };
  }, [measureNavigation, settleToIndex, view]);

  useEffect(() => {
    if (gestureRef.current) {
      cancelGesture(false);
      return;
    }
    setPreviewIndex(null);
    setInteracting(false);
    settleToIndex(viewIndex(view));
  }, [cancelGesture, settleToIndex, view]);

  useEffect(() => () => {
    gestureRef.current = null;
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    const geometry = measureNavigation();
    if (!geometry) return;

    const localX = event.clientX - geometry.navLeft;
    const initialPreviewIndex = nearestMenuIndex(geometry.centers, localX);
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      intent: "pending",
      previewIndex: initialPreviewIndex,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setInteracting(true);
    setPreviewIndex(initialPreviewIndex);
    settleToIndex(initialPreviewIndex, prefersReducedMotion);

    if (!prefersReducedMotion) {
      rawScaleX.set(1.1);
      rawScaleY.set(0.92);
      rawSkewX.set(0);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    const geometry = geometryRef.current;
    if (!gesture || !geometry || gesture.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (gesture.intent === "pending") {
      gesture.intent = gestureIntent(deltaX, deltaY);
      if (gesture.intent === "vertical") {
        cancelGesture();
        return;
      }
    }

    if (gesture.intent !== "horizontal") return;
    event.preventDefault();

    const localX = event.clientX - geometry.navLeft;
    const nextPreviewIndex = menuIndexWithHysteresis(
      geometry.centers,
      localX,
      gesture.previewIndex,
    );
    gesture.previewIndex = nextPreviewIndex;
    setPreviewIndex((currentIndex) => (
      currentIndex === nextPreviewIndex ? currentIndex : nextPreviewIndex
    ));

    const targetCenter = geometry.centers[nextPreviewIndex];
    const visualCenter = magnetizedX(
      localX,
      targetCenter,
      geometry.centers[0],
      geometry.centers[geometry.centers.length - 1],
    );
    rawX.set(visualCenter - geometry.selectionWidth / 2);

    if (!prefersReducedMotion) {
      const elapsed = Math.max(8, event.timeStamp - gesture.lastTime);
      const velocity = (event.clientX - gesture.lastX) / elapsed;
      const stretch = clamp(1.075 + Math.abs(velocity) * 0.065, 1.075, 1.16);
      rawScaleX.set(stretch);
      rawScaleY.set(clamp(1 - (stretch - 1) * 0.72, 0.89, 0.95));
      rawSkewX.set(clamp(-velocity * 4.2, -4.5, 4.5));
      rawHighlightX.set(clamp(-velocity * 4.2, -5, 5));
    }

    gesture.lastX = event.clientX;
    gesture.lastTime = event.timeStamp;
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const focusedElement = document.activeElement;
    if (
      focusedElement instanceof HTMLElement
      && navRef.current?.contains(focusedElement)
    ) {
      focusedElement.blur();
    }

    const targetIndex = gesture.previewIndex;
    const targetView = mobileMenuItems[targetIndex]?.view ?? view;
    gestureRef.current = null;
    setPreviewIndex(null);
    setInteracting(false);
    settleToIndex(targetIndex, false, true);
    suppressNextClick();
    releasePointerCapture(event.pointerId);

    if (targetView !== view) {
      setView(targetView);
    }
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLElement>) {
    if (gestureRef.current?.pointerId === event.pointerId) {
      cancelGesture();
    }
  }

  function handleLostPointerCapture(event: ReactPointerEvent<HTMLElement>) {
    if (gestureRef.current?.pointerId === event.pointerId) {
      cancelGesture();
    }
  }

  function handleClickCapture(event: React.MouseEvent<HTMLElement>) {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <nav
      ref={navRef}
      className={`mobile-nav ${interacting ? "is-interacting" : ""}`.trim()}
      aria-label="移动端主导航"
      data-ready={ready ? "true" : "false"}
      data-preview-view={previewIndex === null ? undefined : mobileMenuItems[previewIndex]?.view}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
      onClickCapture={handleClickCapture}
    >
      <span className="mobile-nav-glass-base" aria-hidden="true" />
      <motion.span
        className="mobile-nav-selection"
        aria-hidden="true"
        style={{
          width: selectionWidth,
          x: prefersReducedMotion || interacting ? rawX : springX,
          scaleX: prefersReducedMotion ? 1 : springScaleX,
          scaleY: prefersReducedMotion ? 1 : springScaleY,
          skewX: prefersReducedMotion ? 0 : springSkewX,
        }}
      >
        <motion.span
          className="mobile-nav-selection-highlight"
          style={{ x: prefersReducedMotion ? 0 : springHighlightX }}
        />
        <span className="mobile-nav-selection-refraction" />
      </motion.span>
      {mobileMenuItems.map((item, index) => {
        const active = item.view === view;
        const preview = interacting && previewIndex === index;
        return (
          <button
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            className={`nav-button ${active ? "is-active" : ""} ${preview ? "is-preview" : ""}`.trim()}
            aria-current={active ? "page" : undefined}
            key={item.view}
            onClick={() => {
              if (item.view !== view) {
                settleToIndex(index, false, true);
                setView(item.view);
              }
            }}
          >
            <KineticIcon kind={item.icon} active={active} size={28} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

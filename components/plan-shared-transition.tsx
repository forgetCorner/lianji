"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { KineticIcon } from "@/components/kinetic-icons";

type PlanSharedTransitionProps = {
  scrollerRef: RefObject<HTMLDivElement | null>;
  sourceIconRef: RefObject<HTMLSpanElement | null>;
  sourceLabelRef: RefObject<HTMLSpanElement | null>;
  sourceDayNameRef: RefObject<HTMLInputElement | null>;
  sourceDayEditorRef: RefObject<HTMLDivElement | null>;
  sourceDayStatusRef: RefObject<HTMLButtonElement | null>;
  sourceStatusDotRef: RefObject<HTMLElement | null>;
  targetIconRef: RefObject<HTMLSpanElement | null>;
  targetLabelRef: RefObject<HTMLSpanElement | null>;
  targetDayNameRef: RefObject<HTMLSpanElement | null>;
  targetDayStatusRef: RefObject<HTMLButtonElement | null>;
  targetStatusDotRef: RefObject<HTMLElement | null>;
  dayName: string;
  dayEnabled: boolean;
  statusState: "saving" | "dirty" | "synced";
  selectionKey: number;
  direction: number;
  onCondensedChange: (condensed: boolean) => void;
};

type TextMeasurement = {
  rect: DOMRect;
  fontSize: number;
  fontWeight: number;
  color: string;
};

type Measurements = {
  sourceIcon: DOMRect;
  sourceStatusDot: DOMRect;
  sourceLabel: TextMeasurement;
  sourceDayName: TextMeasurement;
  sourceDayStatus: DOMRect;
  targetIcon: DOMRect;
  targetStatusDot: DOMRect;
  targetLabel: TextMeasurement;
  targetDayName: TextMeasurement;
  targetDayStatus: DOMRect;
  scrollerTop: number;
  compactHeight: number;
  compactWeekdaysHeight: number;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const smoothstep = (progress: number) => progress * progress * (3 - 2 * progress);

function readElementTranslation(element: HTMLElement | null) {
  if (!element) return { x: 0, y: 0 };
  const transform = getComputedStyle(element).transform;
  if (!transform || transform === "none") return { x: 0, y: 0 };
  const matrix = new DOMMatrixReadOnly(transform);
  return { x: matrix.m41, y: matrix.m42 };
}

function readTextMeasurement(element: HTMLElement, scrollTop = 0, offset = { x: 0, y: 0 }): TextMeasurement {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const textInset = element instanceof HTMLInputElement
    ? Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft)
    : 0;
  return {
    rect: DOMRect.fromRect({
      x: rect.left + offset.x + textInset,
      y: rect.top + scrollTop + offset.y,
      width: Math.max(0, rect.width - textInset),
      height: rect.height,
    }),
    fontSize: Number.parseFloat(style.fontSize),
    fontWeight: Number.parseFloat(style.fontWeight),
    color: style.color,
  };
}

export function PlanSharedTransition({
  scrollerRef,
  sourceIconRef,
  sourceLabelRef,
  sourceDayNameRef,
  sourceDayEditorRef,
  sourceDayStatusRef,
  sourceStatusDotRef,
  targetIconRef,
  targetLabelRef,
  targetDayNameRef,
  targetDayStatusRef,
  targetStatusDotRef,
  dayName,
  dayEnabled,
  statusState,
  selectionKey,
  direction,
  onCondensedChange,
}: PlanSharedTransitionProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const sharedIconRef = useRef<HTMLSpanElement>(null);
  const sharedStatusDotRef = useRef<HTMLSpanElement>(null);
  const sharedLabelRef = useRef<HTMLSpanElement>(null);
  const sharedDayNameRef = useRef<HTMLSpanElement>(null);
  const sharedDayStatusRef = useRef<HTMLSpanElement>(null);
  const onCondensedChangeRef = useRef(onCondensedChange);
  const previousSelectionRef = useRef(selectionKey);
  const condensedStateRef = useRef(false);

  useLayoutEffect(() => {
    onCondensedChangeRef.current = onCondensedChange;
  }, [onCondensedChange]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const sourceIcon = sourceIconRef.current;
    const sourceLabel = sourceLabelRef.current;
    const sourceDayName = sourceDayNameRef.current;
    const sourceDayEditor = sourceDayEditorRef.current;
    const sourceDayStatus = sourceDayStatusRef.current;
    const sourceStatusDot = sourceStatusDotRef.current;
    const targetIcon = targetIconRef.current;
    const targetLabel = targetLabelRef.current;
    const targetDayName = targetDayNameRef.current;
    const targetDayStatus = targetDayStatusRef.current;
    const targetStatusDot = targetStatusDotRef.current;
    const layer = layerRef.current;
    const sharedIcon = sharedIconRef.current;
    const sharedStatusDot = sharedStatusDotRef.current;
    const sharedLabel = sharedLabelRef.current;
    const sharedDayName = sharedDayNameRef.current;
    const sharedDayStatus = sharedDayStatusRef.current;
    if (!scroller || !sourceIcon || !sourceLabel || !sourceDayName || !sourceDayStatus || !sourceStatusDot || !targetIcon || !targetLabel || !targetDayName || !targetDayStatus || !targetStatusDot || !layer || !sharedIcon || !sharedStatusDot || !sharedLabel || !sharedDayName || !sharedDayStatus) return;

    const identitySourceElements = [sourceIcon, sourceLabel, sourceStatusDot];
    const contextSourceElements = [sourceDayName, sourceDayStatus];
    const pageStage = sourceIcon.closest<HTMLElement>(".kinetic-page-stage");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileViewport = window.matchMedia("(max-width: 760px)");
    const containerScrolls = () => getComputedStyle(scroller).overflowY !== "visible";
    const getScrollTop = () => containerScrolls() ? scroller.scrollTop : window.scrollY;
    const getCollapseDistance = () => mobileViewport.matches ? 148 : 156;
    let sharedReady = pageStage?.dataset.pageTransitioning !== "true";
    let measurements: Measurements | null = null;
    let frame = 0;
    let readinessFrame = 0;
    const selectionChanged = previousSelectionRef.current !== selectionKey;
    const selectionAnimations: Animation[] = [];
    previousSelectionRef.current = selectionKey;

    const setIdentitySourceVisibility = (visible: boolean) => {
      identitySourceElements.forEach((element) => { element.style.visibility = visible ? "visible" : "hidden"; });
    };
    const setContextSourceVisibility = (visible: boolean) => {
      contextSourceElements.forEach((element) => { element.style.visibility = visible ? "visible" : "hidden"; });
    };
    const setSourceVisibility = (visible: boolean) => {
      setIdentitySourceVisibility(visible);
      setContextSourceVisibility(visible);
    };
    const setLayerVisibility = (visible: boolean) => {
      layer.style.opacity = visible ? "1" : "0";
    };
    const writeIcon = (x: number, y: number, scale: number) => {
      sharedIcon.style.transform = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) scale(${scale.toFixed(5)})`;
    };
    const writeStatusDot = (x: number, y: number, scale: number) => {
      sharedStatusDot.style.transform = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) scale(${scale.toFixed(5)})`;
    };
    const writeDayStatus = (x: number, y: number, scale: number) => {
      sharedDayStatus.style.transform = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) scale(${scale.toFixed(5)})`;
    };
    const writeText = (element: HTMLElement, source: TextMeasurement, target: TextMeasurement, x: number, y: number, progress: number) => {
      element.style.left = `${x.toFixed(3)}px`;
      element.style.top = `${y.toFixed(3)}px`;
      element.style.fontSize = `${mix(source.fontSize, target.fontSize, progress).toFixed(3)}px`;
      element.style.lineHeight = `${mix(source.rect.height, target.rect.height, progress).toFixed(3)}px`;
      element.style.fontWeight = mix(source.fontWeight, target.fontWeight, progress).toFixed(1);
      element.style.color = progress < 0.5 ? source.color : target.color;
    };
    const setCondensed = (next: boolean) => {
      if (condensedStateRef.current === next) return;
      condensedStateRef.current = next;
      onCondensedChangeRef.current(next);
    };

    const update = () => {
      frame = 0;
      if (!measurements) return;
      const scrollTop = getScrollTop();
      const collapseDistance = getCollapseDistance();
      const progress = clamp(scrollTop / collapseDistance);
      const condensed = progress >= 0.72;
      const fixedBottom = measurements.scrollerTop + measurements.compactHeight + measurements.compactWeekdaysHeight;
      const contextStartScroll = Math.max(
        0,
        measurements.sourceDayName.rect.top + measurements.sourceDayName.rect.height / 2 - fixedBottom,
      );
      const contextTravelDistance = mobileViewport.matches ? 80 : 88;
      const contextProgress = smoothstep(clamp((scrollTop - contextStartScroll) / contextTravelDistance));
      const contextCondensed = contextProgress > 0.001;
      const targetIconY = measurements.scrollerTop + (measurements.compactHeight - measurements.targetIcon.height) / 2;
      const targetStatusDotY = measurements.scrollerTop + (measurements.compactHeight - measurements.targetStatusDot.height) / 2;
      const targetLabelY = measurements.scrollerTop + (measurements.compactHeight - measurements.targetLabel.rect.height) / 2;
      const targetDayNameY = measurements.scrollerTop + (measurements.compactHeight - measurements.targetDayName.rect.height) / 2;
      const targetDayStatusY = measurements.scrollerTop + (measurements.compactHeight - measurements.targetDayStatus.height) / 2;
      scroller.style.setProperty("--plan-header-collapse", progress.toFixed(4));
      scroller.style.setProperty("--plan-context-collapse", contextProgress.toFixed(4));
      scroller.dataset.planHeaderCondensed = condensed ? "true" : "false";
      scroller.dataset.planContextCondensed = contextCondensed ? "true" : "false";
      setCondensed(condensed);

      if (!sharedReady) {
        setSourceVisibility(true);
        targetDayStatus.style.visibility = "hidden";
        setLayerVisibility(false);
        return;
      }

      if (reducedMotion.matches) {
        setIdentitySourceVisibility(!condensed);
        setContextSourceVisibility(!contextCondensed);
        targetDayStatus.style.visibility = contextCondensed ? "visible" : "hidden";
        setLayerVisibility(condensed || contextCondensed);
        sharedIcon.style.opacity = condensed ? "1" : "0";
        sharedStatusDot.style.opacity = condensed ? "1" : "0";
        sharedLabel.style.opacity = condensed ? "1" : "0";
        sharedDayName.style.opacity = contextCondensed ? "1" : "0";
        sharedDayStatus.style.opacity = "0";
        if (condensed) {
          writeIcon(measurements.targetIcon.left, targetIconY, measurements.targetIcon.width / measurements.sourceIcon.width);
          writeStatusDot(
            measurements.targetStatusDot.left,
            targetStatusDotY,
            measurements.targetStatusDot.width / measurements.sourceStatusDot.width,
          );
          writeText(sharedLabel, measurements.sourceLabel, measurements.targetLabel, measurements.targetLabel.rect.left, targetLabelY, 1);
        }
        if (contextCondensed) {
          writeText(sharedDayName, measurements.sourceDayName, measurements.targetDayName, measurements.targetDayName.rect.left, targetDayNameY, 1);
        }
        return;
      }

      if (progress <= 0.001) {
        setSourceVisibility(true);
        targetDayStatus.style.visibility = "hidden";
        setLayerVisibility(false);
        sharedStatusDot.style.opacity = "0";
        sharedDayName.style.opacity = "0";
        sharedDayStatus.style.opacity = "0";
        return;
      }

      const identityProgress = smoothstep(clamp((progress - 0.08) / 0.38));
      const identityOffset = Math.min(scrollTop, collapseDistance * 0.08);
      const contextOffset = Math.min(scrollTop, contextStartScroll);
      setIdentitySourceVisibility(false);
      setContextSourceVisibility(contextProgress <= 0.001);
      const targetDayStatusVisible = contextProgress >= 0.999;
      targetDayStatus.style.visibility = targetDayStatusVisible ? "visible" : "hidden";
      setLayerVisibility(true);
      sharedStatusDot.style.opacity = "1";
      sharedDayName.style.opacity = contextProgress > 0.001 ? "1" : "0";
      sharedDayStatus.style.opacity = contextProgress > 0.001 && !targetDayStatusVisible ? "1" : "0";
      writeIcon(
        mix(measurements.sourceIcon.left, measurements.targetIcon.left, identityProgress),
        mix(measurements.sourceIcon.top - identityOffset, targetIconY, identityProgress),
        mix(1, measurements.targetIcon.width / measurements.sourceIcon.width, identityProgress),
      );
      writeStatusDot(
        mix(measurements.sourceStatusDot.left, measurements.targetStatusDot.left, identityProgress),
        mix(measurements.sourceStatusDot.top - identityOffset, targetStatusDotY, identityProgress),
        mix(1, measurements.targetStatusDot.width / measurements.sourceStatusDot.width, identityProgress),
      );
      writeText(
        sharedLabel,
        measurements.sourceLabel,
        measurements.targetLabel,
        mix(measurements.sourceLabel.rect.left, measurements.targetLabel.rect.left, identityProgress),
        mix(measurements.sourceLabel.rect.top - identityOffset, targetLabelY, identityProgress),
        identityProgress,
      );
      writeText(
        sharedDayName,
        measurements.sourceDayName,
        measurements.targetDayName,
        mix(measurements.sourceDayName.rect.left, measurements.targetDayName.rect.left, contextProgress),
        mix(measurements.sourceDayName.rect.top - contextOffset, targetDayNameY, contextProgress),
        contextProgress,
      );
      writeDayStatus(
        mix(measurements.sourceDayStatus.left, measurements.targetDayStatus.left, contextProgress),
        mix(measurements.sourceDayStatus.top - contextOffset, targetDayStatusY, contextProgress),
        mix(1, measurements.targetDayStatus.width / measurements.sourceDayStatus.width, contextProgress),
      );
    };

    const measure = () => {
      if (!sharedReady) {
        setSourceVisibility(true);
        setLayerVisibility(false);
        return;
      }
      const savedProgress = scroller.style.getPropertyValue("--plan-header-collapse");
      const scrollTop = getScrollTop();
      const scrollerRect = scroller.getBoundingClientRect();
      const compactContext = targetIcon.closest<HTMLElement>(".plan-compact-context");
      const compactShell = targetIcon.closest<HTMLElement>(".plan-compact-shell");
      const compactWeekdays = compactShell?.querySelector<HTMLElement>(".plan-compact-weekdays");
      scroller.style.setProperty("--plan-header-collapse", "0");
      const sourceIconRect = sourceIcon.getBoundingClientRect();
      const sourceDayStatusRect = sourceDayStatus.getBoundingClientRect();
      const sourceStatusDotRect = sourceStatusDot.getBoundingClientRect();
      const dayEditorTranslation = readElementTranslation(sourceDayEditor);
      measurements = {
        sourceIcon: DOMRect.fromRect({ x: sourceIconRect.left, y: sourceIconRect.top + scrollTop, width: sourceIconRect.width, height: sourceIconRect.height }),
        sourceStatusDot: DOMRect.fromRect({ x: sourceStatusDotRect.left, y: sourceStatusDotRect.top + scrollTop, width: sourceStatusDotRect.width, height: sourceStatusDotRect.height }),
        sourceLabel: readTextMeasurement(sourceLabel, scrollTop),
        sourceDayName: readTextMeasurement(sourceDayName, scrollTop, {
          x: -dayEditorTranslation.x,
          y: -dayEditorTranslation.y,
        }),
        sourceDayStatus: DOMRect.fromRect({
          x: sourceDayStatusRect.left - dayEditorTranslation.x,
          y: sourceDayStatusRect.top + scrollTop - dayEditorTranslation.y,
          width: sourceDayStatusRect.width,
          height: sourceDayStatusRect.height,
        }),
        targetIcon: targetIcon.getBoundingClientRect(),
        targetStatusDot: targetStatusDot.getBoundingClientRect(),
        targetLabel: readTextMeasurement(targetLabel),
        targetDayName: readTextMeasurement(targetDayName),
        targetDayStatus: targetDayStatus.getBoundingClientRect(),
        scrollerTop: containerScrolls() ? scrollerRect.top : scrollerRect.top + scrollTop,
        compactHeight: compactContext?.offsetHeight ?? 56,
        compactWeekdaysHeight: mobileViewport.matches ? compactWeekdays?.offsetHeight ?? 42 : 0,
      };
      scroller.style.setProperty("--plan-header-collapse", savedProgress || "0");
      sharedIcon.style.width = `${measurements.sourceIcon.width}px`;
      sharedIcon.style.height = `${measurements.sourceIcon.height}px`;
      sharedStatusDot.style.width = `${measurements.sourceStatusDot.width}px`;
      sharedStatusDot.style.height = `${measurements.sourceStatusDot.height}px`;
      sharedDayStatus.style.width = `${measurements.sourceDayStatus.width}px`;
      sharedDayStatus.style.height = `${measurements.sourceDayStatus.height}px`;
      [
        [sharedLabel, sourceLabel],
        [sharedDayName, sourceDayName],
      ].forEach(([shared, source]) => {
        const style = getComputedStyle(source);
        shared.style.fontFamily = style.fontFamily;
        shared.style.letterSpacing = style.letterSpacing;
        shared.style.whiteSpace = "nowrap";
      });
      update();
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const requestMeasure = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const handlePageTransitionComplete = () => {
      sharedReady = true;
      requestMeasure();
    };
    const checkPageTransitionReady = () => {
      readinessFrame = 0;
      if (sharedReady || !pageStage) return;
      const style = getComputedStyle(pageStage);
      const settled = style.transform === "none" || style.transform === "matrix(1, 0, 0, 1, 0, 0)";
      if (settled && Number.parseFloat(style.opacity) >= 0.999) {
        pageStage.dataset.pageTransitioning = "false";
        handlePageTransitionComplete();
        return;
      }
      readinessFrame = window.requestAnimationFrame(checkPageTransitionReady);
    };

    const resizeObserver = new ResizeObserver(requestMeasure);
    targetStatusDot.style.visibility = "hidden";
    targetDayStatus.style.visibility = "hidden";
    [scroller, sourceIcon, sourceLabel, sourceDayName, sourceDayStatus, sourceStatusDot, targetIcon, targetLabel, targetDayName, targetDayStatus, targetStatusDot].forEach((element) => resizeObserver.observe(element));
    scroller.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestMeasure);
    reducedMotion.addEventListener("change", requestMeasure);
    mobileViewport.addEventListener("change", requestMeasure);
    pageStage?.addEventListener("kinetic-page-transition-complete", handlePageTransitionComplete);
    document.fonts.ready.then(requestMeasure).catch(() => undefined);
    measure();
    if (selectionChanged && scroller.dataset.planContextCondensed === "true" && !reducedMotion.matches) {
      [sharedDayName].forEach((element) => {
        selectionAnimations.push(element.animate(
          [{ opacity: 0.42, translate: `${direction * 12}px 0` }, { opacity: 1, translate: "0 0" }],
          { duration: 190, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
        ));
      });
    }
    if (!sharedReady) readinessFrame = window.requestAnimationFrame(checkPageTransitionReady);

    return () => {
      resizeObserver.disconnect();
      scroller.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestMeasure);
      reducedMotion.removeEventListener("change", requestMeasure);
      mobileViewport.removeEventListener("change", requestMeasure);
      pageStage?.removeEventListener("kinetic-page-transition-complete", handlePageTransitionComplete);
      if (frame) window.cancelAnimationFrame(frame);
      if (readinessFrame) window.cancelAnimationFrame(readinessFrame);
      selectionAnimations.forEach((animation) => animation.cancel());
      targetStatusDot.style.visibility = "";
      targetDayStatus.style.visibility = "";
      setSourceVisibility(true);
      setLayerVisibility(false);
      scroller.style.setProperty("--plan-header-collapse", "0");
      scroller.style.setProperty("--plan-context-collapse", "0");
      scroller.dataset.planHeaderCondensed = "false";
      scroller.dataset.planContextCondensed = "false";
    };
  }, [dayEnabled, direction, scrollerRef, selectionKey, sourceDayEditorRef, sourceDayNameRef, sourceDayStatusRef, sourceIconRef, sourceLabelRef, sourceStatusDotRef, statusState, targetDayNameRef, targetDayStatusRef, targetIconRef, targetLabelRef, targetStatusDotRef]);

  return (
    <div ref={layerRef} className="plan-shared-layer" aria-hidden="true">
      <span ref={sharedIconRef} className="plan-shared-icon"><KineticIcon kind="plan" active size={28} /></span>
      <span ref={sharedStatusDotRef} className={`plan-shared-status-dot is-${statusState}`} />
      <span ref={sharedLabelRef} className="plan-shared-label">周计划</span>
      <strong ref={sharedDayNameRef} className="plan-shared-day-name">{dayName || "未命名训练"}</strong>
      <span ref={sharedDayStatusRef} className={`plan-shared-day-status ${dayEnabled ? "is-enabled" : "is-rest"}`}>
        <span className="day-status-label">{dayEnabled ? "训练日" : "休息日"}</span>
        <span className="day-status-track"><i className="day-status-thumb" /></span>
      </span>
    </div>
  );
}

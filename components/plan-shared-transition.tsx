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
  sourceWeekdaysRef: RefObject<HTMLElement | null>;
  targetIconRef: RefObject<HTMLSpanElement | null>;
  targetLabelRef: RefObject<HTMLSpanElement | null>;
  targetDayNameRef: RefObject<HTMLSpanElement | null>;
  targetDayStatusRef: RefObject<HTMLButtonElement | null>;
  targetStatusDotRef: RefObject<HTMLElement | null>;
  targetWeekdaysRef: RefObject<HTMLElement | null>;
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
  sourceWeekdays: TextMeasurement[];
  targetWeekdays: TextMeasurement[];
  targetWeekdayDots: DOMRect[];
  targetWeekdayUnderline: DOMRect;
  scrollerTop: number;
  compactHeight: number;
  compactWeekdaysHeight: number;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const smoothstep = (progress: number) => progress * progress * (3 - 2 * progress);
const PLAN_HEADER_CONDENSED_THRESHOLD = 0.72;
const PLAN_HEADER_SNAP_EPSILON = 0.75;
const CONTENT_RUBBER_BAND_COEFFICIENT = 0.36;
const CONTENT_SPRING_FREQUENCY = 14;
const TOUCH_SCROLL_IDLE_MS = 160;
const WHEEL_GESTURE_IDLE_MS = 160;

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
  sourceWeekdaysRef,
  targetIconRef,
  targetLabelRef,
  targetDayNameRef,
  targetDayStatusRef,
  targetStatusDotRef,
  targetWeekdaysRef,
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
  const sharedWeekdayRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const sharedWeekdayDotRefs = useRef<Array<HTMLElement | null>>([]);
  const sharedWeekdayUnderlineRef = useRef<HTMLElement>(null);
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
    const sourceWeekdays = sourceWeekdaysRef.current;
    const targetIcon = targetIconRef.current;
    const targetLabel = targetLabelRef.current;
    const targetDayName = targetDayNameRef.current;
    const targetDayStatus = targetDayStatusRef.current;
    const targetStatusDot = targetStatusDotRef.current;
    const targetWeekdays = targetWeekdaysRef.current;
    const layer = layerRef.current;
    const sharedIcon = sharedIconRef.current;
    const sharedStatusDot = sharedStatusDotRef.current;
    const sharedLabel = sharedLabelRef.current;
    const sharedDayName = sharedDayNameRef.current;
    const sharedDayStatus = sharedDayStatusRef.current;
    const sharedWeekdays = sharedWeekdayRefs.current;
    const sharedWeekdayDots = sharedWeekdayDotRefs.current;
    const sharedWeekdayUnderline = sharedWeekdayUnderlineRef.current;
    const contentRegion = sourceDayEditor?.closest<HTMLElement>(".plan-workspace");
    if (!scroller || !sourceIcon || !sourceLabel || !sourceDayName || !sourceDayEditor || !sourceDayStatus || !sourceStatusDot || !sourceWeekdays || !contentRegion || !targetIcon || !targetLabel || !targetDayName || !targetDayStatus || !targetStatusDot || !targetWeekdays || !layer || !sharedIcon || !sharedStatusDot || !sharedLabel || !sharedDayName || !sharedDayStatus || !sharedWeekdayUnderline || sharedWeekdays.some((weekday) => !weekday) || sharedWeekdayDots.some((dot) => !dot)) return;

    const identitySourceElements = [sourceIcon, sourceLabel, sourceStatusDot];
    const contextSourceElements = [sourceDayName, sourceDayStatus];
    const sourceWeekdayLabels = Array.from(sourceWeekdays.querySelectorAll<HTMLElement>("button > b"));
    const targetWeekdayLabels = Array.from(targetWeekdays.querySelectorAll<HTMLElement>("button > span"));
    const targetWeekdayDots = Array.from(targetWeekdays.querySelectorAll<HTMLElement>("button > i"));
    const targetWeekdayButtons = Array.from(targetWeekdays.querySelectorAll<HTMLElement>(":scope > button"));
    const weekdayTransitionReady = sourceWeekdayLabels.length === sharedWeekdays.length
      && targetWeekdayLabels.length === sharedWeekdays.length
      && targetWeekdayDots.length === sharedWeekdayDots.length
      && targetWeekdayButtons.length === sharedWeekdays.length;
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
    let contentMotionFrame = 0;
    let contentRubberBandOffset = 0;
    let contentRubberBandTarget = 0;
    let contentRubberBandVelocity = 0;
    let contentRubberBandFrameTime = 0;
    let contentRubberBandDimension = 1;
    let touchRubberBandDistance = 0;
    previousSelectionRef.current = selectionKey;

    const setIdentitySourceVisibility = (visible: boolean) => {
      identitySourceElements.forEach((element) => { element.style.visibility = visible ? "visible" : "hidden"; });
    };
    const setContextSourceVisibility = (visible: boolean) => {
      contextSourceElements.forEach((element) => { element.style.visibility = visible ? "visible" : "hidden"; });
    };
    const setWeekdaySourceVisibility = (visible: boolean) => {
      sourceWeekdayLabels.forEach((element) => { element.style.visibility = visible ? "visible" : "hidden"; });
    };
    const setTargetWeekdayLabelsVisibility = (visible: boolean) => {
      targetWeekdayLabels.forEach((element) => { element.style.visibility = visible ? "visible" : "hidden"; });
    };
    const setTargetWeekdayDotsVisibility = (visible: boolean) => {
      targetWeekdayDots.forEach((element) => { element.style.visibility = visible ? "visible" : "hidden"; });
    };
    const setSharedWeekdaysVisibility = (visible: boolean) => {
      sharedWeekdays.forEach((element) => {
        if (element) element.style.opacity = visible ? "1" : "0";
      });
    };
    const setSharedWeekdayDotsOpacity = (opacity: number) => {
      sharedWeekdayDots.forEach((element) => {
        if (element) element.style.opacity = opacity.toFixed(4);
      });
    };
    const setSharedWeekdayUnderlineOpacity = (opacity: number) => {
      sharedWeekdayUnderline.style.opacity = opacity.toFixed(4);
    };
    const setTargetWeekdaySharedTransition = (active: boolean) => {
      if (active) targetWeekdays.dataset.sharedWeekdays = "true";
      else delete targetWeekdays.dataset.sharedWeekdays;
    };
    const setSourceVisibility = (visible: boolean) => {
      setIdentitySourceVisibility(visible);
      setContextSourceVisibility(visible);
      setWeekdaySourceVisibility(visible);
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
    const writeWeekday = (element: HTMLElement, source: TextMeasurement, target: TextMeasurement, progress: number, scrollOffset: number) => {
      const scale = mix(1, target.fontSize / source.fontSize, progress);
      element.style.color = progress < 0.5 ? source.color : target.color;
      element.style.transform = `translate3d(${mix(source.rect.left, target.rect.left, progress).toFixed(3)}px, ${mix(source.rect.top - scrollOffset, target.rect.top, progress).toFixed(3)}px, 0) scale(${scale.toFixed(5)})`;
    };
    const writeWeekdayDot = (element: HTMLElement, source: TextMeasurement, target: DOMRect, progress: number, scrollOffset: number) => {
      const sourceX = source.rect.left + (source.rect.width - target.width) / 2;
      const sourceY = source.rect.top + source.rect.height + 8;
      element.style.transform = `translate3d(${mix(sourceX, target.left, progress).toFixed(3)}px, ${mix(sourceY - scrollOffset, target.top, progress).toFixed(3)}px, 0)`;
    };
    const writeWeekdayUnderline = (source: TextMeasurement, target: DOMRect, progress: number, scrollOffset: number) => {
      const sourceX = source.rect.left + (source.rect.width - target.width) / 2;
      const sourceY = source.rect.top + source.rect.height + 15;
      sharedWeekdayUnderline.style.transform = `translate3d(${mix(sourceX, target.left, progress).toFixed(3)}px, ${mix(sourceY - scrollOffset, target.top, progress).toFixed(3)}px, 0)`;
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
      const condensed = progress >= PLAN_HEADER_CONDENSED_THRESHOLD;
      const animateWeekdays = mobileViewport.matches && weekdayTransitionReady;
      const weekdayProgress = clamp((progress - 0.08) / (PLAN_HEADER_CONDENSED_THRESHOLD - 0.08));
      const weekdayDetailsFadeEnd = window.innerWidth <= 600 ? 1 / 2.1 : 1 / 1.5;
      const weekdayDotRevealProgress = smoothstep(clamp((progress - weekdayDetailsFadeEnd) / 0.1));
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
        setTargetWeekdayLabelsVisibility(true);
        setTargetWeekdayDotsVisibility(true);
        setSharedWeekdaysVisibility(false);
        setSharedWeekdayDotsOpacity(0);
        setSharedWeekdayUnderlineOpacity(0);
        setTargetWeekdaySharedTransition(false);
        targetDayStatus.style.visibility = "hidden";
        setLayerVisibility(false);
        return;
      }

      if (reducedMotion.matches) {
        setIdentitySourceVisibility(!condensed);
        setContextSourceVisibility(!contextCondensed);
        setWeekdaySourceVisibility(!animateWeekdays || !condensed);
        setTargetWeekdayLabelsVisibility(!animateWeekdays || condensed);
        setTargetWeekdayDotsVisibility(!animateWeekdays || condensed);
        setSharedWeekdaysVisibility(false);
        setSharedWeekdayDotsOpacity(0);
        setSharedWeekdayUnderlineOpacity(0);
        setTargetWeekdaySharedTransition(false);
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
        setTargetWeekdayLabelsVisibility(false);
        setTargetWeekdayDotsVisibility(false);
        setSharedWeekdaysVisibility(false);
        setSharedWeekdayDotsOpacity(0);
        setSharedWeekdayUnderlineOpacity(0);
        setTargetWeekdaySharedTransition(false);
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
      const weekdayOffset = Math.min(scrollTop, collapseDistance * 0.08);
      setIdentitySourceVisibility(false);
      setContextSourceVisibility(contextProgress <= 0.001);
      if (animateWeekdays) {
        setWeekdaySourceVisibility(false);
        setTargetWeekdayLabelsVisibility(false);
        setTargetWeekdayDotsVisibility(false);
        setSharedWeekdaysVisibility(true);
        setSharedWeekdayDotsOpacity(weekdayDotRevealProgress);
        setSharedWeekdayUnderlineOpacity(weekdayDotRevealProgress);
        setTargetWeekdaySharedTransition(true);
        sharedWeekdays.forEach((element, index) => {
          if (!element) return;
          writeWeekday(element, measurements!.sourceWeekdays[index], measurements!.targetWeekdays[index], weekdayProgress, weekdayOffset);
        });
        sharedWeekdayDots.forEach((element, index) => {
          if (!element) return;
          writeWeekdayDot(element, measurements!.sourceWeekdays[index], measurements!.targetWeekdayDots[index], weekdayProgress, weekdayOffset);
        });
        writeWeekdayUnderline(
          measurements.sourceWeekdays[selectionKey - 1],
          measurements.targetWeekdayUnderline,
          weekdayProgress,
          weekdayOffset,
        );
      } else {
        setWeekdaySourceVisibility(true);
        setTargetWeekdayLabelsVisibility(true);
        setTargetWeekdayDotsVisibility(true);
        setSharedWeekdaysVisibility(false);
        setSharedWeekdayDotsOpacity(0);
        setSharedWeekdayUnderlineOpacity(0);
        setTargetWeekdaySharedTransition(false);
      }
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
      const stickyTop = containerScrolls() ? scrollerRect.top : scrollerRect.top + scrollTop;
      const compactContext = targetIcon.closest<HTMLElement>(".plan-compact-context");
      const compactShell = targetIcon.closest<HTMLElement>(".plan-compact-shell");
      const compactWeekdays = compactShell?.querySelector<HTMLElement>(".plan-compact-weekdays");
      scroller.style.setProperty("--plan-header-collapse", "0");
      const sourceIconRect = sourceIcon.getBoundingClientRect();
      const sourceDayStatusRect = sourceDayStatus.getBoundingClientRect();
      const sourceStatusDotRect = sourceStatusDot.getBoundingClientRect();
      const dayEditorTranslation = readElementTranslation(sourceDayEditor);
      const sourceWeekdayMeasurements = sourceWeekdayLabels.map((element) => readTextMeasurement(element, scrollTop));
      scroller.style.setProperty("--plan-header-collapse", "1");
      const compactShellTop = compactShell?.getBoundingClientRect().top ?? stickyTop;
      const anchorToStickyTop = (rect: DOMRect) => DOMRect.fromRect({
        x: rect.left,
        y: stickyTop + rect.top - compactShellTop,
        width: rect.width,
        height: rect.height,
      });
      const targetWeekdayMeasurements = targetWeekdayLabels.map((element) => {
        const measurement = readTextMeasurement(element);
        return { ...measurement, rect: anchorToStickyTop(measurement.rect) };
      });
      const targetWeekdayDotMeasurements = targetWeekdayDots.map((element) => anchorToStickyTop(element.getBoundingClientRect()));
      const targetWeekdayButtonRect = anchorToStickyTop(targetWeekdayButtons[selectionKey - 1].getBoundingClientRect());
      const targetWeekdayUnderlineMeasurement = DOMRect.fromRect({
        x: targetWeekdayButtonRect.left + (targetWeekdayButtonRect.width - 16) / 2,
        y: targetWeekdayButtonRect.bottom - 2,
        width: 16,
        height: 2,
      });
      scroller.style.setProperty("--plan-header-collapse", "0");
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
        sourceWeekdays: sourceWeekdayMeasurements,
        targetWeekdays: targetWeekdayMeasurements,
        targetWeekdayDots: targetWeekdayDotMeasurements,
        targetWeekdayUnderline: targetWeekdayUnderlineMeasurement,
        scrollerTop: stickyTop,
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
      sharedWeekdays.forEach((shared, index) => {
        const source = sourceWeekdayLabels[index];
        if (!shared || !source) return;
        const sourceMeasurement = measurements!.sourceWeekdays[index];
        const style = getComputedStyle(source);
        shared.style.fontFamily = style.fontFamily;
        shared.style.fontSize = `${sourceMeasurement.fontSize}px`;
        shared.style.fontWeight = sourceMeasurement.fontWeight.toFixed(1);
        shared.style.lineHeight = `${sourceMeasurement.rect.height}px`;
        shared.style.letterSpacing = style.letterSpacing;
      });
      sharedWeekdayDots.forEach((shared, index) => {
        const target = targetWeekdayDots[index];
        const targetMeasurement = measurements!.targetWeekdayDots[index];
        if (!shared || !target || !targetMeasurement) return;
        shared.style.width = `${targetMeasurement.width}px`;
        shared.style.height = `${targetMeasurement.height}px`;
        shared.style.background = getComputedStyle(target).backgroundColor;
      });
      sharedWeekdayUnderline.style.width = `${measurements.targetWeekdayUnderline.width}px`;
      sharedWeekdayUnderline.style.height = `${measurements.targetWeekdayUnderline.height}px`;
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

    const getHeaderSnapScrollTop = () => getCollapseDistance() * PLAN_HEADER_CONDENSED_THRESHOLD;
    const getSnapSide = (scrollTop: number, snapScrollTop: number) => {
      if (scrollTop < snapScrollTop - PLAN_HEADER_SNAP_EPSILON) return -1;
      if (scrollTop > snapScrollTop + PLAN_HEADER_SNAP_EPSILON) return 1;
      return 0;
    };
    const setExactScrollTop = (scrollTop: number) => {
      if (containerScrolls()) scroller.scrollTop = scrollTop;
      else window.scrollTo({ top: scrollTop, left: window.scrollX, behavior: "auto" });
      requestUpdate();
    };
    const preventGestureScroll = (event: TouchEvent | WheelEvent) => {
      if (event.cancelable) event.preventDefault();
    };
    const readContentRubberBandDimension = () => {
      contentRubberBandDimension = Math.max(
        1,
        containerScrolls() ? scroller.clientHeight : window.innerHeight,
      );
    };
    const writeContentRubberBandOffset = (offset: number) => {
      contentRubberBandOffset = offset;
      contentRegion.style.transform = `translate3d(0, ${offset.toFixed(3)}px, 0)`;
    };
    const cancelContentMotion = () => {
      if (contentMotionFrame) window.cancelAnimationFrame(contentMotionFrame);
      contentMotionFrame = 0;
    };
    const resetContentRubberBand = () => {
      cancelContentMotion();
      contentRubberBandOffset = 0;
      contentRubberBandTarget = 0;
      contentRubberBandVelocity = 0;
      contentRubberBandFrameTime = 0;
      touchRubberBandDistance = 0;
      contentRegion.style.removeProperty("transform");
      contentRegion.style.removeProperty("will-change");
    };
    const flushContentRubberBand = (timestamp: number) => {
      contentMotionFrame = 0;
      const previousOffset = contentRubberBandOffset;
      const elapsed = contentRubberBandFrameTime
        ? Math.max(1, timestamp - contentRubberBandFrameTime)
        : 0;
      if (elapsed) {
        const instantaneousVelocity = (contentRubberBandTarget - previousOffset) / (elapsed / 1000);
        contentRubberBandVelocity = contentRubberBandVelocity * 0.65 + instantaneousVelocity * 0.35;
      }
      contentRubberBandFrameTime = timestamp;
      writeContentRubberBandOffset(contentRubberBandTarget);
    };
    const setContentRubberBand = (attemptedScrollDistance: number) => {
      if (reducedMotion.matches) return;
      const distance = Math.abs(attemptedScrollDistance);
      const dampedDistance = (
        distance
        * contentRubberBandDimension
        * CONTENT_RUBBER_BAND_COEFFICIENT
      ) / (
        contentRubberBandDimension
        + CONTENT_RUBBER_BAND_COEFFICIENT * distance
      );
      contentRubberBandTarget = -Math.sign(attemptedScrollDistance) * dampedDistance;
      contentRegion.style.willChange = "transform";
      if (!contentMotionFrame) contentMotionFrame = window.requestAnimationFrame(flushContentRubberBand);
    };
    const releaseContentRubberBand = () => {
      cancelContentMotion();
      if (contentRubberBandTarget !== contentRubberBandOffset) {
        flushContentRubberBand(performance.now());
      }
      touchRubberBandDistance = 0;
      if (reducedMotion.matches || Math.abs(contentRubberBandOffset) < 0.1) {
        resetContentRubberBand();
        return;
      }

      const releaseOffset = contentRubberBandOffset;
      const velocityLimit = contentRubberBandDimension * 1.5;
      const velocityAge = contentRubberBandFrameTime
        ? Math.max(0, performance.now() - contentRubberBandFrameTime) / 1000
        : 0;
      const measuredVelocity = contentRubberBandVelocity * Math.exp(-16 * velocityAge);
      const releaseVelocity = measuredVelocity * releaseOffset > 0
        ? clamp(measuredVelocity, -velocityLimit, velocityLimit)
        : 0;
      let releaseStartedAt = 0;
      const stepRelease = (timestamp: number) => {
        if (!releaseStartedAt) releaseStartedAt = timestamp;
        const elapsed = (timestamp - releaseStartedAt) / 1000;
        const decay = Math.exp(-CONTENT_SPRING_FREQUENCY * elapsed);
        const springTerm = releaseVelocity + CONTENT_SPRING_FREQUENCY * releaseOffset;
        const offset = (releaseOffset + springTerm * elapsed) * decay;
        const velocity = (
          releaseVelocity
          - CONTENT_SPRING_FREQUENCY * springTerm * elapsed
        ) * decay;
        writeContentRubberBandOffset(offset);
        if (Math.abs(offset) < 0.1 && Math.abs(velocity) < 4) {
          resetContentRubberBand();
          return;
        }
        contentMotionFrame = window.requestAnimationFrame(stepRelease);
      };
      contentMotionFrame = window.requestAnimationFrame(stepRelease);
    };
    const playContentSnapFeedback = (snapSide: number) => {
      if (reducedMotion.matches || snapSide === 0) return;
      resetContentRubberBand();
      readContentRubberBandDimension();
      setContentRubberBand(
        (snapSide < 0 ? 1 : -1) * contentRubberBandDimension * 0.04,
      );
      releaseContentRubberBand();
    };

    let touchLastY = 0;
    let touchSnapSide = 0;
    let touchSnapLocked = false;
    let touchGestureTracked = false;
    let touchScrollTimer = 0;
    const finishTouchGesture = () => {
      touchGestureTracked = false;
      if (!touchSnapLocked) touchSnapSide = 0;
      touchScrollTimer = 0;
    };
    const scheduleTouchGestureEnd = () => {
      if (touchScrollTimer) window.clearTimeout(touchScrollTimer);
      touchScrollTimer = window.setTimeout(finishTouchGesture, TOUCH_SCROLL_IDLE_MS);
    };
    const handleTouchStart = (event: TouchEvent) => {
      if (!mobileViewport.matches || event.touches.length !== 1) return;
      if (touchScrollTimer) window.clearTimeout(touchScrollTimer);
      const snapScrollTop = getHeaderSnapScrollTop();
      const continuingPastSnap = touchSnapLocked;
      resetContentRubberBand();
      readContentRubberBandDimension();
      touchLastY = event.touches[0].clientY;
      touchGestureTracked = true;
      touchSnapLocked = false;
      touchSnapSide = continuingPastSnap ? 0 : getSnapSide(getScrollTop(), snapScrollTop);
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (!mobileViewport.matches || event.touches.length !== 1) return;
      const nextY = event.touches[0].clientY;
      const deltaY = touchLastY - nextY;
      touchLastY = nextY;
      if (touchSnapLocked) {
        preventGestureScroll(event);
        touchRubberBandDistance += deltaY;
        touchRubberBandDistance = touchSnapSide < 0
          ? Math.max(0, touchRubberBandDistance)
          : Math.min(0, touchRubberBandDistance);
        setContentRubberBand(touchRubberBandDistance);
        return;
      }
      if (touchSnapSide === 0 || Math.abs(deltaY) < 0.01) return;
      const snapScrollTop = getHeaderSnapScrollTop();
      const nextScrollTop = getScrollTop() + deltaY;
      const reachesSnap = touchSnapSide < 0
        ? nextScrollTop >= snapScrollTop
        : nextScrollTop <= snapScrollTop;
      if (!reachesSnap) return;
      preventGestureScroll(event);
      touchSnapLocked = true;
      touchRubberBandDistance = touchSnapSide < 0
        ? Math.max(0, nextScrollTop - snapScrollTop)
        : Math.min(0, nextScrollTop - snapScrollTop);
      setExactScrollTop(snapScrollTop);
      setContentRubberBand(touchRubberBandDistance);
    };
    const handleTouchEnd = () => {
      if (touchSnapLocked) releaseContentRubberBand();
      scheduleTouchGestureEnd();
    };

    let wheelGestureActive = false;
    let wheelSnapSide = 0;
    let wheelSnapLocked = false;
    let wheelGestureTimer = 0;
    const finishWheelGesture = () => {
      wheelGestureActive = false;
      wheelSnapSide = 0;
      wheelSnapLocked = false;
      wheelGestureTimer = 0;
    };
    const scheduleWheelGestureEnd = () => {
      if (wheelGestureTimer) window.clearTimeout(wheelGestureTimer);
      wheelGestureTimer = window.setTimeout(finishWheelGesture, WHEEL_GESTURE_IDLE_MS);
    };
    const handleWheel = (event: WheelEvent) => {
      if (!mobileViewport.matches || Math.abs(event.deltaY) < 0.01) return;
      const snapScrollTop = getHeaderSnapScrollTop();
      if (!wheelGestureActive) {
        wheelGestureActive = true;
        wheelSnapSide = getSnapSide(getScrollTop(), snapScrollTop);
        wheelSnapLocked = false;
      }
      scheduleWheelGestureEnd();
      if (wheelSnapLocked) {
        preventGestureScroll(event);
        return;
      }
      if (wheelSnapSide === 0) return;
      const deltaScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? scroller.clientHeight
          : 1;
      const nextScrollTop = getScrollTop() + event.deltaY * deltaScale;
      const reachesSnap = wheelSnapSide < 0
        ? nextScrollTop >= snapScrollTop
        : nextScrollTop <= snapScrollTop;
      if (!reachesSnap) return;
      preventGestureScroll(event);
      wheelSnapLocked = true;
      setExactScrollTop(snapScrollTop);
      playContentSnapFeedback(wheelSnapSide);
    };
    const enforceTouchSnap = () => {
      if (!mobileViewport.matches) return;
      const snapScrollTop = getHeaderSnapScrollTop();
      const scrollTop = getScrollTop();
      if (touchSnapLocked) {
        if (Math.abs(scrollTop - snapScrollTop) > PLAN_HEADER_SNAP_EPSILON) setExactScrollTop(snapScrollTop);
        return;
      }
      if (!touchGestureTracked || touchSnapSide === 0) return;
      const reachedSnap = touchSnapSide < 0
        ? scrollTop >= snapScrollTop
        : scrollTop <= snapScrollTop;
      if (!reachedSnap) return;
      touchSnapLocked = true;
      touchRubberBandDistance = scrollTop - snapScrollTop;
      setExactScrollTop(snapScrollTop);
      setContentRubberBand(touchRubberBandDistance);
    };
    const handleTrackedScroll = () => {
      requestUpdate();
      enforceTouchSnap();
    };

    const resizeObserver = new ResizeObserver(requestMeasure);
    targetStatusDot.style.visibility = "hidden";
    targetDayStatus.style.visibility = "hidden";
    [scroller, sourceIcon, sourceLabel, sourceDayName, sourceDayStatus, sourceStatusDot, sourceWeekdays, targetIcon, targetLabel, targetDayName, targetDayStatus, targetStatusDot, targetWeekdays].forEach((element) => resizeObserver.observe(element));
    scroller.addEventListener("scroll", handleTrackedScroll, { passive: true });
    scroller.addEventListener("touchstart", handleTouchStart, { passive: true });
    scroller.addEventListener("touchmove", handleTouchMove, { passive: false });
    scroller.addEventListener("touchend", handleTouchEnd, { passive: true });
    scroller.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    scroller.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("scroll", handleTrackedScroll, { passive: true });
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
      scroller.removeEventListener("scroll", handleTrackedScroll);
      scroller.removeEventListener("touchstart", handleTouchStart);
      scroller.removeEventListener("touchmove", handleTouchMove);
      scroller.removeEventListener("touchend", handleTouchEnd);
      scroller.removeEventListener("touchcancel", handleTouchEnd);
      scroller.removeEventListener("wheel", handleWheel);
      window.removeEventListener("scroll", handleTrackedScroll);
      window.removeEventListener("resize", requestMeasure);
      reducedMotion.removeEventListener("change", requestMeasure);
      mobileViewport.removeEventListener("change", requestMeasure);
      pageStage?.removeEventListener("kinetic-page-transition-complete", handlePageTransitionComplete);
      if (frame) window.cancelAnimationFrame(frame);
      if (readinessFrame) window.cancelAnimationFrame(readinessFrame);
      if (touchScrollTimer) window.clearTimeout(touchScrollTimer);
      if (wheelGestureTimer) window.clearTimeout(wheelGestureTimer);
      selectionAnimations.forEach((animation) => animation.cancel());
      resetContentRubberBand();
      targetStatusDot.style.visibility = "";
      targetDayStatus.style.visibility = "";
      targetWeekdayLabels.forEach((element) => { element.style.removeProperty("visibility"); });
      targetWeekdayDots.forEach((element) => { element.style.removeProperty("visibility"); });
      setSharedWeekdaysVisibility(false);
      setSharedWeekdayDotsOpacity(0);
      setSharedWeekdayUnderlineOpacity(0);
      setTargetWeekdaySharedTransition(false);
      setSourceVisibility(true);
      setLayerVisibility(false);
      scroller.style.setProperty("--plan-header-collapse", "0");
      scroller.style.setProperty("--plan-context-collapse", "0");
      scroller.dataset.planHeaderCondensed = "false";
      scroller.dataset.planContextCondensed = "false";
    };
  }, [dayEnabled, direction, scrollerRef, selectionKey, sourceDayEditorRef, sourceDayNameRef, sourceDayStatusRef, sourceIconRef, sourceLabelRef, sourceStatusDotRef, sourceWeekdaysRef, statusState, targetDayNameRef, targetDayStatusRef, targetIconRef, targetLabelRef, targetStatusDotRef, targetWeekdaysRef]);

  return (
    <div ref={layerRef} className="plan-shared-layer" aria-hidden="true">
      <span ref={sharedIconRef} className="plan-shared-icon"><KineticIcon kind="plan" active size={28} /></span>
      <span ref={sharedStatusDotRef} className={`plan-shared-status-dot is-${statusState}`} />
      <span ref={sharedLabelRef} className="plan-shared-label">周计划</span>
      {["一", "二", "三", "四", "五", "六", "日"].map((weekday, index) => (
        <span
          key={weekday}
          ref={(element) => { sharedWeekdayRefs.current[index] = element; }}
          className="plan-shared-weekday"
        >
          {weekday}
        </span>
      ))}
      {["一", "二", "三", "四", "五", "六", "日"].map((weekday, index) => (
        <i
          key={`dot-${weekday}`}
          ref={(element) => { sharedWeekdayDotRefs.current[index] = element; }}
          className="plan-shared-weekday-dot"
        />
      ))}
      <i ref={sharedWeekdayUnderlineRef} className="plan-shared-weekday-underline" />
      <strong ref={sharedDayNameRef} className="plan-shared-day-name">{dayName || "未命名训练"}</strong>
      <span ref={sharedDayStatusRef} className={`plan-shared-day-status ${dayEnabled ? "is-enabled" : "is-rest"}`}>
        <span className="day-status-label">{dayEnabled ? "训练日" : "休息日"}</span>
        <span className="day-status-track"><i className="day-status-thumb" /></span>
      </span>
    </div>
  );
}

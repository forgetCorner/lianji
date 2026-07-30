"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { KineticIcon } from "@/components/kinetic-icons";

type RankingSharedTransitionProps = {
  scrollerRef: RefObject<HTMLDivElement | null>;
  sourceIconRef: RefObject<HTMLSpanElement | null>;
  sourceLabelRef: RefObject<HTMLSpanElement | null>;
  sourceRangeRef: RefObject<HTMLSpanElement | null>;
  targetIconRef: RefObject<HTMLSpanElement | null>;
  targetLabelRef: RefObject<HTMLSpanElement | null>;
  targetRangeRef: RefObject<HTMLSpanElement | null>;
};

type TextStyle = {
  fontSize: number;
  fontWeight: number;
  color: [number, number, number];
};

type Measurements = {
  sourceIcon: DOMRect;
  sourceLabel: DOMRect;
  sourceRange: DOMRect;
  targetIcon: DOMRect;
  targetLabel: DOMRect;
  targetRange: DOMRect;
  sourceLabelStyle: TextStyle;
  sourceRangeStyle: TextStyle;
  targetLabelStyle: TextStyle;
  targetRangeStyle: TextStyle;
  scrollerTop: number;
  compactHeight: number;
};

const RANKING_HEADER_CONDENSED_THRESHOLD = 0.72;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const smoothstep = (progress: number) => progress * progress * (3 - 2 * progress);
const parseColor = (color: string): [number, number, number] => {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  return channels?.length === 3 ? [channels[0], channels[1], channels[2]] : [255, 255, 255];
};
const mixColor = (
  from: [number, number, number],
  to: [number, number, number],
  progress: number,
) => `rgb(${from.map((channel, index) => Math.round(mix(channel, to[index], progress))).join(", ")})`;

export function RankingSharedTransition({
  scrollerRef,
  sourceIconRef,
  sourceLabelRef,
  sourceRangeRef,
  targetIconRef,
  targetLabelRef,
  targetRangeRef,
}: RankingSharedTransitionProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLElement>(null);
  const rangeRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const sourceIcon = sourceIconRef.current;
    const sourceLabel = sourceLabelRef.current;
    const sourceRange = sourceRangeRef.current;
    const targetIcon = targetIconRef.current;
    const targetLabel = targetLabelRef.current;
    const targetRange = targetRangeRef.current;
    const layer = layerRef.current;
    const sharedIcon = iconRef.current;
    const sharedLabel = labelRef.current;
    const sharedRange = rangeRef.current;
    if (
      !scroller
      || !sourceIcon
      || !sourceLabel
      || !sourceRange
      || !targetIcon
      || !targetLabel
      || !targetRange
      || !layer
      || !sharedIcon
      || !sharedLabel
      || !sharedRange
    ) return;

    const pageStage = sourceIcon.closest<HTMLElement>(".kinetic-page-stage");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileViewport = window.matchMedia("(max-width: 760px)");
    const containerScrolls = () => getComputedStyle(scroller).overflowY !== "visible";
    const getScrollTop = () => containerScrolls() ? scroller.scrollTop : window.scrollY;
    const getCollapseDistance = () => mobileViewport.matches ? 132 : 150;
    let sharedReady = pageStage?.dataset.pageTransitioning !== "true";
    let measurements: Measurements | null = null;
    let frame = 0;
    let readinessFrame = 0;

    const setSourceVisibility = (visible: boolean) => {
      const visibility = visible ? "visible" : "hidden";
      sourceIcon.style.visibility = visibility;
      sourceLabel.style.visibility = visibility;
      sourceRange.style.visibility = visibility;
    };
    const setLayerVisibility = (visible: boolean) => {
      layer.style.opacity = visible ? "1" : "0";
    };
    const readTextStyle = (element: HTMLElement): TextStyle => {
      const style = getComputedStyle(element);
      return {
        fontSize: parseFloat(style.fontSize),
        fontWeight: parseFloat(style.fontWeight),
        color: parseColor(style.color),
      };
    };
    const writeIcon = (x: number, y: number, scale: number) => {
      sharedIcon.style.transform = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) scale(${scale.toFixed(5)})`;
    };
    const writeText = (
      element: HTMLElement,
      x: number,
      y: number,
      fontSize: number,
      lineHeight: number,
      fontWeight: number,
      color: string,
    ) => {
      element.style.left = `${x.toFixed(3)}px`;
      element.style.top = `${y.toFixed(3)}px`;
      element.style.fontSize = `${fontSize.toFixed(3)}px`;
      element.style.lineHeight = `${lineHeight.toFixed(3)}px`;
      element.style.fontWeight = fontWeight.toFixed(1);
      element.style.color = color;
    };

    const update = () => {
      frame = 0;
      if (!measurements) return;
      const scrollTop = getScrollTop();
      const collapseDistance = getCollapseDistance();
      const progress = clamp(scrollTop / collapseDistance);
      const condensed = progress >= RANKING_HEADER_CONDENSED_THRESHOLD;
      scroller.style.setProperty("--ranking-header-collapse", progress.toFixed(4));
      scroller.dataset.rankingHeaderCondensed = condensed ? "true" : "false";

      const targetIconY = measurements.scrollerTop
        + (measurements.compactHeight - measurements.targetIcon.height) / 2;
      const targetLabelY = measurements.scrollerTop
        + (measurements.compactHeight - measurements.targetLabel.height) / 2;
      const targetRangeY = measurements.scrollerTop
        + (measurements.compactHeight - measurements.targetRange.height) / 2;
      const iconScale = measurements.targetIcon.width / measurements.sourceIcon.width;

      if (reducedMotion.matches) {
        setSourceVisibility(!condensed);
        setLayerVisibility(condensed);
        if (!condensed) return;
        writeIcon(measurements.targetIcon.left, targetIconY, iconScale);
        writeText(
          sharedLabel,
          measurements.targetLabel.left,
          targetLabelY,
          measurements.targetLabelStyle.fontSize,
          measurements.targetLabel.height,
          measurements.targetLabelStyle.fontWeight,
          mixColor(
            measurements.sourceLabelStyle.color,
            measurements.targetLabelStyle.color,
            1,
          ),
        );
        writeText(
          sharedRange,
          measurements.targetRange.left,
          targetRangeY,
          measurements.targetRangeStyle.fontSize,
          measurements.targetRange.height,
          measurements.targetRangeStyle.fontWeight,
          mixColor(
            measurements.sourceRangeStyle.color,
            measurements.targetRangeStyle.color,
            1,
          ),
        );
        return;
      }

      const travelProgress = smoothstep(clamp(
        (progress - 0.08) / (RANKING_HEADER_CONDENSED_THRESHOLD - 0.08),
      ));
      const naturalOffset = Math.min(scrollTop, collapseDistance * 0.08);
      setSourceVisibility(false);
      setLayerVisibility(true);
      writeIcon(
        mix(measurements.sourceIcon.left, measurements.targetIcon.left, travelProgress),
        mix(measurements.sourceIcon.top - naturalOffset, targetIconY, travelProgress),
        mix(1, iconScale, travelProgress),
      );
      writeText(
        sharedLabel,
        mix(measurements.sourceLabel.left, measurements.targetLabel.left, travelProgress),
        mix(measurements.sourceLabel.top - naturalOffset, targetLabelY, travelProgress),
        mix(
          measurements.sourceLabelStyle.fontSize,
          measurements.targetLabelStyle.fontSize,
          travelProgress,
        ),
        mix(measurements.sourceLabel.height, measurements.targetLabel.height, travelProgress),
        mix(
          measurements.sourceLabelStyle.fontWeight,
          measurements.targetLabelStyle.fontWeight,
          travelProgress,
        ),
        mixColor(
          measurements.sourceLabelStyle.color,
          measurements.targetLabelStyle.color,
          travelProgress,
        ),
      );
      writeText(
        sharedRange,
        mix(measurements.sourceRange.left, measurements.targetRange.left, travelProgress),
        mix(measurements.sourceRange.top - naturalOffset, targetRangeY, travelProgress),
        mix(
          measurements.sourceRangeStyle.fontSize,
          measurements.targetRangeStyle.fontSize,
          travelProgress,
        ),
        mix(measurements.sourceRange.height, measurements.targetRange.height, travelProgress),
        mix(
          measurements.sourceRangeStyle.fontWeight,
          measurements.targetRangeStyle.fontWeight,
          travelProgress,
        ),
        mixColor(
          measurements.sourceRangeStyle.color,
          measurements.targetRangeStyle.color,
          travelProgress,
        ),
      );
    };

    const measure = () => {
      if (!sharedReady) {
        setSourceVisibility(true);
        setLayerVisibility(false);
        return;
      }
      const savedProgress = scroller.style.getPropertyValue("--ranking-header-collapse");
      const scrollTop = getScrollTop();
      const scrollerRect = scroller.getBoundingClientRect();
      const compactBar = targetIcon.closest<HTMLElement>(".ranking-compact-bar");
      scroller.style.setProperty("--ranking-header-collapse", "0");
      const sourceIconRect = sourceIcon.getBoundingClientRect();
      const sourceLabelRect = sourceLabel.getBoundingClientRect();
      const sourceRangeRect = sourceRange.getBoundingClientRect();
      measurements = {
        sourceIcon: DOMRect.fromRect({
          x: sourceIconRect.left,
          y: sourceIconRect.top + scrollTop,
          width: sourceIconRect.width,
          height: sourceIconRect.height,
        }),
        sourceLabel: DOMRect.fromRect({
          x: sourceLabelRect.left,
          y: sourceLabelRect.top + scrollTop,
          width: sourceLabelRect.width,
          height: sourceLabelRect.height,
        }),
        sourceRange: DOMRect.fromRect({
          x: sourceRangeRect.left,
          y: sourceRangeRect.top + scrollTop,
          width: sourceRangeRect.width,
          height: sourceRangeRect.height,
        }),
        targetIcon: targetIcon.getBoundingClientRect(),
        targetLabel: targetLabel.getBoundingClientRect(),
        targetRange: targetRange.getBoundingClientRect(),
        sourceLabelStyle: readTextStyle(sourceLabel),
        sourceRangeStyle: readTextStyle(sourceRange),
        targetLabelStyle: readTextStyle(targetLabel),
        targetRangeStyle: readTextStyle(targetRange),
        scrollerTop: containerScrolls() ? scrollerRect.top : scrollerRect.top + scrollTop,
        compactHeight: compactBar?.offsetHeight ?? 56,
      };
      scroller.style.setProperty("--ranking-header-collapse", savedProgress || "0");
      sharedIcon.style.width = `${measurements.sourceIcon.width}px`;
      sharedIcon.style.height = `${measurements.sourceIcon.height}px`;
      sharedLabel.style.fontFamily = getComputedStyle(sourceLabel).fontFamily;
      sharedLabel.style.letterSpacing = getComputedStyle(sourceLabel).letterSpacing;
      sharedRange.style.fontFamily = getComputedStyle(sourceRange).fontFamily;
      sharedRange.style.letterSpacing = getComputedStyle(sourceRange).letterSpacing;
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
      const stageStyle = getComputedStyle(pageStage);
      const positionSettled = stageStyle.transform === "none"
        || stageStyle.transform === "matrix(1, 0, 0, 1, 0, 0)";
      const opacitySettled = Number.parseFloat(stageStyle.opacity) >= 0.999;
      if (positionSettled && opacitySettled) {
        pageStage.dataset.pageTransitioning = "false";
        handlePageTransitionComplete();
        return;
      }
      readinessFrame = window.requestAnimationFrame(checkPageTransitionReady);
    };

    const resizeObserver = new ResizeObserver(requestMeasure);
    [
      scroller,
      sourceIcon,
      sourceLabel,
      sourceRange,
      targetIcon,
      targetLabel,
      targetRange,
    ].forEach((element) => resizeObserver.observe(element));
    scroller.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestMeasure);
    reducedMotion.addEventListener("change", requestMeasure);
    mobileViewport.addEventListener("change", requestMeasure);
    pageStage?.addEventListener(
      "kinetic-page-transition-complete",
      handlePageTransitionComplete,
    );
    document.fonts.ready.then(requestMeasure).catch(() => undefined);
    requestMeasure();
    if (!sharedReady) readinessFrame = window.requestAnimationFrame(checkPageTransitionReady);

    return () => {
      resizeObserver.disconnect();
      scroller.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestMeasure);
      reducedMotion.removeEventListener("change", requestMeasure);
      mobileViewport.removeEventListener("change", requestMeasure);
      pageStage?.removeEventListener(
        "kinetic-page-transition-complete",
        handlePageTransitionComplete,
      );
      if (frame) window.cancelAnimationFrame(frame);
      if (readinessFrame) window.cancelAnimationFrame(readinessFrame);
      setSourceVisibility(true);
      setLayerVisibility(false);
      scroller.style.setProperty("--ranking-header-collapse", "0");
      scroller.dataset.rankingHeaderCondensed = "false";
    };
  }, [
    scrollerRef,
    sourceIconRef,
    sourceLabelRef,
    sourceRangeRef,
    targetIconRef,
    targetLabelRef,
    targetRangeRef,
  ]);

  return (
    <div ref={layerRef} className="ranking-shared-layer">
      <span ref={iconRef} className="ranking-shared-icon" aria-hidden="true">
        <KineticIcon kind="ranking" active size={28} />
      </span>
      <strong ref={labelRef} className="ranking-shared-label" aria-hidden="true">
        好友排行
      </strong>
      <strong ref={rangeRef} className="ranking-shared-range" aria-hidden="true">
        近 8 周
      </strong>
    </div>
  );
}

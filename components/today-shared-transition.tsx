"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { TrainingStatusMark } from "@/components/track-visuals";

type TodaySharedTransitionProps = {
  dateLabel: string;
  planName: string;
  planLetter: string | null;
  scrollerRef: RefObject<HTMLDivElement | null>;
  sourceDateRef: RefObject<HTMLTimeElement | null>;
  sourceIconRef: RefObject<HTMLDivElement | null>;
  sourceTitleRef: RefObject<HTMLSpanElement | null>;
  targetIconRef: RefObject<HTMLSpanElement | null>;
  targetPrefixRef: RefObject<HTMLSpanElement | null>;
  targetTitleRef: RefObject<HTMLSpanElement | null>;
};

type SharedMeasurements = {
  sourceScrollTop: number;
  sourceDate: DOMRect;
  sourceIcon: DOMRect;
  sourceTitle: DOMRect;
  targetIcon: DOMRect;
  targetPrefix: DOMRect;
  targetTitle: DOMRect;
  sourceDateFontSize: number;
  targetDateFontSize: number;
  sourceDateFontWeight: number;
  targetDateFontWeight: number;
  sourceDateColor: [number, number, number];
  targetDateColor: [number, number, number];
  sourceTitleFontSize: number;
  targetTitleFontSize: number;
  sourceTitleFontWeight: number;
  targetTitleFontWeight: number;
  scrollerTop: number;
  compactHeight: number;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const smoothstep = (progress: number) => progress * progress * (3 - 2 * progress);
const parseColor = (color: string): [number, number, number] => {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  return channels?.length === 3 ? [channels[0], channels[1], channels[2]] : [255, 255, 255];
};
const mixColor = (from: [number, number, number], to: [number, number, number], progress: number) => `rgb(${from.map((channel, index) => Math.round(mix(channel, to[index], progress))).join(", ")})`;

export function TodaySharedTransition({
  dateLabel,
  planName,
  planLetter,
  scrollerRef,
  sourceDateRef,
  sourceIconRef,
  sourceTitleRef,
  targetIconRef,
  targetPrefixRef,
  targetTitleRef,
}: TodaySharedTransitionProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const prefixRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const sourceDate = sourceDateRef.current;
    const sourceIcon = sourceIconRef.current;
    const sourceTitle = sourceTitleRef.current;
    const targetIcon = targetIconRef.current;
    const targetPrefix = targetPrefixRef.current;
    const targetTitle = targetTitleRef.current;
    const layer = layerRef.current;
    const sharedIcon = iconRef.current;
    const sharedPrefix = prefixRef.current;
    const sharedTitle = titleRef.current;
    if (!scroller || !sourceDate || !sourceIcon || !sourceTitle || !targetIcon || !targetPrefix || !targetTitle || !layer || !sharedIcon || !sharedPrefix || !sharedTitle) return;

    const pageStage = sourceIcon.closest<HTMLElement>(".kinetic-page-stage");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const collapseDistance = 160;
    const containerScrolls = () => getComputedStyle(scroller).overflowY !== "visible";
    const getScrollTop = () => containerScrolls() ? scroller.scrollTop : window.scrollY;
    let sharedReady = pageStage?.dataset.pageTransitioning !== "true";
    let measurements: SharedMeasurements | null = null;
    let frame = 0;
    let readinessFrame = 0;

    const setSourceVisibility = (visible: boolean) => {
      sourceDate.style.visibility = visible ? "visible" : "hidden";
      sourceIcon.style.visibility = visible ? "visible" : "hidden";
      sourceTitle.style.opacity = visible ? "1" : "0";
    };

    const measure = () => {
      if (!sharedReady) {
        setSourceVisibility(true);
        layer.style.opacity = "0";
        sharedPrefix.style.opacity = "0";
        return;
      }
      const compactBar = targetIcon.closest<HTMLElement>(".today-compact-bar");
      const scrollerRect = scroller.getBoundingClientRect();
      const sourceDateStyle = getComputedStyle(sourceDate);
      const sourceTitleStyle = getComputedStyle(sourceTitle);
      const targetPrefixStyle = getComputedStyle(targetPrefix);
      const targetTitleStyle = getComputedStyle(targetTitle);
      const savedProgress = scroller.style.getPropertyValue("--header-collapse");
      const scrollTop = getScrollTop();
      scroller.style.setProperty("--header-collapse", "0");
      const currentDateRect = sourceDate.getBoundingClientRect();
      const currentIconRect = sourceIcon.getBoundingClientRect();
      const currentTitleRect = sourceTitle.getBoundingClientRect();
      const sourceDateRect = DOMRect.fromRect({ x: currentDateRect.left, y: currentDateRect.top + scrollTop, width: currentDateRect.width, height: currentDateRect.height });
      const sourceIconRect = DOMRect.fromRect({ x: currentIconRect.left, y: currentIconRect.top + scrollTop, width: currentIconRect.width, height: currentIconRect.height });
      const sourceTitleRect = DOMRect.fromRect({ x: currentTitleRect.left, y: currentTitleRect.top + scrollTop, width: currentTitleRect.width, height: currentTitleRect.height });
      const targetPrefixRect = targetPrefix.getBoundingClientRect();
      const targetTitleRect = targetTitle.getBoundingClientRect();
      scroller.style.setProperty("--header-collapse", savedProgress || "0");
      measurements = {
        sourceScrollTop: 0,
        sourceDate: sourceDateRect,
        sourceIcon: sourceIconRect,
        sourceTitle: sourceTitleRect,
        targetIcon: targetIcon.getBoundingClientRect(),
        targetPrefix: targetPrefixRect,
        targetTitle: targetTitleRect,
        sourceDateFontSize: parseFloat(sourceDateStyle.fontSize),
        targetDateFontSize: parseFloat(targetPrefixStyle.fontSize),
        sourceDateFontWeight: parseFloat(sourceDateStyle.fontWeight),
        targetDateFontWeight: parseFloat(targetTitleStyle.fontWeight),
        sourceDateColor: parseColor(sourceDateStyle.color),
        targetDateColor: parseColor(targetTitleStyle.color),
        sourceTitleFontSize: parseFloat(sourceTitleStyle.fontSize),
        targetTitleFontSize: parseFloat(targetTitleStyle.fontSize),
        sourceTitleFontWeight: parseFloat(sourceTitleStyle.fontWeight),
        targetTitleFontWeight: parseFloat(targetTitleStyle.fontWeight),
        scrollerTop: containerScrolls() ? scrollerRect.top : scrollerRect.top + scrollTop,
        compactHeight: compactBar?.offsetHeight ?? 56,
      };
      sharedIcon.style.width = `${measurements.sourceIcon.width}px`;
      sharedIcon.style.height = `${measurements.sourceIcon.height}px`;
      sharedPrefix.style.font = sourceDateStyle.font;
      sharedPrefix.style.fontFamily = sourceDateStyle.fontFamily;
      sharedPrefix.style.fontSize = sourceDateStyle.fontSize;
      sharedPrefix.style.fontWeight = sourceDateStyle.fontWeight;
      sharedPrefix.style.letterSpacing = sourceDateStyle.letterSpacing;
      sharedPrefix.style.lineHeight = sourceDateStyle.lineHeight;
      sharedTitle.style.font = sourceTitleStyle.font;
      sharedTitle.style.fontFamily = sourceTitleStyle.fontFamily;
      sharedTitle.style.fontSize = sourceTitleStyle.fontSize;
      sharedTitle.style.fontWeight = sourceTitleStyle.fontWeight;
      sharedTitle.style.letterSpacing = sourceTitleStyle.letterSpacing;
      sharedTitle.style.lineHeight = sourceTitleStyle.lineHeight;
      update();
    };

    const writeIconTransform = (element: HTMLElement, x: number, y: number, scale: number) => {
      element.style.transform = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) scale(${scale.toFixed(5)})`;
    };
    const writeTextLayout = (element: HTMLElement, x: number, y: number, fontSize: number, lineHeight: number, fontWeight: number) => {
      element.style.left = `${x.toFixed(3)}px`;
      element.style.top = `${y.toFixed(3)}px`;
      element.style.fontSize = `${fontSize.toFixed(3)}px`;
      element.style.lineHeight = `${lineHeight.toFixed(3)}px`;
      element.style.fontWeight = fontWeight.toFixed(1);
      element.style.transform = "none";
    };

    const update = () => {
      frame = 0;
      if (!measurements) return;
      const scrollTop = getScrollTop();
      const progress = clamp(scrollTop / collapseDistance);
      const condensed = progress >= 0.72;
      scroller.style.setProperty("--header-collapse", progress.toFixed(4));
      scroller.dataset.headerCondensed = condensed ? "true" : "false";

      const targetIconY = measurements.scrollerTop + (measurements.compactHeight - measurements.targetIcon.height) / 2;
      const targetPrefixY = measurements.scrollerTop + (measurements.compactHeight - measurements.targetPrefix.height) / 2;
      const targetTitleY = measurements.scrollerTop + (measurements.compactHeight - measurements.targetTitle.height) / 2;
      const iconScale = measurements.targetIcon.width / measurements.sourceIcon.width;

      if (reducedMotion.matches) {
        setSourceVisibility(!condensed);
        layer.style.opacity = condensed ? "1" : "0";
        writeIconTransform(sharedIcon, measurements.targetIcon.left, targetIconY, iconScale);
        writeTextLayout(sharedPrefix, measurements.targetPrefix.left, targetPrefixY, measurements.targetDateFontSize, measurements.targetPrefix.height, measurements.targetDateFontWeight);
        sharedPrefix.style.color = mixColor(measurements.sourceDateColor, measurements.targetDateColor, condensed ? 1 : 0);
        writeTextLayout(sharedTitle, measurements.targetTitle.left, targetTitleY, measurements.targetTitleFontSize, measurements.targetTitle.height, measurements.targetTitleFontWeight);
        sharedPrefix.style.opacity = condensed ? "1" : "0";
        return;
      }

      const travelProgress = smoothstep(clamp((progress - 0.12) / 0.66));
      const naturalOffset = Math.min(scrollTop - measurements.sourceScrollTop, collapseDistance * 0.12);
      const dateStartY = measurements.sourceDate.top - naturalOffset;
      const iconStartY = measurements.sourceIcon.top - naturalOffset;
      const titleStartY = measurements.sourceTitle.top - naturalOffset;
      const dateX = mix(measurements.sourceDate.left, measurements.targetPrefix.left, travelProgress);
      const dateY = mix(dateStartY, targetPrefixY, travelProgress);
      const iconX = mix(measurements.sourceIcon.left, measurements.targetIcon.left, travelProgress);
      const iconY = mix(iconStartY, targetIconY, travelProgress);
      const titleX = mix(measurements.sourceTitle.left, measurements.targetTitle.left, travelProgress);
      const titleY = mix(titleStartY, targetTitleY, travelProgress);

      setSourceVisibility(false);
      layer.style.opacity = "1";
      writeTextLayout(sharedPrefix, dateX, dateY, mix(measurements.sourceDateFontSize, measurements.targetDateFontSize, travelProgress), mix(measurements.sourceDate.height, measurements.targetPrefix.height, travelProgress), mix(measurements.sourceDateFontWeight, measurements.targetDateFontWeight, travelProgress));
      sharedPrefix.style.color = mixColor(measurements.sourceDateColor, measurements.targetDateColor, travelProgress);
      writeIconTransform(sharedIcon, iconX, iconY, mix(1, iconScale, travelProgress));
      writeTextLayout(sharedTitle, titleX, titleY, mix(measurements.sourceTitleFontSize, measurements.targetTitleFontSize, travelProgress), mix(measurements.sourceTitle.height, measurements.targetTitle.height, travelProgress), mix(measurements.sourceTitleFontWeight, measurements.targetTitleFontWeight, travelProgress));
      sharedPrefix.style.opacity = "1";
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
      const stageTransform = stageStyle.transform;
      const positionSettled = stageTransform === "none" || stageTransform === "matrix(1, 0, 0, 1, 0, 0)";
      const opacitySettled = Number.parseFloat(stageStyle.opacity) >= 0.999;
      if (positionSettled && opacitySettled) {
        pageStage.dataset.pageTransitioning = "false";
        handlePageTransitionComplete();
        return;
      }
      readinessFrame = window.requestAnimationFrame(checkPageTransitionReady);
    };

    const resizeObserver = new ResizeObserver(requestMeasure);
    resizeObserver.observe(scroller);
    resizeObserver.observe(sourceDate);
    resizeObserver.observe(sourceIcon);
    resizeObserver.observe(sourceTitle);
    resizeObserver.observe(targetIcon);
    resizeObserver.observe(targetTitle);
    scroller.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestMeasure);
    reducedMotion.addEventListener("change", requestMeasure);
    pageStage?.addEventListener("kinetic-page-transition-complete", handlePageTransitionComplete);
    document.fonts.ready.then(requestMeasure).catch(() => undefined);
    requestMeasure();
    if (!sharedReady) readinessFrame = window.requestAnimationFrame(checkPageTransitionReady);

    return () => {
      resizeObserver.disconnect();
      scroller.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestMeasure);
      reducedMotion.removeEventListener("change", requestMeasure);
      pageStage?.removeEventListener("kinetic-page-transition-complete", handlePageTransitionComplete);
      if (frame) window.cancelAnimationFrame(frame);
      if (readinessFrame) window.cancelAnimationFrame(readinessFrame);
      setSourceVisibility(true);
      scroller.style.setProperty("--header-collapse", "0");
      scroller.dataset.headerCondensed = "false";
    };
  }, [dateLabel, planLetter, planName, scrollerRef, sourceDateRef, sourceIconRef, sourceTitleRef, targetIconRef, targetPrefixRef, targetTitleRef]);

  return (
    <div ref={layerRef} className="today-shared-layer" aria-hidden="true">
      <div ref={iconRef} className="today-shared-icon"><TrainingStatusMark planLetter={planLetter} /></div>
      <span ref={prefixRef} className="today-shared-prefix">{dateLabel}</span>
      <strong ref={titleRef} className="today-shared-title">{planName}</strong>
    </div>
  );
}

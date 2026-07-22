"use client";

import { Settings } from "lucide-react";
import { useLayoutEffect, useRef, type RefObject } from "react";

type ProfileSharedTransitionProps = {
  initials: string;
  scrollerRef: RefObject<HTMLDivElement | null>;
  sourceAvatarRef: RefObject<HTMLSpanElement | null>;
  sourceTitleRef: RefObject<HTMLHeadingElement | null>;
  sourceSettingsRef: RefObject<HTMLSpanElement | null>;
  targetAvatarRef: RefObject<HTMLSpanElement | null>;
  targetTitleRef: RefObject<HTMLSpanElement | null>;
  targetSettingsRef: RefObject<HTMLSpanElement | null>;
  suspended: boolean;
  onAccount: () => void;
};

type Measurements = {
  sourceAvatar: DOMRect;
  sourceTitle: DOMRect;
  sourceSettings: DOMRect;
  targetAvatar: DOMRect;
  targetTitle: DOMRect;
  targetSettings: DOMRect;
  sourceTitleFontSize: number;
  sourceTitleFontWeight: number;
  targetTitleFontSize: number;
  targetTitleFontWeight: number;
  scrollerTop: number;
  compactHeight: number;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const smoothstep = (progress: number) => progress * progress * (3 - 2 * progress);

export function ProfileSharedTransition({
  initials,
  scrollerRef,
  sourceAvatarRef,
  sourceTitleRef,
  sourceSettingsRef,
  targetAvatarRef,
  targetTitleRef,
  targetSettingsRef,
  suspended,
  onAccount,
}: ProfileSharedTransitionProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLElement>(null);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const onAccountRef = useRef(onAccount);

  useLayoutEffect(() => {
    onAccountRef.current = onAccount;
  }, [onAccount]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const sourceAvatar = sourceAvatarRef.current;
    const sourceTitle = sourceTitleRef.current;
    const sourceSettings = sourceSettingsRef.current;
    const targetAvatar = targetAvatarRef.current;
    const targetTitle = targetTitleRef.current;
    const targetSettings = targetSettingsRef.current;
    const layer = layerRef.current;
    const sharedAvatar = avatarRef.current;
    const sharedTitle = titleRef.current;
    const sharedSettings = settingsRef.current;
    if (!scroller || !sourceAvatar || !sourceTitle || !sourceSettings || !targetAvatar || !targetTitle || !targetSettings || !layer || !sharedAvatar || !sharedTitle || !sharedSettings) return;

    const setSourceVisibility = (visible: boolean) => {
      sourceAvatar.style.visibility = visible ? "visible" : "hidden";
      sourceTitle.style.visibility = visible ? "visible" : "hidden";
      sourceSettings.style.visibility = visible ? "visible" : "hidden";
    };
    const setLayerVisibility = (visible: boolean) => {
      layer.style.opacity = visible ? "1" : "0";
      sharedSettings.style.pointerEvents = visible ? "auto" : "none";
    };

    if (suspended) {
      setSourceVisibility(true);
      setLayerVisibility(false);
      return;
    }

    const pageStage = sourceAvatar.closest<HTMLElement>(".kinetic-page-stage");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileViewport = window.matchMedia("(max-width: 760px)");
    const containerScrolls = () => getComputedStyle(scroller).overflowY !== "visible";
    const getScrollTop = () => containerScrolls() ? scroller.scrollTop : window.scrollY;
    const getCollapseDistance = () => mobileViewport.matches ? 132 : 150;
    let sharedReady = pageStage?.dataset.pageTransitioning !== "true";
    let measurements: Measurements | null = null;
    let frame = 0;
    let readinessFrame = 0;

    const writeAvatar = (x: number, y: number, scale: number) => {
      sharedAvatar.style.transform = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) scale(${scale.toFixed(5)})`;
    };
    const writeTitle = (x: number, y: number, fontSize: number, lineHeight: number, fontWeight: number) => {
      sharedTitle.style.left = `${x.toFixed(3)}px`;
      sharedTitle.style.top = `${y.toFixed(3)}px`;
      sharedTitle.style.fontSize = `${fontSize.toFixed(3)}px`;
      sharedTitle.style.lineHeight = `${lineHeight.toFixed(3)}px`;
      sharedTitle.style.fontWeight = fontWeight.toFixed(1);
    };
    const writeSettings = (x: number, y: number) => {
      sharedSettings.style.transform = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0)`;
    };

    const update = () => {
      frame = 0;
      if (!measurements) return;
      const scrollTop = getScrollTop();
      const collapseDistance = getCollapseDistance();
      const progress = clamp(scrollTop / collapseDistance);
      const condensed = progress >= 0.72;
      scroller.style.setProperty("--profile-header-collapse", progress.toFixed(4));
      scroller.dataset.profileHeaderCondensed = condensed ? "true" : "false";

      const avatarScale = measurements.targetAvatar.width / measurements.sourceAvatar.width;
      const targetAvatarY = measurements.scrollerTop + (measurements.compactHeight - measurements.targetAvatar.height) / 2;
      const targetTitleY = measurements.scrollerTop + (measurements.compactHeight - measurements.targetTitle.height) / 2;
      const targetSettingsY = measurements.scrollerTop + (measurements.compactHeight - measurements.targetSettings.height) / 2;
      if (reducedMotion.matches) {
        const targetState = condensed;
        setSourceVisibility(false);
        setLayerVisibility(true);
        writeAvatar(
          targetState ? measurements.targetAvatar.left : measurements.sourceAvatar.left,
          targetState ? targetAvatarY : measurements.sourceAvatar.top - scrollTop,
          targetState ? avatarScale : 1,
        );
        writeTitle(
          targetState ? measurements.targetTitle.left : measurements.sourceTitle.left,
          targetState ? targetTitleY : measurements.sourceTitle.top - scrollTop,
          targetState ? measurements.targetTitleFontSize : measurements.sourceTitleFontSize,
          targetState ? measurements.targetTitle.height : measurements.sourceTitle.height,
          targetState ? measurements.targetTitleFontWeight : measurements.sourceTitleFontWeight,
        );
        writeSettings(
          targetState ? measurements.targetSettings.left : measurements.sourceSettings.left,
          targetState ? targetSettingsY : measurements.sourceSettings.top - scrollTop,
        );
        return;
      }

      const travelProgress = smoothstep(clamp((progress - 0.1) / 0.68));
      const naturalOffset = Math.min(scrollTop, collapseDistance * 0.1);
      setSourceVisibility(false);
      setLayerVisibility(true);
      writeAvatar(
        mix(measurements.sourceAvatar.left, measurements.targetAvatar.left, travelProgress),
        mix(measurements.sourceAvatar.top - naturalOffset, targetAvatarY, travelProgress),
        mix(1, avatarScale, travelProgress),
      );
      writeTitle(
        mix(measurements.sourceTitle.left, measurements.targetTitle.left, travelProgress),
        mix(measurements.sourceTitle.top - naturalOffset, targetTitleY, travelProgress),
        mix(measurements.sourceTitleFontSize, measurements.targetTitleFontSize, travelProgress),
        mix(measurements.sourceTitle.height, measurements.targetTitle.height, travelProgress),
        mix(measurements.sourceTitleFontWeight, measurements.targetTitleFontWeight, travelProgress),
      );
      writeSettings(
        mix(measurements.sourceSettings.left, measurements.targetSettings.left, travelProgress),
        mix(measurements.sourceSettings.top - naturalOffset, targetSettingsY, travelProgress),
      );
    };

    const measure = () => {
      if (!sharedReady) {
        setSourceVisibility(true);
        setLayerVisibility(false);
        return;
      }
      const savedProgress = scroller.style.getPropertyValue("--profile-header-collapse");
      const scrollTop = getScrollTop();
      const scrollerRect = scroller.getBoundingClientRect();
      const compactBar = targetAvatar.closest<HTMLElement>(".profile-compact-bar");
      scroller.style.setProperty("--profile-header-collapse", "0");
      const sourceAvatarRect = sourceAvatar.getBoundingClientRect();
      const sourceTitleRect = sourceTitle.getBoundingClientRect();
      const sourceSettingsRect = sourceSettings.getBoundingClientRect();
      const sourceTitleStyle = getComputedStyle(sourceTitle);
      const targetTitleStyle = getComputedStyle(targetTitle);
      measurements = {
        sourceAvatar: DOMRect.fromRect({ x: sourceAvatarRect.left, y: sourceAvatarRect.top + scrollTop, width: sourceAvatarRect.width, height: sourceAvatarRect.height }),
        sourceTitle: DOMRect.fromRect({ x: sourceTitleRect.left, y: sourceTitleRect.top + scrollTop, width: sourceTitleRect.width, height: sourceTitleRect.height }),
        sourceSettings: DOMRect.fromRect({ x: sourceSettingsRect.left, y: sourceSettingsRect.top + scrollTop, width: sourceSettingsRect.width, height: sourceSettingsRect.height }),
        targetAvatar: targetAvatar.getBoundingClientRect(),
        targetTitle: targetTitle.getBoundingClientRect(),
        targetSettings: targetSettings.getBoundingClientRect(),
        sourceTitleFontSize: parseFloat(sourceTitleStyle.fontSize),
        sourceTitleFontWeight: parseFloat(sourceTitleStyle.fontWeight),
        targetTitleFontSize: parseFloat(targetTitleStyle.fontSize),
        targetTitleFontWeight: parseFloat(targetTitleStyle.fontWeight),
        scrollerTop: containerScrolls() ? scrollerRect.top : scrollerRect.top + scrollTop,
        compactHeight: compactBar?.offsetHeight ?? 56,
      };
      scroller.style.setProperty("--profile-header-collapse", savedProgress || "0");
      sharedAvatar.style.width = `${measurements.sourceAvatar.width}px`;
      sharedAvatar.style.height = `${measurements.sourceAvatar.height}px`;
      sharedAvatar.style.fontFamily = getComputedStyle(sourceAvatar).fontFamily;
      sharedAvatar.style.fontSize = getComputedStyle(sourceAvatar).fontSize;
      sharedAvatar.style.fontWeight = getComputedStyle(sourceAvatar).fontWeight;
      sharedTitle.style.fontFamily = sourceTitleStyle.fontFamily;
      sharedTitle.style.letterSpacing = sourceTitleStyle.letterSpacing;
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
      const positionSettled = stageStyle.transform === "none" || stageStyle.transform === "matrix(1, 0, 0, 1, 0, 0)";
      if (positionSettled && Number.parseFloat(stageStyle.opacity) >= 0.999) {
        pageStage.dataset.pageTransitioning = "false";
        handlePageTransitionComplete();
        return;
      }
      readinessFrame = window.requestAnimationFrame(checkPageTransitionReady);
    };

    const resizeObserver = new ResizeObserver(requestMeasure);
    resizeObserver.observe(scroller);
    resizeObserver.observe(sourceAvatar);
    resizeObserver.observe(sourceTitle);
    resizeObserver.observe(sourceSettings);
    resizeObserver.observe(targetAvatar);
    resizeObserver.observe(targetTitle);
    resizeObserver.observe(targetSettings);
    scroller.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestMeasure);
    reducedMotion.addEventListener("change", requestMeasure);
    mobileViewport.addEventListener("change", requestMeasure);
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
      mobileViewport.removeEventListener("change", requestMeasure);
      pageStage?.removeEventListener("kinetic-page-transition-complete", handlePageTransitionComplete);
      if (frame) window.cancelAnimationFrame(frame);
      if (readinessFrame) window.cancelAnimationFrame(readinessFrame);
      setSourceVisibility(true);
      setLayerVisibility(false);
      scroller.style.setProperty("--profile-header-collapse", "0");
      scroller.dataset.profileHeaderCondensed = "false";
    };
  }, [initials, scrollerRef, sourceAvatarRef, sourceSettingsRef, sourceTitleRef, suspended, targetAvatarRef, targetSettingsRef, targetTitleRef]);

  return (
    <div ref={layerRef} className="profile-shared-layer">
      <span ref={avatarRef} className="profile-shared-avatar" aria-hidden="true">{initials}</span>
      <strong ref={titleRef} className="profile-shared-title" aria-hidden="true">我的训练</strong>
      <button ref={settingsRef} type="button" className="profile-shared-settings" onClick={() => onAccountRef.current()} aria-label="打开个人档案与账号设置"><Settings size={18} /></button>
    </div>
  );
}

"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { createPortal } from "react-dom";

type Props = {
  enabled: boolean;
  exerciseCount: number;
  onChange: (enabled: boolean) => void;
  actionRef?: RefObject<HTMLButtonElement | null>;
  compact?: boolean;
  tabIndex?: number;
};

export function TrainingDayStatusControl({ enabled, exerciseCount, onChange, actionRef, compact = false, tabIndex }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const pointerRef = useRef({ x: 0, y: 0, moved: false });

  useEffect(() => {
    if (!confirmOpen) return;
    const trigger = triggerRef.current;
    const focusFrame = window.requestAnimationFrame(() => confirmRef.current?.focus({ preventScroll: true }));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirmOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const first = cancelRef.current;
      const last = confirmRef.current;
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus({ preventScroll: true });
    };
  }, [confirmOpen]);

  function beginPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    pointerRef.current = { x: event.clientX, y: event.clientY, moved: false };
  }

  function movePointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const pointer = pointerRef.current;
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8) pointer.moved = true;
  }

  function toggle(event: ReactMouseEvent<HTMLButtonElement>) {
    if (pointerRef.current.moved) {
      event.preventDefault();
      pointerRef.current.moved = false;
      return;
    }
    if (!enabled) {
      onChange(true);
      return;
    }
    if (exerciseCount === 0) {
      onChange(false);
      return;
    }
    setConfirmOpen(true);
  }

  function confirmRestDay() {
    onChange(false);
    setConfirmOpen(false);
  }

  const portal = typeof document === "undefined" ? null : createPortal(
    <AnimatePresence>
      {confirmOpen && <motion.div
        className="day-status-confirm-backdrop"
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) setConfirmOpen(false);
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : .16 }}
      >
        <motion.section
          className="day-status-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
          transition={{ duration: reducedMotion ? 0 : .16, ease: [0.25, 1, 0.5, 1] }}
        >
          <h2 id={titleId}>设为休息日？</h2>
          <p id={descriptionId}>已配置的 {exerciseCount} 个动作会保留，重新启用训练日后仍可继续使用。</p>
          <div className="day-status-confirm-actions">
            <button ref={cancelRef} type="button" className="secondary-action" onClick={() => setConfirmOpen(false)}>取消</button>
            <button ref={confirmRef} type="button" className="primary-action" onClick={confirmRestDay}>设为休息日</button>
          </div>
        </motion.section>
      </motion.div>}
    </AnimatePresence>,
    document.body,
  );

  return <>
    <section className={`day-status-control ${compact ? "is-compact" : ""} ${enabled ? "is-enabled" : "is-rest"}`.trim()} aria-label="当天安排状态">
      {!compact && <span className="day-status-caption">当天安排</span>}
      <button
        ref={(node) => {
          triggerRef.current = node;
          if (actionRef) actionRef.current = node;
        }}
        type="button"
        className="day-status-action"
        role="switch"
        aria-checked={enabled}
        aria-label={`当天安排：${enabled ? "训练日" : "休息日"}`}
        tabIndex={tabIndex}
        onPointerDown={beginPointer}
        onPointerMove={movePointer}
        onPointerCancel={() => { pointerRef.current.moved = true; }}
        onClick={toggle}
      >
        <span className="day-status-label">{enabled ? "训练日" : "休息日"}</span>
        <span className="day-status-track" aria-hidden="true"><i className="day-status-thumb" /></span>
      </button>
      {!compact && !enabled && exerciseCount > 0 && <span className="day-status-retained">已保留 {exerciseCount} 个动作</span>}
    </section>
    {portal}
  </>;
}

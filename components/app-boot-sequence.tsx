"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TrackMark } from "@/components/track-visuals";

export type BootPhase = "checking" | "syncing" | "ready" | "error";

type AppBootSequenceProps = {
  phase: BootPhase;
  error?: string | null;
  onRetry: () => void;
  onFinished: () => void;
};

const phaseCopy: Record<Exclude<BootPhase, "error">, { title: string; detail: string }> = {
  checking: { title: "正在校准训练空间", detail: "检查账号与私人训练轨迹" },
  syncing: { title: "正在同步训练轨迹", detail: "装载计划、记录与未完成训练" },
  ready: { title: "动能轨道已锁定", detail: "准备进入今天的训练节奏" },
};

const dust = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  x: ((index * 37) % 100) - 50,
  y: ((index * 61) % 72) - 36,
  delay: (index % 7) * 0.055,
}));

type FlightTarget = { x: number; y: number; scale: number };

function flightPoint(progress: number, target: FlightTarget) {
  const t = Math.max(0, Math.min(1, progress));
  const length = Math.max(1, Math.hypot(target.x, target.y));
  const normalX = -target.y / length;
  const normalY = target.x / length;
  const bend = Math.min(160, length * 0.24);
  const controlOne = { x: target.x * 0.18 + normalX * bend, y: target.y * 0.18 + normalY * bend };
  const controlTwo = { x: target.x * 0.72 + normalX * bend * 0.52, y: target.y * 0.72 + normalY * bend * 0.52 };
  const inverse = 1 - t;
  return {
    x: 3 * inverse * inverse * t * controlOne.x + 3 * inverse * t * t * controlTwo.x + t * t * t * target.x,
    y: 3 * inverse * inverse * t * controlOne.y + 3 * inverse * t * t * controlTwo.y + t * t * t * target.y,
  };
}

export function AppBootSequence({ phase, error, onRetry, onFinished }: AppBootSequenceProps) {
  const reducedMotion = useReducedMotion();
  const flyingMarkRef = useRef<HTMLDivElement>(null);
  const flightTargetRef = useRef<FlightTarget>({ x: 0, y: 0, scale: 0.28 });
  const flightProgress = useMotionValue(0);
  const flightX = useTransform(flightProgress, (progress) => flightPoint(progress, flightTargetRef.current).x);
  const flightY = useTransform(flightProgress, (progress) => flightPoint(progress, flightTargetRef.current).y);
  const flightScale = useTransform(flightProgress, (progress) => {
    const t = Math.max(0, Math.min(1, progress));
    const eased = t * t * (3 - 2 * t);
    return 1 - (1 - flightTargetRef.current.scale) * eased;
  });
  const flightRotate = useTransform(flightProgress, (progress) => {
    const direction = flightTargetRef.current.x < 0 ? -1 : 1;
    return Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI) * 5.5 * direction;
  });
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const lockTimer = window.setTimeout(() => setLocked(true), reducedMotion ? 0 : 1320);
    const minimumTimer = window.setTimeout(() => setMinimumElapsed(true), reducedMotion ? 0 : 1750);
    return () => {
      window.clearTimeout(lockTimer);
      window.clearTimeout(minimumTimer);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (phase !== "ready" || !(minimumElapsed || reducedMotion)) return;
    const exitTimer = window.setTimeout(() => {
      if (!reducedMotion && flyingMarkRef.current) {
        const candidates = [
          document.querySelector<SVGElement>(".sidebar .brand-symbol"),
          document.querySelector<SVGElement>(".mobile-nav .nav-button.is-active .kinetic-icon"),
          document.querySelector<SVGElement>(".account-dialog .brand-symbol"),
        ];
        const target = candidates.find((element) => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== "hidden";
        });
        if (target) {
          const sourceRect = flyingMarkRef.current.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          flightTargetRef.current = {
            x: targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2),
            y: targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2),
            scale: Math.max(0.18, Math.min(0.38, targetRect.width / sourceRect.width)),
          };
        }
        window.dispatchEvent(new Event("kinetic-flight-start"));
      }
      setExiting(true);
    }, 0);
    const finishTimer = window.setTimeout(onFinished, reducedMotion ? 140 : 900);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
    };
  }, [minimumElapsed, onFinished, phase, reducedMotion]);

  useEffect(() => {
    if (!exiting || reducedMotion) return;
    flightProgress.set(0);
    const playback = animate(flightProgress, 1, {
      type: "tween",
      duration: 0.72,
      ease: [0.45, 0, 0.15, 1],
    });
    return () => playback.stop();
  }, [exiting, flightProgress, reducedMotion]);

  useEffect(() => () => {
    window.dispatchEvent(new Event("kinetic-flight-end"));
  }, []);

  const visuallyLocked = locked;

  const copy = phase === "error"
    ? { title: "同步轨迹在这里中断", detail: error || "训练数据暂时无法读取" }
    : phaseCopy[phase];

  return (
    <motion.div
      className={`boot-sequence overdrive-boot phase-${phase} ${visuallyLocked ? "is-locked" : ""} ${exiting ? "is-exiting" : ""}`}
      role={phase === "error" ? "alert" : "status"}
      aria-live="polite"
      data-testid="boot-sequence"
      data-phase={phase}
      initial={{ opacity: 1 }}
      animate={exiting && reducedMotion ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: reducedMotion ? 0.12 : 0, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="boot-space" aria-hidden="true">
        <div className="boot-grid" />
        <motion.div
          className="boot-reactor-flare"
          initial={{ opacity: 0, scale: 0.12 }}
          animate={phase === "error"
            ? { opacity: 0.08, scale: 0.72 }
            : { opacity: [0, 0.34, 0.12], scale: [0.12, 1.08, 0.86] }}
          transition={{ delay: 0.36, duration: 1.08, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.div
          className="boot-scan-slice"
          initial={{ x: "-55vw", opacity: 0 }}
          animate={{ x: "55vw", opacity: [0, 1, 0] }}
          transition={{ delay: 0.48, duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.div
          className="boot-energy-rail rail-a"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.div
          className="boot-energy-rail rail-b"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.52 }}
          transition={{ delay: 0.25, duration: 0.86, ease: [0.16, 1, 0.3, 1] }}
        />
        <div className="boot-dust-field">
          {dust.map((particle) => (
            <motion.i
              key={particle.id}
              style={{ "--dust-x": `${particle.x}vw`, "--dust-y": `${particle.y}vh` } as React.CSSProperties}
              initial={{ x: `${particle.x}vw`, y: `${particle.y}vh`, opacity: 0, scale: 0.3 }}
              animate={phase === "error"
                ? { opacity: 0.08, scale: 0.4 }
                : { x: 0, y: 0, opacity: [0, 0.75, 0], scale: [0.3, 1.1, 0.25] }}
              transition={{ delay: 0.18 + particle.delay, duration: 0.82, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
        </div>
      </div>

      <div className="boot-stage">
        <div className="boot-assembly" aria-hidden="true">
          <motion.div
            className="boot-calibration-ring ring-outer"
            initial={{ opacity: 0, scale: 0.58, rotate: -28 }}
            animate={{ opacity: phase === "error" ? 0.16 : 0.62, scale: 1, rotate: 0 }}
            transition={{ delay: 0.08, duration: 0.82, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            className="boot-calibration-ring ring-inner"
            initial={{ opacity: 0, scale: 1.35, rotate: 42 }}
            animate={{ opacity: phase === "error" ? 0.12 : 0.42, scale: 1, rotate: 0 }}
            transition={{ delay: 0.18, duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
          />

          <svg className="boot-barbell-assembly" viewBox="0 0 320 160" fill="none">
            <motion.path className="assembly-bar" d="M55 80h210" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ delay: 0.46, duration: 0.48, ease: [0.16, 1, 0.3, 1] }} />
            <motion.g className="assembly-plates plate-left" initial={{ x: -86, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.54, duration: 0.46, ease: [0.16, 1, 0.3, 1] }}>
              <path d="M46 50v60M54 42v76M64 55v50" />
            </motion.g>
            <motion.g className="assembly-plates plate-right" initial={{ x: 86, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.54, duration: 0.46, ease: [0.16, 1, 0.3, 1] }}>
              <path d="M274 50v60M266 42v76M256 55v50" />
            </motion.g>
            <motion.path className="assembly-trace-back" d="M64 88h62l20-27 25 27 28-43 57 35" initial={{ opacity: 0 }} animate={{ opacity: 0.38 }} transition={{ delay: 0.28, duration: 0.32 }} />
            <motion.path className="assembly-trace-live" d="M64 88h62l20-27 25 27 28-43 57 35" initial={{ pathLength: 0 }} animate={{ pathLength: phase === "error" ? 0.62 : 1 }} transition={{ delay: 0.22, duration: 0.82, ease: [0.22, 1, 0.36, 1] }} />
            <motion.circle className="assembly-energy-core" cx={phase === "error" ? 178 : 256} cy={phase === "error" ? 77 : 80} r="5" initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.86, duration: 0.22 }} />
            {phase === "error" && <motion.path className="assembly-break" d="M172 84l16-18" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />}
          </svg>

          <motion.div
            className="boot-lock-flash"
            initial={{ opacity: 0, scale: 0.25 }}
            animate={visuallyLocked && phase !== "error" ? { opacity: [0, 0.88, 0], scale: [0.25, 1.3, 1.85] } : { opacity: 0 }}
            transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            ref={flyingMarkRef}
            className="boot-brand-flight"
            style={{ x: flightX, y: flightY, scale: flightScale, rotate: flightRotate }}
          >
            <motion.div
              className="boot-brand-lock"
              initial={{ opacity: 0, scale: 0.68, rotate: -4 }}
              animate={visuallyLocked && phase !== "error"
                ? { opacity: 1, scale: 1, rotate: 0, x: 0, y: 0 }
                : { opacity: 0 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            >
              <TrackMark className="boot-brand-mark" state={phase === "syncing" ? "syncing" : "active"} />
              <i className="boot-flight-wake" aria-hidden="true" />
            </motion.div>
          </motion.div>
        </div>

        <motion.div className="boot-copy-overdrive" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.08, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}>
          <span>{phase === "error" ? "TRACK INTERRUPTED" : "KINETIC TRACK / ONLINE"}</span>
          <strong>{copy.title}</strong>
          <p>{copy.detail}</p>
        </motion.div>
        {phase === "error" && <button className="secondary-action boot-retry" onClick={onRetry}>从断点重新同步</button>}
      </div>

      <div className="boot-corner boot-corner-tl" aria-hidden="true">LJ / 01</div>
      <div className="boot-corner boot-corner-br" aria-hidden="true">FORCE TRACE ACTIVE</div>
      <motion.div
        className="boot-lock-impact"
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.15 }}
        animate={visuallyLocked && phase !== "error" ? { opacity: [0, 0.8, 0], scale: [0.15, 1.2, 2.2] } : { opacity: 0 }}
        transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div className="boot-reveal-line" aria-hidden="true" animate={exiting ? { opacity: [0, 1, 0], scaleX: [0, 1, 1] } : { opacity: 0, scaleX: 0 }} transition={{ duration: 0.38 }} />
    </motion.div>
  );
}

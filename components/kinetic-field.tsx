"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { StaticKineticField } from "@/components/static-kinetic-field";
import type { KineticIntensity, KineticMode, KineticScene } from "@/lib/visual/kinetic-scene";

type KineticFieldProps = {
  mode: KineticMode;
  intensity?: KineticIntensity;
  progress?: number;
  pulseKey?: number;
};

export function KineticField({ mode, intensity = "idle", progress = 0, pulseKey = 0 }: KineticFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<KineticScene | null>(null);
  const flightPausedRef = useRef(false);
  const initialStateRef = useRef({ mode, intensity, progress });
  const reducedMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (reducedMotion || !canvasRef.current) return;
    let active = true;
    const canvas = canvasRef.current;

    import("@/lib/visual/kinetic-scene")
      .then(({ KineticScene: Scene }) => {
        if (!active) return;
        const scene = new Scene({ canvas, ...initialStateRef.current });
        sceneRef.current = scene;
        if (flightPausedRef.current) scene.pause();
        setReady(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    const resize = () => sceneRef.current?.resize();
    const pointerMove = (event: PointerEvent) => {
      sceneRef.current?.setPointer((event.clientX / window.innerWidth) * 2 - 1, 1 - (event.clientY / window.innerHeight) * 2);
    };
    const visibilityChange = () => {
      if (document.hidden || flightPausedRef.current) sceneRef.current?.pause();
      else sceneRef.current?.resume();
    };
    const flightStart = () => {
      flightPausedRef.current = true;
      sceneRef.current?.pause();
    };
    const flightEnd = () => {
      flightPausedRef.current = false;
      if (!document.hidden) sceneRef.current?.resume();
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", pointerMove, { passive: true });
    document.addEventListener("visibilitychange", visibilityChange);
    window.addEventListener("kinetic-flight-start", flightStart);
    window.addEventListener("kinetic-flight-end", flightEnd);
    canvas.addEventListener("webglcontextlost", contextLost);

    return () => {
      active = false;
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", pointerMove);
      document.removeEventListener("visibilitychange", visibilityChange);
      window.removeEventListener("kinetic-flight-start", flightStart);
      window.removeEventListener("kinetic-flight-end", flightEnd);
      canvas.removeEventListener("webglcontextlost", contextLost);
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, [reducedMotion]);

  useEffect(() => {
    sceneRef.current?.setMode(mode, intensity, progress);
  }, [intensity, mode, progress]);

  useEffect(() => {
    if (pulseKey > 0) sceneRef.current?.pulse();
  }, [pulseKey]);

  return (
    <div className="kinetic-field-layer" data-mode={mode} data-ready={ready || undefined} data-failed={failed || undefined} aria-hidden="true">
      <StaticKineticField mode={mode} />
      <canvas ref={canvasRef} className="kinetic-field-canvas" />
    </div>
  );
}

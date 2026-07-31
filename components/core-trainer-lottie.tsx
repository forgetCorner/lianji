"use client";

import { useEffect, useState } from "react";
import {
  DotLottieReact,
  setWasmUrl,
  type DotLottie,
} from "@lottiefiles/dotlottie-react";

setWasmUrl("/assets/dotlottie-player.wasm");

type CoreTrainerLottieProps = {
  active: boolean;
};

export function CoreTrainerLottie({ active }: CoreTrainerLottieProps) {
  const [dotLottie, setDotLottie] = useState<DotLottie | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    if (!dotLottie) {
      return;
    }

    const syncPlayback = () => {
      if (active && !prefersReducedMotion) {
        dotLottie.play();
        return;
      }

      dotLottie.pause();
      dotLottie.setFrame(0);
    };

    syncPlayback();
    dotLottie.addEventListener("load", syncPlayback);
    return () => dotLottie.removeEventListener("load", syncPlayback);
  }, [active, dotLottie, prefersReducedMotion]);

  return (
    <span className="exercise-type-core-artboard">
      <DotLottieReact
        className="exercise-type-core-player"
        src="/assets/core-trainer.json?v=deadbug-1"
        autoplay={active && !prefersReducedMotion}
        loop
        mode="forward"
        speed={0.85}
        useFrameInterpolation
        renderConfig={{ autoResize: true }}
        dotLottieRefCallback={setDotLottie}
      />
    </span>
  );
}

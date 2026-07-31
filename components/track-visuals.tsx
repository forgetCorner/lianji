import { CardioRunnerLottie } from "@/components/cardio-runner-lottie";
import { CoreTrainerLottie } from "@/components/core-trainer-lottie";
import type { ExerciseCategory } from "@/lib/exercise-category";

type TrackMarkProps = {
  className?: string;
  label?: string;
  state?: "idle" | "active" | "syncing" | "error";
};

export function TrackMark({ className = "", label, state = "idle" }: TrackMarkProps) {
  return (
    <svg
      className={`track-mark state-${state} ${className}`.trim()}
      viewBox="0 0 64 48"
      fill="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g className="track-mark-plates plate-left">
        <path d="M5 13v22M9 10v28M13 15v18" />
      </g>
      <g className="track-mark-plates plate-right">
        <path d="M59 13v22M55 10v28M51 15v18" />
      </g>
      <path className="track-mark-bar" d="M13 24h38" />
      <path className="track-mark-route-base" d="M13 27h11l6-8 7 7 8-12 6 6" />
      <path className="track-mark-route" pathLength="100" d="M13 27h11l6-8 7 7 8-12 6 6" />
      <circle className="track-mark-core-glow" cx="51" cy="20" r="5.5" />
      <circle className="track-mark-endpoint" cx="51" cy="20" r="2.6" />
      <path className="track-mark-error" d="M37 22l7-7" />
    </svg>
  );
}

type ExerciseTypeMarkProps = {
  category: ExerciseCategory | null;
  className?: string;
  state?: "idle" | "syncing";
};

export function ExerciseTypeMark({
  category,
  className = "",
  state = "idle",
}: ExerciseTypeMarkProps) {
  const resolvedCategory = category ?? "strength";

  if (resolvedCategory === "strength") {
    return (
      <TrackMark
        className={`exercise-type-mark is-strength ${className}`.trim()}
        state={state}
      />
    );
  }

  const svgClassName = `exercise-type-mark is-${resolvedCategory} state-${state} ${className}`.trim();

  if (resolvedCategory === "cardio") {
    return (
      <span className={svgClassName} aria-hidden="true">
        <CardioRunnerLottie active={state === "syncing"} />
      </span>
    );
  }

  return (
    <span className={svgClassName} aria-hidden="true">
      <CoreTrainerLottie active={state === "syncing"} />
    </span>
  );
}

type TrainingStatusMarkProps = {
  planLetter?: string | null;
};

export function TrainingStatusMark({ planLetter }: TrainingStatusMarkProps) {
  const isRest = !planLetter;
  return (
    <svg
      className={`training-status-mark ${isRest ? "is-rest" : "is-training"}`}
      viewBox="0 0 160 160"
      fill="none"
      aria-hidden="true"
    >
      <circle className="status-core-halo" cx="80" cy="80" r="69" />
      <path className="status-orbit status-orbit-back" d="M132 42A67 67 0 1 0 139 105" />
      <path className="status-orbit status-orbit-live" pathLength="100" d="M35 131A67 67 0 0 0 132 42" />
      <path className="status-orbit status-orbit-inner" d="M121 57a48 48 0 1 0-2 50" />
      <g className="status-ticks">
        <path d="M80 5v12M80 143v12M5 80h12M143 80h12" />
        <path d="m27 27 8 8m90 90 8 8m0-106-8 8m-90 90-8 8" />
      </g>
      {isRest ? (
        <>
          <path className="recovery-track recovery-track-back" d="M33 84c16 0 20-17 36-10 12 5 13 21 26 17 12-4 14-21 34-13" />
          <path className="recovery-track recovery-track-live" pathLength="100" d="M33 84c16 0 20-17 36-10 12 5 13 21 26 17 12-4 14-21 34-13" />
          <circle className="status-endpoint-glow" cx="129" cy="78" r="9" />
          <circle className="status-endpoint" cx="129" cy="78" r="4" />
          <path className="rest-glyph" d="M68 52h8M86 52h8" />
        </>
      ) : (
        <>
          <path className="plan-track" d="M31 108h30l9-11 9 7 14-19h32" />
          <circle className="status-endpoint-glow" cx="125" cy="85" r="9" />
          <circle className="status-endpoint" cx="125" cy="85" r="4" />
          <text className="plan-letter-glyph" x="80" y="87" textAnchor="middle">{planLetter}</text>
        </>
      )}
    </svg>
  );
}

export function WeekStatusIcon() {
  return (
    <svg className="section-symbol kinetic-week-symbol" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 18V11M6 18V8M9 18v-5M12 18V6M15 18v4M18 18V9M21 18v-7" />
      <path className="section-symbol-live" d="M3 18h18" />
      <circle cx="12" cy="6" r="1.5" />
    </svg>
  );
}

import { MAX_SETS_PER_EXERCISE } from "./training.ts";

export type WorkoutSetZone = "required" | "optional";
export type WorkoutSetState = "done" | "current" | "pending";

export type WorkoutSetProgressNode = {
  setNumber: number;
  zone: WorkoutSetZone;
  state: WorkoutSetState;
  startsOptionalZone: boolean;
};

export type WorkoutSetProgressModel = {
  mode: "single" | "fixed" | "range";
  goalLabel: string;
  statusLabel: string;
  ariaLabel: string;
  reachedMinimum: boolean;
  completed: boolean;
  currentSet: number | null;
  minSets: number;
  maxSets: number;
  completedSets: number;
  nodes: WorkoutSetProgressNode[];
};

function integerInRange(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function buildWorkoutSetProgress({
  minSets,
  maxSets,
  completedSets,
}: {
  minSets: number;
  maxSets: number;
  completedSets: number;
}): WorkoutSetProgressModel {
  const normalizedMax = integerInRange(maxSets, 1, 1, MAX_SETS_PER_EXERCISE);
  const normalizedMin = integerInRange(minSets, normalizedMax, 1, normalizedMax);
  const normalizedCompleted = integerInRange(completedSets, 0, 0, normalizedMax);
  const mode = normalizedMin === normalizedMax
    ? normalizedMax === 1 ? "single" : "fixed"
    : "range";
  const completed = normalizedCompleted >= normalizedMax;
  const reachedMinimum = normalizedCompleted >= normalizedMin;
  const currentSet = completed ? null : normalizedCompleted + 1;

  const goalLabel = mode === "single"
    ? "本动作仅 1 组"
    : mode === "fixed"
      ? `目标 ${normalizedMax} 组`
      : reachedMinimum
        ? `已达最低目标 · 最多 ${normalizedMax} 组`
        : `至少 ${normalizedMin} 组 · 最多 ${normalizedMax} 组`;

  const statusLabel = completed
    ? "本动作已完成"
    : currentSet !== null && currentSet > normalizedMin
      ? `第 ${currentSet} 组加练`
      : `第 ${currentSet} 组进行中`;

  const targetDescription = mode === "single"
    ? "计划仅 1 组"
    : mode === "fixed"
      ? `计划完成 ${normalizedMax} 组`
      : `计划至少 ${normalizedMin} 组，最多 ${normalizedMax} 组`;
  const progressDescription = completed
    ? `已完成 ${normalizedCompleted} 组，本动作已完成`
    : `已完成 ${normalizedCompleted} 组，${statusLabel}`;

  return {
    mode,
    goalLabel,
    statusLabel,
    ariaLabel: `${targetDescription}；${progressDescription}`,
    reachedMinimum,
    completed,
    currentSet,
    minSets: normalizedMin,
    maxSets: normalizedMax,
    completedSets: normalizedCompleted,
    nodes: Array.from({ length: normalizedMax }, (_, index) => {
      const setNumber = index + 1;
      return {
        setNumber,
        zone: setNumber <= normalizedMin ? "required" : "optional",
        state: setNumber <= normalizedCompleted
          ? "done"
          : setNumber === currentSet
            ? "current"
            : "pending",
        startsOptionalZone: setNumber === normalizedMin + 1,
      };
    }),
  };
}

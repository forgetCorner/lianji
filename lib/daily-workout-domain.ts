export type DailyWorkoutStatus = "not_started" | "in_progress" | "completed" | "finalized";

export type PlanExerciseIdentity = {
  id: string;
};

export type WorkoutExerciseIdentity = {
  planExerciseId: string | null;
  completedAt: number | null;
  removedFromPlanAt: number | null;
  setCount: number;
};

export type ExerciseReconciliation = {
  add: string[];
  restore: string[];
  remove: string[];
  update: string[];
  keep: string[];
};

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function shanghaiDateKey(timestamp = Date.now()): string {
  return new Date(timestamp + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

export function nextShanghaiMidnight(timestamp = Date.now()): number {
  const shifted = new Date(timestamp + SHANGHAI_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1) - SHANGHAI_OFFSET_MS;
}

export function isTrainingDateFinalized(trainingDate: string | null, now = Date.now()): boolean {
  return Boolean(trainingDate && trainingDate < shanghaiDateKey(now));
}

export function reconcileExerciseMembership(
  planExercises: PlanExerciseIdentity[],
  workoutExercises: WorkoutExerciseIdentity[],
): ExerciseReconciliation {
  const planIds = new Set(planExercises.map((exercise) => exercise.id));
  const workoutByPlanId = new Map(
    workoutExercises
      .filter((exercise): exercise is WorkoutExerciseIdentity & { planExerciseId: string } => Boolean(exercise.planExerciseId))
      .map((exercise) => [exercise.planExerciseId, exercise]),
  );
  const result: ExerciseReconciliation = { add: [], restore: [], remove: [], update: [], keep: [] };

  for (const exercise of planExercises) {
    const snapshot = workoutByPlanId.get(exercise.id);
    if (!snapshot) result.add.push(exercise.id);
    else if (snapshot.removedFromPlanAt) result.restore.push(exercise.id);
    else if (!snapshot.completedAt && snapshot.setCount === 0) result.update.push(exercise.id);
    else result.keep.push(exercise.id);
  }

  for (const snapshot of workoutExercises) {
    if (snapshot.planExerciseId && !planIds.has(snapshot.planExerciseId) && !snapshot.removedFromPlanAt) {
      result.remove.push(snapshot.planExerciseId);
    }
  }

  return result;
}

export function getDailyWorkoutStatus(input: {
  exists: boolean;
  trainingDate: string | null;
  finalizedAt: number | null;
  exercises: Array<Pick<WorkoutExerciseIdentity, "completedAt" | "removedFromPlanAt">>;
}, now = Date.now()): DailyWorkoutStatus {
  if (!input.exists) return "not_started";
  if (input.finalizedAt || isTrainingDateFinalized(input.trainingDate, now)) return "finalized";
  return input.exercises.some((exercise) => !exercise.removedFromPlanAt && !exercise.completedAt) ? "in_progress" : "completed";
}

export function getCurrentWorkoutExercise<T extends { completedAt: number | null; removedFromPlanAt: number | null }>(exercises: T[]): T | null {
  return exercises.find((exercise) => !exercise.removedFromPlanAt && !exercise.completedAt) ?? null;
}

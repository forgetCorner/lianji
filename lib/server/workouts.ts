import { ensureDatabase, getD1 } from "@/db";
import {
  getDailyWorkoutStatus,
  reconcileExerciseMembership,
  shanghaiDateKey,
} from "@/lib/daily-workout-domain";
import { shanghaiWeekday } from "@/lib/server/plans";
import type {
  ActiveWorkout,
  TodayWorkoutState,
  TrackingType,
  TrainingPlan,
  WeightMode,
  WorkoutExercise,
  WorkoutSet,
} from "@/lib/training";
import { isInclineWalkExercise, restSecondsForSets } from "@/lib/training";

type SessionRow = {
  id: string;
  plan_name: string;
  plan_id: string | null;
  plan_day_id: string | null;
  plan_version: number | null;
  started_at: number;
  completed_at: number | null;
  duration_seconds: number;
  workout_type: string;
  training_date: string | null;
  finalized_at: number | null;
  synced_plan_version: number | null;
  resumed_at: number | null;
};
type ExerciseRow = {
  id: string;
  plan_exercise_id: string | null;
  exercise_id: string;
  name: string;
  equipment: string;
  muscle_group: string;
  tracking_type: TrackingType;
  weight_mode: WeightMode;
  min_sets: number;
  max_sets: number;
  min_reps: number;
  max_reps: number;
  min_duration_seconds: number;
  max_duration_seconds: number;
  rest_seconds: number;
  speed_min: number | null;
  speed_max: number | null;
  notes: string;
  alternative_exercise_id: string | null;
  alternative_name: string | null;
  alternative_equipment: string | null;
  position: number;
  skipped: number;
  completed_at: number | null;
  removed_from_plan_at: number | null;
};
type ReconciliationExerciseRow = ExerciseRow & { set_count: number };
type SetRow = {
  id: string;
  workout_exercise_id: string | null;
  exercise_id: string;
  set_index: number;
  tracking_type: TrackingType;
  weight_kg: number;
  left_weight_kg: number | null;
  right_weight_kg: number | null;
  reps: number;
  duration_seconds: number;
  speed_kmh: number | null;
  incline_percent: number | null;
  completed_at: number;
};
type LastSetMetricRow = {
  exercise_id: string;
  tracking_type: TrackingType;
  weight_kg: number;
  left_weight_kg: number | null;
  right_weight_kg: number | null;
  speed_kmh: number | null;
  incline_percent: number | null;
};

const sessionSelection = `id, plan_name, plan_id, plan_day_id, plan_version, started_at, completed_at, duration_seconds,
  workout_type, training_date, finalized_at, synced_plan_version, resumed_at`;

function mapSet(row: SetRow): WorkoutSet {
  return {
    id: row.id,
    workoutExerciseId: row.workout_exercise_id,
    exerciseId: row.exercise_id,
    setIndex: row.set_index,
    trackingType: row.tracking_type,
    weightKg: row.weight_kg,
    leftWeightKg: row.left_weight_kg,
    rightWeightKg: row.right_weight_kg,
    reps: row.reps,
    durationSeconds: row.duration_seconds,
    speedKmh: row.speed_kmh,
    inclinePercent: row.incline_percent,
    completedAt: row.completed_at,
  };
}

async function readWorkout(userId: string, session: SessionRow): Promise<ActiveWorkout> {
  const database = getD1();
  const [exerciseResult, setResult, lastMetricResult] = await Promise.all([
    database.prepare("SELECT * FROM workout_exercises WHERE workout_session_id = ? AND user_id = ? ORDER BY position, id").bind(session.id, userId).all<ExerciseRow>(),
    database.prepare("SELECT id, workout_exercise_id, exercise_id, set_index, tracking_type, weight_kg, left_weight_kg, right_weight_kg, reps, duration_seconds, speed_kmh, incline_percent, completed_at FROM workout_sets WHERE workout_session_id = ? AND user_id = ? ORDER BY completed_at").bind(session.id, userId).all<SetRow>(),
    database.prepare("SELECT exercise_id, tracking_type, weight_kg, left_weight_kg, right_weight_kg, speed_kmh, incline_percent FROM workout_sets WHERE user_id = ? AND workout_session_id <> ? ORDER BY completed_at DESC").bind(userId, session.id).all<LastSetMetricRow>(),
  ]);
  const lastLoads = new Map<string, LastSetMetricRow>();
  const lastInclineWalkMetrics = new Map<string, LastSetMetricRow>();
  for (const row of lastMetricResult.results) {
    if (row.tracking_type === "weight_reps" && !lastLoads.has(row.exercise_id)) lastLoads.set(row.exercise_id, row);
    if (isInclineWalkExercise(row.exercise_id) && row.speed_kmh !== null && row.incline_percent !== null && !lastInclineWalkMetrics.has(row.exercise_id)) {
      lastInclineWalkMetrics.set(row.exercise_id, row);
    }
  }

  const exercises: WorkoutExercise[] = exerciseResult.results
    .filter((row) => !row.removed_from_plan_at)
    .map((row) => {
      const lastLoad = lastLoads.get(row.exercise_id);
      const lastInclineWalkMetric = lastInclineWalkMetrics.get(row.exercise_id);
      return {
        id: row.id,
        planExerciseId: row.plan_exercise_id,
        exerciseId: row.exercise_id,
        name: row.name,
        selectedName: row.name,
        equipment: row.equipment,
        selectedEquipment: row.equipment,
        muscleGroup: row.muscle_group,
        trackingType: row.tracking_type,
        weightMode: row.weight_mode,
        minSets: row.min_sets,
        maxSets: row.max_sets,
        minReps: row.min_reps,
        maxReps: row.max_reps,
        minDurationSeconds: row.min_duration_seconds,
        maxDurationSeconds: row.max_duration_seconds,
        restSeconds: restSecondsForSets(row.max_sets),
        speedMin: row.speed_min,
        speedMax: row.speed_max,
        notes: row.notes,
        alternativeExerciseId: row.alternative_exercise_id,
        alternativeName: row.alternative_name,
        alternativeEquipment: row.alternative_equipment,
        position: row.position,
        skipped: Boolean(row.skipped),
        completedAt: row.completed_at,
        removedFromPlanAt: row.removed_from_plan_at,
        sets: setResult.results.filter((set) => set.workout_exercise_id === row.id).map(mapSet),
        lastWeightKg: lastLoad?.weight_kg ?? 0,
        lastLeftWeightKg: lastLoad?.left_weight_kg ?? null,
        lastRightWeightKg: lastLoad?.right_weight_kg ?? null,
        lastSpeedKmh: lastInclineWalkMetric?.speed_kmh ?? null,
        lastInclinePercent: lastInclineWalkMetric?.incline_percent ?? null,
      };
    });

  return {
    id: session.id,
    planName: session.plan_name,
    planDayId: session.plan_day_id,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    trainingDate: session.training_date,
    finalizedAt: session.finalized_at,
    durationSeconds: session.duration_seconds,
    resumedAt: session.resumed_at,
    syncedPlanVersion: session.synced_plan_version,
    exercises,
  };
}

function businessDateEnd(trainingDate: string): number {
  return Date.parse(`${trainingDate}T16:00:00.000Z`);
}

function accumulatedDuration(session: Pick<SessionRow, "duration_seconds" | "resumed_at">, endAt: number): number {
  if (!session.resumed_at) return session.duration_seconds;
  return Math.max(0, session.duration_seconds + Math.floor((endAt - session.resumed_at) / 1000));
}

export async function finalizeExpiredPlanWorkouts(userId: string, now = Date.now()): Promise<void> {
  await ensureDatabase();
  const database = getD1();
  const today = shanghaiDateKey(now);
  const result = await database.prepare(
    `SELECT ${sessionSelection} FROM workout_sessions
     WHERE user_id = ? AND workout_type = 'plan' AND training_date IS NOT NULL AND training_date < ? AND finalized_at IS NULL`,
  ).bind(userId, today).all<SessionRow>();
  if (!result.results.length) return;
  await database.batch(result.results.map((session) => {
    const finalizedAt = Math.min(now, businessDateEnd(session.training_date!));
    return database.prepare(
      "UPDATE workout_sessions SET finalized_at = ?, duration_seconds = ?, resumed_at = NULL WHERE id = ? AND user_id = ? AND finalized_at IS NULL",
    ).bind(finalizedAt, accumulatedDuration(session, finalizedAt), session.id, userId);
  }));
}

export async function getWorkout(userId: string, workoutId: string): Promise<ActiveWorkout | null> {
  await ensureDatabase();
  const session = await getD1().prepare(
    `SELECT ${sessionSelection} FROM workout_sessions WHERE id = ? AND user_id = ?`,
  ).bind(workoutId, userId).first<SessionRow>();
  return session ? readWorkout(userId, session) : null;
}

export async function getTodayPlanWorkout(userId: string, now = Date.now()): Promise<ActiveWorkout | null> {
  await finalizeExpiredPlanWorkouts(userId, now);
  const session = await getD1().prepare(
    `SELECT ${sessionSelection} FROM workout_sessions
     WHERE user_id = ? AND workout_type = 'plan' AND training_date = ? AND finalized_at IS NULL
     ORDER BY started_at DESC LIMIT 1`,
  ).bind(userId, shanghaiDateKey(now)).first<SessionRow>();
  return session ? readWorkout(userId, session) : null;
}

export async function getTodayWorkoutState(userId: string, now = Date.now()): Promise<TodayWorkoutState> {
  const workout = await getTodayPlanWorkout(userId, now);
  const status = getDailyWorkoutStatus({
    exists: Boolean(workout),
    trainingDate: workout?.trainingDate ?? null,
    finalizedAt: workout?.finalizedAt ?? null,
    exercises: workout?.exercises ?? [],
  }, now);
  return { status: status === "finalized" ? "not_started" : status, workout };
}

export async function getActiveWorkout(userId: string, workoutId?: string): Promise<ActiveWorkout | null> {
  if (workoutId) {
    const workout = await getWorkout(userId, workoutId);
    return workout && !workout.finalizedAt ? workout : null;
  }
  const state = await getTodayWorkoutState(userId);
  return state.status === "in_progress" ? state.workout : null;
}

export async function recalculatePlanWorkoutCompletion(userId: string, workoutId: string, now = Date.now()): Promise<ActiveWorkout | null> {
  await ensureDatabase();
  const database = getD1();
  const session = await database.prepare(
    `SELECT ${sessionSelection} FROM workout_sessions WHERE id = ? AND user_id = ? AND workout_type = 'plan'`,
  ).bind(workoutId, userId).first<SessionRow>();
  if (!session || session.finalized_at || session.training_date !== shanghaiDateKey(now)) return session ? readWorkout(userId, session) : null;
  const pending = await database.prepare(
    "SELECT COUNT(*) AS count FROM workout_exercises WHERE workout_session_id = ? AND user_id = ? AND removed_from_plan_at IS NULL AND completed_at IS NULL",
  ).bind(workoutId, userId).first<{ count: number }>();
  if ((pending?.count ?? 0) === 0 && !session.completed_at) {
    await database.prepare(
      "UPDATE workout_sessions SET completed_at = ?, duration_seconds = ?, resumed_at = NULL WHERE id = ? AND user_id = ? AND finalized_at IS NULL",
    ).bind(now, accumulatedDuration(session, now), workoutId, userId).run();
  } else if ((pending?.count ?? 0) > 0 && session.completed_at) {
    await database.prepare(
      "UPDATE workout_sessions SET completed_at = NULL, resumed_at = ? WHERE id = ? AND user_id = ? AND finalized_at IS NULL",
    ).bind(now, workoutId, userId).run();
  }
  return getWorkout(userId, workoutId);
}

export async function reconcileTodayPlanWorkout(userId: string, plan: TrainingPlan, now = Date.now()): Promise<TodayWorkoutState> {
  const workout = await getTodayPlanWorkout(userId, now);
  if (!workout) return { status: "not_started", workout: null };
  const database = getD1();
  const session = await database.prepare(
    `SELECT ${sessionSelection} FROM workout_sessions WHERE id = ? AND user_id = ?`,
  ).bind(workout.id, userId).first<SessionRow>();
  if (!session || session.finalized_at) return { status: "not_started", workout: null };
  const day = plan.days.find((item) => item.weekday === shanghaiWeekday(now));
  const planExercises = day?.enabled ? day.exercises : [];
  let snapshots = await database.prepare(
    `SELECT workout_exercises.*, COUNT(workout_sets.id) AS set_count
     FROM workout_exercises
     LEFT JOIN workout_sets ON workout_sets.workout_exercise_id = workout_exercises.id
     WHERE workout_exercises.workout_session_id = ? AND workout_exercises.user_id = ?
     GROUP BY workout_exercises.id ORDER BY workout_exercises.position`,
  ).bind(workout.id, userId).all<ReconciliationExerciseRow>();
  const currentPlanIds = new Set(planExercises.map((exercise) => exercise.id));
  if (session.synced_plan_version !== plan.version) {
    const occupiedPlanIds = new Set(snapshots.results.map((snapshot) => snapshot.plan_exercise_id).filter((id): id is string => Boolean(id) && currentPlanIds.has(id!)));
    const legacyAlignment: D1PreparedStatement[] = [];
    for (const snapshot of snapshots.results) {
      if (!snapshot.plan_exercise_id || currentPlanIds.has(snapshot.plan_exercise_id)) continue;
      const candidates = planExercises.filter((exercise) => exercise.exerciseId === snapshot.exercise_id && !occupiedPlanIds.has(exercise.id));
      const match = candidates.find((exercise) => exercise.position === snapshot.position) ?? (candidates.length === 1 ? candidates[0] : null);
      if (!match) continue;
      occupiedPlanIds.add(match.id);
      legacyAlignment.push(database.prepare(
        "UPDATE workout_exercises SET plan_exercise_id = ? WHERE id = ? AND workout_session_id = ? AND user_id = ?",
      ).bind(match.id, snapshot.id, workout.id, userId));
    }
    if (legacyAlignment.length) {
      await database.batch(legacyAlignment);
      snapshots = await database.prepare(
        `SELECT workout_exercises.*, COUNT(workout_sets.id) AS set_count
         FROM workout_exercises
         LEFT JOIN workout_sets ON workout_sets.workout_exercise_id = workout_exercises.id
         WHERE workout_exercises.workout_session_id = ? AND workout_exercises.user_id = ?
         GROUP BY workout_exercises.id ORDER BY workout_exercises.position`,
      ).bind(workout.id, userId).all<ReconciliationExerciseRow>();
    }
  }
  const diff = reconcileExerciseMembership(
    planExercises,
    snapshots.results.map((snapshot) => ({
      planExerciseId: snapshot.plan_exercise_id,
      completedAt: snapshot.completed_at,
      removedFromPlanAt: snapshot.removed_from_plan_at,
      setCount: snapshot.set_count,
    })),
  );
  const byPlanId = new Map(planExercises.map((exercise) => [exercise.id, exercise]));
  const statements: D1PreparedStatement[] = [];
  for (const planExerciseId of diff.add) {
    const exercise = byPlanId.get(planExerciseId)!;
    statements.push(database.prepare(
      `INSERT OR IGNORE INTO workout_exercises
       (id, workout_session_id, user_id, plan_exercise_id, exercise_id, name, equipment, muscle_group, tracking_type, weight_mode,
        min_sets, max_sets, min_reps, max_reps, min_duration_seconds, max_duration_seconds, rest_seconds,
        speed_min, speed_max, notes, alternative_exercise_id, alternative_name, alternative_equipment, position, skipped, completed_at, removed_from_plan_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL)`,
    ).bind(crypto.randomUUID(), workout.id, userId, exercise.id, exercise.exerciseId, exercise.name, exercise.equipment, exercise.muscleGroup, exercise.trackingType, exercise.weightMode,
      exercise.minSets, exercise.maxSets, exercise.minReps, exercise.maxReps, exercise.minDurationSeconds, exercise.maxDurationSeconds, exercise.restSeconds,
      exercise.speedMin, exercise.speedMax, exercise.notes, exercise.alternativeExerciseId, exercise.alternativeName, exercise.alternativeEquipment, exercise.position));
  }
  for (const planExerciseId of diff.restore) {
    const exercise = byPlanId.get(planExerciseId)!;
    statements.push(database.prepare(
      `UPDATE workout_exercises SET removed_from_plan_at = NULL, position = ?, min_sets = ?, max_sets = ?, min_reps = ?, max_reps = ?,
       min_duration_seconds = ?, max_duration_seconds = ?, rest_seconds = ?, notes = ?
       WHERE workout_session_id = ? AND user_id = ? AND plan_exercise_id = ?`,
    ).bind(exercise.position, exercise.minSets, exercise.maxSets, exercise.minReps, exercise.maxReps, exercise.minDurationSeconds, exercise.maxDurationSeconds,
      exercise.restSeconds, exercise.notes, workout.id, userId, planExerciseId));
  }
  for (const planExerciseId of diff.update) {
    const exercise = byPlanId.get(planExerciseId)!;
    statements.push(database.prepare(
      `UPDATE workout_exercises SET name = ?, equipment = ?, muscle_group = ?, tracking_type = ?, weight_mode = ?, position = ?,
       min_sets = ?, max_sets = ?, min_reps = ?, max_reps = ?, min_duration_seconds = ?, max_duration_seconds = ?, rest_seconds = ?, notes = ?
       WHERE workout_session_id = ? AND user_id = ? AND plan_exercise_id = ? AND completed_at IS NULL`,
    ).bind(exercise.name, exercise.equipment, exercise.muscleGroup, exercise.trackingType, exercise.weightMode, exercise.position,
      exercise.minSets, exercise.maxSets, exercise.minReps, exercise.maxReps, exercise.minDurationSeconds, exercise.maxDurationSeconds,
      exercise.restSeconds, exercise.notes, workout.id, userId, planExerciseId));
  }
  for (const planExerciseId of diff.remove) {
    statements.push(database.prepare(
      "UPDATE workout_exercises SET removed_from_plan_at = ? WHERE workout_session_id = ? AND user_id = ? AND plan_exercise_id = ? AND removed_from_plan_at IS NULL",
    ).bind(now, workout.id, userId, planExerciseId));
  }
  for (const exercise of planExercises) {
    if (diff.keep.includes(exercise.id)) {
      statements.push(database.prepare(
        "UPDATE workout_exercises SET position = ? WHERE workout_session_id = ? AND user_id = ? AND plan_exercise_id = ?",
      ).bind(exercise.position, workout.id, userId, exercise.id));
    }
  }
  statements.push(database.prepare(
    "UPDATE workout_sessions SET plan_name = ?, plan_day_id = ?, synced_plan_version = ? WHERE id = ? AND user_id = ? AND finalized_at IS NULL",
  ).bind(day?.name ?? session.plan_name, day?.id ?? session.plan_day_id, plan.version, workout.id, userId));
  await database.batch(statements);
  const reconciled = await recalculatePlanWorkoutCompletion(userId, workout.id, now);
  const status = getDailyWorkoutStatus({
    exists: Boolean(reconciled),
    trainingDate: reconciled?.trainingDate ?? null,
    finalizedAt: reconciled?.finalizedAt ?? null,
    exercises: reconciled?.exercises ?? [],
  }, now);
  return { status: status === "finalized" ? "not_started" : status, workout: reconciled };
}

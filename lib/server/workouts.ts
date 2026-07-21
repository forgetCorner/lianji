import { ensureDatabase, getD1 } from "@/db";
import type { ActiveWorkout, TrackingType, WeightMode, WorkoutExercise, WorkoutSet } from "@/lib/training";

type SessionRow = { id: string; plan_name: string; plan_day_id: string | null; started_at: number };
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
};
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
  completed_at: number;
};
type LastLoadRow = { exercise_id: string; weight_kg: number; left_weight_kg: number | null; right_weight_kg: number | null };

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
    completedAt: row.completed_at,
  };
}

export async function getActiveWorkout(userId: string, workoutId?: string): Promise<ActiveWorkout | null> {
  await ensureDatabase();
  const database = getD1();
  const session = workoutId
    ? await database.prepare("SELECT id, plan_name, plan_day_id, started_at FROM workout_sessions WHERE id = ? AND user_id = ? AND completed_at IS NULL").bind(workoutId, userId).first<SessionRow>()
    : await database.prepare("SELECT id, plan_name, plan_day_id, started_at FROM workout_sessions WHERE user_id = ? AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1").bind(userId).first<SessionRow>();
  if (!session) return null;

  const [exerciseResult, setResult, lastLoadResult] = await Promise.all([
    database.prepare("SELECT * FROM workout_exercises WHERE workout_session_id = ? AND user_id = ? ORDER BY position").bind(session.id, userId).all<ExerciseRow>(),
    database.prepare("SELECT id, workout_exercise_id, exercise_id, set_index, tracking_type, weight_kg, left_weight_kg, right_weight_kg, reps, duration_seconds, completed_at FROM workout_sets WHERE workout_session_id = ? AND user_id = ? ORDER BY completed_at").bind(session.id, userId).all<SetRow>(),
    database.prepare("SELECT exercise_id, weight_kg, left_weight_kg, right_weight_kg FROM workout_sets WHERE user_id = ? AND workout_session_id <> ? AND tracking_type = 'weight_reps' ORDER BY completed_at DESC").bind(userId, session.id).all<LastLoadRow>(),
  ]);
  const lastLoads = new Map<string, LastLoadRow>();
  for (const row of lastLoadResult.results) if (!lastLoads.has(row.exercise_id)) lastLoads.set(row.exercise_id, row);

  const exercises: WorkoutExercise[] = exerciseResult.results.map((row) => {
    const lastLoad = lastLoads.get(row.exercise_id);
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
      restSeconds: row.rest_seconds,
      speedMin: row.speed_min,
      speedMax: row.speed_max,
      notes: row.notes,
      alternativeExerciseId: row.alternative_exercise_id,
      alternativeName: row.alternative_name,
      alternativeEquipment: row.alternative_equipment,
      position: row.position,
      skipped: Boolean(row.skipped),
      completedAt: row.completed_at,
      sets: setResult.results.filter((set) => set.workout_exercise_id === row.id).map(mapSet),
      lastWeightKg: lastLoad?.weight_kg ?? 0,
      lastLeftWeightKg: lastLoad?.left_weight_kg ?? null,
      lastRightWeightKg: lastLoad?.right_weight_kg ?? null,
    };
  });

  return { id: session.id, planName: session.plan_name, planDayId: session.plan_day_id, startedAt: session.started_at, exercises };
}

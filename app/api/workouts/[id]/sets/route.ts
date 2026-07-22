import { ensureDatabase, getD1 } from "@/db";
import { getSessionUser } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";
import { getWorkout } from "@/lib/server/workouts";
import { shanghaiDateKey } from "@/lib/daily-workout-domain";
import type { TrackingType, WeightMode } from "@/lib/training";

type ExerciseRow = {
  id: string;
  exercise_id: string;
  name: string;
  muscle_group: string;
  tracking_type: TrackingType;
  weight_mode: WeightMode;
  max_sets: number;
  completed_at: number | null;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    const { id: workoutId } = await context.params;
    const body = await readJsonObject(request);
    const workoutExerciseId = typeof body?.workoutExerciseId === "string" ? body.workoutExerciseId.trim().slice(0, 80) : "";
    const setIndex = typeof body?.setIndex === "number" ? Math.round(body.setIndex) : 0;
    const reps = typeof body?.reps === "number" ? Math.round(body.reps) : 0;
    const durationSeconds = typeof body?.durationSeconds === "number" ? Math.round(body.durationSeconds) : 0;
    const rawWeight = typeof body?.weightKg === "number" ? body.weightKg : 0;
    const leftWeightKg = typeof body?.leftWeightKg === "number" ? body.leftWeightKg : null;
    const rightWeightKg = typeof body?.rightWeightKg === "number" ? body.rightWeightKg : null;
    const effort = typeof body?.effort === "number" ? Math.round(body.effort) : null;
    if (!workoutExerciseId || setIndex < 1 || setIndex > 30) return jsonError(400, "BAD_REQUEST", "训练组数据不正确");

    await ensureDatabase();
    const database = getD1();
    const session = await database.prepare(
      "SELECT completed_at, training_date, finalized_at FROM workout_sessions WHERE id = ? AND user_id = ? AND workout_type = 'plan'",
    ).bind(workoutId, user.id).first<{ completed_at: number | null; training_date: string | null; finalized_at: number | null }>();
    if (!session) return jsonError(404, "NOT_FOUND", "当前训练不存在");
    if (session.finalized_at || session.training_date !== shanghaiDateKey()) return jsonError(409, "WORKOUT_FINALIZED", "这条训练已跨日冻结");
    if (session.completed_at) return jsonError(409, "CONFLICT", "今日训练已完成");
    const exercise = await database.prepare(
      `SELECT workout_exercises.id, workout_exercises.exercise_id, workout_exercises.name, workout_exercises.muscle_group,
        workout_exercises.tracking_type, workout_exercises.weight_mode, workout_exercises.max_sets, workout_exercises.completed_at
       FROM workout_exercises JOIN workout_sessions ON workout_sessions.id = workout_exercises.workout_session_id
       WHERE workout_exercises.id = ? AND workout_exercises.workout_session_id = ? AND workout_exercises.user_id = ?
         AND workout_sessions.completed_at IS NULL AND workout_sessions.finalized_at IS NULL
         AND workout_sessions.training_date = ? AND workout_exercises.removed_from_plan_at IS NULL`,
    ).bind(workoutExerciseId, workoutId, user.id, shanghaiDateKey()).first<ExerciseRow>();
    if (!exercise) return jsonError(404, "NOT_FOUND", "当前训练动作不存在");
    if (exercise.completed_at) return jsonError(409, "CONFLICT", "这个动作已经完成");
    if (setIndex > exercise.max_sets) return jsonError(400, "BAD_REQUEST", "训练组数超出计划范围");

    const isDuration = exercise.tracking_type === "duration" || exercise.tracking_type === "bodyweight_duration";
    const isReps = exercise.tracking_type === "weight_reps" || exercise.tracking_type === "bodyweight_reps";
    if (isDuration && (durationSeconds < 1 || durationSeconds > 4 * 60 * 60)) return jsonError(400, "BAD_REQUEST", "训练时长不正确");
    if (isReps && (reps < 1 || reps > 300)) return jsonError(400, "BAD_REQUEST", "训练次数不正确");
    if (rawWeight < 0 || rawWeight > 2000 || (leftWeightKg !== null && (leftWeightKg < 0 || leftWeightKg > 1000)) || (rightWeightKg !== null && (rightWeightKg < 0 || rightWeightKg > 1000))) {
      return jsonError(400, "BAD_REQUEST", "训练重量不正确");
    }
    if (effort !== null && (effort < 1 || effort > 5)) return jsonError(400, "BAD_REQUEST", "训练感受应为 1 到 5");
    const weightKg = exercise.weight_mode === "per_side" ? (leftWeightKg ?? 0) + (rightWeightKg ?? 0) : rawWeight;
    const completedAt = Date.now();
    const setId = crypto.randomUUID();
    await database.prepare(
      `INSERT INTO workout_sets
       (id, workout_session_id, user_id, exercise_id, exercise_name, muscle_group, set_index, weight_kg, reps, completed_at,
        workout_exercise_id, tracking_type, duration_seconds, left_weight_kg, right_weight_kg, effort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workout_exercise_id, set_index) DO UPDATE SET
       weight_kg = excluded.weight_kg, reps = excluded.reps, completed_at = excluded.completed_at,
       tracking_type = excluded.tracking_type, duration_seconds = excluded.duration_seconds,
       left_weight_kg = excluded.left_weight_kg, right_weight_kg = excluded.right_weight_kg, effort = excluded.effort`,
    ).bind(setId, workoutId, user.id, exercise.exercise_id, exercise.name, exercise.muscle_group, setIndex, weightKg, reps, completedAt,
      workoutExerciseId, exercise.tracking_type, durationSeconds, leftWeightKg, rightWeightKg, effort).run();
    return jsonOk({ workout: await getWorkout(user.id, workoutId) }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}

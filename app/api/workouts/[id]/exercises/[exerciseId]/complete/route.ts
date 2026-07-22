import { ensureDatabase, getD1 } from "@/db";
import { getSessionUser } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";
import { getWorkout, recalculatePlanWorkoutCompletion } from "@/lib/server/workouts";
import { shanghaiDateKey } from "@/lib/daily-workout-domain";

type ExerciseRow = { id: string; min_sets: number; completed_at: number | null };

export async function POST(request: Request, context: { params: Promise<{ id: string; exerciseId: string }> }): Promise<Response> {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    const { id: workoutId, exerciseId } = await context.params;
    const body = await readJsonObject(request);
    const skipped = body?.skipped === true;
    await ensureDatabase();
    const database = getD1();
    const session = await database.prepare(
      "SELECT completed_at, training_date, finalized_at FROM workout_sessions WHERE id = ? AND user_id = ? AND workout_type = 'plan'",
    ).bind(workoutId, user.id).first<{ completed_at: number | null; training_date: string | null; finalized_at: number | null }>();
    if (!session) return jsonError(404, "NOT_FOUND", "当前训练不存在");
    if (session.finalized_at || session.training_date !== shanghaiDateKey()) return jsonError(409, "WORKOUT_FINALIZED", "这条训练已跨日冻结");
    if (session.completed_at) return jsonOk({ workout: await getWorkout(user.id, workoutId) });
    const exercise = await database.prepare(
      `SELECT workout_exercises.id, workout_exercises.min_sets, workout_exercises.completed_at
       FROM workout_exercises JOIN workout_sessions ON workout_sessions.id = workout_exercises.workout_session_id
       WHERE workout_exercises.id = ? AND workout_exercises.workout_session_id = ? AND workout_exercises.user_id = ?
         AND workout_sessions.completed_at IS NULL AND workout_sessions.finalized_at IS NULL
         AND workout_sessions.training_date = ? AND workout_exercises.removed_from_plan_at IS NULL`,
    ).bind(exerciseId, workoutId, user.id, shanghaiDateKey()).first<ExerciseRow>();
    if (!exercise) return jsonError(404, "NOT_FOUND", "当前训练动作不存在");
    if (exercise.completed_at) return jsonOk({ workout: await getWorkout(user.id, workoutId) });
    const setCount = await database.prepare(
      "SELECT COUNT(*) AS count FROM workout_sets WHERE workout_session_id = ? AND workout_exercise_id = ? AND user_id = ?",
    ).bind(workoutId, exerciseId, user.id).first<{ count: number }>();
    if (!skipped && (setCount?.count ?? 0) < exercise.min_sets) return jsonError(409, "CONFLICT", `至少完成 ${exercise.min_sets} 组后才能结束动作`);
    await database.prepare("UPDATE workout_exercises SET completed_at = ?, skipped = ? WHERE id = ? AND user_id = ?")
      .bind(Date.now(), skipped ? 1 : 0, exerciseId, user.id).run();
    return jsonOk({ workout: await recalculatePlanWorkoutCompletion(user.id, workoutId) });
  } catch (error) {
    return serverError(error);
  }
}

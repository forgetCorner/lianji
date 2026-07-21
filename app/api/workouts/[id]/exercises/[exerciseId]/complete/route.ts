import { ensureDatabase, getD1 } from "@/db";
import { getSessionUser } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";
import { getActiveWorkout } from "@/lib/server/workouts";

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
    const exercise = await database.prepare(
      `SELECT workout_exercises.id, workout_exercises.min_sets, workout_exercises.completed_at
       FROM workout_exercises JOIN workout_sessions ON workout_sessions.id = workout_exercises.workout_session_id
       WHERE workout_exercises.id = ? AND workout_exercises.workout_session_id = ? AND workout_exercises.user_id = ?
         AND workout_sessions.completed_at IS NULL`,
    ).bind(exerciseId, workoutId, user.id).first<ExerciseRow>();
    if (!exercise) return jsonError(404, "NOT_FOUND", "当前训练动作不存在");
    if (exercise.completed_at) return jsonOk({ workout: await getActiveWorkout(user.id, workoutId) });
    const setCount = await database.prepare(
      "SELECT COUNT(*) AS count FROM workout_sets WHERE workout_session_id = ? AND workout_exercise_id = ? AND user_id = ?",
    ).bind(workoutId, exerciseId, user.id).first<{ count: number }>();
    if (!skipped && (setCount?.count ?? 0) < exercise.min_sets) return jsonError(409, "CONFLICT", `至少完成 ${exercise.min_sets} 组后才能结束动作`);
    await database.prepare("UPDATE workout_exercises SET completed_at = ?, skipped = ? WHERE id = ? AND user_id = ?")
      .bind(Date.now(), skipped ? 1 : 0, exerciseId, user.id).run();
    return jsonOk({ workout: await getActiveWorkout(user.id, workoutId) });
  } catch (error) {
    return serverError(error);
  }
}

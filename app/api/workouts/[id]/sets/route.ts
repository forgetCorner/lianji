import { ensureDatabase, getD1 } from "@/db";
import { getSessionUser } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    const { id: workoutId } = await context.params;
    const body = await readJsonObject(request);
    const exerciseId = typeof body?.exerciseId === "string" ? body.exerciseId.trim().slice(0, 60) : "";
    const exerciseName = typeof body?.exerciseName === "string" ? body.exerciseName.trim().slice(0, 60) : "";
    const muscleGroup = typeof body?.muscleGroup === "string" ? body.muscleGroup.trim().slice(0, 60) : "";
    const setIndex = typeof body?.setIndex === "number" ? Math.round(body.setIndex) : 0;
    const weightKg = typeof body?.weightKg === "number" ? body.weightKg : Number.NaN;
    const reps = typeof body?.reps === "number" ? Math.round(body.reps) : 0;
    if (!exerciseId || !exerciseName || setIndex < 1 || setIndex > 30 || !Number.isFinite(weightKg) || weightKg < 0 || weightKg > 1000 || reps < 1 || reps > 200) {
      return jsonError(400, "BAD_REQUEST", "训练组数据不正确");
    }

    await ensureDatabase();
    const database = getD1();
    const workout = await database.prepare(
      "SELECT id, completed_at FROM workout_sessions WHERE id = ? AND user_id = ?",
    ).bind(workoutId, user.id).first<{ id: string; completed_at: number | null }>();
    if (!workout) return jsonError(404, "NOT_FOUND", "训练不存在");
    if (workout.completed_at) return jsonError(409, "CONFLICT", "这次训练已经完成");

    const set = { id: crypto.randomUUID(), workoutId, exerciseId, exerciseName, muscleGroup, setIndex, weightKg, reps, completedAt: Date.now() };
    await database.prepare(
      `INSERT INTO workout_sets (id, workout_session_id, user_id, exercise_id, exercise_name, muscle_group, set_index, weight_kg, reps, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workout_session_id, exercise_id, set_index) DO UPDATE SET
       weight_kg = excluded.weight_kg, reps = excluded.reps, completed_at = excluded.completed_at`,
    ).bind(set.id, workoutId, user.id, exerciseId, exerciseName, muscleGroup, setIndex, weightKg, reps, set.completedAt).run();
    return jsonOk({ set }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}

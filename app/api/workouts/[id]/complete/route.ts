import { ensureDatabase, getD1 } from "@/db";
import { shanghaiDateKey } from "@/lib/daily-workout-domain";
import { getSessionUser } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";
import { recalculatePlanWorkoutCompletion } from "@/lib/server/workouts";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 1000) : "";

    await ensureDatabase();
    const database = getD1();
    const incomplete = await database.prepare(
      "SELECT COUNT(*) AS count FROM workout_exercises WHERE workout_session_id = ? AND user_id = ? AND removed_from_plan_at IS NULL AND completed_at IS NULL",
    ).bind(id, user.id).first<{ count: number }>();
    if ((incomplete?.count ?? 0) > 0) return jsonError(409, "CONFLICT", "还有动作未完成");
    const writable = await database.prepare(
      "SELECT id FROM workout_sessions WHERE id = ? AND user_id = ? AND workout_type = 'plan' AND training_date = ? AND finalized_at IS NULL",
    ).bind(id, user.id, shanghaiDateKey()).first<{ id: string }>();
    if (!writable) return jsonError(409, "WORKOUT_FINALIZED", "这条训练已跨日冻结");
    await database.prepare("UPDATE workout_sessions SET notes = ? WHERE id = ? AND user_id = ?").bind(notes, id, user.id).run();
    return jsonOk({ workout: await recalculatePlanWorkoutCompletion(user.id, id) });
  } catch (error) {
    return serverError(error);
  }
}

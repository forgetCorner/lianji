import { ensureDatabase, getD1 } from "@/db";
import { getSessionUser } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    const limitParam = new URL(request.url).searchParams.get("limit");
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
    const result = await getD1().prepare(
      `SELECT workout_sessions.id, workout_sessions.plan_name, workout_sessions.started_at, workout_sessions.completed_at,
        workout_sessions.duration_seconds, workout_sessions.notes,
        COUNT(workout_sets.id) AS set_count,
        COALESCE(SUM(workout_sets.weight_kg * workout_sets.reps), 0) AS volume_kg
       FROM workout_sessions LEFT JOIN workout_sets ON workout_sets.workout_session_id = workout_sessions.id
       WHERE workout_sessions.user_id = ?
       GROUP BY workout_sessions.id ORDER BY workout_sessions.started_at DESC LIMIT ?`,
    ).bind(user.id, limit).all();
    return jsonOk({ workouts: result.results });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    const body = await readJsonObject(request);
    const planName = typeof body?.planName === "string" ? body.planName.trim().slice(0, 60) : "";
    const startedAt = typeof body?.startedAt === "number" ? Math.round(body.startedAt) : Date.now();
    if (!planName) return jsonError(400, "BAD_REQUEST", "训练计划名称不能为空");
    if (startedAt > Date.now() + 60_000 || startedAt < Date.now() - 7 * 24 * 60 * 60 * 1000) {
      return jsonError(400, "BAD_REQUEST", "训练开始时间无效");
    }

    await ensureDatabase();
    const workout = { id: crypto.randomUUID(), planName, startedAt, completedAt: null, durationSeconds: 0, notes: "" };
    await getD1().prepare(
      "INSERT INTO workout_sessions (id, user_id, plan_name, started_at, completed_at, duration_seconds, notes) VALUES (?, ?, ?, ?, NULL, 0, '')",
    ).bind(workout.id, user.id, planName, startedAt).run();
    return jsonOk({ workout }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}

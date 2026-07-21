import { ensureDatabase, getD1 } from "@/db";
import { getSessionUser } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const completedAt = Date.now();
    const durationSeconds = typeof body?.durationSeconds === "number" ? Math.max(0, Math.min(24 * 60 * 60, Math.round(body.durationSeconds))) : 0;
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 1000) : "";

    await ensureDatabase();
    const result = await getD1().prepare(
      "UPDATE workout_sessions SET completed_at = ?, duration_seconds = ?, notes = ? WHERE id = ? AND user_id = ? AND completed_at IS NULL",
    ).bind(completedAt, durationSeconds, notes, id, user.id).run();
    if (!result.meta.changes) return jsonError(404, "NOT_FOUND", "未找到可完成的训练");
    return jsonOk({ workout: { id, completedAt, durationSeconds, notes } });
  } catch (error) {
    return serverError(error);
  }
}

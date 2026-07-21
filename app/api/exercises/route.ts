import { ensureDatabase, getD1 } from "@/db";
import { getSessionUser } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";
import { exerciseLibrary, type ExerciseDefinition, type TrackingType, type WeightMode } from "@/lib/training";

type CustomRow = {
  id: string;
  name: string;
  equipment: string;
  muscle_group: string;
  tracking_type: TrackingType;
  weight_mode: WeightMode;
};

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    await ensureDatabase();
    const custom = await getD1().prepare(
      "SELECT id, name, equipment, muscle_group, tracking_type, weight_mode FROM custom_exercises WHERE user_id = ? ORDER BY updated_at DESC",
    ).bind(user.id).all<CustomRow>();
    return jsonOk({
      exercises: [
        ...exerciseLibrary,
        ...custom.results.map((row) => ({ exerciseId: row.id, name: row.name, equipment: row.equipment, muscleGroup: row.muscle_group, trackingType: row.tracking_type, weightMode: row.weight_mode })),
      ],
    });
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
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
    const equipment = typeof body?.equipment === "string" ? body.equipment.trim().slice(0, 60) : "";
    const muscleGroup = typeof body?.muscleGroup === "string" ? body.muscleGroup.trim().slice(0, 60) : "";
    const trackingType = (["weight_reps", "duration", "bodyweight_reps", "bodyweight_duration"] as const).includes(body?.trackingType as TrackingType) ? body?.trackingType as TrackingType : "weight_reps";
    const weightMode = (["total", "per_side", "none"] as const).includes(body?.weightMode as WeightMode) ? body?.weightMode as WeightMode : "total";
    if (!name) return jsonError(400, "BAD_REQUEST", "动作名称不能为空");
    await ensureDatabase();
    const now = Date.now();
    const exercise: ExerciseDefinition = { exerciseId: crypto.randomUUID(), name, equipment, muscleGroup, trackingType, weightMode };
    await getD1().prepare(
      `INSERT INTO custom_exercises (id, user_id, name, equipment, muscle_group, tracking_type, weight_mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, name) DO UPDATE SET equipment = excluded.equipment, muscle_group = excluded.muscle_group,
       tracking_type = excluded.tracking_type, weight_mode = excluded.weight_mode, updated_at = excluded.updated_at`,
    ).bind(exercise.exerciseId, user.id, name, equipment, muscleGroup, trackingType, weightMode, now, now).run();
    return jsonOk({ exercise }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}

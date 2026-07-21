import { ensureDatabase, getD1 } from "@/db";
import { getSessionUser } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";
import { getActivePlan } from "@/lib/server/plans";
import { getActiveWorkout } from "@/lib/server/workouts";

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
    const planDayId = typeof body?.planDayId === "string" ? body.planDayId.trim().slice(0, 80) : "";
    const selections = body?.selections && typeof body.selections === "object" && !Array.isArray(body.selections) ? body.selections as Record<string, unknown> : {};
    const startedAt = typeof body?.startedAt === "number" ? Math.round(body.startedAt) : Date.now();
    if (!planDayId) return jsonError(400, "BAD_REQUEST", "请选择要开始的训练计划");
    if (startedAt > Date.now() + 60_000 || startedAt < Date.now() - 7 * 24 * 60 * 60 * 1000) {
      return jsonError(400, "BAD_REQUEST", "训练开始时间无效");
    }

    await ensureDatabase();
    const existing = await getActiveWorkout(user.id);
    if (existing) return jsonError(409, "CONFLICT", "你还有一场未完成的训练，请先继续或完成它");
    const plan = await getActivePlan(user.id);
    const day = plan.days.find((item) => item.id === planDayId);
    if (!day || !day.exercises.length) return jsonError(404, "NOT_FOUND", "这一天还没有可执行的训练动作");
    const database = getD1();
    const workout = { id: crypto.randomUUID(), planName: day.name, planDayId: day.id, startedAt, completedAt: null, durationSeconds: 0, notes: "" };
    const statements = [database.prepare(
      `INSERT INTO workout_sessions (id, user_id, plan_name, started_at, completed_at, duration_seconds, notes, plan_id, plan_day_id, plan_version)
       VALUES (?, ?, ?, ?, NULL, 0, '', ?, ?, ?)`,
    ).bind(workout.id, user.id, day.name, startedAt, plan.id, day.id, plan.version)];
    for (const exercise of day.exercises) {
      const useAlternative = selections[exercise.id] === "alternative" && exercise.alternativeName;
      const exerciseId = useAlternative ? exercise.alternativeExerciseId! : exercise.exerciseId;
      const name = useAlternative ? exercise.alternativeName! : exercise.name;
      const equipment = useAlternative ? exercise.alternativeEquipment ?? "" : exercise.equipment;
      statements.push(database.prepare(
        `INSERT INTO workout_exercises
         (id, workout_session_id, user_id, plan_exercise_id, exercise_id, name, equipment, muscle_group, tracking_type, weight_mode,
          min_sets, max_sets, min_reps, max_reps, min_duration_seconds, max_duration_seconds, rest_seconds,
          speed_min, speed_max, notes, alternative_exercise_id, alternative_name, alternative_equipment, position, skipped, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      ).bind(crypto.randomUUID(), workout.id, user.id, exercise.id, exerciseId, name, equipment, exercise.muscleGroup, exercise.trackingType, exercise.weightMode,
        exercise.minSets, exercise.maxSets, exercise.minReps, exercise.maxReps, exercise.minDurationSeconds, exercise.maxDurationSeconds, exercise.restSeconds,
        exercise.speedMin, exercise.speedMax, exercise.notes, exercise.alternativeExerciseId, exercise.alternativeName, exercise.alternativeEquipment, exercise.position));
    }
    await database.batch(statements);
    return jsonOk({ workout: await getActiveWorkout(user.id, workout.id) }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}

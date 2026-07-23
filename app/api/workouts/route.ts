import { ensureDatabase, getD1 } from "@/db";
import { getSessionUser } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";
import { getActivePlan, shanghaiWeekday } from "@/lib/server/plans";
import { getTodayWorkoutState, getWorkout } from "@/lib/server/workouts";
import { shanghaiDateKey } from "@/lib/daily-workout-domain";
import { trainingDayDisplayName } from "@/lib/training";

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
    if (shanghaiDateKey(startedAt) !== shanghaiDateKey()) return jsonError(400, "BAD_REQUEST", "只能开始今天的计划训练");

    await ensureDatabase();
    const plan = await getActivePlan(user.id);
    const database = getD1();
    const now = Date.now();
    const day = plan.days.find((item) => item.weekday === shanghaiWeekday(now));
    if (!day?.enabled || !day.exercises.length) return jsonError(409, "CONFLICT", "今天是恢复日，没有安排计划训练");
    if (day.id !== planDayId) return jsonError(409, "CONFLICT", "只能开始今天安排的训练计划");
    const existing = await getTodayWorkoutState(user.id);
    if (existing.status === "completed") return jsonError(409, "TODAY_PLAN_COMPLETED", "今日计划训练已完成");
    if (existing.status === "in_progress") return jsonOk(existing);
    const planName = trainingDayDisplayName(day.name);
    const workout = { id: crypto.randomUUID(), planName, planDayId: day.id, startedAt, completedAt: null, durationSeconds: 0, notes: "" };
    const statements = [database.prepare(
      `INSERT INTO workout_sessions
       (id, user_id, plan_name, started_at, completed_at, duration_seconds, notes, plan_id, plan_day_id, plan_version,
        workout_type, training_date, finalized_at, synced_plan_version, resumed_at)
       VALUES (?, ?, ?, ?, NULL, 0, '', ?, ?, ?, 'plan', ?, NULL, ?, ?)`,
    ).bind(workout.id, user.id, planName, startedAt, plan.id, day.id, plan.version, shanghaiDateKey(now), plan.version, now)];
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
    try {
      await database.batch(statements);
    } catch (error) {
      const concurrent = await getTodayWorkoutState(user.id);
      if (concurrent.status !== "not_started") return concurrent.status === "completed"
        ? jsonError(409, "TODAY_PLAN_COMPLETED", "今日计划训练已完成")
        : jsonOk(concurrent);
      throw error;
    }
    return jsonOk({ status: "in_progress", workout: await getWorkout(user.id, workout.id) }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}

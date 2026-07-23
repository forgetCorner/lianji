import { getSessionUser } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";
import { getActivePlan, replaceActivePlan } from "@/lib/server/plans";
import { reconcileTodayPlanWorkout } from "@/lib/server/workouts";
import { exerciseLibrary, MAX_SETS_PER_EXERCISE, restSecondsForSets, type PlanExercise, type TrackingType, type TrainingDay, type TrainingPlan, type WeightMode } from "@/lib/training";

const trackingTypes = new Set<TrackingType>(["weight_reps", "duration", "bodyweight_reps", "bodyweight_duration"]);
const weightModes = new Set<WeightMode>(["total", "per_side", "none"]);

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

function nullableNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null;
}

function exceedsSetLimit(body: Record<string, unknown> | null): boolean {
  if (!body || !Array.isArray(body.days)) return false;
  return body.days.some((day) => {
    if (!day || typeof day !== "object" || Array.isArray(day)) return false;
    const exercises = (day as Record<string, unknown>).exercises;
    if (!Array.isArray(exercises)) return false;
    return exercises.some((exercise) => {
      if (!exercise || typeof exercise !== "object" || Array.isArray(exercise)) return false;
      const row = exercise as Record<string, unknown>;
      return (typeof row.minSets === "number" && row.minSets > MAX_SETS_PER_EXERCISE)
        || (typeof row.maxSets === "number" && row.maxSets > MAX_SETS_PER_EXERCISE);
    });
  });
}

function parseExercise(value: unknown, position: number): PlanExercise | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const name = text(row.name, 60);
  if (!name) return null;
  const exerciseId = text(row.exerciseId, 80) || `custom-${crypto.randomUUID()}`;
  const definition = exerciseLibrary.find((exercise) => exercise.exerciseId === exerciseId);
  const requestedTrackingType = trackingTypes.has(row.trackingType as TrackingType) ? row.trackingType as TrackingType : "weight_reps";
  const trackingType = definition?.trackingType ?? requestedTrackingType;
  const requestedWeightMode = weightModes.has(row.weightMode as WeightMode) ? row.weightMode as WeightMode : null;
  const weightMode = trackingType === "weight_reps"
    ? requestedWeightMode === "total" || requestedWeightMode === "per_side"
      ? requestedWeightMode
      : definition?.weightMode === "per_side" ? "per_side" : "total"
    : "none";
  const minSets = integer(row.minSets, 3, 1, MAX_SETS_PER_EXERCISE);
  const maxSets = integer(row.maxSets, minSets, minSets, MAX_SETS_PER_EXERCISE);
  const minReps = integer(row.minReps, trackingType.endsWith("reps") ? 10 : 0, 0, 300);
  const maxReps = integer(row.maxReps, minReps, minReps, 300);
  const minDurationSeconds = integer(row.minDurationSeconds, trackingType.includes("duration") ? 60 : 0, 0, 4 * 60 * 60);
  const maxDurationSeconds = integer(row.maxDurationSeconds, minDurationSeconds, minDurationSeconds, 4 * 60 * 60);
  return {
    id: text(row.id, 80) || crypto.randomUUID(),
    exerciseId,
    name,
    equipment: definition?.equipment ?? text(row.equipment, 60),
    muscleGroup: definition?.muscleGroup ?? text(row.muscleGroup, 60),
    trackingType,
    weightMode,
    minSets,
    maxSets,
    minReps,
    maxReps,
    minDurationSeconds,
    maxDurationSeconds,
    restSeconds: restSecondsForSets(maxSets),
    speedMin: nullableNumber(row.speedMin, 0, 50),
    speedMax: nullableNumber(row.speedMax, 0, 50),
    notes: text(row.notes, 300),
    alternativeExerciseId: text(row.alternativeExerciseId, 80) || null,
    alternativeName: text(row.alternativeName, 60) || null,
    alternativeEquipment: text(row.alternativeEquipment, 60) || null,
    position,
  };
}

function parsePlan(body: Record<string, unknown> | null): TrainingPlan | null {
  if (!body || !Array.isArray(body.days)) return null;
  const id = text(body.id, 80);
  const name = text(body.name, 60);
  const version = integer(body.version, 0, 1, Number.MAX_SAFE_INTEGER);
  if (!id || !name || !version || body.days.length !== 7) return null;
  const seen = new Set<number>();
  const dayIds = new Set<string>();
  const exerciseIds = new Set<string>();
  const days: TrainingDay[] = [];
  for (const [position, value] of body.days.entries()) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const weekday = integer(row.weekday, 0, 1, 7);
    if (!weekday || seen.has(weekday) || !Array.isArray(row.exercises) || row.exercises.length > 30) return null;
    seen.add(weekday);
    const exercises = row.exercises.map(parseExercise).filter((exercise): exercise is PlanExercise => Boolean(exercise));
    if (exercises.length !== row.exercises.length) return null;
    const dayId = text(row.id, 80) || crypto.randomUUID();
    if (dayIds.has(dayId) || exercises.some((exercise) => exerciseIds.has(exercise.id))) return null;
    dayIds.add(dayId);
    exercises.forEach((exercise) => exerciseIds.add(exercise.id));
    const enabled = Boolean(row.enabled);
    if (enabled && !exercises.length) return null;
    days.push({
      id: dayId,
      weekday,
      name: text(row.name, 60),
      focus: text(row.focus, 100),
      enabled,
      position,
      exercises,
    });
  }
  return { id, name, version, updatedAt: 0, days };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    return jsonOk({ plan: await getActivePlan(user.id) });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    const body = await readJsonObject(request);
    if (exceedsSetLimit(body)) return jsonError(400, "BAD_REQUEST", `每个动作最多 ${MAX_SETS_PER_EXERCISE} 组`);
    const plan = parsePlan(body);
    if (!plan) return jsonError(400, "BAD_REQUEST", "训练计划数据不完整");
    const saved = await replaceActivePlan(user.id, plan);
    if (!saved) return jsonError(409, "CONFLICT", "计划已在其他设备更新，请重新加载后再保存");
    return jsonOk({ plan: saved, todayWorkout: await reconcileTodayPlanWorkout(user.id, saved) });
  } catch (error) {
    return serverError(error);
  }
}

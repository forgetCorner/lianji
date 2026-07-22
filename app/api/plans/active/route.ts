import { getSessionUser } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";
import { getActivePlan, replaceActivePlan } from "@/lib/server/plans";
import { reconcileTodayPlanWorkout } from "@/lib/server/workouts";
import type { PlanExercise, TrackingType, TrainingDay, TrainingPlan, WeightMode } from "@/lib/training";

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

function parseExercise(value: unknown, position: number): PlanExercise | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const name = text(row.name, 60);
  if (!name) return null;
  const trackingType = trackingTypes.has(row.trackingType as TrackingType) ? row.trackingType as TrackingType : "weight_reps";
  const weightMode = weightModes.has(row.weightMode as WeightMode) ? row.weightMode as WeightMode : trackingType.includes("bodyweight") || trackingType === "duration" ? "none" : "total";
  const minSets = integer(row.minSets, 3, 1, 12);
  const maxSets = integer(row.maxSets, minSets, minSets, 12);
  const minReps = integer(row.minReps, trackingType.endsWith("reps") ? 10 : 0, 0, 300);
  const maxReps = integer(row.maxReps, minReps, minReps, 300);
  const minDurationSeconds = integer(row.minDurationSeconds, trackingType.includes("duration") ? 60 : 0, 0, 4 * 60 * 60);
  const maxDurationSeconds = integer(row.maxDurationSeconds, minDurationSeconds, minDurationSeconds, 4 * 60 * 60);
  return {
    id: text(row.id, 80) || crypto.randomUUID(),
    exerciseId: text(row.exerciseId, 80) || `custom-${crypto.randomUUID()}`,
    name,
    equipment: text(row.equipment, 60),
    muscleGroup: text(row.muscleGroup, 60),
    trackingType,
    weightMode,
    minSets,
    maxSets,
    minReps,
    maxReps,
    minDurationSeconds,
    maxDurationSeconds,
    restSeconds: integer(row.restSeconds, 90, 0, 15 * 60),
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
      name: text(row.name, 60) || "训练日",
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
    const plan = parsePlan(await readJsonObject(request));
    if (!plan) return jsonError(400, "BAD_REQUEST", "训练计划数据不完整");
    const saved = await replaceActivePlan(user.id, plan);
    if (!saved) return jsonError(409, "CONFLICT", "计划已在其他设备更新，请重新加载后再保存");
    return jsonOk({ plan: saved, todayWorkout: await reconcileTodayPlanWorkout(user.id, saved) });
  } catch (error) {
    return serverError(error);
  }
}

export const WORKOUT_HISTORY_PREVIEW_SIZE = 6;
export const INITIAL_WORKOUT_HISTORY_LIMIT = 10;
export const WORKOUT_HISTORY_PAGE_SIZE = 10;

export type WorkoutSummary = {
  id: string;
  plan_name: string;
  started_at: number;
  completed_at: number | null;
  duration_seconds: number;
  set_count: number;
  volume_kg: number;
};

export type WorkoutHistoryPageInfo = {
  hasMore: boolean;
  nextCursor: string | null;
};

export type WorkoutHistoryPageResponse = {
  workouts: WorkoutSummary[];
  pageInfo: WorkoutHistoryPageInfo;
};

export type NormalizedWorkoutHistoryPage = {
  records: WorkoutSummary[];
  hasMore: boolean;
  nextCursor: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown, field: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    throw new Error(`训练历史响应字段 ${field} 无效`);
  }
  return value;
}

function normalizeWorkout(value: unknown, index: number): WorkoutSummary {
  if (!isRecord(value)) throw new Error(`训练历史第 ${index + 1} 条记录无效`);
  if (typeof value.id !== "string" || !value.id.trim())
    throw new Error(`训练历史第 ${index + 1} 条记录缺少 ID`);
  if (typeof value.plan_name !== "string" || !value.plan_name.trim())
    throw new Error(`训练历史第 ${index + 1} 条记录缺少名称`);
  if (
    value.completed_at === null ||
    typeof value.completed_at !== "number" ||
    !Number.isFinite(value.completed_at)
  ) {
    throw new Error(`训练历史第 ${index + 1} 条记录尚未完成`);
  }

  const setCount = finiteNumber(value.set_count, "set_count");
  if (!Number.isInteger(setCount))
    throw new Error(`训练历史第 ${index + 1} 条记录组数无效`);

  return {
    id: value.id,
    plan_name: value.plan_name,
    started_at: finiteNumber(value.started_at, "started_at", 1),
    completed_at: finiteNumber(value.completed_at, "completed_at", 1),
    duration_seconds: finiteNumber(value.duration_seconds, "duration_seconds"),
    set_count: setCount,
    volume_kg: finiteNumber(value.volume_kg, "volume_kg"),
  };
}

export function normalizeWorkoutHistoryPageResponse(
  raw: unknown,
): NormalizedWorkoutHistoryPage {
  if (
    !isRecord(raw) ||
    !Array.isArray(raw.workouts) ||
    !isRecord(raw.pageInfo)
  ) {
    throw new Error("训练历史响应结构无效");
  }

  const records = raw.workouts.map(normalizeWorkout);
  const { hasMore, nextCursor } = raw.pageInfo;
  if (typeof hasMore !== "boolean") throw new Error("训练历史分页状态无效");
  if (
    nextCursor !== null &&
    (typeof nextCursor !== "string" || !nextCursor.trim())
  ) {
    throw new Error("训练历史下一页游标无效");
  }
  if (hasMore && (!nextCursor || records.length === 0)) {
    throw new Error("训练历史分页响应无法继续");
  }
  if (!hasMore && nextCursor !== null) {
    throw new Error("训练历史末页游标无效");
  }

  return { records, hasMore, nextCursor };
}

export function mergeWorkoutHistoryRecords(
  current: WorkoutSummary[],
  incoming: WorkoutSummary[],
) {
  const knownIds = new Set(current.map((record) => record.id));
  const addedRecords = incoming.filter((record) => {
    if (knownIds.has(record.id)) return false;
    knownIds.add(record.id);
    return true;
  });
  return { records: [...current, ...addedRecords], addedRecords };
}

import { ensureDatabase, getD1 } from "@/db";
import { normalizeLegacyTrainingDayFocus, normalizeLegacyTrainingDayName, restSecondsForSets } from "@/lib/training";
import type { PlanExercise, TrackingType, TrainingPlan, WeightMode } from "@/lib/training";

type PlanRow = { id: string; name: string; version: number; updated_at: number };
type DayRow = { id: string; weekday: number; name: string; focus: string; enabled: number; position: number };
type ExerciseRow = {
  id: string;
  plan_day_id: string;
  exercise_id: string;
  name: string;
  equipment: string;
  muscle_group: string;
  tracking_type: TrackingType;
  weight_mode: WeightMode;
  min_sets: number;
  max_sets: number;
  min_reps: number;
  max_reps: number;
  min_duration_seconds: number;
  max_duration_seconds: number;
  rest_seconds: number;
  speed_min: number | null;
  speed_max: number | null;
  notes: string;
  alternative_exercise_id: string | null;
  alternative_name: string | null;
  alternative_equipment: string | null;
  position: number;
};

type DefaultExercise = Omit<PlanExercise, "id" | "position">;

const emptyExerciseDefaults = {
  minReps: 0,
  maxReps: 0,
  minDurationSeconds: 0,
  maxDurationSeconds: 0,
  restSeconds: 90,
  speedMin: null,
  speedMax: null,
  notes: "",
  alternativeExerciseId: null,
  alternativeName: null,
  alternativeEquipment: null,
} as const;

function weighted(exerciseId: string, name: string, equipment: string, muscleGroup: string, minSets = 3, maxSets = 3, minReps = 10, maxReps = 12, weightMode: WeightMode = "total"): DefaultExercise {
  return { ...emptyExerciseDefaults, exerciseId, name, equipment, muscleGroup, trackingType: "weight_reps", weightMode, minSets, maxSets, minReps, maxReps, restSeconds: restSecondsForSets(maxSets) };
}

function duration(exerciseId: string, name: string, equipment: string, muscleGroup: string, minSeconds: number, maxSeconds: number, minSets = 1, maxSets = 1, trackingType: TrackingType = "duration"): DefaultExercise {
  return { ...emptyExerciseDefaults, exerciseId, name, equipment, muscleGroup, trackingType, weightMode: "none", minSets, maxSets, minDurationSeconds: minSeconds, maxDurationSeconds: maxSeconds, restSeconds: restSecondsForSets(maxSets) };
}

function bodyweightReps(exerciseId: string, name: string, muscleGroup: string, minSets: number, maxSets: number, minReps: number, maxReps: number): DefaultExercise {
  return { ...emptyExerciseDefaults, exerciseId, name, equipment: "垫子", muscleGroup, trackingType: "bodyweight_reps", weightMode: "none", minSets, maxSets, minReps, maxReps, restSeconds: restSecondsForSets(maxSets) };
}

const defaultDays: Array<{ weekday: number; name: string; focus: string; enabled: boolean; exercises: DefaultExercise[] }> = [
  {
    weekday: 1,
    name: "全身 A",
    focus: "腿 + 胸 + 背",
    enabled: true,
    exercises: [
      { ...duration("treadmill-warmup", "跑步机热身", "跑步机", "热身", 5 * 60, 8 * 60), speedMin: 4.5, speedMax: 5.2, notes: "逐步提高心率，不需要跑起来" },
      weighted("leg-press-45", "45 度倒蹬", "45 度倒蹬机", "腿部"),
      weighted("seated-chest-press", "坐姿推胸", "坐姿推胸机", "胸部", 3, 3, 10, 12, "per_side"),
      weighted("lat-pulldown", "高位下拉", "高位下拉机", "背部"),
      weighted("seated-leg-curl", "坐姿腿弯举", "坐姿腿弯举机", "腿后侧", 2, 3),
      duration("plank", "平板支撑", "垫子", "核心", 30, 60, 3, 3, "bodyweight_duration"),
      { ...duration("incline-walk", "爬坡", "跑步机", "有氧", 20 * 60, 25 * 60), notes: "保持可以短句交流的强度" },
    ],
  },
  { weekday: 2, name: "", focus: "", enabled: false, exercises: [] },
  {
    weekday: 3,
    name: "全身 B",
    focus: "背 + 臀 + 肩",
    enabled: true,
    exercises: [
      duration("treadmill-warmup", "跑步机热身", "跑步机", "热身", 5 * 60, 8 * 60),
      weighted("seated-row", "坐姿划船", "划船机", "背部"),
      weighted("hip-thrust", "臀推", "臀推机", "臀腿"),
      weighted("seated-shoulder-press", "坐姿推肩", "坐姿推肩机", "肩部", 3, 3, 10, 12, "per_side"),
      weighted("hip-abduction", "髋外展", "开合腿机", "臀部", 2, 3, 12, 15),
      weighted("face-pull", "面拉", "龙门架", "肩后束", 2, 3, 12, 15),
      bodyweightReps("dead-bug", "死虫", "核心", 3, 3, 10, 12),
    ],
  },
  { weekday: 4, name: "", focus: "", enabled: false, exercises: [] },
  {
    weekday: 5,
    name: "全身 C",
    focus: "腿 + 胸 + 背",
    enabled: true,
    exercises: [
      duration("treadmill-warmup", "跑步机热身", "跑步机", "热身", 5 * 60, 8 * 60),
      { ...weighted("hack-squat", "哈克深蹲", "哈克深蹲机", "腿部"), alternativeExerciseId: "leg-press-45", alternativeName: "45 度倒蹬", alternativeEquipment: "45 度倒蹬机" },
      weighted("incline-chest-press", "上斜推胸", "上斜推胸机", "胸部", 3, 3, 10, 12, "per_side"),
      { ...weighted("lat-pulldown", "高位下拉", "高位下拉机", "背部"), alternativeExerciseId: "seated-row", alternativeName: "坐姿划船", alternativeEquipment: "划船机" },
      weighted("leg-extension", "腿屈伸", "腿屈伸机", "股四头肌", 2, 2, 12, 15),
      weighted("triceps-pushdown", "绳索下压", "龙门架", "肱三头肌", 2, 2, 12, 15),
      bodyweightReps("crunch", "卷腹", "核心", 3, 3, 12, 15),
    ],
  },
  { weekday: 6, name: "", focus: "", enabled: false, exercises: [] },
  { weekday: 7, name: "", focus: "", enabled: false, exercises: [] },
];

function mapExercise(row: ExerciseRow): PlanExercise {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    name: row.name,
    equipment: row.equipment,
    muscleGroup: row.muscle_group,
    trackingType: row.tracking_type,
    weightMode: row.weight_mode,
    minSets: row.min_sets,
    maxSets: row.max_sets,
    minReps: row.min_reps,
    maxReps: row.max_reps,
    minDurationSeconds: row.min_duration_seconds,
    maxDurationSeconds: row.max_duration_seconds,
    restSeconds: restSecondsForSets(row.max_sets),
    speedMin: row.speed_min,
    speedMax: row.speed_max,
    notes: row.notes,
    alternativeExerciseId: row.alternative_exercise_id,
    alternativeName: row.alternative_name,
    alternativeEquipment: row.alternative_equipment,
    position: row.position,
  };
}

async function readPlan(userId: string, row: PlanRow): Promise<TrainingPlan> {
  const database = getD1();
  const [dayResult, exerciseResult] = await Promise.all([
    database.prepare("SELECT id, weekday, name, focus, enabled, position FROM training_plan_days WHERE plan_id = ? AND user_id = ? ORDER BY position").bind(row.id, userId).all<DayRow>(),
    database.prepare(
      `SELECT training_plan_exercises.* FROM training_plan_exercises
       JOIN training_plan_days ON training_plan_days.id = training_plan_exercises.plan_day_id
       WHERE training_plan_days.plan_id = ? AND training_plan_exercises.user_id = ?
       ORDER BY training_plan_exercises.position`,
    ).bind(row.id, userId).all<ExerciseRow>(),
  ]);
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    updatedAt: row.updated_at,
    days: dayResult.results.map((day) => {
      const enabled = Boolean(day.enabled);
      const exercises = exerciseResult.results.filter((exercise) => exercise.plan_day_id === day.id).map(mapExercise);
      return {
        id: day.id,
        weekday: day.weekday,
        name: normalizeLegacyTrainingDayName(day.name, enabled, exercises.length),
        focus: normalizeLegacyTrainingDayFocus(day.focus, enabled, exercises.length),
        enabled,
        position: day.position,
        exercises,
      };
    }),
  };
}

async function createDefaultPlan(userId: string): Promise<PlanRow> {
  const database = getD1();
  const now = Date.now();
  const plan: PlanRow = { id: crypto.randomUUID(), name: "每周训练计划", version: 1, updated_at: now };
  const statements = [
    database.prepare("INSERT INTO training_plans (id, user_id, name, is_active, version, created_at, updated_at) VALUES (?, ?, ?, 1, 1, ?, ?)").bind(plan.id, userId, plan.name, now, now),
  ];
  for (const [dayIndex, day] of defaultDays.entries()) {
    const dayId = crypto.randomUUID();
    statements.push(database.prepare(
      "INSERT INTO training_plan_days (id, plan_id, user_id, weekday, name, focus, enabled, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(dayId, plan.id, userId, day.weekday, day.name, day.focus, day.enabled ? 1 : 0, dayIndex));
    for (const [exerciseIndex, exercise] of day.exercises.entries()) {
      statements.push(database.prepare(
        `INSERT INTO training_plan_exercises
         (id, plan_day_id, user_id, exercise_id, name, equipment, muscle_group, tracking_type, weight_mode,
          min_sets, max_sets, min_reps, max_reps, min_duration_seconds, max_duration_seconds, rest_seconds,
          speed_min, speed_max, notes, alternative_exercise_id, alternative_name, alternative_equipment, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), dayId, userId, exercise.exerciseId, exercise.name, exercise.equipment, exercise.muscleGroup, exercise.trackingType, exercise.weightMode,
        exercise.minSets, exercise.maxSets, exercise.minReps, exercise.maxReps, exercise.minDurationSeconds, exercise.maxDurationSeconds, exercise.restSeconds,
        exercise.speedMin, exercise.speedMax, exercise.notes, exercise.alternativeExerciseId, exercise.alternativeName, exercise.alternativeEquipment, exerciseIndex));
    }
  }
  await database.batch(statements);
  return plan;
}

export async function getActivePlan(userId: string): Promise<TrainingPlan> {
  await ensureDatabase();
  const database = getD1();
  let row = await database.prepare(
    "SELECT id, name, version, updated_at FROM training_plans WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1",
  ).bind(userId).first<PlanRow>();
  if (!row) row = await createDefaultPlan(userId);
  return readPlan(userId, row);
}

export async function replaceActivePlan(userId: string, input: TrainingPlan): Promise<TrainingPlan | null> {
  await ensureDatabase();
  const database = getD1();
  const existing = await database.prepare(
    "SELECT id, name, version, updated_at FROM training_plans WHERE id = ? AND user_id = ? AND is_active = 1",
  ).bind(input.id, userId).first<PlanRow>();
  if (!existing || existing.version !== input.version) return null;

  const [dayResult, exerciseResult] = await Promise.all([
    database.prepare(
      "SELECT id, weekday FROM training_plan_days WHERE plan_id = ? AND user_id = ?",
    ).bind(input.id, userId).all<{ id: string; weekday: number }>(),
    database.prepare(
      `SELECT training_plan_exercises.id, training_plan_exercises.plan_day_id
       FROM training_plan_exercises
       JOIN training_plan_days ON training_plan_days.id = training_plan_exercises.plan_day_id
       WHERE training_plan_days.plan_id = ? AND training_plan_exercises.user_id = ?`,
    ).bind(input.id, userId).all<{ id: string; plan_day_id: string }>(),
  ]);
  const existingDaysById = new Map(dayResult.results.map((day) => [day.id, day]));
  const existingDaysByWeekday = new Map(dayResult.results.map((day) => [day.weekday, day]));
  const existingExerciseIds = new Set(exerciseResult.results.map((exercise) => exercise.id));
  const inputDayIds = new Set(input.days.map((day) => day.id));
  const inputExercises = input.days.flatMap((day) => day.exercises.map((exercise) => ({ day, exercise })));
  const inputExerciseIds = new Set(inputExercises.map(({ exercise }) => exercise.id));

  // 训练日的业务身份绑定星期；普通编辑不允许用新 ID 偷换已有训练日。
  for (const day of input.days) {
    const currentDay = existingDaysByWeekday.get(day.weekday);
    if (currentDay && currentDay.id !== day.id) return null;
    const currentIdentity = existingDaysById.get(day.id);
    if (currentIdentity && currentIdentity.weekday !== day.weekday) return null;
  }

  async function hasForeignIdentity(table: "training_plan_days" | "training_plan_exercises", ids: string[]): Promise<boolean> {
    for (let offset = 0; offset < ids.length; offset += 50) {
      const chunk = ids.slice(offset, offset + 50);
      if (!chunk.length) continue;
      const placeholders = chunk.map(() => "?").join(", ");
      const found = await database.prepare(`SELECT id FROM ${table} WHERE id IN (${placeholders}) LIMIT 1`).bind(...chunk).first<{ id: string }>();
      if (found) return true;
    }
    return false;
  }

  const newDayIds = input.days.filter((day) => !existingDaysById.has(day.id)).map((day) => day.id);
  const newExerciseIds = inputExercises.filter(({ exercise }) => !existingExerciseIds.has(exercise.id)).map(({ exercise }) => exercise.id);
  if (await hasForeignIdentity("training_plan_days", newDayIds) || await hasForeignIdentity("training_plan_exercises", newExerciseIds)) return null;

  const now = Date.now();
  const nextVersion = existing.version + 1;
  const statements: D1PreparedStatement[] = [];
  for (const [dayIndex, day] of input.days.entries()) {
    const dayId = day.id;
    if (existingDaysById.has(dayId)) {
      statements.push(database.prepare(
        `UPDATE training_plan_days SET name = ?, focus = ?, enabled = ?, position = ?
         WHERE id = ? AND plan_id = ? AND user_id = ?
           AND EXISTS (SELECT 1 FROM training_plans WHERE id = ? AND user_id = ? AND version = ?)`,
      ).bind(day.name, day.focus, day.enabled ? 1 : 0, dayIndex, dayId, input.id, userId, input.id, userId, existing.version));
    } else {
      statements.push(database.prepare(
        `INSERT INTO training_plan_days (id, plan_id, user_id, weekday, name, focus, enabled, position)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM training_plans WHERE id = ? AND user_id = ? AND version = ?)`,
      ).bind(dayId, input.id, userId, day.weekday, day.name, day.focus, day.enabled ? 1 : 0, dayIndex, input.id, userId, existing.version));
    }
    for (const [exerciseIndex, exercise] of day.exercises.entries()) {
      if (existingExerciseIds.has(exercise.id)) {
        statements.push(database.prepare(
          `UPDATE training_plan_exercises SET plan_day_id = ?, exercise_id = ?, name = ?, equipment = ?, muscle_group = ?, tracking_type = ?, weight_mode = ?,
           min_sets = ?, max_sets = ?, min_reps = ?, max_reps = ?, min_duration_seconds = ?, max_duration_seconds = ?, rest_seconds = ?,
           speed_min = ?, speed_max = ?, notes = ?, alternative_exercise_id = ?, alternative_name = ?, alternative_equipment = ?, position = ?
           WHERE id = ? AND user_id = ?
             AND EXISTS (SELECT 1 FROM training_plans WHERE id = ? AND user_id = ? AND version = ?)`,
        ).bind(dayId, exercise.exerciseId, exercise.name, exercise.equipment, exercise.muscleGroup, exercise.trackingType, exercise.weightMode,
          exercise.minSets, exercise.maxSets, exercise.minReps, exercise.maxReps, exercise.minDurationSeconds, exercise.maxDurationSeconds, exercise.restSeconds,
          exercise.speedMin, exercise.speedMax, exercise.notes, exercise.alternativeExerciseId, exercise.alternativeName, exercise.alternativeEquipment, exerciseIndex,
          exercise.id, userId, input.id, userId, existing.version));
      } else {
        statements.push(database.prepare(
          `INSERT INTO training_plan_exercises
           (id, plan_day_id, user_id, exercise_id, name, equipment, muscle_group, tracking_type, weight_mode,
            min_sets, max_sets, min_reps, max_reps, min_duration_seconds, max_duration_seconds, rest_seconds,
            speed_min, speed_max, notes, alternative_exercise_id, alternative_name, alternative_equipment, position)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE EXISTS (SELECT 1 FROM training_plans WHERE id = ? AND user_id = ? AND version = ?)`,
        ).bind(exercise.id, dayId, userId, exercise.exerciseId, exercise.name, exercise.equipment, exercise.muscleGroup, exercise.trackingType, exercise.weightMode,
          exercise.minSets, exercise.maxSets, exercise.minReps, exercise.maxReps, exercise.minDurationSeconds, exercise.maxDurationSeconds, exercise.restSeconds,
          exercise.speedMin, exercise.speedMax, exercise.notes, exercise.alternativeExerciseId, exercise.alternativeName, exercise.alternativeEquipment, exerciseIndex,
          input.id, userId, existing.version));
      }
    }
  }
  for (const exercise of exerciseResult.results) {
    if (!inputExerciseIds.has(exercise.id)) {
      statements.push(database.prepare(
        `DELETE FROM training_plan_exercises WHERE id = ? AND user_id = ?
         AND EXISTS (SELECT 1 FROM training_plans WHERE id = ? AND user_id = ? AND version = ?)`,
      ).bind(exercise.id, userId, input.id, userId, existing.version));
    }
  }
  for (const day of dayResult.results) {
    if (!inputDayIds.has(day.id)) {
      statements.push(database.prepare(
        `DELETE FROM training_plan_days WHERE id = ? AND plan_id = ? AND user_id = ?
         AND EXISTS (SELECT 1 FROM training_plans WHERE id = ? AND user_id = ? AND version = ?)`,
      ).bind(day.id, input.id, userId, input.id, userId, existing.version));
    }
  }
  statements.push(database.prepare(
    "UPDATE training_plans SET name = ?, version = ?, updated_at = ? WHERE id = ? AND user_id = ? AND version = ?",
  ).bind(input.name, nextVersion, now, input.id, userId, existing.version));
  const results = await database.batch(statements);
  const planUpdate = results.at(-1);
  if (!planUpdate?.success || Number(planUpdate.meta?.changes ?? 0) !== 1) return null;
  return readPlan(userId, { id: input.id, name: input.name, version: nextVersion, updated_at: now });
}

export function shanghaiWeekday(timestamp = Date.now()): number {
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", weekday: "short" }).format(new Date(timestamp));
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[label] ?? 1;
}

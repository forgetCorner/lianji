import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: integer("locked_until"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("users_username_unique").on(table.username)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_expiry_idx").on(table.userId, table.expiresAt),
  ],
);

export const inviteCodes = sqliteTable(
  "invite_codes",
  {
    id: text("id").primaryKey(),
    codeHash: text("code_hash").notNull(),
    label: text("label").notNull().default("好友邀请"),
    maxUses: integer("max_uses").notNull().default(1),
    usedCount: integer("used_count").notNull().default(0),
    expiresAt: integer("expires_at"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull(),
    disabledAt: integer("disabled_at"),
  },
  (table) => [
    uniqueIndex("invite_codes_code_hash_unique").on(table.codeHash),
    index("invite_codes_creator_idx").on(table.createdBy, table.createdAt),
  ],
);

export const workoutSessions = sqliteTable(
  "workout_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    planName: text("plan_name").notNull(),
    startedAt: integer("started_at").notNull(),
    completedAt: integer("completed_at"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    notes: text("notes").notNull().default(""),
    planId: text("plan_id"),
    planDayId: text("plan_day_id"),
    planVersion: integer("plan_version"),
    workoutType: text("workout_type").notNull().default("plan"),
    trainingDate: text("training_date"),
    finalizedAt: integer("finalized_at"),
    syncedPlanVersion: integer("synced_plan_version"),
    resumedAt: integer("resumed_at"),
  },
  (table) => [
    index("workout_sessions_user_started_idx").on(table.userId, table.startedAt),
    uniqueIndex("workout_sessions_user_plan_date_unique")
      .on(table.userId, table.trainingDate, table.workoutType)
      .where(sql`${table.trainingDate} IS NOT NULL AND ${table.workoutType} = 'plan'`),
  ],
);

export const workoutSets = sqliteTable(
  "workout_sets",
  {
    id: text("id").primaryKey(),
    workoutSessionId: text("workout_session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").notNull(),
    exerciseName: text("exercise_name").notNull(),
    muscleGroup: text("muscle_group").notNull().default(""),
    setIndex: integer("set_index").notNull(),
    weightKg: real("weight_kg").notNull(),
    reps: integer("reps").notNull(),
    completedAt: integer("completed_at").notNull(),
    workoutExerciseId: text("workout_exercise_id"),
    trackingType: text("tracking_type").notNull().default("weight_reps"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    speedKmh: real("speed_kmh"),
    inclinePercent: real("incline_percent"),
    leftWeightKg: real("left_weight_kg"),
    rightWeightKg: real("right_weight_kg"),
    effort: integer("effort"),
  },
  (table) => [
    uniqueIndex("workout_sets_workout_exercise_set_unique").on(table.workoutExerciseId, table.setIndex),
    index("workout_sets_session_idx").on(table.workoutSessionId),
    index("workout_sets_user_exercise_completed_idx").on(table.userId, table.exerciseId, table.completedAt),
  ],
);

export const trainingPlans = sqliteTable(
  "training_plans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isActive: integer("is_active").notNull().default(1),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("training_plans_user_active_idx").on(table.userId, table.isActive)],
);

export const trainingPlanScheduleRevisions = sqliteTable(
  "training_plan_schedule_revisions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => trainingPlans.id, { onDelete: "cascade" }),
    planVersion: integer("plan_version").notNull(),
    effectiveAt: integer("effective_at").notNull(),
    enabledWeekdays: text("enabled_weekdays").notNull().default("[]"),
  },
  (table) => [
    uniqueIndex("training_plan_schedule_revisions_plan_version_unique").on(table.planId, table.planVersion),
    index("training_plan_schedule_revisions_user_effective_idx").on(table.userId, table.effectiveAt),
  ],
);

export const trainingPlanDays = sqliteTable(
  "training_plan_days",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id").notNull().references(() => trainingPlans.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    name: text("name").notNull(),
    focus: text("focus").notNull().default(""),
    enabled: integer("enabled").notNull().default(0),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("training_plan_days_plan_weekday_unique").on(table.planId, table.weekday),
    index("training_plan_days_user_idx").on(table.userId, table.weekday),
  ],
);

export const trainingPlanExercises = sqliteTable(
  "training_plan_exercises",
  {
    id: text("id").primaryKey(),
    planDayId: text("plan_day_id").notNull().references(() => trainingPlanDays.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").notNull(),
    name: text("name").notNull(),
    equipment: text("equipment").notNull().default(""),
    muscleGroup: text("muscle_group").notNull().default(""),
    trackingType: text("tracking_type").notNull().default("weight_reps"),
    weightMode: text("weight_mode").notNull().default("total"),
    minSets: integer("min_sets").notNull().default(3),
    maxSets: integer("max_sets").notNull().default(3),
    minReps: integer("min_reps").notNull().default(10),
    maxReps: integer("max_reps").notNull().default(12),
    minDurationSeconds: integer("min_duration_seconds").notNull().default(0),
    maxDurationSeconds: integer("max_duration_seconds").notNull().default(0),
    restSeconds: integer("rest_seconds").notNull().default(90),
    speedMin: real("speed_min"),
    speedMax: real("speed_max"),
    notes: text("notes").notNull().default(""),
    alternativeExerciseId: text("alternative_exercise_id"),
    alternativeName: text("alternative_name"),
    alternativeEquipment: text("alternative_equipment"),
    position: integer("position").notNull(),
  },
  (table) => [index("training_plan_exercises_day_position_idx").on(table.planDayId, table.position)],
);

export const customExercises = sqliteTable(
  "custom_exercises",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    equipment: text("equipment").notNull().default(""),
    muscleGroup: text("muscle_group").notNull().default(""),
    trackingType: text("tracking_type").notNull().default("weight_reps"),
    weightMode: text("weight_mode").notNull().default("total"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("custom_exercises_user_name_unique").on(table.userId, table.name)],
);

export const workoutExercises = sqliteTable(
  "workout_exercises",
  {
    id: text("id").primaryKey(),
    workoutSessionId: text("workout_session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    planExerciseId: text("plan_exercise_id"),
    exerciseId: text("exercise_id").notNull(),
    name: text("name").notNull(),
    equipment: text("equipment").notNull().default(""),
    muscleGroup: text("muscle_group").notNull().default(""),
    trackingType: text("tracking_type").notNull().default("weight_reps"),
    weightMode: text("weight_mode").notNull().default("total"),
    minSets: integer("min_sets").notNull(),
    maxSets: integer("max_sets").notNull(),
    minReps: integer("min_reps").notNull().default(0),
    maxReps: integer("max_reps").notNull().default(0),
    minDurationSeconds: integer("min_duration_seconds").notNull().default(0),
    maxDurationSeconds: integer("max_duration_seconds").notNull().default(0),
    restSeconds: integer("rest_seconds").notNull().default(90),
    speedMin: real("speed_min"),
    speedMax: real("speed_max"),
    notes: text("notes").notNull().default(""),
    alternativeExerciseId: text("alternative_exercise_id"),
    alternativeName: text("alternative_name"),
    alternativeEquipment: text("alternative_equipment"),
    position: integer("position").notNull(),
    skipped: integer("skipped").notNull().default(0),
    completedAt: integer("completed_at"),
    removedFromPlanAt: integer("removed_from_plan_at"),
  },
  (table) => [
    index("workout_exercises_session_position_idx").on(table.workoutSessionId, table.position),
    uniqueIndex("workout_exercises_session_plan_unique")
      .on(table.workoutSessionId, table.planExerciseId)
      .where(sql`${table.planExerciseId} IS NOT NULL`),
    index("workout_exercises_user_session_idx").on(table.userId, table.workoutSessionId),
  ],
);

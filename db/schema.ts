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
  },
  (table) => [index("workout_sessions_user_started_idx").on(table.userId, table.startedAt)],
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
  },
  (table) => [
    uniqueIndex("workout_sets_session_exercise_set_unique").on(table.workoutSessionId, table.exerciseId, table.setIndex),
    index("workout_sets_user_exercise_completed_idx").on(table.userId, table.exerciseId, table.completedAt),
  ],
);

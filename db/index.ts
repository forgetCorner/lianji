import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    failed_login_count INTEGER DEFAULT 0 NOT NULL,
    locked_until INTEGER,
    created_at INTEGER NOT NULL
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)",
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_unique ON sessions (token_hash)",
  "CREATE INDEX IF NOT EXISTS sessions_user_expiry_idx ON sessions (user_id, expires_at)",
  `CREATE TABLE IF NOT EXISTS invite_codes (
    id TEXT PRIMARY KEY NOT NULL,
    code_hash TEXT NOT NULL,
    label TEXT DEFAULT '好友邀请' NOT NULL,
    max_uses INTEGER DEFAULT 1 NOT NULL,
    used_count INTEGER DEFAULT 0 NOT NULL,
    expires_at INTEGER,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    disabled_at INTEGER
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS invite_codes_code_hash_unique ON invite_codes (code_hash)",
  "CREATE INDEX IF NOT EXISTS invite_codes_creator_idx ON invite_codes (created_by, created_at)",
  `CREATE TABLE IF NOT EXISTS workout_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    duration_seconds INTEGER DEFAULT 0 NOT NULL,
    notes TEXT DEFAULT '' NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS workout_sessions_user_started_idx ON workout_sessions (user_id, started_at)",
  `CREATE TABLE IF NOT EXISTS workout_sets (
    id TEXT PRIMARY KEY NOT NULL,
    workout_session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    exercise_name TEXT NOT NULL,
    muscle_group TEXT DEFAULT '' NOT NULL,
    set_index INTEGER NOT NULL,
    weight_kg REAL NOT NULL,
    reps INTEGER NOT NULL,
    completed_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS workout_sets_user_exercise_completed_idx ON workout_sets (user_id, exercise_id, completed_at)",
  `CREATE TABLE IF NOT EXISTS training_plans (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS training_plans_user_active_idx ON training_plans (user_id, is_active)",
  `CREATE TABLE IF NOT EXISTS training_plan_days (
    id TEXT PRIMARY KEY NOT NULL,
    plan_id TEXT NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL,
    name TEXT NOT NULL,
    focus TEXT DEFAULT '' NOT NULL,
    enabled INTEGER DEFAULT 0 NOT NULL,
    position INTEGER NOT NULL
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS training_plan_days_plan_weekday_unique ON training_plan_days (plan_id, weekday)",
  "CREATE INDEX IF NOT EXISTS training_plan_days_user_idx ON training_plan_days (user_id, weekday)",
  `CREATE TABLE IF NOT EXISTS training_plan_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    plan_day_id TEXT NOT NULL REFERENCES training_plan_days(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    name TEXT NOT NULL,
    equipment TEXT DEFAULT '' NOT NULL,
    muscle_group TEXT DEFAULT '' NOT NULL,
    tracking_type TEXT DEFAULT 'weight_reps' NOT NULL,
    weight_mode TEXT DEFAULT 'total' NOT NULL,
    min_sets INTEGER DEFAULT 3 NOT NULL,
    max_sets INTEGER DEFAULT 3 NOT NULL,
    min_reps INTEGER DEFAULT 10 NOT NULL,
    max_reps INTEGER DEFAULT 12 NOT NULL,
    min_duration_seconds INTEGER DEFAULT 0 NOT NULL,
    max_duration_seconds INTEGER DEFAULT 0 NOT NULL,
    rest_seconds INTEGER DEFAULT 90 NOT NULL,
    speed_min REAL,
    speed_max REAL,
    notes TEXT DEFAULT '' NOT NULL,
    alternative_exercise_id TEXT,
    alternative_name TEXT,
    alternative_equipment TEXT,
    position INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS training_plan_exercises_day_position_idx ON training_plan_exercises (plan_day_id, position)",
  `CREATE TABLE IF NOT EXISTS custom_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    equipment TEXT DEFAULT '' NOT NULL,
    muscle_group TEXT DEFAULT '' NOT NULL,
    tracking_type TEXT DEFAULT 'weight_reps' NOT NULL,
    weight_mode TEXT DEFAULT 'total' NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS custom_exercises_user_name_unique ON custom_exercises (user_id, name)",
  `CREATE TABLE IF NOT EXISTS workout_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    workout_session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_exercise_id TEXT,
    exercise_id TEXT NOT NULL,
    name TEXT NOT NULL,
    equipment TEXT DEFAULT '' NOT NULL,
    muscle_group TEXT DEFAULT '' NOT NULL,
    tracking_type TEXT DEFAULT 'weight_reps' NOT NULL,
    weight_mode TEXT DEFAULT 'total' NOT NULL,
    min_sets INTEGER NOT NULL,
    max_sets INTEGER NOT NULL,
    min_reps INTEGER DEFAULT 0 NOT NULL,
    max_reps INTEGER DEFAULT 0 NOT NULL,
    min_duration_seconds INTEGER DEFAULT 0 NOT NULL,
    max_duration_seconds INTEGER DEFAULT 0 NOT NULL,
    rest_seconds INTEGER DEFAULT 90 NOT NULL,
    speed_min REAL,
    speed_max REAL,
    notes TEXT DEFAULT '' NOT NULL,
    alternative_exercise_id TEXT,
    alternative_name TEXT,
    alternative_equipment TEXT,
    position INTEGER NOT NULL,
    skipped INTEGER DEFAULT 0 NOT NULL,
    completed_at INTEGER
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS workout_exercises_session_position_unique ON workout_exercises (workout_session_id, position)",
  "CREATE INDEX IF NOT EXISTS workout_exercises_user_session_idx ON workout_exercises (user_id, workout_session_id)",
] as const;

let initialization: Promise<void> | null = null;

export function getD1() {
  const database = (env as unknown as { DB?: D1Database }).DB;
  if (!database) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable. Set .openai/hosting.json d1 to DB.");
  }
  return database;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

export async function ensureDatabase(): Promise<void> {
  if (!initialization) {
    const database = getD1();
    initialization = (async () => {
      await database.batch(schemaStatements.map((statement) => database.prepare(statement)));

      const sessionColumns = await database.prepare("PRAGMA table_info(workout_sessions)").all<{ name: string }>();
      const setColumns = await database.prepare("PRAGMA table_info(workout_sets)").all<{ name: string }>();
      const sessionColumnNames = new Set(sessionColumns.results.map((column) => column.name));
      const setColumnNames = new Set(setColumns.results.map((column) => column.name));
      const additions: D1PreparedStatement[] = [];

      if (!sessionColumnNames.has("plan_id")) additions.push(database.prepare("ALTER TABLE workout_sessions ADD COLUMN plan_id TEXT"));
      if (!sessionColumnNames.has("plan_day_id")) additions.push(database.prepare("ALTER TABLE workout_sessions ADD COLUMN plan_day_id TEXT"));
      if (!sessionColumnNames.has("plan_version")) additions.push(database.prepare("ALTER TABLE workout_sessions ADD COLUMN plan_version INTEGER"));
      if (!setColumnNames.has("workout_exercise_id")) additions.push(database.prepare("ALTER TABLE workout_sets ADD COLUMN workout_exercise_id TEXT"));
      if (!setColumnNames.has("tracking_type")) additions.push(database.prepare("ALTER TABLE workout_sets ADD COLUMN tracking_type TEXT DEFAULT 'weight_reps' NOT NULL"));
      if (!setColumnNames.has("duration_seconds")) additions.push(database.prepare("ALTER TABLE workout_sets ADD COLUMN duration_seconds INTEGER DEFAULT 0 NOT NULL"));
      if (!setColumnNames.has("left_weight_kg")) additions.push(database.prepare("ALTER TABLE workout_sets ADD COLUMN left_weight_kg REAL"));
      if (!setColumnNames.has("right_weight_kg")) additions.push(database.prepare("ALTER TABLE workout_sets ADD COLUMN right_weight_kg REAL"));
      if (!setColumnNames.has("effort")) additions.push(database.prepare("ALTER TABLE workout_sets ADD COLUMN effort INTEGER"));
      if (additions.length) await database.batch(additions);
      await database.batch([
        database.prepare("DROP INDEX IF EXISTS workout_sets_session_exercise_set_unique"),
        database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS workout_sets_workout_exercise_set_unique ON workout_sets (workout_exercise_id, set_index)"),
      ]);
    })();
  }

  try {
    await initialization;
  } catch (error) {
    initialization = null;
    throw error;
  }
}

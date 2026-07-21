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
  "CREATE UNIQUE INDEX IF NOT EXISTS workout_sets_session_exercise_set_unique ON workout_sets (workout_session_id, exercise_id, set_index)",
  "CREATE INDEX IF NOT EXISTS workout_sets_user_exercise_completed_idx ON workout_sets (user_id, exercise_id, completed_at)",
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
    initialization = database.batch(schemaStatements.map((statement) => database.prepare(statement))).then(() => undefined);
  }

  try {
    await initialization;
  } catch (error) {
    initialization = null;
    throw error;
  }
}

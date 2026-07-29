import { ensureDatabase, getD1 } from "@/db";
import type {
  WorkoutHistoryPageResponse,
  WorkoutSummary,
} from "@/lib/workout-history";
import {
  encodeWorkoutHistoryCursor,
  type WorkoutHistoryCursor,
} from "@/lib/server/workout-history-cursor";

type WorkoutHistoryRow = WorkoutSummary;

type WorkoutHistoryPageOptions = {
  limit: number;
  cursor?: WorkoutHistoryCursor | null;
};

export async function getWorkoutHistoryPage(
  userId: string,
  { limit, cursor = null }: WorkoutHistoryPageOptions,
): Promise<WorkoutHistoryPageResponse> {
  await ensureDatabase();
  const safeLimit = Math.min(20, Math.max(1, Math.trunc(limit)));
  const cursorCondition = cursor
    ? "AND (workout_sessions.started_at < ? OR (workout_sessions.started_at = ? AND workout_sessions.id < ?))"
    : "";
  const statement = getD1().prepare(
    `WITH page AS (
       SELECT workout_sessions.id, workout_sessions.plan_name, workout_sessions.started_at,
         workout_sessions.completed_at, workout_sessions.duration_seconds
       FROM workout_sessions
       WHERE workout_sessions.user_id = ?
         AND workout_sessions.completed_at IS NOT NULL
         ${cursorCondition}
       ORDER BY workout_sessions.started_at DESC, workout_sessions.id DESC
       LIMIT ?
     )
     SELECT page.id, page.plan_name, page.started_at, page.completed_at, page.duration_seconds,
      COUNT(workout_sets.id) AS set_count,
      COALESCE(SUM(workout_sets.weight_kg * workout_sets.reps), 0) AS volume_kg
     FROM page
     LEFT JOIN workout_sets ON workout_sets.workout_session_id = page.id
     GROUP BY page.id
     ORDER BY page.started_at DESC, page.id DESC`,
  );
  const query = cursor
    ? statement.bind(
        userId,
        cursor.startedAt,
        cursor.startedAt,
        cursor.id,
        safeLimit + 1,
      )
    : statement.bind(userId, safeLimit + 1);
  const result = await query.all<WorkoutHistoryRow>();
  const workouts = result.results.slice(0, safeLimit);
  const hasMore = result.results.length > safeLimit;
  const lastWorkout = workouts.at(-1);

  return {
    workouts,
    pageInfo: {
      hasMore,
      nextCursor:
        hasMore && lastWorkout
          ? encodeWorkoutHistoryCursor({
              v: 1,
              startedAt: lastWorkout.started_at,
              id: lastWorkout.id,
            })
          : null,
    },
  };
}

import { ensureDatabase, getD1 } from "@/db";
import type { AuthUser } from "@/lib/server/auth";
import { getActivePlan, shanghaiWeekday } from "@/lib/server/plans";
import { finalizeExpiredPlanWorkouts } from "@/lib/server/workouts";
import { getWorkoutHistoryPage } from "@/lib/server/workout-history";
import { calculateScheduledTrainingStreak, countActiveWeeks, estimateOneRepMaxKg } from "@/lib/training-summary-domain";
import { INITIAL_WORKOUT_HISTORY_LIMIT } from "@/lib/workout-history";

type CompletedSessionRow = {
  id: string;
  completed_at: number;
  plan_day_id: string | null;
  training_date: string | null;
  workout_type: string;
};

type ActivityRow = {
  activity_date: string;
  plan_name: string;
  session_count: number;
  volume_kg: number;
};

type SetRow = {
  user_id: string;
  exercise_id: string;
  exercise_name: string;
  weight_kg: number;
  reps: number;
  completed_at: number;
};

type UserRow = { id: string; display_name: string };
type StrengthExerciseRow = {
  exercise_id: string;
  exercise_name: string;
};
type StrengthTrendRow = {
  exercise_id: string;
  exercise_name: string;
  trend_date: string;
  estimated_one_rep_max_kg: number;
  actual_max_weight_kg: number;
  latest_completed_at: number;
};
type ScheduleRevisionRow = {
  effective_at: number;
  enabled_weekdays: string;
};

const shanghaiDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dateKey(timestamp: number): string {
  return shanghaiDateFormatter.format(new Date(timestamp));
}

function dateToUtcDay(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

function startOfShanghaiWeek(now: number): number {
  const today = dateToUtcDay(dateKey(now));
  const day = new Date(today).getUTCDay() || 7;
  return today - (day - 1) * 24 * 60 * 60 * 1000 - 8 * 60 * 60 * 1000;
}

function weekKey(timestamp: number): string {
  const day = dateToUtcDay(dateKey(timestamp));
  const weekday = new Date(day).getUTCDay() || 7;
  return shanghaiDateFormatter.format(new Date(day - (weekday - 1) * 24 * 60 * 60 * 1000));
}

function bestStrengthByExercise(rows: SetRow[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const row of rows) {
    const e1rm = estimateOneRepMaxKg(row.weight_kg, row.reps);
    best.set(row.exercise_id, Math.max(best.get(row.exercise_id) ?? 0, e1rm));
  }
  return best;
}

function strengthTotal(rows: SetRow[]): number {
  return [...bestStrengthByExercise(rows).values()].reduce((sum, value) => sum + value, 0);
}

function buildLeaderboard(users: UserRow[], sets: SetRow[], now: number, currentUserId: string) {
  const currentStart = now - 28 * 24 * 60 * 60 * 1000;
  const baselineStart = now - 56 * 24 * 60 * 60 * 1000;
  return users.map((user) => {
    const userSets = sets.filter((row) => row.user_id === user.id);
    const baseline = strengthTotal(userSets.filter((row) => row.completed_at >= baselineStart && row.completed_at < currentStart));
    const currentRows = userSets.filter((row) => row.completed_at >= currentStart);
    const current = strengthTotal(currentRows);
    const progressPercent = baseline > 0 ? ((current - baseline) / baseline) * 100 : null;
    const stability = Math.min(100, new Set(currentRows.map((row) => weekKey(row.completed_at))).size * 25);
    const normalizedProgress = progressPercent === null ? 0 : Math.max(0, Math.min(100, ((progressPercent + 10) / 30) * 100));
    const score = normalizedProgress * 0.7 + stability * 0.3;
    return {
      userId: user.id,
      name: user.display_name,
      progressPercent: progressPercent === null ? null : Math.round(progressPercent * 10) / 10,
      stability,
      score: Math.round(score * 10) / 10,
      baselineStatus: baseline > 0 ? "ready" : "building",
      isCurrentUser: user.id === currentUserId,
    };
  }).sort((left, right) => right.score - left.score).map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function buildDashboard(user: AuthUser) {
  await ensureDatabase();
  await finalizeExpiredPlanWorkouts(user.id);
  const database = getD1();
  const plan = await getActivePlan(user.id);
  const now = Date.now();
  const fiftySixDaysAgo = now - 56 * 24 * 60 * 60 * 1000;
  const [
    recentWorkoutPage,
    completedSessionResult,
    activityResult,
    strengthExerciseResult,
    strengthTrendResult,
    rankingSetResult,
    userResult,
    scheduleRevisionResult,
  ] = await Promise.all([
    getWorkoutHistoryPage(user.id, { limit: INITIAL_WORKOUT_HISTORY_LIMIT }),
    database.prepare(
      `SELECT id, completed_at, plan_day_id, training_date, workout_type
       FROM workout_sessions
       WHERE user_id = ? AND completed_at IS NOT NULL
       ORDER BY completed_at`,
    ).bind(user.id).all<CompletedSessionRow>(),
    database.prepare(
      `SELECT
         COALESCE(
           workout_sessions.training_date,
           strftime('%Y-%m-%d', workout_sessions.completed_at / 1000, 'unixepoch', '+8 hours')
         ) AS activity_date,
         workout_sessions.plan_name,
         COUNT(DISTINCT workout_sessions.id) AS session_count,
         COALESCE(SUM(workout_sets.weight_kg * workout_sets.reps), 0) AS volume_kg
       FROM workout_sessions
       LEFT JOIN workout_sets ON workout_sets.workout_session_id = workout_sessions.id
       WHERE workout_sessions.user_id = ? AND workout_sessions.completed_at IS NOT NULL
       GROUP BY 1, workout_sessions.plan_name
       ORDER BY activity_date`,
    ).bind(user.id).all<ActivityRow>(),
    database.prepare(
      `WITH ranked_exercises AS (
         SELECT
           id,
           exercise_id,
           exercise_name,
           completed_at,
           ROW_NUMBER() OVER (
             PARTITION BY exercise_id
             ORDER BY completed_at DESC, id DESC
           ) AS recency_rank
         FROM workout_sets
         WHERE user_id = ?
       )
       SELECT exercise_id, exercise_name
       FROM ranked_exercises
       WHERE recency_rank = 1
       ORDER BY completed_at DESC, id DESC`,
    ).bind(user.id).all<StrengthExerciseRow>(),
    database.prepare(
      `WITH eligible_sets AS (
         SELECT id, exercise_id, exercise_name, weight_kg, reps, completed_at
         FROM workout_sets
         WHERE user_id = ?
           AND tracking_type = 'weight_reps'
           AND weight_kg > 0
           AND reps > 0
       ),
       ranked_exercises AS (
         SELECT
           exercise_id,
           exercise_name,
           completed_at,
           ROW_NUMBER() OVER (
             PARTITION BY exercise_id
             ORDER BY completed_at DESC, id DESC
           ) AS recency_rank
         FROM eligible_sets
       ),
       latest_exercises AS (
         SELECT
           exercise_id,
           exercise_name,
           completed_at AS latest_completed_at
         FROM ranked_exercises
         WHERE recency_rank = 1
       )
       SELECT
         latest_exercises.exercise_id,
         latest_exercises.exercise_name,
         strftime('%Y-%m-%d', eligible_sets.completed_at / 1000, 'unixepoch', '+8 hours') AS trend_date,
         MAX(eligible_sets.weight_kg * (1 + eligible_sets.reps / 30.0)) AS estimated_one_rep_max_kg,
         MAX(eligible_sets.weight_kg) AS actual_max_weight_kg,
         latest_exercises.latest_completed_at
       FROM latest_exercises
       JOIN eligible_sets
         ON eligible_sets.exercise_id = latest_exercises.exercise_id
       GROUP BY latest_exercises.exercise_id, latest_exercises.exercise_name, trend_date
       ORDER BY latest_exercises.latest_completed_at DESC, latest_exercises.exercise_id, trend_date`,
    ).bind(user.id).all<StrengthTrendRow>(),
    database.prepare(
      "SELECT user_id, exercise_id, exercise_name, weight_kg, reps, completed_at FROM workout_sets WHERE completed_at >= ? AND tracking_type = 'weight_reps' AND weight_kg > 0 AND reps > 0",
    ).bind(fiftySixDaysAgo).all<SetRow>(),
    database.prepare("SELECT id, display_name FROM users ORDER BY created_at").all<UserRow>(),
    database.prepare(
      `SELECT effective_at, enabled_weekdays
       FROM training_plan_schedule_revisions
       WHERE user_id = ?
       ORDER BY effective_at, plan_version`,
    ).bind(user.id).all<ScheduleRevisionRow>(),
  ]);

  const completedSessions = completedSessionResult.results;
  const weekStart = startOfShanghaiWeek(now);
  const weeklyCount = new Set(completedSessions.filter((session) => session.completed_at >= weekStart).map((session) => session.plan_day_id ?? session.id)).size;
  const completedDates = completedSessions.map((session) => session.training_date ?? dateKey(session.completed_at));
  const completedPlanDates = completedSessions
    .filter((session) => session.workout_type === "plan")
    .map((session) => session.training_date ?? dateKey(session.completed_at));
  const activity = new Map<string, { count: number; volumeKg: number; planNames: string[] }>();
  for (const row of activityResult.results) {
    const current = activity.get(row.activity_date) ?? { count: 0, volumeKg: 0, planNames: [] };
    current.count += row.session_count;
    current.volumeKg += row.volume_kg;
    if (!current.planNames.includes(row.plan_name)) current.planNames.push(row.plan_name);
    activity.set(row.activity_date, current);
  }
  const scheduleRevisions = scheduleRevisionResult.results.map((revision) => {
    let enabledWeekdays: number[] = [];
    try {
      const parsed = JSON.parse(revision.enabled_weekdays);
      if (Array.isArray(parsed)) enabledWeekdays = parsed.filter((value): value is number => Number.isInteger(value));
    } catch {
      enabledWeekdays = [];
    }
    return { effectiveAt: revision.effective_at, enabledWeekdays };
  });

  const trendExercises: {
    exerciseId: string;
    exerciseName: string;
    points: { date: string; estimatedOneRepMaxKg: number; actualMaxWeightKg: number }[];
  }[] = strengthExerciseResult.results.map((exercise) => ({
    exerciseId: exercise.exercise_id,
    exerciseName: exercise.exercise_name,
    points: [],
  }));
  const trendExerciseMap = new Map(trendExercises.map((exercise) => [exercise.exerciseId, exercise]));
  for (const point of strengthTrendResult.results) {
    let exercise = trendExerciseMap.get(point.exercise_id);
    if (!exercise) {
      exercise = { exerciseId: point.exercise_id, exerciseName: point.exercise_name, points: [] };
      trendExerciseMap.set(point.exercise_id, exercise);
      trendExercises.push(exercise);
    }
    exercise.points.push({
      date: point.trend_date,
      estimatedOneRepMaxKg: Math.round(point.estimated_one_rep_max_kg * 10) / 10,
      actualMaxWeightKg: Math.round(point.actual_max_weight_kg * 10) / 10,
    });
  }
  const defaultTrend = trendExercises.find((exercise) => exercise.points.length > 0) ?? trendExercises[0] ?? null;

  return {
    user,
    plan,
    todayPlan: plan.days.find((day) => day.enabled && day.exercises.length > 0 && day.weekday === shanghaiWeekday(now)) ?? null,
    summary: {
      weeklyCount,
      weeklyTarget: plan.days.filter((day) => day.enabled && day.exercises.length > 0).length,
      scheduledStreak: calculateScheduledTrainingStreak({ revisions: scheduleRevisions, completedDates: completedPlanDates, now }),
      totalWorkouts: completedSessions.length,
      activeWeeks: countActiveWeeks(completedDates),
    },
    lastSession: recentWorkoutPage.workouts[0] ?? null,
    activity: [...activity.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, entry]) => ({
        date,
        count: entry.count,
        volumeKg: Math.round(entry.volumeKg * 10) / 10,
        planNames: entry.planNames,
      })),
    recentWorkouts: recentWorkoutPage.workouts,
    recentWorkoutsPageInfo: recentWorkoutPage.pageInfo,
    trend: {
      exerciseId: defaultTrend?.exerciseId ?? null,
      exerciseName: defaultTrend?.exerciseName ?? null,
      points: defaultTrend?.points ?? [],
      exercises: trendExercises,
    },
    leaderboard: buildLeaderboard(userResult.results, rankingSetResult.results, now, user.id),
    syncedAt: now,
  };
}

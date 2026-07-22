import { ensureDatabase, getD1 } from "@/db";
import type { AuthUser } from "@/lib/server/auth";
import { getActivePlan, shanghaiWeekday } from "@/lib/server/plans";
import { finalizeExpiredPlanWorkouts } from "@/lib/server/workouts";

type SessionRow = {
  id: string;
  user_id: string;
  plan_name: string;
  started_at: number;
  completed_at: number | null;
  duration_seconds: number;
  set_count: number;
  volume_kg: number;
  plan_day_id: string | null;
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

function calculateStreak(sessions: SessionRow[], now: number): number {
  const activeDays = new Set(sessions.filter((session) => session.completed_at).map((session) => dateKey(session.completed_at!)));
  let cursor = dateToUtcDay(dateKey(now));
  if (!activeDays.has(dateKey(now))) cursor -= 24 * 60 * 60 * 1000;
  let streak = 0;
  while (activeDays.has(shanghaiDateFormatter.format(new Date(cursor)))) {
    streak += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }
  return streak;
}

function weekKey(timestamp: number): string {
  const day = dateToUtcDay(dateKey(timestamp));
  const weekday = new Date(day).getUTCDay() || 7;
  return shanghaiDateFormatter.format(new Date(day - (weekday - 1) * 24 * 60 * 60 * 1000));
}

function bestStrengthByExercise(rows: SetRow[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const row of rows) {
    const e1rm = row.weight_kg * (1 + row.reps / 30);
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
  const yearAgo = now - 366 * 24 * 60 * 60 * 1000;
  const fiftySixDaysAgo = now - 56 * 24 * 60 * 60 * 1000;
  const [sessionResult, currentSetResult, rankingSetResult, userResult] = await Promise.all([
    database.prepare(
      `SELECT workout_sessions.id, workout_sessions.user_id, workout_sessions.plan_name, workout_sessions.started_at,
        workout_sessions.completed_at, workout_sessions.duration_seconds, COUNT(workout_sets.id) AS set_count,
        COALESCE(SUM(workout_sets.weight_kg * workout_sets.reps), 0) AS volume_kg, workout_sessions.plan_day_id
       FROM workout_sessions LEFT JOIN workout_sets ON workout_sets.workout_session_id = workout_sessions.id
       WHERE workout_sessions.user_id = ? AND workout_sessions.started_at >= ?
       GROUP BY workout_sessions.id ORDER BY workout_sessions.started_at DESC`,
    ).bind(user.id, yearAgo).all<SessionRow>(),
    database.prepare(
      "SELECT user_id, exercise_id, exercise_name, weight_kg, reps, completed_at FROM workout_sets WHERE user_id = ? AND completed_at >= ? AND tracking_type = 'weight_reps' AND weight_kg > 0 AND reps > 0 ORDER BY completed_at",
    ).bind(user.id, yearAgo).all<SetRow>(),
    database.prepare(
      "SELECT user_id, exercise_id, exercise_name, weight_kg, reps, completed_at FROM workout_sets WHERE completed_at >= ? AND tracking_type = 'weight_reps' AND weight_kg > 0 AND reps > 0",
    ).bind(fiftySixDaysAgo).all<SetRow>(),
    database.prepare("SELECT id, display_name FROM users ORDER BY created_at").all<UserRow>(),
  ]);

  const sessions = sessionResult.results;
  const sets = currentSetResult.results;
  const completedSessions = sessions.filter((session) => session.completed_at);
  const weekStart = startOfShanghaiWeek(now);
  const weeklyCount = new Set(completedSessions.filter((session) => session.completed_at! >= weekStart).map((session) => session.plan_day_id ?? session.id)).size;
  const activity = new Map<string, number>();
  for (const session of completedSessions) {
    const key = dateKey(session.completed_at!);
    activity.set(key, (activity.get(key) ?? 0) + 1);
  }

  const trendExercise = sets.at(-1)?.exercise_id ?? null;
  const trendName = sets.at(-1)?.exercise_name ?? null;
  const trendByDay = new Map<string, number>();
  for (const set of sets.filter((row) => row.exercise_id === trendExercise)) {
    const key = dateKey(set.completed_at);
    const e1rm = set.weight_kg * (1 + set.reps / 30);
    trendByDay.set(key, Math.max(trendByDay.get(key) ?? 0, e1rm));
  }

  return {
    user,
    plan,
    todayPlan: plan.days.find((day) => day.enabled && day.exercises.length > 0 && day.weekday === shanghaiWeekday(now)) ?? null,
    summary: {
      weeklyCount,
      weeklyTarget: plan.days.filter((day) => day.enabled && day.exercises.length > 0).length,
      streak: calculateStreak(completedSessions, now),
      totalWorkouts: completedSessions.length,
    },
    lastSession: completedSessions[0] ?? null,
    activity: [...activity.entries()].map(([date, count]) => ({ date, count })),
    recentWorkouts: completedSessions.slice(0, 20),
    trend: {
      exerciseId: trendExercise,
      exerciseName: trendName,
      points: [...trendByDay.entries()].map(([date, value]) => ({ date, value: Math.round(value * 10) / 10 })),
    },
    leaderboard: buildLeaderboard(userResult.results, rankingSetResult.results, now, user.id),
    syncedAt: now,
  };
}

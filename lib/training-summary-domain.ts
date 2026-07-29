import { shanghaiDateKey } from "./daily-workout-domain.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const SHANGHAI_DAY_END_OFFSET_MS = 16 * 60 * 60 * 1000 - 1;

export type PlanScheduleRevision = {
  effectiveAt: number;
  enabledWeekdays: number[];
};

export function estimateOneRepMaxKg(weightKg: number, reps: number): number {
  if (
    !Number.isFinite(weightKg)
    || !Number.isFinite(reps)
    || weightKg <= 0
    || reps <= 0
  ) {
    return 0;
  }
  return weightKg * (1 + reps / 30);
}

function dateKeyToUtcDay(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function weekdayForDate(date: string): number {
  return new Date(dateKeyToUtcDay(date)).getUTCDay() || 7;
}

function shanghaiDayEnd(date: string): number {
  return dateKeyToUtcDay(date) + SHANGHAI_DAY_END_OFFSET_MS;
}

export function shanghaiWeekKey(date: string): string {
  const day = dateKeyToUtcDay(date);
  const weekday = new Date(day).getUTCDay() || 7;
  return new Date(day - (weekday - 1) * DAY_MS).toISOString().slice(0, 10);
}

export function countActiveWeeks(completedDates: string[]): number {
  return new Set(completedDates.map(shanghaiWeekKey)).size;
}

export function calculateScheduledTrainingStreak({
  revisions,
  completedDates,
  now = Date.now(),
}: {
  revisions: PlanScheduleRevision[];
  completedDates: string[];
  now?: number;
}): number {
  const orderedRevisions = revisions
    .filter((revision) => Number.isFinite(revision.effectiveAt))
    .map((revision) => ({
      effectiveAt: revision.effectiveAt,
      enabledWeekdays: [...new Set(revision.enabledWeekdays.filter((weekday) => weekday >= 1 && weekday <= 7))],
    }))
    .sort((left, right) => left.effectiveAt - right.effectiveAt);
  if (!orderedRevisions.length) return 0;

  const today = shanghaiDateKey(now);
  const firstReliableDate = shanghaiDateKey(orderedRevisions[0].effectiveAt);
  const completed = new Set(completedDates);
  const scheduledDates: string[] = [];
  let revisionIndex = -1;

  for (
    let cursor = dateKeyToUtcDay(firstReliableDate);
    cursor <= dateKeyToUtcDay(today);
    cursor += DAY_MS
  ) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    const dayEnd = shanghaiDayEnd(date);
    while (
      revisionIndex + 1 < orderedRevisions.length
      && orderedRevisions[revisionIndex + 1].effectiveAt <= dayEnd
    ) {
      revisionIndex += 1;
    }
    const revision = orderedRevisions[revisionIndex];
    if (revision?.enabledWeekdays.includes(weekdayForDate(date))) {
      scheduledDates.push(date);
    }
  }

  let streak = 0;
  for (let index = scheduledDates.length - 1; index >= 0; index -= 1) {
    const date = scheduledDates[index];
    if (date === today && !completed.has(date)) continue;
    if (!completed.has(date)) break;
    streak += 1;
  }
  return streak;
}

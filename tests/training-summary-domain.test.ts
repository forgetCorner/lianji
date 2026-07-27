import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateScheduledTrainingStreak,
  countActiveWeeks,
  shanghaiWeekKey,
} from "../lib/training-summary-domain.ts";

const mondayWednesdayFriday = [{
  effectiveAt: Date.parse("2026-07-01T00:00:00.000Z"),
  enabledWeekdays: [1, 3, 5],
}];

test("连续完成按计划训练机会统计并跳过休息日", () => {
  const streak = calculateScheduledTrainingStreak({
    revisions: mondayWednesdayFriday,
    completedDates: ["2026-07-20", "2026-07-22", "2026-07-24"],
    now: Date.parse("2026-07-26T08:00:00.000Z"),
  });
  assert.equal(streak, 3);
});

test("漏掉一次计划训练后从最近完成机会重新累计", () => {
  const streak = calculateScheduledTrainingStreak({
    revisions: mondayWednesdayFriday,
    completedDates: ["2026-07-20", "2026-07-24"],
    now: Date.parse("2026-07-26T08:00:00.000Z"),
  });
  assert.equal(streak, 1);
});

test("当天尚未结束时不因未训练提前中断连续完成", () => {
  const streak = calculateScheduledTrainingStreak({
    revisions: mondayWednesdayFriday,
    completedDates: ["2026-07-20", "2026-07-22", "2026-07-24"],
    now: Date.parse("2026-07-27T08:00:00.000Z"),
  });
  assert.equal(streak, 3);
});

test("当天完成计划训练后计入连续完成", () => {
  const streak = calculateScheduledTrainingStreak({
    revisions: mondayWednesdayFriday,
    completedDates: ["2026-07-20", "2026-07-22", "2026-07-24", "2026-07-27"],
    now: Date.parse("2026-07-27T08:00:00.000Z"),
  });
  assert.equal(streak, 4);
});

test("计划修改只影响版本生效后的训练机会", () => {
  const streak = calculateScheduledTrainingStreak({
    revisions: [
      ...mondayWednesdayFriday,
      {
        effectiveAt: Date.parse("2026-07-23T04:00:00.000Z"),
        enabledWeekdays: [2, 4],
      },
    ],
    completedDates: ["2026-07-20", "2026-07-22", "2026-07-23"],
    now: Date.parse("2026-07-26T08:00:00.000Z"),
  });
  assert.equal(streak, 3);
});

test("活跃周数按上海自然周去重", () => {
  assert.equal(shanghaiWeekKey("2026-07-26"), "2026-07-20");
  assert.equal(countActiveWeeks(["2026-07-20", "2026-07-24", "2026-07-27"]), 2);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  getCurrentWorkoutExercise,
  getDailyWorkoutStatus,
  isTrainingDateFinalized,
  nextShanghaiMidnight,
  reconcileExerciseMembership,
  shanghaiDateKey,
} from "../lib/daily-workout-domain.ts";

test("按上海时区划分训练日期和零点", () => {
  const beforeMidnight = Date.parse("2026-07-22T15:59:59.000Z");
  const afterMidnight = Date.parse("2026-07-22T16:00:00.000Z");
  assert.equal(shanghaiDateKey(beforeMidnight), "2026-07-22");
  assert.equal(shanghaiDateKey(afterMidnight), "2026-07-23");
  assert.equal(nextShanghaiMidnight(beforeMidnight), afterMidnight);
  assert.equal(isTrainingDateFinalized("2026-07-22", afterMidnight), true);
});

test("识别新增、恢复、移除和可安全更新动作", () => {
  const diff = reconcileExerciseMembership(
    [{ id: "keep" }, { id: "restore" }, { id: "update" }, { id: "add" }],
    [
      { planExerciseId: "keep", completedAt: 1, removedFromPlanAt: null, setCount: 3 },
      { planExerciseId: "restore", completedAt: null, removedFromPlanAt: 1, setCount: 0 },
      { planExerciseId: "update", completedAt: null, removedFromPlanAt: null, setCount: 0 },
      { planExerciseId: "remove", completedAt: null, removedFromPlanAt: null, setCount: 0 },
    ],
  );
  assert.deepEqual(diff, {
    add: ["add"],
    restore: ["restore"],
    remove: ["remove"],
    update: ["update"],
    keep: ["keep"],
  });
});

test("当天训练可在完成与进行中之间切换，跨日后冻结", () => {
  const now = Date.parse("2026-07-22T08:00:00.000Z");
  assert.equal(getDailyWorkoutStatus({ exists: false, trainingDate: null, finalizedAt: null, exercises: [] }, now), "not_started");
  assert.equal(getDailyWorkoutStatus({ exists: true, trainingDate: "2026-07-22", finalizedAt: null, exercises: [{ completedAt: 1, removedFromPlanAt: null }] }, now), "completed");
  assert.equal(getDailyWorkoutStatus({ exists: true, trainingDate: "2026-07-22", finalizedAt: null, exercises: [{ completedAt: null, removedFromPlanAt: null }] }, now), "in_progress");
  assert.equal(getDailyWorkoutStatus({ exists: true, trainingDate: "2026-07-21", finalizedAt: null, exercises: [{ completedAt: null, removedFromPlanAt: null }] }, now), "finalized");
});

test("删除最后一个未完成动作会完成当天训练，新增动作会重新开启", () => {
  const now = Date.parse("2026-07-22T08:00:00.000Z");
  const completed = { completedAt: 1, removedFromPlanAt: null };
  const remaining = { completedAt: null, removedFromPlanAt: null };
  assert.equal(getDailyWorkoutStatus({ exists: true, trainingDate: "2026-07-22", finalizedAt: null, exercises: [completed, remaining] }, now), "in_progress");
  assert.equal(getDailyWorkoutStatus({ exists: true, trainingDate: "2026-07-22", finalizedAt: null, exercises: [completed, { ...remaining, removedFromPlanAt: 1 }] }, now), "completed");
  assert.equal(getDailyWorkoutStatus({ exists: true, trainingDate: "2026-07-22", finalizedAt: null, exercises: [completed, { completedAt: null, removedFromPlanAt: null }] }, now), "in_progress");
});

test("当前动作必须真实存在，被移除动作不命中", () => {
  assert.equal(getCurrentWorkoutExercise([]), null);
  assert.equal(getCurrentWorkoutExercise([
    { id: "removed", completedAt: null, removedFromPlanAt: 1 },
    { id: "done", completedAt: 1, removedFromPlanAt: null },
    { id: "current", completedAt: null, removedFromPlanAt: null },
  ])?.id, "current");
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkoutSetProgress } from "../lib/workout-set-progress.ts";

test("单组动作使用单组模式且不生成多余节点", () => {
  const progress = buildWorkoutSetProgress({ minSets: 1, maxSets: 1, completedSets: 0 });
  assert.equal(progress.mode, "single");
  assert.equal(progress.goalLabel, "本动作仅 1 组");
  assert.equal(progress.statusLabel, "第 1 组进行中");
  assert.equal(progress.currentSet, 1);
  assert.deepEqual(progress.nodes, [
    { setNumber: 1, zone: "required", state: "current", startsOptionalZone: false },
  ]);
});

test("任意固定组数按计划动态生成节点", () => {
  const progress = buildWorkoutSetProgress({ minSets: 6, maxSets: 6, completedSets: 2 });
  assert.equal(progress.mode, "fixed");
  assert.equal(progress.goalLabel, "目标 6 组");
  assert.equal(progress.nodes.length, 6);
  assert.equal(progress.nodes[2]?.state, "current");
  assert.equal(progress.nodes.every((node) => node.zone === "required"), true);
});

test("弹性组数准确区分最低目标区和加练区", () => {
  const progress = buildWorkoutSetProgress({ minSets: 3, maxSets: 6, completedSets: 1 });
  assert.equal(progress.mode, "range");
  assert.equal(progress.goalLabel, "至少 3 组 · 最多 6 组");
  assert.deepEqual(progress.nodes.map((node) => node.zone), [
    "required", "required", "required", "optional", "optional", "optional",
  ]);
  assert.equal(progress.nodes[3]?.startsOptionalZone, true);
  assert.equal(progress.statusLabel, "第 2 组进行中");
});

test("达到最低目标后进入加练状态", () => {
  const progress = buildWorkoutSetProgress({ minSets: 2, maxSets: 5, completedSets: 2 });
  assert.equal(progress.reachedMinimum, true);
  assert.equal(progress.completed, false);
  assert.equal(progress.goalLabel, "已达最低目标 · 最多 5 组");
  assert.equal(progress.statusLabel, "第 3 组加练");
  assert.equal(progress.nodes[2]?.state, "current");
  assert.equal(progress.nodes[2]?.zone, "optional");
});

test("达到最大组数后完成动作且没有越界当前节点", () => {
  const progress = buildWorkoutSetProgress({ minSets: 2, maxSets: 4, completedSets: 8 });
  assert.equal(progress.completed, true);
  assert.equal(progress.currentSet, null);
  assert.equal(progress.statusLabel, "本动作已完成");
  assert.equal(progress.nodes.length, 4);
  assert.equal(progress.nodes.every((node) => node.state === "done"), true);
});

test("组数上限统一限制为六组", () => {
  const progress = buildWorkoutSetProgress({ minSets: 12, maxSets: 12, completedSets: 5 });
  assert.equal(progress.nodes.length, 6);
  assert.equal(progress.nodes[5]?.state, "current");
  assert.equal(progress.statusLabel, "第 6 组进行中");
});

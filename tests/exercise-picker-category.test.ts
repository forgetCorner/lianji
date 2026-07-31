import assert from "node:assert/strict";
import test from "node:test";
import {
  exerciseCategory,
  exerciseCategoryCounts,
  filterExerciseOptions,
} from "../lib/exercise-category.ts";
import { exerciseLibrary } from "../lib/training.ts";
import type { ExerciseDefinition } from "../lib/training.ts";

function exerciseIds(options: ExerciseDefinition[]): string[] {
  return options.map((option) => option.exerciseId);
}

test("固定动作库全部拥有明确分类", () => {
  assert.equal(exerciseLibrary.length, 18);
  assert.deepEqual(
    exerciseLibrary.filter((option) => exerciseCategory(option.exerciseId) === null),
    [],
  );
});

test("固定动作分类数量符合当前动作库", () => {
  assert.deepEqual(exerciseCategoryCounts(exerciseLibrary), {
    all: 18,
    strength: 13,
    cardio: 2,
    core: 3,
  });
});

test("有氧和核心动作按主要训练目的互斥归类", () => {
  assert.deepEqual(
    exerciseIds(filterExerciseOptions(exerciseLibrary, "", "cardio")),
    ["treadmill-warmup", "incline-walk"],
  );
  assert.deepEqual(
    exerciseIds(filterExerciseOptions(exerciseLibrary, "", "core")),
    ["plank", "dead-bug", "crunch"],
  );
});

test("其余固定动作全部归入力量且保持原始顺序", () => {
  assert.deepEqual(
    exerciseIds(filterExerciseOptions(exerciseLibrary, "", "strength")),
    [
      "leg-press-45",
      "seated-chest-press",
      "lat-pulldown",
      "seated-leg-curl",
      "seated-row",
      "hip-thrust",
      "seated-shoulder-press",
      "hip-abduction",
      "face-pull",
      "hack-squat",
      "incline-chest-press",
      "leg-extension",
      "triceps-pushdown",
    ],
  );
});

test("搜索继续匹配动作名称、器械和肌群", () => {
  assert.deepEqual(
    exerciseIds(filterExerciseOptions(exerciseLibrary, "哈克深蹲", "all")),
    ["hack-squat"],
  );
  assert.deepEqual(
    exerciseIds(filterExerciseOptions(exerciseLibrary, "跑步机", "all")),
    ["treadmill-warmup", "incline-walk"],
  );
  assert.deepEqual(
    exerciseIds(filterExerciseOptions(exerciseLibrary, "背部", "all")),
    ["lat-pulldown", "seated-row"],
  );
});

test("搜索与分类可以组合且无结果不回退", () => {
  assert.deepEqual(
    exerciseIds(filterExerciseOptions(exerciseLibrary, "垫子", "core")),
    ["plank", "dead-bug", "crunch"],
  );
  assert.deepEqual(
    filterExerciseOptions(exerciseLibrary, "跑步机", "strength"),
    [],
  );
});

test("未知动作只保留在全部中且不会改变固定分类计数", () => {
  const futureCustomExercise: ExerciseDefinition = {
    exerciseId: "custom-future",
    name: "后续自定义动作",
    equipment: "",
    muscleGroup: "",
    trackingType: "weight_reps",
    weightMode: "total",
  };
  const options = [...exerciseLibrary, futureCustomExercise];

  assert.equal(exerciseCategory(futureCustomExercise.exerciseId), null);
  assert.equal(filterExerciseOptions(options, "", "all").includes(futureCustomExercise), true);
  assert.equal(filterExerciseOptions(options, "", "strength").includes(futureCustomExercise), false);
  assert.deepEqual(exerciseCategoryCounts(options), {
    all: 19,
    strength: 13,
    cardio: 2,
    core: 3,
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_REST_SECONDS,
  hasTrainingPlanChanges,
  hasTrainingPlanSetCountDraftChanges,
  isInclineWalkExercise,
  normalizeLegacyTrainingDayFocus,
  normalizeLegacyTrainingDayName,
  restSecondsForSets,
  trainingDayDisplayName,
  validateInclineWalkMetrics,
} from "../lib/training.ts";
import type { TrainingPlan } from "../lib/training.ts";

test("空训练名称使用统一回退文案", () => {
  assert.equal(trainingDayDisplayName(""), "未命名训练");
  assert.equal(trainingDayDisplayName("   "), "未命名训练");
  assert.equal(trainingDayDisplayName("  全身 D  "), "全身 D");
});

test("只清理无动作休息日的旧系统默认名称", () => {
  assert.equal(normalizeLegacyTrainingDayName("训练日", false, 0), "");
  assert.equal(normalizeLegacyTrainingDayName("训练日", true, 0), "训练日");
  assert.equal(normalizeLegacyTrainingDayName("训练日", false, 2), "训练日");
  assert.equal(normalizeLegacyTrainingDayName("自定义训练", false, 0), "自定义训练");
});

test("只清理无动作休息日的旧训练重点默认值", () => {
  assert.equal(normalizeLegacyTrainingDayFocus("自定义", false, 0), "");
  assert.equal(normalizeLegacyTrainingDayFocus("自定义", true, 0), "自定义");
  assert.equal(normalizeLegacyTrainingDayFocus("自定义", false, 2), "自定义");
  assert.equal(normalizeLegacyTrainingDayFocus("腿 + 背", false, 0), "腿 + 背");
});

test("只有爬坡动作需要有效的实际速度和坡度", () => {
  assert.equal(isInclineWalkExercise("incline-walk"), true);
  assert.equal(isInclineWalkExercise("treadmill-warmup"), false);
  assert.equal(validateInclineWalkMetrics("treadmill-warmup", null, null), null);
  assert.equal(validateInclineWalkMetrics("incline-walk", 4.5, 5), null);
  assert.equal(validateInclineWalkMetrics("incline-walk", 50, 30), null);
  assert.equal(validateInclineWalkMetrics("incline-walk", null, 5), "爬坡速度应为 0 到 50 km/h");
  assert.equal(validateInclineWalkMetrics("incline-walk", 4.5, 31), "爬坡坡度应为 0% 到 30%");
});

test("固定一组不休息，多组动作统一休息九十秒", () => {
  assert.equal(DEFAULT_REST_SECONDS, 90);
  assert.equal(restSecondsForSets(1), 0);
  assert.equal(restSecondsForSets(2), 90);
  assert.equal(restSecondsForSets(6), 90);
});

test("周计划只有实际内容变化时才需要保存", () => {
  const saved: TrainingPlan = {
    id: "plan-1",
    name: "每周计划",
    version: 2,
    updatedAt: 100,
    days: [{
      id: "day-1",
      weekday: 1,
      name: "全身",
      focus: "腿 + 胸 + 背",
      enabled: true,
      position: 0,
      exercises: [{
        id: "plan-exercise-1",
        exerciseId: "seated-row",
        name: "坐姿划船",
        equipment: "划船机",
        muscleGroup: "背部",
        trackingType: "weight_reps",
        weightMode: "total",
        minSets: 2,
        maxSets: 3,
        minReps: 10,
        maxReps: 12,
        minDurationSeconds: 0,
        maxDurationSeconds: 0,
        restSeconds: 90,
        speedMin: null,
        speedMax: null,
        notes: "",
        alternativeExerciseId: null,
        alternativeName: null,
        alternativeEquipment: null,
        position: 0,
      }],
    }],
  };

  const current = structuredClone(saved);
  current.version = 3;
  current.updatedAt = 200;
  assert.equal(hasTrainingPlanChanges(current, saved), false);

  current.days[0].exercises[0].minSets = 3;
  assert.equal(hasTrainingPlanChanges(current, saved), true);

  current.days[0].exercises[0].minSets = 2;
  assert.equal(hasTrainingPlanChanges(current, saved), false);

  assert.equal(hasTrainingPlanSetCountDraftChanges(current, { "plan-exercise-1:min": "2" }), false);
  assert.equal(hasTrainingPlanSetCountDraftChanges(current, { "plan-exercise-1:min": "" }), true);
});
